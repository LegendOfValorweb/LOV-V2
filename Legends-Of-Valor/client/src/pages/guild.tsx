import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Guild, GuildBank, Account } from "@shared/schema";
import { useGame } from "@/lib/game-context";
import { ZoneScene } from "@/components/zone-scene";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Shield, Users, Crown, LogOut, ShoppingBag, Package, Swords, Calendar,
  Target, ScrollText, Trophy, Heart, Coins, Gem, Sparkles, Plus, X, 
  UserPlus, Building2, Vault, Castle, ArrowLeftRight, Send, ClipboardList, Search,
  MapPin, Skull, ChevronRight, Loader2, Star, Layers
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface GuildChatMessage {
  id: string;
  senderName: string;
  message: string;
  createdAt: string;
}

interface GuildMember {
  accountId: string;
  username: string;
  rank: string;
  isOnline: boolean;
  isMaster: boolean;
  role: "leader" | "officer" | "member";
}

interface GuildVaultLogEntry {
  id: string;
  playerName: string;
  action: string;
  resource: string | null;
  quantity: number | null;
  itemId: string | null;
  itemName: string | null;
  createdAt: string;
}

interface GuildWithMembers extends Guild {
  members: GuildMember[];
}

interface AvailablePlayer {
  id: string;
  username: string;
  rank: string;
  isOnline: boolean;
}

interface GuildInvite {
  id: string;
  guildId: string;
  guild?: Guild;
}

interface GuildDungeonTierInfo {
  tier: number;
  name: string;
  description: string;
  isUnlocked: boolean;
  isCompleted: boolean;
  buffExpiresAt: string | null;
  unlockRequirement: { guildLevel: number; previousDungeon: number };
  npcStats: { Str: number; Spd: number; Int: number; Luck: number };
  rewards: { unityCoins: number; gold: number; shards: number; label: string };
  buff: { name: string; stat: string; bonusPercent: number };
}

interface GuildBuffInfo {
  id: string;
  name: string;
  stat: string;
  bonusPercent: number;
  expiresAt: string;
  fromDungeon: number;
}

interface GuildPerkInfo {
  level: number;
  name: string;
  description: string;
  unlocked: boolean;
}

interface DungeonInfo {
  floor: number;
  level: number;
  displayFloor: number;
  globalLevel: number;
  dungeonName: string;
  isDemonLordDungeon: boolean;
  petsAllowed: boolean;
  isBoss: boolean;
  npcStats: { Str: number; Spd: number; Int: number; Luck: number };
  immunities: string[];
  rewards: { gold: number; rubies: number; soulShards: number; focusedShards: number; runes: number };
  onlineMembers: { accountId: string; username: string; equippedPet?: { id: string; name: string; tier: string; elements: string[] } | null }[];
  memberCount: number;
  dungeons: GuildDungeonTierInfo[];
  unityCoins: number;
  dungeonsCompleted: number;
  activeBuffs: GuildBuffInfo[];
  perks: GuildPerkInfo[];
}

interface GuildBattle {
  id: string;
  challengerGuildId: string;
  challengerGuildName: string;
  challengedGuildId: string;
  challengedGuildName: string;
  status: string;
  challengerFighters: string[];
  challengedFighters: string[];
  currentRound: number;
  challengerScore: number;
  challengedScore: number;
  winnerId?: string;
  createdAt: string;
}

interface GuildQuestContribution {
  id: string;
  questId: string;
  accountId: string;
  amount: number;
  updatedAt: string;
}

interface GuildQuest {
  id: string;
  guildId: string | null;
  name: string;
  description: string;
  type: "gather" | "dungeon" | "pvp" | "slay";
  targetAmount: number;
  currentAmount: number;
  rewardUnityCoins: number;
  rewardGold: number;
  rewardGuildExp: number;
  status: "active" | "completed" | "expired";
  expiresAt: string | null;
  contributions: GuildQuestContribution[];
}

interface GuildWithMemberCount {
  id: string;
  name: string;
  level: number;
  memberCount: number;
}

interface ZoneConquest {
  zoneId: string;
  guildId: string | null;
  guildName: string | null;
  defensePoints: number | null;
  taxRate: number | null;
  conqueredAt: string | null;
}

interface GuildApplicationInfo {
  id: string;
  guildId: string;
  applicantId: string;
  status: string;
  createdAt: string;
  guild?: { id: string; name: string; level: number };
}

interface GuildApplicationWithApplicant {
  id: string;
  guildId: string;
  applicantId: string;
  status: string;
  createdAt: string;
  applicantName: string;
  applicantLevel: string;
  applicantClass: string | null;
}

