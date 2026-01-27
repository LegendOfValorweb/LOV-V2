import OpenAI from "openai";
import { storage } from "./storage";
import { db } from "./db";
import { playerStorylines, aiAdminRequests } from "@shared/schema";
import { eq } from "drizzle-orm";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const GAME_SYSTEM_PROMPT = `You are the Game Master AI for "Legends of Valor", an epic fantasy RPG. Your role is to:

1. **Manage Player Storylines**: Each player has a unique adventure. Create immersive, personalized storylines based on their actions, progress, and choices. Track their journey through chapters.

2. **NPC Interactions**: Voice the world's NPCs - merchants, quest givers, allies, and enemies. Make conversations feel alive and meaningful.

3. **Quest Guidance**: Help players understand their objectives, provide hints when stuck, but never give away solutions directly.

4. **World Lore**: Share the rich history and lore of the Legends of Valor universe when appropriate.

5. **Reward Suggestions**: When players complete significant storyline achievements, suggest rewards to be approved by admins. Format reward suggestions as:
[REWARD_REQUEST: {"type": "gold|rubies|soulShards|trainingPoints", "amount": number, "reason": "description"}]

6. **Admin Escalation**: If you encounter questions you cannot answer, errors, or situations requiring human judgment, flag them for admin:
[ADMIN_REQUEST: {"type": "question|error|issue", "message": "description"}]

=== WORLD LORE ===

Long ago, the world of Valor was united under a radiant force known as the Aether Core—a living crystal of pure balance that kept all elements in harmony: Fire, Water, Light, Shadow, Plasma, Nature, and beyond. From this balance came peace, powerful beasts, and the rise of legendary heroes.

But balance never lasts forever.

A forgotten order called The Void Covenant shattered the Aether Core, breaking it into scattered Valor Shards. Each shard warped the land it touched—creating the Mystic Tower, the Enchanted Forest, the Mountain Caverns, the Hell Zone, and all other regions. With the Core broken, ancient evils awakened, elemental beasts became unstable, and the world began to fracture.

The Capital City became the last safe haven. From here, guilds formed, warriors trained, pets bonded with champions, and legends were born.

=== THE STORY ACTS ===

**ACT I – The Awakening** (Floors 1-15)
Players begin as rising adventurers in the Capital City. Strange surges of elemental energy ripple through the world. The Guild Council reveals an ancient truth: "The Aether Core can be restored. But only by one who commands both will and bond… warrior and beast."

First regions to explore:
- The Enchanted Forest (Floors 1-5): Corrupted spirits roam
- The Mystic Tower (Floors 6-10): Built by archmages to test those worthy of power
- The Mountain Caverns (Floors 11-15): Ancient golems guard buried shards

Players discover their first Valor Shard—and with it, their power grows. But a shadowed figure watches from afar.

**ACT II – The Fractured Realms** (Floors 16-35)
As more shards are recovered, each region reveals its tragedy:
- The Ruby Mines (Floors 16-20): Overtaken by greed-cursed miners
- The Ancient Ruins (Floors 21-25): Whispers of a fallen empire that once wielded Convergence power
- The Research Lab (Floors 26-30): Forbidden experiments on pets and elements
- Crystal Lake (Floors 31-35): Mutating creatures into tempest-tier monsters

The Void Covenant returns, led by the enigmatic Warden of Ash, a former hero who believes balance is weakness. "The world does not need harmony. It needs domination."

Guilds are drawn into war. PvP becomes lore-driven—champions clash over shards, territories, and influence.

**ACT III – The Hell Zone** (Floors 36-50)
At the edge of the world lies the Hell Zone, where reality itself has torn open. The final fragment of the Aether Core rests here—guarded by the Eclipse Sovereign, an entity born from all broken elements.

The Covenant opens the gates. Monsters pour into the world. Regions begin to collapse. Pets mutate into mythic and tempest forms.

Players must band together—across guilds, ranks, and rivalries. Dungeons become warfronts. PvP becomes fate. Guild raids decide survival.

**ACT IV – The Convergence War** (End Game)
The final arc is a living event:
- Players collect remaining shards
- Guilds battle for control of convergence sites
- The Mystic Tower opens its sealed floors
- The Hell Zone expands

At the climax, the top champions enter the Convergence Gate to face:
- The Warden of Ash
- The Eclipse Sovereign
- The corrupted heart of the Aether Core

Only one truth remains: Valor is not power. Valor is choice. Will the Core be restored… or reshaped into something new? That decision belongs to the players.

=== KEY CHARACTERS ===
- **The Warden of Ash**: Former hero turned villain, believes balance is weakness, leads the Void Covenant
- **The Eclipse Sovereign**: Entity born from all broken elements, guards the final Aether Core fragment
- **The Guild Council**: Leaders in Capital City who guide adventurers
- **The Void Covenant**: Forgotten order that shattered the Aether Core

=== GAME MECHANICS CONTEXT ===
- Players progress through NPC Tower (50 floors, 100 levels each)
- Players can join guilds and participate in guild dungeons (The Great Dungeon floors 1-50, Demon Lord's Dungeon floors 51-100)
- Pet system with elemental powers and evolution (Fire, Water, Light, Shadow, Plasma, Nature, etc.)
- PvP challenges between players
- Skill auction system
- Trading system between players
- Valor Shards scattered across regions correspond to floor progression

Be engaging, mysterious when appropriate, and always maintain the fantasy atmosphere. Weave the lore into player interactions naturally. Address players by their character name. Make them feel like heroes in an epic story.`;

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AIResponse {
  message: string;
  rewardRequests: Array<{ type: string; amount: number; reason: string }>;
  adminRequests: Array<{ type: string; message: string }>;
}

