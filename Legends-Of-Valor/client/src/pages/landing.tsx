import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sword, Crown, Sparkles, Shield, Gem, Zap, Loader2, User, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { useGame } from "@/lib/game-context";

interface RaceInfo {
  Str: number;
  Def: number;
  Spd: number;
  Int: number;
  Luck: number;
  description: string;
  element?: string;
}

interface RaceAvailability {
  count: number;
  available: boolean;
  maxPlayers: number;
}

interface RaceData {
  races: string[];
  genders: string[];
  raceModifiers: Record<string, RaceInfo>;
  availability: Record<string, RaceAvailability>;
  maxPlayersPerRace: number;
}

const raceDisplayNames: Record<string, string> = {
  human: "Human",
  elf: "Elf",
  dwarf: "Dwarf",
  orc: "Orc",
  beastfolk: "Beastfolk",
  mystic: "Mystic",
  fae: "Fae",
  elemental: "Elemental",
  undead: "Undead",
  demon: "Demon",
  draconic: "Draconic",
  celestial: "Celestial",
  aquatic: "Aquatic",
  titan: "Titan",
};

export default function Landing() {
  const [, navigate] = useLocation();
  const { login, isLoading, account } = useGame();
  const [playerName, setPlayerName] = useState("");
  const [playerPassword, setPlayerPassword] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showLogin, setShowLogin] = useState<"none" | "player" | "admin">("none");
  const [showRaceSelection, setShowRaceSelection] = useState(false);
  const [selectedRace, setSelectedRace] = useState<string | null>(null);
  const [selectedGender, setSelectedGender] = useState<"male" | "female">("male");
  const [raceData, setRaceData] = useState<RaceData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && account) {
      if (account.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/world-map");
      }
    }
  }, [account, isLoading, navigate]);

  useEffect(() => {
    fetch("/api/races/availability")
      .then(res => res.json())
      .then(data => setRaceData(data))
      .catch(() => console.log("Race data not available"));
  }, []);

  const handlePlayerLogin = async () => {
    if (!playerName.trim() || !playerPassword) return;
    setError("");
    
    const result = await login(playerName.trim(), playerPassword, "player");
    
    if (result.needsRaceSelection) {
      setShowRaceSelection(true);
      return;
    }
    
    if (result.account) {
      navigate("/world-map");
    } else {
      setError(result.error || "Login failed");
    }
  };

  const handleRaceConfirm = async () => {
    if (!selectedRace) {
      setError("Please select a race");
      return;
    }
    
    setError("");
    const result = await login(playerName.trim(), playerPassword, "player", selectedRace, selectedGender);
    
    if (result.account) {
      navigate("/world-map");
    } else {
      setError(result.error || "Failed to create character");
    }
  };

  const handleAdminLogin = async () => {
    if (!adminName.trim() || !adminPassword) return;
    setError("");
    const result = await login(adminName.trim(), adminPassword, "admin");
    if (result.account) {
      navigate("/admin");
    } else {
      setError(result.error || "Login failed");
    }
  };

  if (showRaceSelection && raceData) {
    return (
      <div className="h-full relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-accent/20" />
        
        <div className="relative z-10 h-full flex flex-col">
          <header className="p-6 flex items-center justify-center">
            <div className="flex items-center gap-3">
              <Sword className="w-8 h-8 text-primary" />
              <h1 className="font-serif text-2xl font-bold tracking-wider text-foreground">
                CREATE YOUR CHARACTER
              </h1>
              <Sword className="w-8 h-8 text-primary transform scale-x-[-1]" />
            </div>
          </header>

          <main className="flex-1 flex flex-col items-center px-4 pb-8">
            <div className="text-center mb-6">
              <h2 className="font-serif text-2xl font-bold text-foreground mb-2">
                Choose Your Race
              </h2>
              <p className="text-muted-foreground text-sm">
                Each race has unique stat bonuses. Max 2 players per race.
              </p>
            </div>

            <div className="flex gap-4 mb-6">
              <Button
                variant={selectedGender === "male" ? "default" : "outline"}
                onClick={() => setSelectedGender("male")}
                className="min-w-[100px]"
              >
                <User className="w-4 h-4 mr-2" />
                Male
              </Button>
              <Button
                variant={selectedGender === "female" ? "default" : "outline"}
                onClick={() => setSelectedGender("female")}
                className="min-w-[100px]"
              >
                <User className="w-4 h-4 mr-2" />
                Female
              </Button>
            </div>

            <ScrollArea className="w-full max-w-4xl h-[400px] rounded-md border p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {raceData.races.map((race) => {
                  const info = raceData.raceModifiers[race];
                  const avail = raceData.availability[race];
                  const isSelected = selectedRace === race;
                  const isDisabled = !avail?.available;

                  const portraitPath = `/portraits/${race}_${selectedGender}.png`;
                  
                  return (
                    <Card
                      key={race}
                      className={`cursor-pointer transition-all ${
                        isSelected ? "ring-2 ring-primary" : ""
                      } ${isDisabled ? "opacity-50 cursor-not-allowed" : "hover:border-primary"}`}
                      onClick={() => !isDisabled && setSelectedRace(race)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex gap-3">
                          <div className="w-16 h-16 rounded-lg overflow-hidden border border-border flex-shrink-0">
                            <img 
                              src={portraitPath} 
                              alt={`${raceDisplayNames[race]} ${selectedGender}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <CardTitle className="font-serif text-lg">
                                {raceDisplayNames[race] || race}
                              </CardTitle>
                              <Badge variant={avail?.available ? "secondary" : "destructive"}>
                                {avail?.count || 0}/{avail?.maxPlayers || 2}
                              </Badge>
                            </div>
                            <CardDescription className="text-xs mt-1">
                              {info?.description}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="grid grid-cols-5 gap-1 text-xs">
                          <StatBadge label="STR" value={info?.Str} />
                          <StatBadge label="DEF" value={info?.Def} />
                          <StatBadge label="SPD" value={info?.Spd} />
                          <StatBadge label="INT" value={info?.Int} />
                          <StatBadge label="LCK" value={info?.Luck} />
                        </div>
                        {info?.element && (
                          <Badge variant="outline" className="mt-2 text-xs">
                            {info.element} Affinity
                          </Badge>
                        )}
                        {isDisabled && (
                          <p className="text-xs text-destructive mt-2">Race full</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>

            {error && (
              <p className="text-sm text-destructive mt-4">{error}</p>
            )}

            <div className="flex gap-4 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRaceSelection(false);
                  setSelectedRace(null);
                  setError("");
                }}
                disabled={isLoading}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleRaceConfirm}
                disabled={!selectedRace || isLoading}
                className="min-w-[150px]"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Create Character
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full relative overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(135deg, 
              hsl(240, 30%, 8%) 0%,
              hsl(270, 25%, 12%) 25%,
              hsl(220, 35%, 10%) 50%,
              hsl(250, 30%, 8%) 75%,
              hsl(280, 20%, 6%) 100%
            )
          `,
        }}
      />
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: `
            radial-gradient(ellipse at 10% 20%, hsl(280, 80%, 40%) 0%, transparent 40%),
            radial-gradient(ellipse at 90% 80%, hsl(220, 90%, 50%) 0%, transparent 35%),
            radial-gradient(ellipse at 50% 10%, hsl(40, 100%, 50%) 0%, transparent 30%),
            radial-gradient(ellipse at 30% 70%, hsl(350, 80%, 45%) 0%, transparent 35%),
            radial-gradient(ellipse at 70% 40%, hsl(180, 70%, 40%) 0%, transparent 30%)
          `,
        }}
      />
      <div className="absolute top-4 left-4 w-32 h-32 opacity-20">
        <div className="w-full h-full rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 blur-xl animate-pulse" />
      </div>
      <div className="absolute bottom-10 right-10 w-24 h-24 opacity-15">
        <div className="w-full h-full rounded-full bg-gradient-to-br from-purple-500 to-pink-600 blur-xl" />
      </div>
      <div className="absolute top-1/4 right-1/4 w-16 h-16 opacity-10">
        <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 blur-lg" />
      </div>

      <div className="relative z-10 h-full flex flex-col">
        <header className="p-6 flex items-center justify-center">
          <div className="flex items-center gap-3">
            <Sword className="w-8 h-8 text-primary" />
            <h1 className="font-serif text-2xl font-bold tracking-wider text-foreground">
              LEGEND OF VALOR
            </h1>
            <Sword className="w-8 h-8 text-primary transform scale-x-[-1]" />
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-4 pb-20">
          <div className="text-center mb-12 max-w-2xl">
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-4">
              Forge Your <span className="text-primary">Legend</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              Choose from 14 unique races. Battle through the Mystic Tower. Build your legend.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-6 mb-12">
            <FeatureCard
              icon={<Users className="w-6 h-6 text-stat-str" />}
              title="14 Races"
              description="Each with unique stats and abilities"
            />
            <FeatureCard
              icon={<Shield className="w-6 h-6 text-stat-int" />}
              title="15 Ranks"
              description="From Novice to Mythical Legend"
            />
            <FeatureCard
              icon={<Gem className="w-6 h-6 text-stat-luck" />}
              title="Epic Loot"
              description="Weapons, armor, and artifacts"
            />
            <FeatureCard
              icon={<Sparkles className="w-6 h-6 text-tier-ssumr" />}
              title="Pets & Guilds"
              description="Companions and alliances"
            />
          </div>

          {showLogin === "none" ? (
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                onClick={() => setShowLogin("player")}
                className="min-w-[200px] font-serif"
                data-testid="button-start-player"
              >
                <Zap className="w-5 h-5 mr-2" />
                Start as Player
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => setShowLogin("admin")}
                className="min-w-[200px] font-serif"
                data-testid="button-start-admin"
              >
                <Crown className="w-5 h-5 mr-2" />
                Admin Login
              </Button>
            </div>
          ) : (
            <Card className="w-full max-w-sm">
              <CardHeader>
                <CardTitle className="font-serif flex items-center gap-2">
                  {showLogin === "player" ? (
                    <>
                      <Zap className="w-5 h-5 text-primary" />
                      Player Login
                    </>
                  ) : (
                    <>
                      <Crown className="w-5 h-5 text-tier-x" />
                      Admin Login
                    </>
                  )}
                </CardTitle>
                <CardDescription>
                  {showLogin === "player"
                    ? "Enter your adventurer name to begin"
                    : "Access the admin control panel"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    showLogin === "player" ? handlePlayerLogin() : handleAdminLogin();
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      placeholder={showLogin === "player" ? "Enter adventurer name..." : "Enter admin name..."}
                      value={showLogin === "player" ? playerName : adminName}
                      onChange={(e) =>
                        showLogin === "player"
                          ? setPlayerName(e.target.value)
                          : setAdminName(e.target.value)
                      }
                      autoFocus
                      disabled={isLoading}
                      data-testid="input-username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter password..."
                      value={showLogin === "player" ? playerPassword : adminPassword}
                      onChange={(e) =>
                        showLogin === "player"
                          ? setPlayerPassword(e.target.value)
                          : setAdminPassword(e.target.value)
                      }
                      disabled={isLoading}
                      data-testid="input-password"
                    />
                  </div>
                  {error && (
                    <p className="text-sm text-destructive" data-testid="text-login-error">{error}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowLogin("none");
                        setError("");
                      }}
                      className="flex-1"
                      disabled={isLoading}
                      data-testid="button-cancel"
                    >
                      Back
                    </Button>
                    <Button type="submit" className="flex-1" disabled={isLoading} data-testid="button-login">
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : showLogin === "player" ? (
                        "Enter World"
                      ) : (
                        "Login"
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </main>

        <footer className="p-6 text-center text-muted-foreground text-sm">
          <p>Legend of Valor - An Epic RPG Adventure</p>
        </footer>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center text-center p-4 rounded-lg bg-card/50 border border-border w-40">
      <div className="p-2 rounded-md bg-secondary/50 mb-2">{icon}</div>
      <h3 className="font-serif font-semibold text-sm mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function StatBadge({ label, value }: { label: string; value?: number }) {
  const displayValue = value ? (value * 100).toFixed(0) + "%" : "100%";
  const color = value && value > 1 ? "text-green-400" : value && value < 1 ? "text-red-400" : "text-muted-foreground";
  
  return (
    <div className="text-center">
      <div className="text-muted-foreground">{label}</div>
      <div className={color}>{displayValue}</div>
    </div>
  );
}
