import { useState, useRef, useEffect } from "react";
import { useGame } from "@/lib/game-context";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Users, Swords, Crown, Send, Plus, ArrowLeft, Loader2,
  Sparkles, BookOpen, Shield, LogOut, Clock, CheckCircle2, Globe
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";

interface CoopChatMessage {
  role: "player" | "gamemaster";
  content: string;
  senderId: string;
  senderUsername: string;
  timestamp: string;
}

interface CoopSession {
  id: string;
  hostId: string;
  guestId: string | null;
  sessionName: string;
  status: "waiting" | "active" | "completed" | "abandoned";
  sharedHistory: CoopChatMessage[];
  encounterPhase: string;
  hostUsername: string;
  guestUsername: string | null;
  hostRank?: string;
  guestRank?: string | null;
  createdAt: string;
}

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br/>");
}

function MessageBubble({ msg, myAccountId }: { msg: CoopChatMessage; myAccountId: string }) {
  const isGM = msg.role === "gamemaster";
  const isMe = msg.senderId === myAccountId;

  if (isGM) {
    return (
      <div className="flex gap-3 mb-4">
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-violet-800 border border-purple-400/50 flex items-center justify-center shadow-[0_0_12px_rgba(168,85,247,0.4)]">
          <Crown className="w-4 h-4 text-purple-200" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-purple-400">Game Master</span>
            <span className="text-xs text-muted-foreground">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <div
            className="p-3 rounded-lg bg-gradient-to-br from-purple-950/60 to-violet-950/60 border border-purple-500/30 text-sm leading-relaxed text-purple-50"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 mb-3 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${
        isMe
          ? "bg-gradient-to-br from-blue-600 to-cyan-700 border-blue-400/50"
          : "bg-gradient-to-br from-amber-600 to-orange-700 border-amber-400/50"
      }`}>
        {msg.senderUsername.charAt(0).toUpperCase()}
      </div>
      <div className={`max-w-[72%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <span className={`text-xs font-medium ${isMe ? "text-blue-400 text-right" : "text-amber-400"}`}>
          {msg.senderUsername}
          <span className="text-muted-foreground ml-2 font-normal">
            {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </span>
        <div className={`p-3 rounded-xl text-sm leading-relaxed ${
          isMe
            ? "bg-blue-600/25 border border-blue-500/30 text-blue-50"
            : "bg-amber-600/20 border border-amber-500/30 text-amber-50"
        }`}>
          {msg.content}
        </div>
      </div>
    </div>
  );
}

function SessionCard({
  session,
  myAccountId,
  onJoin,
  onOpen,
}: {
  session: CoopSession;
  myAccountId: string;
  onJoin: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const isHost = session.hostId === myAccountId;
  const isGuest = session.guestId === myAccountId;
  const isInSession = isHost || isGuest;
  const canJoin = session.status === "waiting" && !isInSession;

  const statusColor: Record<string, string> = {
    waiting: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
    active: "bg-green-500/20 text-green-400 border-green-500/40",
    completed: "bg-gray-500/20 text-gray-400 border-gray-500/40",
    abandoned: "bg-red-500/20 text-red-400 border-red-500/40",
  };

  return (
    <Card className={`border ${isInSession ? "border-primary/40 bg-primary/5" : "border-border/50"} transition-colors`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-4 h-4 text-purple-400 flex-shrink-0" />
              <p className="font-semibold text-sm truncate">{session.sessionName}</p>
              {isInSession && <Badge variant="outline" className="text-xs shrink-0">Yours</Badge>}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <Crown className="w-3 h-3 text-amber-400" />
                {session.hostUsername}
              </span>
              {session.guestUsername ? (
                <span className="flex items-center gap-1">
                  <Shield className="w-3 h-3 text-blue-400" />
                  {session.guestUsername}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-muted-foreground/60">
                  <Shield className="w-3 h-3" />
                  Waiting for hero…
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor[session.status] || "bg-secondary"}`}>
                {session.status}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(session.createdAt).toLocaleDateString()}
              </span>
              {session.sharedHistory.length > 0 && (
                <span className="text-xs text-muted-foreground">{session.sharedHistory.length} messages</span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 flex-shrink-0">
            {isInSession && session.status === "active" && (
              <Button size="sm" onClick={() => onOpen(session.id)} className="text-xs">
                <Swords className="w-3 h-3 mr-1" /> Continue
              </Button>
            )}
            {isInSession && session.status === "waiting" && (
              <Button size="sm" variant="outline" onClick={() => onOpen(session.id)} className="text-xs">
                <Clock className="w-3 h-3 mr-1" /> Waiting…
              </Button>
            )}
            {canJoin && (
              <Button size="sm" onClick={() => onJoin(session.id)} className="text-xs bg-green-700 hover:bg-green-600">
                <Users className="w-3 h-3 mr-1" /> Join
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CoopPage() {
  const { account } = useGame();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newSessionName, setNewSessionName] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!account) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Please log in to access Co-op Story Mode.</p>
      </div>
    );
  }

  // Poll sessions list every 3s
  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ["/api/coop/sessions", account.id],
    queryFn: () => apiRequest("GET", `/api/coop/sessions?accountId=${account.id}`).then(r => r.json()),
    refetchInterval: 8000,
  });

  // Poll active session every 4s when in a session
  const { data: activeData } = useQuery({
    queryKey: ["/api/coop/sessions", activeSessionId],
    queryFn: () => activeSessionId
      ? apiRequest("GET", `/api/coop/sessions/${activeSessionId}`).then(r => r.json())
      : null,
    enabled: !!activeSessionId,
    refetchInterval: 4000,
  });

  const sessions: CoopSession[] = sessionsData?.sessions || [];
  const activeSession: CoopSession | null = activeData?.session || null;

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeSession?.sharedHistory?.length]);

  // Auto-open if player already has an active session
  useEffect(() => {
    if (!activeSessionId && sessions.length > 0) {
      const mine = sessions.find(s =>
        (s.hostId === account.id || s.guestId === account.id) &&
        s.status === "active"
      );
      if (mine) setActiveSessionId(mine.id);
    }
  }, [sessions, account.id, activeSessionId]);

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/coop/sessions", {
      hostId: account.id,
      sessionName: newSessionName.trim(),
    }).then(r => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/coop/sessions"] });
      setActiveSessionId(data.session.id);
      setShowCreateDialog(false);
      setNewSessionName("");
      toast({ title: "Session created!", description: "Waiting for another hero to join…" });
    },
    onError: () => toast({ title: "Failed to create session", variant: "destructive" }),
  });

  const joinMutation = useMutation({
    mutationFn: (sessionId: string) => apiRequest("POST", `/api/coop/sessions/${sessionId}/join`, {
      accountId: account.id,
    }).then(r => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/coop/sessions"] });
      setActiveSessionId(data.session.id);
      toast({ title: "Joined session!", description: "The Game Master awaits…" });
    },
    onError: () => toast({ title: "Failed to join session", variant: "destructive" }),
  });

  const leaveMutation = useMutation({
    mutationFn: (sessionId: string) => apiRequest("POST", `/api/coop/sessions/${sessionId}/leave`, {
      accountId: account.id,
    }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coop/sessions"] });
      setActiveSessionId(null);
      toast({ title: "Left session" });
    },
  });

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !activeSessionId || isSending) return;
    const msg = chatInput.trim();
    setChatInput("");
    setIsSending(true);
    try {
      await apiRequest("POST", `/api/coop/sessions/${activeSessionId}/message`, {
        accountId: account.id,
        message: msg,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/coop/sessions", activeSessionId] });
    } catch {
      toast({ title: "Failed to send message", variant: "destructive" });
      setChatInput(msg);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // ── Active session view ──────────────────────────────────────────────────
  if (activeSessionId && activeSession) {
    const isHost = activeSession.hostId === account.id;
    const partnerName = isHost ? (activeSession.guestUsername || "Waiting…") : activeSession.hostUsername;
    const partnerRank = isHost ? (activeSession.guestRank || "") : (activeSession.hostRank || "");
    const isWaiting = activeSession.status === "waiting";
    const history = activeSession.sharedHistory || [];

    return (
      <div className="h-screen flex flex-col bg-background overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-gradient-to-r from-purple-950/30 to-background flex-shrink-0">
          <Button variant="ghost" size="icon" onClick={() => setActiveSessionId(null)} className="h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-purple-400 flex-shrink-0" />
              {activeSession.sessionName}
            </p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              <span className="flex items-center gap-1">
                <Crown className="w-3 h-3 text-amber-400" />
                {activeSession.hostUsername}
                {isHost && <span className="text-primary ml-1">(you)</span>}
              </span>
              <span className="text-border">·</span>
              <span className="flex items-center gap-1">
                <Shield className="w-3 h-3 text-blue-400" />
                {activeSession.guestUsername
                  ? <>{activeSession.guestUsername}{!isHost && <span className="text-primary ml-1">(you)</span>}</>
                  : <span className="italic">Awaiting hero…</span>
                }
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isWaiting && (
              <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-500/40 bg-yellow-500/10 animate-pulse">
                Waiting for hero…
              </Badge>
            )}
            {!isWaiting && (
              <Badge variant="outline" className="text-xs text-green-400 border-green-500/40 bg-green-500/10">
                Active
              </Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              className="text-xs text-red-400 border-red-500/30 hover:bg-red-500/10"
              onClick={() => leaveMutation.mutate(activeSessionId)}
            >
              <LogOut className="w-3 h-3 mr-1" /> Leave
            </Button>
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
            {history.length === 0 && isWaiting && (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <Users className="w-12 h-12 mb-4 opacity-30" />
                <p className="font-medium mb-1">Session created!</p>
                <p className="text-sm">Share your session name with a friend. The adventure begins when they join.</p>
                <div className="mt-4 p-3 rounded-lg bg-secondary/50 border border-border max-w-sm">
                  <p className="text-xs text-muted-foreground mb-1">Session Name</p>
                  <p className="font-mono font-bold text-primary">{activeSession.sessionName}</p>
                </div>
              </div>
            )}
            {history.map((msg, i) => (
              <MessageBubble key={i} msg={msg} myAccountId={account.id} />
            ))}
            {isSending && (
              <div className="flex gap-3 mb-4">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-violet-800 border border-purple-400/50 flex items-center justify-center flex-shrink-0">
                  <Crown className="w-4 h-4 text-purple-200" />
                </div>
                <div className="flex items-center gap-2 text-purple-400 text-sm italic">
                  <Loader2 className="w-4 h-4 animate-spin" /> Game Master is responding…
                </div>
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t border-border bg-background/80 flex-shrink-0">
            {isWaiting ? (
              <div className="text-center text-sm text-muted-foreground py-2 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Waiting for your companion before the story begins…
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Describe what ${account.username} does…`}
                    disabled={isSending}
                    className="flex-1 bg-secondary/50"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!chatInput.trim() || isSending}
                    className="shrink-0"
                  >
                    {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Describe your action or speak to the Game Master. Both players share this story. Press Enter to send.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Lobby view ──────────────────────────────────────────────────────────
  const waitingSessions = sessions.filter(s => s.status === "waiting" && s.hostId !== account.id);
  const mySessions = sessions.filter(s => s.hostId === account.id || s.guestId === account.id);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-gradient-to-r from-purple-950/20 to-background flex-shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="h-8 w-8">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="font-bold text-base flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            Co-op Story Mode
          </h1>
          <p className="text-xs text-muted-foreground">Adventure alongside a companion with an AI Game Master</p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreateDialog(true)}
          className="shrink-0 bg-purple-700 hover:bg-purple-600"
        >
          <Plus className="w-4 h-4 mr-1" /> New Adventure
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        {/* Feature description */}
        <Card className="mb-6 border border-purple-500/30 bg-gradient-to-br from-purple-950/30 to-violet-950/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-violet-800 flex items-center justify-center flex-shrink-0">
                <Crown className="w-5 h-5 text-purple-200" />
              </div>
              <div>
                <p className="font-semibold text-sm mb-1 text-purple-200">AI-Narrated Co-op Adventure</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Team up with another player for a shared story experience. The <strong className="text-purple-400">AI Game Master</strong> narrates your adventure, reacts to both players' actions, and weaves a personalized tale across the Legends of Valor world.
                  Describe what you do, ask the GM questions, plan with your companion — every message shapes the story.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Badge variant="outline" className="text-xs text-purple-400 border-purple-500/40">AI Game Master</Badge>
                  <Badge variant="outline" className="text-xs text-amber-400 border-amber-500/40">Shared Story</Badge>
                  <Badge variant="outline" className="text-xs text-green-400 border-green-500/40">2 Players</Badge>
                  <Badge variant="outline" className="text-xs text-blue-400 border-blue-500/40">Live Narration</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* My sessions */}
        {mySessions.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" /> YOUR ADVENTURES
            </h2>
            <div className="space-y-3">
              {mySessions.map(session => (
                <SessionCard
                  key={session.id}
                  session={session}
                  myAccountId={account.id}
                  onJoin={(id) => joinMutation.mutate(id)}
                  onOpen={(id) => setActiveSessionId(id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Open sessions */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <Globe className="w-4 h-4 text-green-400" /> OPEN SESSIONS — JOIN A HERO
          </h2>
          {sessionsLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading sessions…
            </div>
          ) : waitingSessions.length === 0 ? (
            <Card className="border-dashed border-border/50">
              <CardContent className="p-8 text-center text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium mb-1">No open sessions yet</p>
                <p className="text-xs">Be the first! Create a new adventure and invite a friend.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {waitingSessions.map(session => (
                <SessionCard
                  key={session.id}
                  session={session}
                  myAccountId={account.id}
                  onJoin={(id) => joinMutation.mutate(id)}
                  onOpen={(id) => setActiveSessionId(id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* How it works */}
        <Card className="border border-border/40 bg-secondary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" /> How It Works
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-muted-foreground">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 mb-1 text-foreground font-medium">
                  <div className="w-5 h-5 rounded-full bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-xs text-purple-400 font-bold">1</div>
                  Create or Join
                </div>
                <p>One player creates a named adventure session. Another player joins from the lobby. The AI Game Master crafts a personalized opening based on both players' ranks and progress.</p>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 mb-1 text-foreground font-medium">
                  <div className="w-5 h-5 rounded-full bg-amber-600/30 border border-amber-500/40 flex items-center justify-center text-xs text-amber-400 font-bold">2</div>
                  Narrate & Explore
                </div>
                <p>Both players see the same shared story chat. Describe your actions, talk to each other, ask the GM questions. The AI narrates outcomes, introduces encounters, and responds to everything.</p>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 mb-1 text-foreground font-medium">
                  <div className="w-5 h-5 rounded-full bg-green-600/30 border border-green-500/40 flex items-center justify-center text-xs text-green-400 font-bold">3</div>
                  Fight & Forge Legends
                </div>
                <p>The GM introduces monsters, puzzles, and twists that require teamwork. Engage with the story through your words. Every choice shapes the narrative of your shared legend.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </ScrollArea>

      {/* Create session dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-purple-400" />
              New Co-op Adventure
            </DialogTitle>
            <DialogDescription>
              Give your adventure a name. Another player can find and join it from the lobby.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-2 block">Adventure Name</label>
              <Input
                value={newSessionName}
                onChange={(e) => setNewSessionName(e.target.value)}
                placeholder="e.g. Into the Crystal Lake…"
                maxLength={60}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newSessionName.trim()) {
                    createMutation.mutate();
                  }
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">{newSessionName.length}/60 characters</p>
            </div>
            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs text-muted-foreground">
              <p className="text-purple-300 font-medium mb-1">What happens next?</p>
              <p>Your session opens in the lobby. When another hero joins, the AI Game Master will craft a dramatic opening scene based on both your stories, ranks, and progress.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!newSessionName.trim() || createMutation.isPending}
              className="bg-purple-700 hover:bg-purple-600"
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Create Adventure
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