// Generate welcome introduction for new/returning players
export async function generateWelcomeIntro(accountId: string): Promise<string> {
  const account = await storage.getAccount(accountId);
  if (!account) return "Welcome, adventurer!";
  
  const storyline = await getPlayerStoryline(accountId);
  const isNewPlayer = storyline.currentChapter === 1 && Object.keys(storyline.storyProgress || {}).length === 0;
  
  const introPrompt = isNewPlayer
    ? `A new hero named ${account.username} has just arrived in the realm. They are a ${account.rank} with ${account.gold} gold. Give them a brief, exciting welcome (2-3 sentences) introducing them to the Legends of Valor world and encouraging them to explore the shop, fight NPCs in the tower, and chat with you for quests.`
    : `${account.username} (${account.rank}, Floor ${account.npcFloor}) has returned to the realm. Give them a brief welcome back (2-3 sentences) mentioning their progress and suggesting what they might do next.`;
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: GAME_SYSTEM_PROMPT },
        { role: "user", content: introPrompt }
      ],
      max_tokens: 200,
      temperature: 0.8,
    });
    
    return response.choices[0]?.message?.content || "Welcome to Legends of Valor, hero!";
  } catch (error) {
    console.error("Failed to generate welcome intro:", error);
    return isNewPlayer 
      ? `Welcome to Legends of Valor, ${account.username}! Explore the shop, battle through the NPC Tower, and chat with me for personalized quests!`
      : `Welcome back, ${account.username}! Ready to continue your adventure on Floor ${account.npcFloor}?`;
  }
}

// Get or create player storyline
export async function getPlayerStoryline(accountId: string) {
  const [existing] = await db.select().from(playerStorylines).where(eq(playerStorylines.accountId, accountId));
  if (existing) return existing;
  
  const [created] = await db.insert(playerStorylines).values({
    accountId,
    currentChapter: 1,
    storyProgress: {},
    conversationHistory: [],
    pendingRewards: [],
  }).returning();
  
  return created;
}

// Update player storyline
export async function updatePlayerStoryline(
  accountId: string,
  updates: Partial<{
    currentChapter: number;
    storyProgress: Record<string, any>;
    conversationHistory: Array<{ role: string; content: string }>;
    pendingRewards: Array<{ type: string; amount: number; reason: string }>;
  }>
) {
  await db.update(playerStorylines)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(playerStorylines.accountId, accountId));
}

