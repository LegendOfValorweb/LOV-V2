import { useState, useRef, useEffect } from "react";
import { useGame } from "@/lib/game-context";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send, Sparkles, BookOpen, ArrowLeft, Map, Smile, Zap, Shield, Eye } from "lucide-react";
import { Link, useLocation } from "wouter";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Storyline {
  id: string;
  accountId: string;
  currentChapter: number;
  guidePersonality: string;
  conversationHistory: ChatMessage[];
}

interface StoryActInfo {
  act: number;
  name: string;
  description: string;
  chapter: number;
  personality: string;
  tutorialCompleted: boolean;
}

const PERSONALITY_INFO: Record<string, { icon: React.ReactNode; color: string; description: string }> = {
  friendly: { icon: <Smile className="w-4 h-4" />, color: "text-green-400", description: "Warm and encouraging mentor" },
  sarcastic: { icon: <Zap className="w-4 h-4" />, color: "text-yellow-400", description: "Witty rogue with dry humor" },
  serious: { icon: <Shield className="w-4 h-4" />, color: "text-blue-400", description: "Dignified ancient sage" },
  mysterious: { icon: <Eye className="w-4 h-4" />, color: "text-purple-400", description: "Cryptic oracle of secrets" },
};

export default function AIChat() {
  const { account } = useGame();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, navigate] = useLocation();
  const [input, setInput] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState<string | null>(null);
  const [loadingWelcome, setLoadingWelcome] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: storyActInfo } = useQuery<StoryActInfo>({
    queryKey: ["/api/ai/story-act", account?.id],
    queryFn: async () => {
      if (!account?.id) return null;
      const res = await fetch(`/api/ai/story-act/${account.id}`);
      if (!res.ok) throw new Error("Failed to fetch story act");
      return res.json();
    },
    enabled: !!account?.id,
  });

  const personalityMutation = useMutation({
    mutationFn: async (personality: string) => {
      const res = await apiRequest("POST", `/api/ai/personality/${account?.id}`, { personality });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/story-act"] });
      toast({ title: "Guide personality updated!" });
    },
  });

  const [tutorialContent, setTutorialContent] = useState<string | null>(null);
  const [loadingTutorial, setLoadingTutorial] = useState(false);

  const fetchTutorial = async (topic: string) => {
    if (!account?.id) return;
    setLoadingTutorial(true);
    try {
      const res = await fetch(`/api/ai/tutorial/${account.id}/${topic}`);
      const data = await res.json();
      setTutorialContent(data.content);
    } catch (error) {
      console.error("Failed to fetch tutorial:", error);
    }
    setLoadingTutorial(false);
  };

  const completeTutorial = async () => {
    if (!account?.id) return;
    try {
      await apiRequest("POST", `/api/ai/tutorial/${account.id}/complete`, {});
      queryClient.invalidateQueries({ queryKey: ["/api/ai/story-act"] });
      setTutorialContent(null);
      toast({ title: "Tutorial completed! Explore the world!" });
    } catch (error) {
      console.error("Failed to complete tutorial:", error);
    }
  };
  
  // Check for welcome parameter and fetch intro
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("welcome") === "true" && account?.id && !welcomeMessage) {
      setLoadingWelcome(true);
      fetch(`/api/ai/welcome/${account.id}`)
        .then(res => res.json())
        .then(data => {
          setWelcomeMessage(data.message);
          setLoadingWelcome(false);
          // Clear the URL param
          window.history.replaceState({}, "", "/ai-chat");
        })
        .catch(() => {
          setLoadingWelcome(false);
          setWelcomeMessage(`Welcome to Legends of Valor, ${account.username}! I'm your Game Master. Ask me anything about your adventure!`);
        });
    }
  }, [account?.id]);

  const { data: storyline, refetch: refetchStoryline } = useQuery<Storyline>({
    queryKey: ["/api/ai/storyline", account?.id],
    queryFn: async () => {
      if (!account?.id) return null;
      const res = await fetch(`/api/ai/storyline/${account.id}`);
      if (!res.ok) throw new Error("Failed to fetch storyline");
      return res.json();
    },
    enabled: !!account?.id,
  });

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", "/api/ai/chat", {
        accountId: account?.id,
        message,
      });
      return res.json();
    },
    onSuccess: () => {
      refetchStoryline();
    },
    onError: (error: Error) => {
      toast({
        title: "Chat Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    if (!input.trim() || chatMutation.isPending) return;
    chatMutation.mutate(input);
    setInput("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [storyline?.conversationHistory]);

  if (!account) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
        <Card className="bg-gray-800/90 border-purple-500/30">
          <CardContent className="p-8 text-center">
            <Sparkles className="w-12 h-12 mx-auto mb-4 text-purple-400" />
            <p className="text-gray-300">Please log in to chat with the Game Master AI</p>
            <Link href="/">
              <Button variant="outline" className="mt-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const messages = storyline?.conversationHistory || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => navigate("/world-map")}>
              <Map className="w-4 h-4 mr-2" />
              World Map
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 font-cinzel flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-purple-400" />
                Story Guide
              </h1>
              <p className="text-gray-400 text-sm">Your personal companion through Legends of Valor</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {storyActInfo && (
              <div className="text-right">
                <div className="flex items-center gap-2 justify-end mb-1">
                  <Badge variant="outline" className="border-amber-500/50 text-amber-300">
                    Act {storyActInfo.act}: {storyActInfo.name}
                  </Badge>
                  <Badge variant="outline" className="border-purple-500/50 text-purple-300">
                    <BookOpen className="w-3 h-3 mr-1" />
                    Ch. {storyActInfo.chapter}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500">{storyActInfo.description}</p>
              </div>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowSettings(!showSettings)}
              className={PERSONALITY_INFO[storyActInfo?.personality || "friendly"]?.color}
            >
              {PERSONALITY_INFO[storyActInfo?.personality || "friendly"]?.icon}
            </Button>
          </div>
        </div>
        
        {storyActInfo && !storyActInfo.tutorialCompleted && !tutorialContent && (
          <Card className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 border-purple-500/30 mb-4 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-purple-300 mb-1">New to Legends of Valor?</h3>
                <p className="text-xs text-gray-400">Get a personalized tutorial from your Story Guide</p>
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => fetchTutorial("newPlayer")}
                  disabled={loadingTutorial}
                  className="border-purple-500/50 text-purple-300"
                >
                  {loadingTutorial ? <Loader2 className="w-4 h-4 animate-spin" /> : "Start Tutorial"}
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={completeTutorial}
                  className="text-gray-400"
                >
                  Skip
                </Button>
              </div>
            </div>
          </Card>
        )}
        
        {tutorialContent && (
          <Card className="bg-purple-900/30 border-purple-500/30 mb-4 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-purple-400 mt-1 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-purple-300 mb-2">Story Guide Tutorial</h3>
                <p className="text-sm text-gray-200 whitespace-pre-wrap">{tutorialContent}</p>
                <div className="flex gap-2 mt-3">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => fetchTutorial("combatIntro")}
                    disabled={loadingTutorial}
                    className="border-amber-500/50 text-amber-300"
                  >
                    Combat Guide
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => fetchTutorial("storyProgress")}
                    disabled={loadingTutorial}
                    className="border-blue-500/50 text-blue-300"
                  >
                    Story Acts
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={completeTutorial}
                    className="bg-purple-600 hover:bg-purple-500"
                  >
                    Done
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}
        
        {showSettings && (
          <Card className="bg-gray-800/80 border-purple-500/30 mb-4 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-purple-300 mb-1">Guide Personality</h3>
                <p className="text-xs text-gray-400">Change how your Story Guide speaks to you</p>
              </div>
              <Select 
                value={storyActInfo?.personality || "friendly"} 
                onValueChange={(val) => personalityMutation.mutate(val)}
              >
                <SelectTrigger className="w-[180px] bg-gray-700/50 border-purple-500/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PERSONALITY_INFO).map(([key, info]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <span className={info.color}>{info.icon}</span>
                        <span className="capitalize">{key}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {PERSONALITY_INFO[storyActInfo?.personality || "friendly"]?.description}
            </p>
          </Card>
        )}

        <Card className="bg-gray-800/90 border-purple-500/30 h-[calc(100vh-200px)] flex flex-col">
          <CardHeader className="border-b border-purple-500/20 py-3">
            <CardTitle className="text-lg text-purple-300">
              {account.username}'s Journey
            </CardTitle>
          </CardHeader>
          
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-4">
              {/* Welcome message from login */}
              {loadingWelcome && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] bg-purple-500/20 border border-purple-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-purple-300">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      The Game Master is preparing your welcome...
                    </div>
                  </div>
                </div>
              )}
              
              {welcomeMessage && !loadingWelcome && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] bg-purple-500/20 border border-purple-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span className="text-purple-300 font-semibold text-sm">Story Guide</span>
                    </div>
                    <p className="text-gray-200">{welcomeMessage}</p>
                  </div>
                </div>
              )}
              
              {messages.length === 0 && !welcomeMessage && !loadingWelcome && (
                <div className="text-center py-8">
                  <Sparkles className="w-16 h-16 mx-auto mb-4 text-purple-400/50" />
                  <p className="text-gray-400 italic">
                    "Greetings, brave {account.username}. Your adventure awaits..."
                  </p>
                  <p className="text-gray-500 text-sm mt-2">
                    Start a conversation to begin your unique storyline
                  </p>
                </div>
              )}
              
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-purple-600/30 border border-purple-500/30 text-white"
                        : "bg-gray-700/50 border border-gray-600/30 text-gray-200"
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <div className="flex items-center gap-2 mb-2 text-purple-400 text-xs font-semibold">
                        <Sparkles className="w-3 h-3" />
                        Story Guide
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              
              {chatMutation.isPending && (
                <div className="flex justify-start">
                  <div className="bg-gray-700/50 border border-gray-600/30 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2 text-purple-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">The Story Guide is pondering...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          
          <div className="p-4 border-t border-purple-500/20">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about quests, lore, or your adventure..."
                className="flex-1 bg-gray-700/50 border-purple-500/30 focus:border-purple-400"
                disabled={chatMutation.isPending}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || chatMutation.isPending}
                className="bg-purple-600 hover:bg-purple-500"
              >
                {chatMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              The AI may suggest story rewards that require admin approval
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
