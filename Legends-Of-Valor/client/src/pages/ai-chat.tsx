import { useState, useRef, useEffect } from "react";
import { useGame } from "@/lib/game-context";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Sparkles, BookOpen, ArrowLeft, ShoppingBag } from "lucide-react";
import { Link, useLocation } from "wouter";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Storyline {
  id: string;
  accountId: string;
  currentChapter: number;
  conversationHistory: ChatMessage[];
}

export default function AIChat() {
  const { account } = useGame();
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const [input, setInput] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState<string | null>(null);
  const [loadingWelcome, setLoadingWelcome] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
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
            <Link href="/shop">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 font-cinzel flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-purple-400" />
                Game Master AI
              </h1>
              <p className="text-gray-400 text-sm">Your personal guide through Legends of Valor</p>
            </div>
          </div>
          {storyline && (
            <Badge variant="outline" className="border-purple-500/50 text-purple-300">
              <BookOpen className="w-3 h-3 mr-1" />
              Chapter {storyline.currentChapter}
            </Badge>
          )}
        </div>

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
                <div className="flex flex-col gap-4">
                  <div className="flex justify-start">
                    <div className="max-w-[80%] bg-purple-500/20 border border-purple-500/30 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <span className="text-purple-300 font-semibold text-sm">Game Master</span>
                      </div>
                      <p className="text-gray-200">{welcomeMessage}</p>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => navigate("/shop")}
                      className="border-amber-500/50 text-amber-300 hover:bg-amber-500/20"
                    >
                      <ShoppingBag className="w-4 h-4 mr-2" />
                      Enter the Shop
                    </Button>
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
                        Game Master
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
                      <span className="text-sm">The Game Master is thinking...</span>
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