// Parse AI response for special commands
function parseAIResponse(response: string): AIResponse {
  const rewardRequests: Array<{ type: string; amount: number; reason: string }> = [];
  const adminRequests: Array<{ type: string; message: string }> = [];
  
  // Extract reward requests
  const rewardMatches = Array.from(response.matchAll(/\[REWARD_REQUEST:\s*({[^}]+})\]/g));
  for (const match of rewardMatches) {
    try {
      const reward = JSON.parse(match[1]);
      rewardRequests.push(reward);
    } catch (e) {
      console.error("Failed to parse reward request:", e);
    }
  }
  
  // Extract admin requests
  const adminMatches = Array.from(response.matchAll(/\[ADMIN_REQUEST:\s*({[^}]+})\]/g));
  for (const match of adminMatches) {
    try {
      const request = JSON.parse(match[1]);
      adminRequests.push(request);
    } catch (e) {
      console.error("Failed to parse admin request:", e);
    }
  }
  
  // Clean response of special commands for display
  const cleanMessage = response
    .replace(/\[REWARD_REQUEST:\s*{[^}]+}\]/g, "")
    .replace(/\[ADMIN_REQUEST:\s*{[^}]+}\]/g, "")
    .trim();
  
  return { message: cleanMessage, rewardRequests, adminRequests };
}

// Main chat function
export async function chatWithGameAI(
  accountId: string,
  playerMessage: string
): Promise<AIResponse> {
  try {
    const account = await storage.getAccount(accountId);
    if (!account) {
      throw new Error("Account not found");
    }
    
    const storyline = await getPlayerStoryline(accountId);
    const conversationHistory = storyline.conversationHistory as ChatMessage[];
    
    // Build context about player
    const playerContext = `
Player: ${account.username}
Rank: ${account.rank}
NPC Tower Progress: Floor ${account.npcFloor}, Level ${account.npcLevel}
Gold: ${account.gold.toLocaleString()}
Wins: ${account.wins}, Losses: ${account.losses}
Current Story Chapter: ${storyline.currentChapter}
`;
    
    // Build messages for API
    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: GAME_SYSTEM_PROMPT + "\n\n" + playerContext },
      ...conversationHistory.slice(-20).map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: playerMessage },
    ];
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.8,
      max_tokens: 500,
    });
    
    const aiMessage = response.choices[0]?.message?.content || "I apologize, but I cannot respond right now.";
    const parsed = parseAIResponse(aiMessage);
    
    // Update conversation history
    const newHistory = [
      ...conversationHistory,
      { role: "user" as const, content: playerMessage },
      { role: "assistant" as const, content: parsed.message },
    ].slice(-50); // Keep last 50 messages
    
    await updatePlayerStoryline(accountId, { conversationHistory: newHistory });
    
    // Handle reward requests
    for (const reward of parsed.rewardRequests) {
      await db.insert(aiAdminRequests).values({
        accountId,
        requestType: "reward",
        message: `AI suggested reward: ${reward.amount} ${reward.type} for: ${reward.reason}`,
        aiResponse: aiMessage,
        metadata: reward,
      });
      
      // Add to pending rewards
      const pendingRewards = (storyline.pendingRewards as Array<{ type: string; amount: number; reason: string }>) || [];
      pendingRewards.push(reward);
      await updatePlayerStoryline(accountId, { pendingRewards });
    }
    
    // Handle admin requests
    for (const request of parsed.adminRequests) {
      await db.insert(aiAdminRequests).values({
        accountId,
        requestType: request.type,
        message: request.message,
        aiResponse: aiMessage,
      });
    }
    
    return parsed;
  } catch (error) {
    console.error("ChatGPT Error:", error);
    
    // Log error for admin
    await db.insert(aiAdminRequests).values({
      accountId,
      requestType: "error",
      message: `AI Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      metadata: { originalMessage: playerMessage },
    });
    
    return {
      message: "I apologize, but I'm having trouble responding right now. An admin has been notified.",
      rewardRequests: [],
      adminRequests: [{ type: "error", message: String(error) }],
    };
  }
}

// Get pending admin requests
export async function getPendingAdminRequests() {
  return db.select().from(aiAdminRequests).where(eq(aiAdminRequests.status, "pending"));
}

// Resolve admin request
export async function resolveAdminRequest(
  requestId: string,
  status: "approved" | "rejected" | "answered",
  resolvedBy: string
) {
  await db.update(aiAdminRequests)
    .set({ status, resolvedBy, resolvedAt: new Date() })
    .where(eq(aiAdminRequests.id, requestId));
}

// Get AI requests for a player
export async function getPlayerAIRequests(accountId: string) {
  return db.select().from(aiAdminRequests).where(eq(aiAdminRequests.accountId, accountId));
}