export default function GuildPage() {
  const { account, logout } = useGame();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [guildName, setGuildName] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [distributeDialogOpen, setDistributeDialogOpen] = useState(false);
  const [distributions, setDistributions] = useState<Record<string, { gold: number; rubies: number; soulShards: number; focusedShards: number }>>({});
  const [battleDialogOpen, setBattleDialogOpen] = useState(false);
  const [selectedOpponentGuild, setSelectedOpponentGuild] = useState("");
  const [selectedFighters, setSelectedFighters] = useState<string[]>([]);
  const [respondBattleId, setRespondBattleId] = useState<string | null>(null);
  const [respondFighters, setRespondFighters] = useState<string[]>([]);
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositResource, setDepositResource] = useState<"gold" | "rubies" | "soulShards" | "focusedShards" | "runes" | "trainingPoints" | "beakCoins" | "valorTokens">("gold");
  const [vaultLogsDialogOpen, setVaultLogsDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<{ accountId: string; username: string; currentRole: string } | null>(null);
  const [selectedRole, setSelectedRole] = useState<"officer" | "member">("member");

  const { data: guild, isLoading: guildLoading } = useQuery<GuildWithMembers | null>({
    queryKey: ["/api/accounts", account?.id, "guild"],
    enabled: !!account,
  });

  const { data: invites = [] } = useQuery<GuildInvite[]>({
    queryKey: ["/api/accounts", account?.id, "guild-invites"],
    enabled: !!account && !guild,
  });

  const { data: availablePlayers = [] } = useQuery<AvailablePlayer[]>({
    queryKey: ["/api/players/available-for-guild"],
    enabled: !!account && !!guild && (guild.masterId === account.id || guild.members?.some(m => m.accountId === account.id && m.role === "officer")),
  });

  const { data: dungeonInfo } = useQuery<DungeonInfo>({
    queryKey: ["/api/guilds", guild?.id, "dungeon"],
    enabled: !!guild,
    refetchInterval: 5000,
  });

  const { data: zoneConquests = [], refetch: refetchZoneConquests } = useQuery<ZoneConquest[]>({
    queryKey: ["/api/zone-conquests"],
    enabled: !!guild,
    refetchInterval: 10000,
  });

  const claimZoneMutation = useMutation({
    mutationFn: async (zoneId: string) => {
      const res = await apiRequest("POST", `/api/zone-conquests/${zoneId}/claim`, { accountId: account!.id });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Zone Claimed!", description: data.message || "Your guild now controls this zone." });
      refetchZoneConquests();
      queryClient.invalidateQueries({ queryKey: ["/api/zone-conquests"] });
    },
    onError: (err: any) => {
      toast({ title: "Cannot Claim Zone", description: err?.message || "Failed to claim zone.", variant: "destructive" });
    },
  });

  const attackZoneMutation = useMutation({
    mutationFn: async (zoneId: string) => {
      const res = await apiRequest("POST", `/api/zone-conquests/${zoneId}/attack`, { accountId: account!.id });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.conquered) {
        toast({ title: "Zone Conquered!", description: data.message || "Your guild seized the zone!" });
      } else {
        toast({ title: "Zone Attacked!", description: data.message || "Defense reduced." });
      }
      refetchZoneConquests();
      queryClient.invalidateQueries({ queryKey: ["/api/zone-conquests"] });
    },
    onError: (err: any) => {
      toast({ title: "Attack Failed", description: err?.message || "Failed to attack zone.", variant: "destructive" });
    },
  });

  const { data: chatMessages = [], refetch: refetchChat } = useQuery<GuildChatMessage[]>({
    queryKey: ["/api/guilds", guild?.id, "chat"],
    enabled: !!guild,
    refetchInterval: 5000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      await apiRequest("POST", `/api/guilds/${guild!.id}/chat`, {
        accountId: account!.id,
        message
      });
    },
    onSuccess: () => {
      setChatMessage("");
      refetchChat();
    }
  });

  const createGuildMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/guilds", { name, masterId: account!.id });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", account?.id, "guild"] });
      setCreateDialogOpen(false);
      setGuildName("");
      toast({ title: "Guild created!", description: "You are now the Guild Master." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create guild", variant: "destructive" });
    },
  });

  const invitePlayerMutation = useMutation({
    mutationFn: async (playerId: string) => {
      const res = await apiRequest("POST", `/api/guilds/${guild!.id}/invite`, {
        accountId: playerId,
        invitedBy: account!.id,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/players/available-for-guild"] });
      toast({ title: "Invite sent!" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to send invite", variant: "destructive" });
    },
  });

  const acceptInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      const res = await apiRequest("POST", `/api/guild-invites/${inviteId}/accept`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", account?.id, "guild"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", account?.id, "guild-invites"] });
      toast({ title: "Joined guild!" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to join guild", variant: "destructive" });
    },
  });

  const declineInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      const res = await apiRequest("POST", `/api/guild-invites/${inviteId}/decline`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", account?.id, "guild-invites"] });
    },
  });

  const leaveGuildMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/guilds/${guild!.id}/leave`, { accountId: account!.id });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", account?.id, "guild"] });
      toast({ 
        title: data.guildDisbanded ? "Guild disbanded" : "Left guild",
        description: data.guildDisbanded ? "The guild has been disbanded." : "You have left the guild."
      });
    },
  });

  const kickMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const res = await apiRequest("POST", `/api/guilds/${guild!.id}/kick`, {
        accountId: memberId,
        kickedBy: account!.id,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", account?.id, "guild"] });
      toast({ title: "Member kicked" });
    },
  });

  const fightDungeonMutation = useMutation({
    mutationFn: async (dungeonTier: number) => {
      const res = await apiRequest("POST", `/api/guilds/${guild!.id}/dungeon/fight`, { accountId: account!.id, dungeonTier });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/guilds", guild?.id, "dungeon"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", account?.id, "guild"] });
      if (data.victory) {
        toast({ 
          title: `Victory in ${data.dungeonName}!`, 
          description: `Earned ${data.rewards.unityCoins} Unity Coins and ${data.rewards.gold.toLocaleString()} gold! Guild buff "${data.buff.name}" active for 24h.` 
        });
      } else {
        toast({ title: "Defeat", description: `${data.dungeonName} proved too challenging. Try again with more members!`, variant: "destructive" });
      }
    },
  });

  const [zoneDungeonOpen, setZoneDungeonOpen] = useState(false);
  const [selectedDungeonZone, setSelectedDungeonZone] = useState<string | null>(null);
  const [soulLinkPartner, setSoulLinkPartner] = useState("");
  const [dungeonRun, setDungeonRun] = useState<any>(null);
  const [zoneDungeonMeta, setZoneDungeonMeta] = useState<any>(null);
  const [lastFightResult, setLastFightResult] = useState<any>(null);
  const [dungeonFinished, setDungeonFinished] = useState(false);

  const enterZoneDungeonMutation = useMutation({
    mutationFn: async (zoneId: string) => {
      const res = await apiRequest("POST", `/api/zone-dungeons/${zoneId}/enter`, { accountId: account!.id });
      return res.json();
    },
    onSuccess: (data) => {
      setDungeonRun(data.run);
      setZoneDungeonMeta(data.dungeon);
      setLastFightResult(null);
      setDungeonFinished(false);
    },
    onError: (err: any) => {
      toast({ title: "Cannot Enter Dungeon", description: err.message || "Failed to enter dungeon", variant: "destructive" });
    },
  });

  const fightZoneDungeonMutation = useMutation({
    mutationFn: async (zoneId: string) => {
      const res = await apiRequest("POST", `/api/zone-dungeons/${zoneId}/fight`, { accountId: account!.id });
      return res.json();
    },
    onSuccess: (data) => {
      setLastFightResult(data);
      if (data.dungeonCompleted || data.runEnded) {
        setDungeonFinished(true);
        setDungeonRun(null);
      } else if (data.run) {
        setDungeonRun(data.run);
      } else if (dungeonRun) {
        setDungeonRun({ ...dungeonRun, currentFloor: (dungeonRun.currentFloor || 1) + 1 });
      }
    },
    onError: (err: any) => {
      toast({ title: "Fight Error", description: err.message || "Failed to fight", variant: "destructive" });
    },
  });

  function openZoneDungeon(zoneId: string) {
    setSelectedDungeonZone(zoneId);
    setDungeonRun(null);
    setZoneDungeonMeta(null);
    setLastFightResult(null);
    setDungeonFinished(false);
    setZoneDungeonOpen(true);
    enterZoneDungeonMutation.mutate(zoneId);
  }

  const distributeMutation = useMutation({
    mutationFn: async (dists: { accountId: string; gold: number; rubies: number; soulShards: number; focusedShards: number }[]) => {
      const res = await apiRequest("POST", `/api/guilds/${guild!.id}/distribute`, {
        masterId: account!.id,
        distributions: dists,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", account?.id, "guild"] });
      setDistributeDialogOpen(false);
      setDistributions({});
      toast({ title: "Rewards distributed!" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to distribute", variant: "destructive" });
    },
  });

  const { data: guildQuests = [] } = useQuery<GuildQuest[]>({
    queryKey: ["/api/guilds", guild?.id, "quests"],
    enabled: !!guild,
    refetchInterval: 10000,
    select: (data: any) => Array.isArray(data) ? data : (data?.quests ?? []),
  });

  const contributeQuestMutation = useMutation({
    mutationFn: async (data: { questId: string; amount: number }) => {
      const res = await apiRequest("POST", `/api/guilds/${guild!.id}/quests/${data.questId}/contribute`, {
        amount: data.amount,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/guilds", guild?.id, "quests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", account?.id] });
      toast({ 
        title: data.completed ? "Quest Completed!" : "Contribution added!",
        description: data.completed ? "Rewards have been distributed to all contributors." : `Progress: ${data.currentAmount}`
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to contribute", variant: "destructive" });
    },
  });

  const isMaster = guild?.masterId === account?.id;

  // Guild Applications (for unguilded players)
  const { data: myApplication } = useQuery<GuildApplicationInfo | null>({
    queryKey: ["/api/accounts", account?.id, "guild-application"],
    enabled: !!account && !guild,
  });

  const { data: browseGuilds = [] } = useQuery<GuildWithMemberCount[]>({
    queryKey: ["/api/guilds"],
    enabled: !!account && !guild,
  });

  const applyToGuildMutation = useMutation({
    mutationFn: async (guildId: string) => {
      const res = await apiRequest("POST", `/api/guilds/${guildId}/apply`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", account?.id, "guild-application"] });
      toast({ title: "Application submitted!", description: "Wait for the guild master or officer to review your application." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to submit application", variant: "destructive" });
    },
  });

  const cancelApplicationMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      const res = await apiRequest("DELETE", `/api/guild-applications/${applicationId}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", account?.id, "guild-application"] });
      toast({ title: "Application cancelled" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to cancel application", variant: "destructive" });
    },
  });

  // Guild Applications (for masters/officers)
  const canManageApplications = isMaster || (guild?.members.find(m => m.accountId === account?.id)?.role === "officer");

  const { data: pendingApplications = [] } = useQuery<GuildApplicationWithApplicant[]>({
    queryKey: ["/api/guilds", guild?.id, "applications"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/guilds/${guild!.id}/applications`);
      return res.json();
    },
    enabled: !!guild && canManageApplications,
    refetchInterval: 10000,
  });

  const respondApplicationMutation = useMutation({
    mutationFn: async (data: { applicationId: string; approve: boolean }) => {
      const res = await apiRequest("PATCH", `/api/guild-applications/${data.applicationId}/respond`, {
        approve: data.approve,
      });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/guilds", guild?.id, "applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", account?.id, "guild"] });
      toast({ title: variables.approve ? "Application approved!" : "Application rejected" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to respond to application", variant: "destructive" });
    },
  });

  // Guild Battles
  const { data: guildBattles = [] } = useQuery<GuildBattle[]>({
    queryKey: ["/api/guilds", guild?.id, "battles"],
    enabled: !!guild,
  });

  const { data: allGuilds = [] } = useQuery<Guild[]>({
    queryKey: ["/api/guilds"],
    enabled: !!guild && isMaster && battleDialogOpen,
    refetchInterval: battleDialogOpen ? 5000 : false,
  });

  const challengeGuildMutation = useMutation({
    mutationFn: async (data: { challengedGuildId: string; fighters: string[] }) => {
      const res = await apiRequest("POST", `/api/guilds/${guild!.id}/battles/challenge`, {
        accountId: account!.id,
        targetGuildId: data.challengedGuildId,
        fighters: data.fighters,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/guilds", guild?.id, "battles"] });
      setBattleDialogOpen(false);
      setSelectedOpponentGuild("");
      setSelectedFighters([]);
      toast({ title: "Challenge sent!", description: "Waiting for the opposing guild to respond." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to send challenge", variant: "destructive" });
    },
  });

  const respondBattleMutation = useMutation({
    mutationFn: async (data: { battleId: string; accept: boolean; fighters?: string[] }) => {
      const res = await apiRequest("PATCH", `/api/guild-battles/${data.battleId}/respond`, {
        accountId: account!.id,
        accept: data.accept,
        fighters: data.fighters,
      });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/guilds", guild?.id, "battles"] });
      setRespondBattleId(null);
      setRespondFighters([]);
      toast({ 
        title: variables.accept ? "Challenge accepted!" : "Challenge declined",
        description: variables.accept ? "The battle has begun! Admin will judge each round." : "You declined the guild battle."
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to respond", variant: "destructive" });
    },
  });

  const myMember = guild?.members.find(m => m.accountId === account?.id);
  const myRole = myMember?.role || "member";
  const canManage = myRole === "leader" || myRole === "officer";

  const { data: vaultLogs = [] } = useQuery<GuildVaultLogEntry[]>({
    queryKey: ["/api/guilds", guild?.id, "vault-logs", { accountId: account?.id }],
    enabled: !!guild && canManage && vaultLogsDialogOpen,
  });

  const setRoleMutation = useMutation({
    mutationFn: async (data: { targetAccountId: string; role: "officer" | "member" }) => {
      const res = await apiRequest("POST", `/api/guilds/${guild!.id}/set-role`, {
        accountId: account!.id,
        targetAccountId: data.targetAccountId,
        role: data.role,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", account?.id, "guild"] });
      setRoleDialogOpen(false);
      setRoleTarget(null);
      toast({ title: "Role updated!" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to set role", variant: "destructive" });
    },
  });

  const depositMutation = useMutation({
    mutationFn: async (data: { resource: string; amount: number }) => {
      const res = await apiRequest("POST", `/api/guilds/${guild!.id}/deposit`, {
        accountId: account!.id,
        resource: data.resource,
        amount: data.amount,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", account?.id, "guild"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", account?.id] });
      setDepositDialogOpen(false);
      setDepositAmount("");
      toast({ title: "Deposit successful!", description: "Your contribution has been added to the guild bank." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to deposit", variant: "destructive" });
    },
  });

  const levelUpGuildMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/guilds/${guild!.id}/level-up`, {
        accountId: account!.id,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", account?.id, "guild"] });
      toast({ title: "Guild Leveled Up!", description: `Your guild is now level ${data.newLevel}!` });
    },
    onError: (error: any) => {
      toast({ title: "Level Up Failed", description: error.message || "Cannot level up guild", variant: "destructive" });
    },
  });

  const { data: soulLinks = [], refetch: refetchSoulLinks } = useQuery<any[]>({
    queryKey: ["/api/soul-links", account?.id],
    queryFn: async () => {
      if (!account?.id) return [];
      const res = await fetch(`/api/soul-links/${account.id}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!account?.id,
  });

  const createSoulLinkMutation = useMutation({
    mutationFn: async (player2Id: string) => {
      const res = await apiRequest("POST", "/api/soul-links", {
        player1Id: account!.id,
        player2Id,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Soul Link Created!", description: "Your soul link has been forged." });
      setSoulLinkPartner("");
      refetchSoulLinks();
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message || "Could not create soul link", variant: "destructive" }),
  });

  const pendingBattles = guildBattles.filter(b => b.status === "pending" && b.challengedGuildId === guild?.id);
  const activeBattles = guildBattles.filter(b => b.status === "accepted" || b.status === "in_progress");
  const completedBattles = guildBattles.filter(b => b.status === "completed").slice(0, 5);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  if (!account || account.role !== "player" && account.role !== "admin") {
    navigate("/");
    return null;
  }

  return (
    <ZoneScene
      zoneName="Guild Hall"
      backdrop="/backdrops/base.png"
      ambientClass="zone-ambient-shop"
      overlayOpacity={0.45}
    >
      <div className="game-page text-foreground">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold font-serif text-primary flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Guild
            </h1>
            <nav className="hidden md:flex gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate("/world-map")} data-testid="link-world-map">
                <Building2 className="w-4 h-4 mr-1" />World Map
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/shop")} data-testid="link-shop">
                <ShoppingBag className="w-4 h-4 mr-1" />Shop
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/inventory")} data-testid="link-inventory">
                <Package className="w-4 h-4 mr-1" />Inventory
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/pets")} data-testid="link-pets">
                <Heart className="w-4 h-4 mr-1" />Pets
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/challenges")} data-testid="link-challenges">
                <Swords className="w-4 h-4 mr-1" />Challenges
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/npc-battle")} data-testid="link-npc">
                <Target className="w-4 h-4 mr-1" />NPC Tower
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/quests")} data-testid="link-quests">
                <ScrollText className="w-4 h-4 mr-1" />Quests
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/leaderboard")} data-testid="link-leaderboard">
                <Trophy className="w-4 h-4 mr-1" />Leaderboard
              </Button>
              <Button variant="secondary" size="sm" data-testid="link-guild-active">
                <Shield className="w-4 h-4 mr-1" />Guild
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/skills")} data-testid="link-skills">
                <Sparkles className="w-4 h-4 mr-1" />Skills
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/trading")} data-testid="link-trading">
                <ArrowLeftRight className="w-4 h-4 mr-1" />Trade
              </Button>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{account.username}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="button-logout">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {guildLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : !guild ? (
          <div className="max-w-2xl mx-auto">
            <Card className="mb-6">
              <CardHeader className="text-center">
                <Building2 className="w-16 h-16 mx-auto mb-4 text-primary" />
                <CardTitle className="text-2xl">Join or Create a Guild</CardTitle>
                <CardDescription>
                  Form a party of up to 4 players to conquer the Great Dungeon together!
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="lg" className="w-full" data-testid="button-create-guild">
                      <Plus className="w-4 h-4 mr-2" />
                      Create New Guild
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Guild</DialogTitle>
                      <DialogDescription>
                        Choose a name for your guild. You will become the Guild Master.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="guild-name">Guild Name</Label>
                        <Input
                          id="guild-name"
                          value={guildName}
                          onChange={(e) => setGuildName(e.target.value)}
                          placeholder="Enter guild name..."
                          maxLength={30}
                          data-testid="input-guild-name"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() => createGuildMutation.mutate(guildName)}
                        disabled={guildName.length < 3 || createGuildMutation.isPending}
                        data-testid="button-confirm-create"
                      >
                        {createGuildMutation.isPending ? "Creating..." : "Create Guild"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {invites.length > 0 && (
                  <div className="mt-6">
                    <h3 className="font-semibold mb-3">Pending Invites</h3>
                    <div className="space-y-2">
                      {invites.map((invite) => (
                        <Card key={invite.id} className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{invite.guild?.name || "Unknown Guild"}</p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => acceptInviteMutation.mutate(invite.id)}
                                disabled={acceptInviteMutation.isPending}
                                data-testid={`button-accept-invite-${invite.id}`}
                              >
                                Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => declineInviteMutation.mutate(invite.id)}
                                data-testid={`button-decline-invite-${invite.id}`}
                              >
                                Decline
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* My pending application status */}
            {myApplication && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ClipboardList className="w-4 h-4 text-yellow-500" />
                    Pending Application
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                    <div>
                      <p className="font-medium">{myApplication.guild?.name || "Unknown Guild"}</p>
                      <p className="text-xs text-muted-foreground">
                        Level {myApplication.guild?.level ?? "?"} guild &middot; Submitted {new Date(myApplication.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => cancelApplicationMutation.mutate(myApplication.id)}
                      disabled={cancelApplicationMutation.isPending}
                      data-testid="button-cancel-application"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Browse Guilds */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="w-5 h-5 text-primary" />
                  Browse Guilds
                </CardTitle>
                <CardDescription>
                  Apply to join an existing guild. You can only have one pending application at a time.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {browseGuilds.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">No guilds found. Be the first to create one!</p>
                ) : (
                  <div className="space-y-2">
                    {browseGuilds.map((g) => {
                      const maxMembers = 2 + (g.level * 3);
                      const isFull = g.memberCount >= maxMembers;
                      const alreadyApplied = myApplication?.guildId === g.id;
                      return (
                        <div
                          key={g.id}
                          className="flex items-center justify-between p-3 rounded-lg border border-border"
                          data-testid={`guild-browse-${g.id}`}
                        >
                          <div>
                            <p className="font-medium flex items-center gap-2">
                              <Shield className="w-4 h-4 text-primary" />
                              {g.name}
                              <Badge variant="outline" className="border-yellow-500 text-yellow-500 text-[10px]">
                                Lv {g.level}
                              </Badge>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {g.memberCount}/{maxMembers} Members{isFull ? " · Full" : ""}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            disabled={isFull || !!myApplication || applyToGuildMutation.isPending}
                            onClick={() => applyToGuildMutation.mutate(g.id)}
                            data-testid={`button-apply-${g.id}`}
                          >
                            {alreadyApplied ? "Applied" : isFull ? "Full" : "Apply"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  {guild.name}
                  <Badge variant="outline" className="ml-2 border-yellow-500 text-yellow-500">
                    Level {guild.level || 1}
                  </Badge>
                </CardTitle>
                <CardDescription className="flex items-center justify-between">
                  <span>{guild.members.length}/{2 + (guild.level || 1) * 3} Members</span>
                  {isMaster && (guild.level || 1) < 10 && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => levelUpGuildMutation.mutate()}
                      disabled={levelUpGuildMutation.isPending}
                      data-testid="button-level-up-guild"
                      className="text-yellow-500 border-yellow-500/50"
                    >
                      <Sparkles className="w-3 h-3 mr-1" />
                      {levelUpGuildMutation.isPending ? "..." : "Level Up"}
                    </Button>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {guild.members.map((member) => {
                    const memberRole = member.role || "member";
                    const canKickThis = (myRole === "leader" && memberRole !== "leader") ||
                      (myRole === "officer" && memberRole === "member");
                    return (
                      <div
                        key={member.accountId}
                        className="flex items-center justify-between p-3 rounded-lg border border-border"
                      >
                        <div className="flex items-center gap-3">
                          {member.isMaster && <Crown className="w-4 h-4 text-yellow-500" />}
                          <div>
                            <p className="font-medium flex items-center gap-2">
                              {member.username}
                              {member.isOnline && (
                                <span className="w-2 h-2 rounded-full bg-green-500" />
                              )}
                              <Badge variant="outline" className={
                                memberRole === "leader" ? "border-yellow-500 text-yellow-500 text-[10px]" :
                                memberRole === "officer" ? "border-blue-500 text-blue-500 text-[10px]" :
                                "text-[10px]"
                              }>
                                {memberRole.charAt(0).toUpperCase() + memberRole.slice(1)}
                              </Badge>
                            </p>
                            <p className="text-xs text-muted-foreground">{member.rank}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {isMaster && !member.isMaster && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setRoleTarget({ accountId: member.accountId, username: member.username, currentRole: memberRole });
                                setSelectedRole(memberRole === "officer" ? "member" : "officer");
                                setRoleDialogOpen(true);
                              }}
                              data-testid={`button-role-${member.accountId}`}
                            >
                              <Shield className="w-4 h-4" />
                            </Button>
                          )}
                          {canKickThis && member.accountId !== account?.id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => kickMemberMutation.mutate(member.accountId)}
                              data-testid={`button-kick-${member.accountId}`}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-2">
                  {canManage && guild.members.length < 4 && (
                    <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="flex-1" data-testid="button-invite">
                          <UserPlus className="w-4 h-4 mr-2" />
                          Invite Player
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Invite Player</DialogTitle>
                        </DialogHeader>
                        <div className="max-h-60 overflow-y-auto space-y-2">
                          {availablePlayers.length === 0 ? (
                            <p className="text-muted-foreground text-center py-4">No available players</p>
                          ) : (
                            availablePlayers.map((player) => (
                              <div
                                key={player.id}
                                className="flex items-center justify-between p-3 rounded-lg border"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{player.username}</span>
                                  {player.isOnline && (
                                    <span className="w-2 h-2 rounded-full bg-green-500" />
                                  )}
                                  <Badge variant="outline">{player.rank}</Badge>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    invitePlayerMutation.mutate(player.id);
                                    setInviteDialogOpen(false);
                                  }}
                                  data-testid={`button-invite-${player.id}`}
                                >
                                  Invite
                                </Button>
                              </div>
                            ))
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => leaveGuildMutation.mutate()}
                    data-testid="button-leave-guild"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    {isMaster ? "Disband Guild" : "Leave Guild"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Guild Chat Card */}
            <Card className="flex flex-col h-[450px] md:h-[600px] md:col-span-1 border-primary/20 bg-card/50 backdrop-blur shadow-xl">
              <CardHeader className="py-3 px-4 border-b border-border/50 bg-muted/20">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg font-serif">
                  <Send className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                  Guild Chat
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col flex-grow gap-2 md:gap-4 overflow-hidden p-3 md:p-6 bg-gradient-to-b from-transparent to-background/20">
                <div className="flex-grow overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-primary/20 scroll-smooth">
                  {chatMessages && chatMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm space-y-2 opacity-60">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                        <Send className="w-6 h-6" />
                      </div>
                      <p>No messages yet. Say hello!</p>
                    </div>
                  ) : (
                    chatMessages && [...chatMessages].map((msg) => (
                      <div key={msg.id} className={`flex flex-col ${msg.senderName === account?.username ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                        <div className="flex items-center gap-2 mb-1 px-1">
                          <span className={`text-[10px] md:text-xs font-bold ${msg.senderName === account?.username ? 'text-primary' : 'text-blue-400'}`}>
                            {msg.senderName}
                          </span>
                          <span className="text-[9px] md:text-[10px] text-muted-foreground opacity-70">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className={`px-4 py-2 rounded-2xl max-w-[85%] md:max-w-[80%] text-xs md:text-sm shadow-md transition-all hover:scale-[1.02] ${
                          msg.senderName === account?.username 
                            ? 'bg-primary text-primary-foreground rounded-tr-none border border-primary/20' 
                            : 'bg-muted/80 backdrop-blur-sm border border-border/50 rounded-tl-none'
                        }`}>
                          {msg.message}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2 pt-3 border-t border-border/50 mt-auto bg-background/40 p-1 rounded-lg">
                  <Input
                    placeholder="Type a message..."
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && chatMessage.trim() && !sendMessageMutation.isPending) {
                        sendMessageMutation.mutate(chatMessage);
                      }
                    }}
                    className="h-10 text-sm bg-background/50 border-border/50 focus-visible:ring-primary/30"
                  />
                  <Button 
                    size="icon" 
                    className="h-10 w-10 shrink-0 shadow-lg transition-transform active:scale-95"
                    onClick={() => chatMessage.trim() && sendMessageMutation.mutate(chatMessage)}
                    disabled={sendMessageMutation.isPending || !chatMessage.trim()}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="flex flex-col h-[400px] md:h-[600px] md:col-span-1 border-primary/20 bg-card/50 backdrop-blur shadow-xl">
              <CardHeader className="py-3 px-4 border-b border-border/50 bg-muted/20">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg font-serif">
                  <Send className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                  Guild Chat
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col flex-grow gap-2 md:gap-4 overflow-hidden p-3 md:p-6 bg-gradient-to-b from-transparent to-background/20">
                <div className="flex-grow overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-primary/20 scroll-smooth">
                  {chatMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm space-y-2 opacity-60">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                        <Send className="w-6 h-6" />
                      </div>
                      <p>No messages yet. Say hello!</p>
                    </div>
                  ) : (
                    chatMessages.map((msg) => (
                      <div key={msg.id} className={`flex flex-col ${msg.senderName === account.username ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                        <div className="flex items-center gap-2 mb-1 px-1">
                          <span className={`text-[10px] md:text-xs font-bold ${msg.senderName === account.username ? 'text-primary' : 'text-blue-400'}`}>
                            {msg.senderName}
                          </span>
                          <span className="text-[9px] md:text-[10px] text-muted-foreground opacity-70">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className={`px-4 py-2 rounded-2xl max-w-[85%] md:max-w-[80%] text-xs md:text-sm shadow-md transition-all hover:scale-[1.02] ${
                          msg.senderName === account.username 
                            ? 'bg-primary text-primary-foreground rounded-tr-none border border-primary/20' 
                            : 'bg-muted/80 backdrop-blur-sm border border-border/50 rounded-tl-none'
                        }`}>
                          {msg.message}
                        </div>
                      </div>
                    )).reverse()
                  )}
                </div>
                <div className="flex gap-2 pt-3 border-t border-border/50 mt-auto bg-background/40 p-1 rounded-lg">
                  <Input
                    placeholder="Type a message..."
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && chatMessage.trim() && !sendMessageMutation.isPending) {
                        sendMessageMutation.mutate(chatMessage);
                      }
                    }}
                    className="h-10 text-sm bg-background/50 border-border/50 focus-visible:ring-primary/30"
                  />
                  <Button 
                    size="icon" 
                    className="h-10 w-10 shrink-0 shadow-lg transition-transform active:scale-95"
                    onClick={() => chatMessage.trim() && sendMessageMutation.mutate(chatMessage)}
                    disabled={sendMessageMutation.isPending || !chatMessage.trim()}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Vault className="w-5 h-5 text-yellow-500" />
                  Guild Bank
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10">
                    <Coins className="w-5 h-5 text-yellow-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Gold</p>
                      <p className="font-bold">{guild.bank.gold.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10">
                    <Gem className="w-5 h-5 text-red-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Rubies</p>
                      <p className="font-bold">{guild.bank.rubies.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-purple-500/10">
                    <Sparkles className="w-5 h-5 text-purple-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Soul Shards</p>
                      <p className="font-bold">{guild.bank.soulShards.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10">
                    <Sparkles className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Focused Shards</p>
                      <p className="font-bold">{guild.bank.focusedShards.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10">
                    <Sparkles className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Training Points</p>
                      <p className="font-bold">{(guild.bank.trainingPoints || 0).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-500/10">
                    <Sparkles className="w-5 h-5 text-orange-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Runes</p>
                      <p className="font-bold">{(guild.bank.runes || 0).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10">
                    <Coins className="w-5 h-5 text-amber-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Beak Coins</p>
                      <p className="font-bold">{((guild.bank as any).beakCoins || 0).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10">
                    <Star className="w-5 h-5 text-emerald-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Valor Tokens</p>
                      <p className="font-bold">{((guild.bank as any).valorTokens || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Dialog open={depositDialogOpen} onOpenChange={setDepositDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="flex-1" variant="outline" data-testid="button-deposit">
                        <Plus className="w-4 h-4 mr-2" />
                        Deposit
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Deposit to Guild Bank</DialogTitle>
                        <DialogDescription>
                          Contribute your resources to help the guild
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div>
                          <Label>Resource Type</Label>
                          <Select value={depositResource} onValueChange={(v) => setDepositResource(v as any)}>
                            <SelectTrigger data-testid="select-deposit-resource">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="gold">Gold ({account.gold?.toLocaleString() || 0})</SelectItem>
                              <SelectItem value="rubies">Rubies ({account.rubies?.toLocaleString() || 0})</SelectItem>
                              <SelectItem value="soulShards">Soul Shards ({account.soulShards?.toLocaleString() || 0})</SelectItem>
                              <SelectItem value="focusedShards">Focused Shards ({account.focusedShards?.toLocaleString() || 0})</SelectItem>
                              <SelectItem value="runes">Runes ({(account as any).runes?.toLocaleString() || 0})</SelectItem>
                              <SelectItem value="trainingPoints">Training Points ({(account as any).trainingPoints?.toLocaleString() || 0})</SelectItem>
                              <SelectItem value="beakCoins">Beak Coins ({(account as any).beakCoins?.toLocaleString() || 0})</SelectItem>
                              <SelectItem value="valorTokens">Valor Tokens ({(account as any).valorTokens?.toLocaleString() || 0})</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Amount</Label>
                          <Input
                            type="number"
                            min={1}
                            value={depositAmount}
                            onChange={(e) => setDepositAmount(e.target.value)}
                            placeholder="Enter amount"
                            data-testid="input-deposit-amount"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setDepositDialogOpen(false)}>Cancel</Button>
                        <Button
                          onClick={() => {
                            const amount = parseInt(depositAmount) || 0;
                            if (amount > 0) {
                              depositMutation.mutate({ resource: depositResource, amount });
                            }
                          }}
                          disabled={depositMutation.isPending || !depositAmount}
                          data-testid="button-confirm-deposit"
                        >
                          {depositMutation.isPending ? "Depositing..." : "Deposit"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {canManage && (
                    <Dialog open={vaultLogsDialogOpen} onOpenChange={setVaultLogsDialogOpen}>
                      <DialogTrigger asChild>
                        <Button className="flex-1" variant="outline" data-testid="button-vault-logs">
                          <ScrollText className="w-4 h-4 mr-2" />
                          Vault Logs
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Guild Vault Logs</DialogTitle>
                          <DialogDescription>
                            Transaction history for guild vault
                          </DialogDescription>
                        </DialogHeader>
                        <div className="max-h-80 overflow-y-auto space-y-2">
                          {vaultLogs.length === 0 ? (
                            <p className="text-muted-foreground text-center py-4">No vault transactions yet</p>
                          ) : (
                            vaultLogs.map((log) => (
                              <div key={log.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                                <div>
                                  <p className="font-medium">{log.playerName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {log.action === "deposit" ? "Deposited" : "Withdrew"}{" "}
                                    {log.quantity?.toLocaleString()} {log.resource}
                                    {log.itemName && ` (${log.itemName})`}
                                  </p>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(log.createdAt).toLocaleDateString()} {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}

                  {isMaster && (
                    <Dialog open={distributeDialogOpen} onOpenChange={setDistributeDialogOpen}>
                      <DialogTrigger asChild>
                        <Button className="flex-1" variant="outline" data-testid="button-distribute">
                          <Coins className="w-4 h-4 mr-2" />
                          Distribute
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Distribute Guild Bank</DialogTitle>
                          <DialogDescription>
                            Allocate resources to guild members
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 max-h-80 overflow-y-auto">
                          {guild.members.map((member) => (
                            <div key={member.accountId} className="space-y-2 p-3 rounded-lg border">
                              <p className="font-medium">{member.username}</p>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-xs">Gold ({guild.bank.gold.toLocaleString()} available)</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    max={guild.bank.gold}
                                    value={distributions[member.accountId]?.gold || 0}
                                    onChange={(e) => setDistributions(prev => ({
                                      ...prev,
                                      [member.accountId]: {
                                        ...prev[member.accountId],
                                        gold: parseInt(e.target.value) || 0,
                                        rubies: prev[member.accountId]?.rubies || 0,
                                        soulShards: prev[member.accountId]?.soulShards || 0,
                                        focusedShards: prev[member.accountId]?.focusedShards || 0,
                                      }
                                    }))}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Rubies ({guild.bank.rubies.toLocaleString()} available)</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    max={guild.bank.rubies}
                                    value={distributions[member.accountId]?.rubies || 0}
                                    onChange={(e) => setDistributions(prev => ({
                                      ...prev,
                                      [member.accountId]: {
                                        ...prev[member.accountId],
                                        gold: prev[member.accountId]?.gold || 0,
                                        rubies: parseInt(e.target.value) || 0,
                                        soulShards: prev[member.accountId]?.soulShards || 0,
                                        focusedShards: prev[member.accountId]?.focusedShards || 0,
                                      }
                                    }))}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Soul Shards ({guild.bank.soulShards.toLocaleString()} available)</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    max={guild.bank.soulShards}
                                    value={distributions[member.accountId]?.soulShards || 0}
                                    onChange={(e) => setDistributions(prev => ({
                                      ...prev,
                                      [member.accountId]: {
                                        ...prev[member.accountId],
                                        gold: prev[member.accountId]?.gold || 0,
                                        rubies: prev[member.accountId]?.rubies || 0,
                                        soulShards: parseInt(e.target.value) || 0,
                                        focusedShards: prev[member.accountId]?.focusedShards || 0,
                                      }
                                    }))}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Focused Shards ({guild.bank.focusedShards.toLocaleString()} available)</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    max={guild.bank.focusedShards}
                                    value={distributions[member.accountId]?.focusedShards || 0}
                                    onChange={(e) => setDistributions(prev => ({
                                      ...prev,
                                      [member.accountId]: {
                                        ...prev[member.accountId],
                                        gold: prev[member.accountId]?.gold || 0,
                                        rubies: prev[member.accountId]?.rubies || 0,
                                        soulShards: prev[member.accountId]?.soulShards || 0,
                                        focusedShards: parseInt(e.target.value) || 0,
                                      }
                                    }))}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <DialogFooter>
                          <Button
                            onClick={() => {
                              const dists = Object.entries(distributions)
                                .filter(([_, v]) => v.gold > 0 || v.rubies > 0 || v.soulShards > 0 || v.focusedShards > 0)
                                .map(([accountId, v]) => ({
                                  accountId,
                                  gold: v.gold || 0,
                                  rubies: v.rubies || 0,
                                  soulShards: v.soulShards || 0,
                                  focusedShards: v.focusedShards || 0,
                                }));
                              if (dists.length > 0) {
                                distributeMutation.mutate(dists);
                              }
                            }}
                            disabled={distributeMutation.isPending}
                          >
                            Distribute
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Unity Group Quests Section */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-500" />
                  Unity Group Quests
                </CardTitle>
                <CardDescription>
                  Work together with your guild to complete these challenges for shared rewards.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {guildQuests.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4 col-span-2">No active group quests</p>
                  ) : (
                    guildQuests.map((quest) => {
                      const myContribution = quest.contributions.find(c => c.accountId === account.id)?.amount || 0;
                      const progress = (quest.currentAmount / quest.targetAmount) * 100;
                      
                      return (
                        <div key={quest.id} className="p-4 rounded-lg border bg-card/50 space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-bold text-primary">{quest.name}</h4>
                              <p className="text-xs text-muted-foreground">{quest.description}</p>
                            </div>
                            <Badge variant="outline">{quest.type.toUpperCase()}</Badge>
                          </div>
                          
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span>Progress: {quest.currentAmount} / {quest.targetAmount}</span>
                              <span>{Math.round(progress)}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="p-1.5 rounded bg-blue-500/10 border border-blue-500/20">
                              <p className="text-[10px] text-blue-400 uppercase font-bold">Unity</p>
                              <p className="text-sm font-bold">{quest.rewardUnityCoins}</p>
                            </div>
                            <div className="p-1.5 rounded bg-yellow-500/10 border border-yellow-500/20">
                              <p className="text-[10px] text-yellow-400 uppercase font-bold">Gold</p>
                              <p className="text-sm font-bold">{quest.rewardGold.toLocaleString()}</p>
                            </div>
                            <div className="p-1.5 rounded bg-purple-500/10 border border-purple-500/20">
                              <p className="text-[10px] text-purple-400 uppercase font-bold">Guild EXP</p>
                              <p className="text-sm font-bold">{quest.rewardGuildExp}</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2">
                            <span className="text-xs text-muted-foreground">My Contribution: {myContribution}</span>
                            <Button 
                              size="sm" 
                              variant="secondary"
                              onClick={() => contributeQuestMutation.mutate({ questId: quest.id, amount: 1 })}
                              disabled={contributeQuestMutation.isPending}
                            >
                              Contribute +1
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>

            {dungeonInfo?.activeBuffs && dungeonInfo.activeBuffs.length > 0 && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-yellow-400" />
                    Active Guild Buffs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {dungeonInfo.activeBuffs.map((buff) => {
                      const timeLeft = Math.max(0, Math.floor((new Date(buff.expiresAt).getTime() - Date.now()) / 3600000));
                      return (
                        <div key={buff.id} className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-yellow-400" />
                          <div>
                            <p className="font-medium text-yellow-400 text-sm">{buff.name}</p>
                            <p className="text-xs text-muted-foreground">
                              +{buff.bonusPercent}% {buff.stat === "all" ? "All Stats" : buff.stat} · {timeLeft}h remaining
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {dungeonInfo?.unityCoins !== undefined && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-blue-400" />
                    Unity Coins: {dungeonInfo.unityCoins.toLocaleString()}
                    <Badge variant="outline" className="ml-2 border-blue-400 text-blue-400">
                      {dungeonInfo.dungeonsCompleted}/5 Dungeons Completed
                    </Badge>
                  </CardTitle>
                </CardHeader>
              </Card>
            )}

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Castle className="w-5 h-5 text-red-500" />
                  Guild Dungeons (5-Tier Chain)
                </CardTitle>
                <CardDescription>
                  Complete each dungeon to unlock the next. Difficulty scales with online member stats.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dungeonInfo && (
                  <div className="space-y-4">
                    <div className="mb-4">
                      <p className="text-sm text-muted-foreground mb-2">Online Guild Members:</p>
                      <div className="flex flex-wrap gap-2">
                        {dungeonInfo.onlineMembers.length === 0 ? (
                          <span className="text-muted-foreground text-sm">None online</span>
                        ) : (
                          dungeonInfo.onlineMembers.map((m) => (
                            <div key={m.accountId} className="flex items-center gap-1">
                              <Badge variant="secondary">{m.username}</Badge>
                              {m.equippedPet && (
                                <Badge variant="outline" className="text-xs border-purple-400 text-purple-400">
                                  {m.equippedPet.name}
                                </Badge>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-1">
                      {(dungeonInfo.dungeons || []).map((dungeon) => {
                        const cooldownHoursLeft = dungeon.buffExpiresAt
                          ? Math.max(0, Math.ceil((new Date(dungeon.buffExpiresAt).getTime() - Date.now()) / 3600000))
                          : 0;
                        return (
                        <div
                          key={dungeon.tier}
                          className={`p-4 rounded-lg border ${
                            dungeon.isCompleted
                              ? 'bg-blue-500/10 border-blue-500/30'
                              : dungeon.isUnlocked
                              ? 'bg-red-500/10 border-red-500/30'
                              : 'bg-muted/30 border-border opacity-60'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Castle className={`w-5 h-5 ${dungeon.isCompleted ? 'text-blue-400' : dungeon.isUnlocked ? 'text-red-500' : 'text-muted-foreground'}`} />
                              <span className="font-bold">Tier {dungeon.tier}: {dungeon.name}</span>
                              {dungeon.isCompleted && (
                                <Badge className="bg-blue-600 text-white">On Cooldown ({cooldownHoursLeft}h)</Badge>
                              )}
                              {!dungeon.isUnlocked && (
                                <Badge variant="outline" className="text-muted-foreground">
                                  Locked (Guild Lv{dungeon.unlockRequirement.guildLevel}{dungeon.unlockRequirement.previousDungeon > 0 ? ` + Dungeon ${dungeon.unlockRequirement.previousDungeon}` : ''})
                                </Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">{dungeon.description}</p>

                          {dungeon.isCompleted && (
                            <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 mb-3">
                              <Sparkles className="w-3 h-3 inline mr-1 text-yellow-400" />
                              <span className="text-yellow-400 font-medium">{dungeon.buff.name}</span> buff is active on all guild members — +{dungeon.buff.bonusPercent}% {dungeon.buff.stat === "all" ? "All Stats" : dungeon.buff.stat}. Refreshes in {cooldownHoursLeft}h.
                            </div>
                          )}
                          
                          {dungeon.isUnlocked && !dungeon.isCompleted && (
                            <div className="grid gap-3 md:grid-cols-3">
                              <div className="p-2 rounded bg-card/50 border border-border">
                                <p className="text-xs text-muted-foreground mb-1">Enemy Stats</p>
                                <div className="grid grid-cols-2 gap-1 text-xs">
                                  <span>STR: {dungeon.npcStats.Str.toLocaleString()}</span>
                                  <span>SPD: {dungeon.npcStats.Spd.toLocaleString()}</span>
                                  <span>INT: {dungeon.npcStats.Int.toLocaleString()}</span>
                                  <span>LUCK: {dungeon.npcStats.Luck.toLocaleString()}</span>
                                </div>
                              </div>
                              <div className="p-2 rounded bg-yellow-500/10 border border-yellow-500/30">
                                <p className="text-xs text-yellow-500 mb-1">Rewards</p>
                                <div className="text-xs space-y-0.5">
                                  <p className="text-blue-400">{dungeon.rewards.unityCoins} Unity Coins</p>
                                  <p className="text-yellow-400">{dungeon.rewards.gold.toLocaleString()} Gold</p>
                                  {dungeon.rewards.shards > 0 && (
                                    <p className="text-purple-400">{dungeon.rewards.shards} Shards</p>
                                  )}
                                </div>
                              </div>
                              <div className="p-2 rounded bg-blue-500/10 border border-blue-500/30">
                                <p className="text-xs text-blue-400 mb-1">Buff (24h on win)</p>
                                <p className="text-xs">{dungeon.buff.name}</p>
                                <p className="text-xs text-muted-foreground">+{dungeon.buff.bonusPercent}% {dungeon.buff.stat === "all" ? "All Stats" : dungeon.buff.stat}</p>
                              </div>
                            </div>
                          )}

                          {dungeon.isUnlocked && !dungeon.isCompleted && (
                            <Button
                              className="w-full mt-3"
                              size="sm"
                              onClick={() => fightDungeonMutation.mutate(dungeon.tier)}
                              disabled={fightDungeonMutation.isPending}
                              data-testid={`button-fight-dungeon-${dungeon.tier}`}
                            >
                              <Swords className="w-4 h-4 mr-2" />
                              {fightDungeonMutation.isPending ? "Fighting..." : `Fight with ${Math.max(1, dungeonInfo.onlineMembers.length)} Members`}
                            </Button>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {dungeonInfo?.perks && dungeonInfo.perks.length > 0 && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-500" />
                    Guild Perks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 md:grid-cols-2">
                    {dungeonInfo.perks.map((perk) => (
                      <div
                        key={perk.level}
                        className={`p-3 rounded-lg border flex items-center gap-3 ${
                          perk.unlocked ? 'bg-amber-500/10 border-amber-500/30' : 'bg-muted/20 border-border opacity-50'
                        }`}
                      >
                        <Badge variant={perk.unlocked ? "default" : "outline"} className="shrink-0">
                          Lv{perk.level}
                        </Badge>
                        <div>
                          <p className={`text-sm font-medium ${perk.unlocked ? 'text-amber-400' : 'text-muted-foreground'}`}>{perk.name}</p>
                          <p className="text-xs text-muted-foreground">{perk.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Zone Conquest Section */}
            {guild && (() => {
              const ZONE_DISPLAY: Record<string, { label: string; icon: string; minRank: string }> = {
                capital_city:     { label: "Capital City",     icon: "🏛️", minRank: "Novice" },
                mountain_caverns: { label: "Mountain Caverns", icon: "⛰️", minRank: "Apprentice" },
                ancient_ruins:    { label: "Ancient Ruins",    icon: "🏚️", minRank: "Initiate" },
                enchanted_forest: { label: "Enchanted Forest", icon: "🌲", minRank: "Apprentice" },
                crystal_lake:     { label: "Crystal Lake",     icon: "💧", minRank: "Journeyman" },
                coastal_village:  { label: "Coastal Village",  icon: "⚓", minRank: "Journeyman" },
                ruby_mines:       { label: "Ruby Mines",       icon: "💎", minRank: "Expert" },
                battle_arena:     { label: "Battle Arena",     icon: "⚔️", minRank: "Expert" },
                research_lab:     { label: "Research Lab",     icon: "🔬", minRank: "Scholar" },
                pet_training:     { label: "Pet Training Grounds", icon: "🐾", minRank: "Journeyman" },
                hell_zone:        { label: "Hell Zone",        icon: "🔥", minRank: "Veteran" },
                mystic_tower:     { label: "Mystic Tower",     icon: "🗼", minRank: "Master" },
              };
              const ALL_ZONES = Object.keys(ZONE_DISPLAY);
              return (
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-violet-400" />
                      Zone Conquest
                    </CardTitle>
                    <CardDescription>
                      Conquer zones across the realm to earn tax income for your guild. Claim unclaimed zones for 5,000 guild gold. Reduce enemy defense to 0 to seize their territory.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 md:grid-cols-2">
                      {ALL_ZONES.map((zoneId) => {
                        const info = ZONE_DISPLAY[zoneId];
                        const conquest = zoneConquests.find(z => z.zoneId === zoneId);
                        const isOurs = conquest?.guildId === guild.id;
                        const isEnemy = !!conquest?.guildId && conquest.guildId !== guild.id;
                        const isUnclaimed = !conquest?.guildId;
                        const defense = conquest?.defensePoints ?? 100;

                        return (
                          <div
                            key={zoneId}
                            className={`p-3 rounded-lg border flex items-center justify-between gap-2 ${
                              isOurs
                                ? "bg-violet-500/10 border-violet-500/30"
                                : isEnemy
                                ? "bg-red-500/10 border-red-500/30"
                                : "bg-muted/20 border-border"
                            }`}
                          >
                            <div className="flex items-center gap-2 justify-between">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="text-xl shrink-0">{info.icon}</span>
                                <div className="min-w-0">
                                  <p className="font-medium text-sm truncate">{info.label}</p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {isOurs
                                      ? `Your guild · Defense: ${defense}/100`
                                      : isEnemy
                                      ? `${conquest!.guildName || "Enemy"} · Defense: ${defense}/100`
                                      : "Unclaimed · 5,000 gold to claim"}
                                  </p>
                                </div>
                              </div>
                              <div className="shrink-0">
                                {isOurs ? (
                                  <Badge variant="outline" className="border-violet-400 text-violet-400 text-xs">Owned</Badge>
                                ) : isEnemy ? (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-7 text-xs px-2"
                                    onClick={() => attackZoneMutation.mutate(zoneId)}
                                    disabled={attackZoneMutation.isPending}
                                  >
                                    <Swords className="w-3 h-3 mr-1" />
                                    Attack
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    className="h-7 text-xs px-2 bg-violet-600 hover:bg-violet-700"
                                    onClick={() => claimZoneMutation.mutate(zoneId)}
                                    disabled={claimZoneMutation.isPending}
                                  >
                                    <Crown className="w-3 h-3 mr-1" />
                                    Claim
                                  </Button>
                                )}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full h-7 text-xs mt-2 border-amber-500/40 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
                              onClick={() => openZoneDungeon(zoneId)}
                            >
                              <Layers className="w-3 h-3 mr-1" />
                              Enter Zone Dungeon
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Applications Management Section (for masters/officers) */}
            {canManageApplications && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-blue-400" />
                    Applications
                    {pendingApplications.length > 0 && (
                      <Badge className="ml-1 bg-blue-500 text-white">{pendingApplications.length}</Badge>
                    )}
                  </CardTitle>
                  <CardDescription>Review and respond to pending join applications.</CardDescription>
                </CardHeader>
                <CardContent>
                  {pendingApplications.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">No pending applications.</p>
                  ) : (
                    <div className="space-y-2">
                      {pendingApplications.map((app) => (
                        <div
                          key={app.id}
                          className="flex items-center justify-between p-3 rounded-lg border border-border"
                          data-testid={`application-${app.id}`}
                        >
                          <div>
                            <p className="font-medium">{app.applicantName}</p>
                            <p className="text-xs text-muted-foreground">
                              {app.applicantLevel}
                              {app.applicantClass ? ` · ${app.applicantClass}` : ""}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => respondApplicationMutation.mutate({ applicationId: app.id, approve: true })}
                              disabled={respondApplicationMutation.isPending}
                              data-testid={`button-approve-${app.id}`}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => respondApplicationMutation.mutate({ applicationId: app.id, approve: false })}
                              disabled={respondApplicationMutation.isPending}
                              data-testid={`button-reject-${app.id}`}
                            >
                              Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Guild Battles Section */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Swords className="w-5 h-5 text-orange-500" />
                    Guild Battles
                  </div>
                  {isMaster && (
                    <Dialog open={battleDialogOpen} onOpenChange={setBattleDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" data-testid="button-challenge-guild">
                          <Plus className="w-4 h-4 mr-1" />
                          Challenge Guild
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Challenge Another Guild</DialogTitle>
                          <DialogDescription>
                            Select a guild to challenge and pick your fighters.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label>Select Guild</Label>
                            <Select value={selectedOpponentGuild} onValueChange={setSelectedOpponentGuild}>
                              <SelectTrigger data-testid="select-opponent-guild">
                                <SelectValue placeholder="Choose a guild..." />
                              </SelectTrigger>
                              <SelectContent>
                                {allGuilds.filter(g => g.id !== guild?.id).map(g => (
                                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Select Fighters (up to 5)</Label>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {guild?.members.map(m => (
                                <Badge
                                  key={m.accountId}
                                  variant={selectedFighters.includes(m.accountId) ? "default" : "outline"}
                                  className="cursor-pointer"
                                  onClick={() => {
                                    if (selectedFighters.includes(m.accountId)) {
                                      setSelectedFighters(selectedFighters.filter(f => f !== m.accountId));
                                    } else if (selectedFighters.length < 5) {
                                      setSelectedFighters([...selectedFighters, m.accountId]);
                                    }
                                  }}
                                  data-testid={`fighter-select-${m.accountId}`}
                                >
                                  {m.username}
                                </Badge>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Selected: {selectedFighters.length}/5</p>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            onClick={() => challengeGuildMutation.mutate({
                              challengedGuildId: selectedOpponentGuild,
                              fighters: selectedFighters
                            })}
                            disabled={!selectedOpponentGuild || selectedFighters.length === 0 || challengeGuildMutation.isPending}
                            data-testid="button-send-challenge"
                          >
                            Send Challenge
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Incoming Challenges (for guild master) */}
                {isMaster && pendingBattles.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 text-yellow-500">Incoming Challenges</h4>
                    <div className="space-y-2">
                      {pendingBattles.map(battle => (
                        <div key={battle.id} className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                          <div>
                            <p className="font-medium">{battle.challengerGuildName}</p>
                            <p className="text-xs text-muted-foreground">{battle.challengerFighters.length} fighters</p>
                          </div>
                          <div className="flex gap-2">
                            <Dialog open={respondBattleId === battle.id} onOpenChange={(open) => !open && setRespondBattleId(null)}>
                              <DialogTrigger asChild>
                                <Button size="sm" onClick={() => setRespondBattleId(battle.id)} data-testid={`button-respond-${battle.id}`}>
                                  Accept
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Accept Challenge</DialogTitle>
                                  <DialogDescription>Select your fighters to accept this challenge.</DialogDescription>
                                </DialogHeader>
                                <div>
                                  <Label>Select Fighters (up to 5 - opponent has {battle.challengerFighters.length})</Label>
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {guild?.members.map(m => (
                                      <Badge
                                        key={m.accountId}
                                        variant={respondFighters.includes(m.accountId) ? "default" : "outline"}
                                        className="cursor-pointer"
                                        onClick={() => {
                                          if (respondFighters.includes(m.accountId)) {
                                            setRespondFighters(respondFighters.filter(f => f !== m.accountId));
                                          } else if (respondFighters.length < 5) {
                                            setRespondFighters([...respondFighters, m.accountId]);
                                          }
                                        }}
                                      >
                                        {m.username}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button
                                    onClick={() => respondBattleMutation.mutate({
                                      battleId: battle.id,
                                      accept: true,
                                      fighters: respondFighters
                                    })}
                                    disabled={respondFighters.length !== battle.challengerFighters.length || respondBattleMutation.isPending}
                                  >
                                    Accept Battle
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => respondBattleMutation.mutate({ battleId: battle.id, accept: false })}
                              disabled={respondBattleMutation.isPending}
                              data-testid={`button-decline-${battle.id}`}
                            >
                              Decline
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Active Battles */}
                {activeBattles.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 text-green-500">Active Battles</h4>
                    <div className="space-y-2">
                      {activeBattles.map(battle => {
                        const isChallenger = battle.challengerGuildId === guild?.id;
                        const opponentName = isChallenger ? battle.challengedGuildName : battle.challengerGuildName;
                        const ourScore = isChallenger ? battle.challengerScore : battle.challengedScore;
                        const theirScore = isChallenger ? battle.challengedScore : battle.challengerScore;
                        return (
                          <div key={battle.id} className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                            <div>
                              <p className="font-medium">vs {opponentName}</p>
                              <p className="text-xs text-muted-foreground">Round {battle.currentRound + 1}</p>
                            </div>
                            <Badge variant="outline" className="text-lg">
                              {ourScore} - {theirScore}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Recent Completed Battles */}
                {completedBattles.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Recent Battles</h4>
                    <div className="space-y-2">
                      {completedBattles.map(battle => {
                        const isChallenger = battle.challengerGuildId === guild?.id;
                        const opponentName = isChallenger ? battle.challengedGuildName : battle.challengerGuildName;
                        const won = battle.winnerId === guild?.id;
                        const ourScore = isChallenger ? battle.challengerScore : battle.challengedScore;
                        const theirScore = isChallenger ? battle.challengedScore : battle.challengerScore;
                        return (
                          <div key={battle.id} className={`flex items-center justify-between p-3 rounded-lg ${won ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                            <div>
                              <p className="font-medium">vs {opponentName}</p>
                              <Badge variant={won ? "default" : "destructive"} className="text-xs">
                                {won ? "Victory" : "Defeat"}
                              </Badge>
                            </div>
                            <span className="font-mono">{ourScore} - {theirScore}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {pendingBattles.length === 0 && activeBattles.length === 0 && completedBattles.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">No guild battles yet. {isMaster && "Challenge another guild!"}</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Soul Links Section */}
        <div className="max-w-4xl mx-auto mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                Soul Links
              </CardTitle>
              <CardDescription>
                Form a mystical bond with another player for shared stat bonuses. Soul links cost gold from both players.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {soulLinks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">No active soul links. Forge a bond with another player below.</p>
              ) : (
                <div className="space-y-2">
                  {soulLinks.map((link: any) => {
                    const partner = link.player1Id === account.id ? link.player2Name : link.player1Name;
                    return (
                      <div key={link.id} className="flex items-center gap-3 p-3 rounded-lg border border-purple-500/30 bg-purple-900/10">
                        <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white">Linked with <span className="text-purple-300">{partner || "Unknown"}</span></p>
                          {link.bonuses && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Bonuses: {Object.entries(link.bonuses as Record<string, any>).map(([k, v]) => `+${v} ${k}`).join(", ")}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Since {new Date(link.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge className="text-[10px] bg-purple-500/30 text-purple-300 border-purple-500">Active</Badge>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2 font-medium">Forge New Soul Link</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter player ID or username..."
                    value={soulLinkPartner}
                    onChange={(e) => setSoulLinkPartner(e.target.value)}
                    className="flex-1 h-8 text-sm"
                    data-testid="input-soul-link-partner"
                  />
                  <Button
                    size="sm"
                    onClick={() => createSoulLinkMutation.mutate(soulLinkPartner)}
                    disabled={!soulLinkPartner.trim() || createSoulLinkMutation.isPending}
                    className="shrink-0 bg-purple-700 hover:bg-purple-600 border border-purple-500/40"
                    data-testid="button-create-soul-link"
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1" />
                    {createSoulLinkMutation.isPending ? "Forging..." : "Forge Link"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>
              Set role for {roleTarget?.username}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as "officer" | "member")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="officer">Officer</SelectItem>
                <SelectItem value="member">Member</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {selectedRole === "officer" 
                ? "Officers can invite players and kick members (but not other officers or the leader)."
                : "Members have basic guild access."}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (roleTarget) {
                  setRoleMutation.mutate({ targetAccountId: roleTarget.accountId, role: selectedRole });
                }
              }}
              disabled={setRoleMutation.isPending}
            >
              {setRoleMutation.isPending ? "Saving..." : "Save Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

    {/* Zone Dungeon Dialog */}
    <Dialog open={zoneDungeonOpen} onOpenChange={(open) => { if (!open) { setZoneDungeonOpen(false); setSelectedDungeonZone(null); } }}>
      <DialogContent className="max-w-md bg-gray-950 border-amber-500/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-300">
            <Layers className="w-5 h-5" />
            {zoneDungeonMeta?.name || (selectedDungeonZone ? selectedDungeonZone.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) + " Dungeon" : "Zone Dungeon")}
          </DialogTitle>
          <DialogDescription className="text-gray-400 text-sm">
            Fight through dungeon floors to earn gold, XP, training points and soul shards.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {enterZoneDungeonMutation.isPending && (
            <div className="flex items-center justify-center gap-2 py-6 text-amber-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Entering dungeon…</span>
            </div>
          )}

          {!enterZoneDungeonMutation.isPending && dungeonRun && !dungeonFinished && (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-gray-900/60 rounded-lg px-3 py-2">
                <span className="text-xs text-gray-400">Floor</span>
                <span className="text-sm font-bold text-amber-300">
                  {dungeonRun.currentFloor > (zoneDungeonMeta?.floors || 5)
                    ? "👑 BOSS FLOOR"
                    : `${dungeonRun.currentFloor} / ${zoneDungeonMeta?.floors || "?"}`}
                </span>
              </div>

              {lastFightResult && (
                <div className={`rounded-lg px-3 py-2 text-sm border ${lastFightResult.success ? "bg-green-900/20 border-green-500/30 text-green-300" : "bg-red-900/20 border-red-500/30 text-red-300"}`}>
                  <p className="font-semibold mb-1">{lastFightResult.success ? "⚔️ Victory!" : "💀 Defeated!"}</p>
                  <p className="text-xs opacity-80">{lastFightResult.message}</p>
                  {lastFightResult.success && lastFightResult.rewards && (
                    <div className="flex gap-3 mt-1 text-xs text-gray-300">
                      <span>+{(lastFightResult.rewards.gold || 0).toLocaleString()} gold</span>
                      {lastFightResult.rewards.trainingPoints > 0 && <span>+{lastFightResult.rewards.trainingPoints} TP</span>}
                      {lastFightResult.rewards.soulShards > 0 && <span>+{lastFightResult.rewards.soulShards} shards</span>}
                    </div>
                  )}
                </div>
              )}

              <Button
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-semibold"
                onClick={() => fightZoneDungeonMutation.mutate(selectedDungeonZone!)}
                disabled={fightZoneDungeonMutation.isPending}
              >
                {fightZoneDungeonMutation.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Fighting…</>
                  : <><Swords className="w-4 h-4 mr-2" />Fight Next Enemy</>}
              </Button>
            </div>
          )}

          {dungeonFinished && lastFightResult && (
            <div className="space-y-3">
              {lastFightResult.dungeonCompleted ? (
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg px-4 py-3 text-center">
                  <p className="text-yellow-300 font-bold text-base mb-1">🏆 Dungeon Cleared!</p>
                  <p className="text-xs text-gray-300 mb-3">{lastFightResult.message}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-gray-900/60 rounded px-2 py-1">
                      <p className="text-gray-400">Gold Earned</p>
                      <p className="text-yellow-300 font-bold">{(lastFightResult.rewards?.gold || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-gray-900/60 rounded px-2 py-1">
                      <p className="text-gray-400">XP Earned</p>
                      <p className="text-blue-300 font-bold">{(lastFightResult.rewards?.xp || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-gray-900/60 rounded px-2 py-1">
                      <p className="text-gray-400">Training Pts</p>
                      <p className="text-green-300 font-bold">{lastFightResult.rewards?.trainingPoints || 0}</p>
                    </div>
                    <div className="bg-gray-900/60 rounded px-2 py-1">
                      <p className="text-gray-400">Soul Shards</p>
                      <p className="text-purple-300 font-bold">{lastFightResult.rewards?.soulShards || 0}</p>
                    </div>
                  </div>
                  {lastFightResult.rewards?.rareItemDropped && (
                    <p className="mt-2 text-xs text-pink-300 font-semibold">✨ Rare item dropped: {lastFightResult.rewards.rareItemDropped}</p>
                  )}
                </div>
              ) : (
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3 text-center">
                  <p className="text-red-300 font-bold text-base mb-1">💀 Dungeon Run Ended</p>
                  <p className="text-xs text-gray-300 mb-2">{lastFightResult.message}</p>
                  <p className="text-xs text-gray-400">Gold earned this run: {(lastFightResult.rewards?.gold || 0).toLocaleString()}</p>
                </div>
              )}
              <Button
                className="w-full bg-violet-600 hover:bg-violet-500 text-white"
                onClick={() => { setDungeonFinished(false); enterZoneDungeonMutation.mutate(selectedDungeonZone!); }}
              >
                <ChevronRight className="w-4 h-4 mr-1" />
                Run Again
              </Button>
            </div>
          )}

          {!enterZoneDungeonMutation.isPending && !dungeonRun && !dungeonFinished && (
            <div className="text-center py-4 text-gray-500 text-sm">
              <Skull className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>Preparing dungeon…</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" className="text-gray-400 hover:text-white" onClick={() => setZoneDungeonOpen(false)}>
            Leave Dungeon
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    </ZoneScene>
  );
}
