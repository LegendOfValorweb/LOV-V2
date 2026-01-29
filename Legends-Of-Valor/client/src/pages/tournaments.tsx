import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useGame } from "@/lib/game-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Swords, Users, Clock, Crown, ArrowLeft, Map, Loader2, CheckCircle, XCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface TournamentMatch {
  player1: string;
  player2: string;
  winner?: string;
}

interface Tournament {
  id: string;
  name: string;
  status: "pending" | "active" | "completed";
  participants: string[];
  brackets: { round: number; matches: TournamentMatch[] }[];
  rewards: { gold?: number; rubies?: number; items?: string[] };
  createdBy: string;
  startedAt?: string;
  endedAt?: string;
}

interface TournamentData {
  active?: Tournament;
  pending: Tournament[];
  completed: Tournament[];
}

export default function Tournaments() {
  const [, navigate] = useLocation();
  const { account } = useGame();
  const { toast } = useToast();

  const { data: tournamentData, isLoading } = useQuery<TournamentData>({
    queryKey: ["/api/tournaments"],
    refetchInterval: 10000,
  });

  const joinMutation = useMutation({
    mutationFn: async (tournamentId: string) => {
      const res = await apiRequest("POST", `/api/tournaments/${tournamentId}/join`, {
        accountId: account?.id,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Joined tournament!", description: "Good luck, warrior!" });
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to join",
        description: error.message || "Could not join tournament",
        variant: "destructive",
      });
    },
  });

  if (!account || account.role !== "player") {
    navigate("/");
    return null;
  }

  const active = tournamentData?.active;
  const pending = tournamentData?.pending || [];
  const completed = tournamentData?.completed || [];

  const isParticipant = (t: Tournament) => account?.id ? t.participants.includes(account.id) : false;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-900/50 text-yellow-300 border-yellow-600">Registering</Badge>;
      case "active":
        return <Badge variant="outline" className="bg-green-900/50 text-green-300 border-green-600">In Progress</Badge>;
      case "completed":
        return <Badge variant="outline" className="bg-gray-700/50 text-gray-300 border-gray-600">Completed</Badge>;
      default:
        return null;
    }
  };

  const renderBracket = (tournament: Tournament) => {
    if (!tournament.brackets || tournament.brackets.length === 0) {
      return <p className="text-gray-400 text-sm">Brackets not yet generated</p>;
    }

    return (
      <div className="space-y-4">
        {tournament.brackets.map((round) => (
          <div key={round.round} className="space-y-2">
            <h4 className="text-sm font-semibold text-amber-400">Round {round.round}</h4>
            <div className="grid gap-2">
              {round.matches.map((match, idx) => (
                <div
                  key={idx}
                  className="bg-gray-800/50 rounded-lg p-3 border border-gray-700"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={match.winner === match.player1 ? "text-green-400 font-bold" : "text-gray-300"}>
                        {match.player1?.length > 8 ? `${match.player1.substring(0, 8)}...` : match.player1 ?? "Unknown"}
                      </span>
                      <span className="text-gray-500">vs</span>
                      <span className={match.winner === match.player2 ? "text-green-400 font-bold" : "text-gray-300"}>
                        {match.player2?.length > 8 ? `${match.player2.substring(0, 8)}...` : match.player2 ?? "Unknown"}
                      </span>
                    </div>
                    {match.winner ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <Clock className="w-4 h-4 text-yellow-400" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderTournamentCard = (tournament: Tournament, showJoin: boolean = false) => (
    <Card key={tournament.id} className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 border-amber-600/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-amber-300 flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            {tournament.name}
          </CardTitle>
          {getStatusBadge(tournament.status)}
        </div>
        <CardDescription className="text-gray-400">
          <div className="flex items-center gap-4 mt-2">
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {tournament.participants.length} participants
            </span>
            {tournament.rewards.gold && (
              <span className="text-yellow-400">{tournament.rewards.gold.toLocaleString()} Gold</span>
            )}
            {tournament.rewards.rubies && (
              <span className="text-red-400">{tournament.rewards.rubies} Rubies</span>
            )}
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {tournament.status !== "pending" && renderBracket(tournament)}
        
        {showJoin && tournament.status === "pending" && (
          <div className="flex items-center gap-3">
            {isParticipant(tournament) ? (
              <Badge className="bg-green-700 text-white">
                <CheckCircle className="w-3 h-3 mr-1" />
                Registered
              </Badge>
            ) : (
              <Button
                onClick={() => joinMutation.mutate(tournament.id)}
                disabled={joinMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {joinMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Swords className="w-4 h-4 mr-2" />
                )}
                Join Tournament
              </Button>
            )}
          </div>
        )}

        {isParticipant(tournament) && tournament.status === "active" && (
          <Badge className="bg-blue-700 text-white">
            <Swords className="w-3 h-3 mr-1" />
            You are competing!
          </Badge>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/world-map")}
              className="border-amber-600/50 text-amber-300 hover:bg-amber-900/30"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              World Map
            </Button>
            <h1 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
              <Trophy className="w-6 h-6" />
              Tournaments
            </h1>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
          </div>
        ) : (
          <>
            {active && (
              <section>
                <h2 className="text-lg font-semibold text-green-400 mb-3 flex items-center gap-2">
                  <Swords className="w-5 h-5" />
                  Active Tournament
                </h2>
                {renderTournamentCard(active, false)}
              </section>
            )}

            {pending.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-yellow-400 mb-3 flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Open for Registration
                </h2>
                <div className="space-y-4">
                  {pending.map((t) => renderTournamentCard(t, true))}
                </div>
              </section>
            )}

            {completed.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-gray-400 mb-3 flex items-center gap-2">
                  <Crown className="w-5 h-5" />
                  Past Tournaments
                </h2>
                <div className="space-y-4">
                  {completed.map((t) => renderTournamentCard(t, false))}
                </div>
              </section>
            )}

            {!active && pending.length === 0 && completed.length === 0 && (
              <Card className="bg-gray-900/50 border-gray-700">
                <CardContent className="py-12 text-center">
                  <Trophy className="w-12 h-12 mx-auto text-gray-600 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-400 mb-2">No Tournaments Available</h3>
                  <p className="text-gray-500">
                    Check back later for upcoming tournament events!
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
