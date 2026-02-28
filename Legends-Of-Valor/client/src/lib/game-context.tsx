// This is a static version of the game context for GitHub Pages
// It uses localStorage instead of an API to persist data

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import type { Account, InventoryItem, Item } from "@shared/schema";
import { ALL_ITEMS } from "./items-data";
import { useToast } from "@/hooks/use-toast";

interface GameContextType {
  account: Account | null;
  inventory: InventoryItem[];
  isLoading: boolean;
  setAccount: (account: Account | null) => void;
  setInventory: (inventory: InventoryItem[]) => void;
  addToInventory: (item: Item) => Promise<boolean>;
  spendGold: (amount: number) => boolean;
  addGold: (amount: number) => void;
  logout: () => void;
  login: (username: string, password: string, role: "player" | "admin", race?: string, gender?: string, startingEggElement?: string) => Promise<{ account: Account | null; error?: string; needsRaceSelection?: boolean }>;
  refreshInventory: () => Promise<void>;
  refetchAccount: () => Promise<void>;
}

const GameContext = createContext<GameContextType | null>(null);

const SESSION_KEY = "lov_session";
const ACCOUNT_STORAGE_PREFIX = "lov_account_";
const INVENTORY_STORAGE_PREFIX = "lov_inventory_";

// Mock global data for "online" simulation on GitHub Pages
const GLOBAL_ACCOUNTS_KEY = "lov_global_accounts";
const GLOBAL_CHALLENGES_KEY = "lov_global_challenges";

export function GameProvider({ children }: { children: ReactNode }) {
  const [account, setAccountState] = useState<Account | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Helper to sync local account to "global" mock storage
  const syncToGlobal = (acc: Account) => {
    const globalAccounts = JSON.parse(localStorage.getItem(GLOBAL_ACCOUNTS_KEY) || "[]");
    const index = globalAccounts.findIndex((a: any) => a.username === acc.username);
    if (index > -1) {
      globalAccounts[index] = acc;
    } else {
      globalAccounts.push(acc);
    }
    localStorage.setItem(GLOBAL_ACCOUNTS_KEY, JSON.stringify(globalAccounts));
  };

  const loadAccountData = async (username: string) => {
    const savedAccount = localStorage.getItem(ACCOUNT_STORAGE_PREFIX + username);
    
    if (savedAccount) {
      const cachedAcc = JSON.parse(savedAccount);
      setAccountState(cachedAcc);
      syncToGlobal(cachedAcc);
      
      // Fetch fresh account data from server to ensure base/inventory is up to date
      try {
        const accountResponse = await fetch(`/api/accounts/${cachedAcc.id}`);
        if (accountResponse.ok) {
          const freshAccount = await accountResponse.json();
          setAccountState(freshAccount);
          localStorage.setItem(ACCOUNT_STORAGE_PREFIX + username, JSON.stringify(freshAccount));
          syncToGlobal(freshAccount);
        }
      } catch (error) {
        console.error("Failed to fetch fresh account data:", error);
      }
      
      // Fetch inventory from API
      try {
        const response = await fetch(`/api/accounts/${cachedAcc.id}/inventory`);
        if (response.ok) {
          const data = await response.json();
          setInventory(data);
          localStorage.setItem(INVENTORY_STORAGE_PREFIX + username, JSON.stringify(data));
        }
      } catch (error) {
        console.error("Failed to load inventory from API:", error);
        const savedInventory = localStorage.getItem(INVENTORY_STORAGE_PREFIX + username);
        if (savedInventory) {
          setInventory(JSON.parse(savedInventory));
        } else {
          setInventory([]);
        }
      }
    }
  };

  useEffect(() => {
    const savedSession = localStorage.getItem(SESSION_KEY);
    if (savedSession) {
      try {
        const { username } = JSON.parse(savedSession);
        loadAccountData(username);
      } catch (e) {
        localStorage.removeItem(SESSION_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const setAccount = useCallback((acc: Account | null) => {
    setAccountState(acc);
    if (acc) {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ username: acc.username }));
      localStorage.setItem(ACCOUNT_STORAGE_PREFIX + acc.username, JSON.stringify(acc));
      syncToGlobal(acc);
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }, []);

  const login = useCallback(async (username: string, _password: string, role: "player" | "admin", race?: string, gender?: string, startingEggElement?: string) => {
    try {
      // Try API login first
      const response = await fetch("/api/accounts/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password: _password, role, race, gender, startingEggElement }),
      });

      if (response.ok) {
        const acc = await response.json();
        // JWT handling: token is in cookie, but we can store some info in localStorage if needed
        // The server uses HTTP-only cookies for the JWT, so we don't manually store the token string.
        setAccount(acc);
        localStorage.setItem(SESSION_KEY, JSON.stringify({ username: acc.username }));
        localStorage.setItem(ACCOUNT_STORAGE_PREFIX + acc.username, JSON.stringify(acc));
        sessionStorage.setItem('lov_just_logged_in', 'true');
        syncToGlobal(acc);
        return { account: acc };
      }

      const errorData = await response.json();
      
      // Check if race/gender is required for new account
      if (response.status === 400 && errorData.error === "Race and gender required") {
        return { account: null, needsRaceSelection: true };
      }

      return { account: null, error: errorData.message || errorData.error || "Login failed" };
    } catch (error) {
      // Fallback to localStorage for offline/static mode
      console.log("API unavailable, using localStorage fallback");
      const savedAccount = localStorage.getItem(ACCOUNT_STORAGE_PREFIX + username);
      let acc: Account;

      if (savedAccount) {
        acc = JSON.parse(savedAccount);
      } else {
        acc = {
          id: Math.floor(Math.random() * 1000000).toString(),
          username,
          password: _password,
          role,
          race: null,
          gender: null,
          portrait: null,
          gold: 10000,
          rubies: 0,
          soulShards: 0,
          focusedShards: 0,
          trainingPoints: 100,
          petExp: 0,
          runes: 0,
          soulGins: 0,
          beakCoins: 0,
          valorTokens: 0,
          bait: 0,
          craftingMats: 0,
          mysticShards: 0,
          petEggs: 0,
          rarePetEggs: 0,
          epicPetEggs: 0,
          mythicPetEggs: 0,
          skinTickets: 0,
          rareSkinTickets: 0,
          epicSkinTickets: 0,
          mythicSkinTickets: 0,
          unlockedSkins: [],
          activeBuffs: [],
          vipUntil: null,
          pets: [],
          rank: "Novice",
          wins: 0,
          losses: 0,
          stats: { Str: 10, Def: 10, Spd: 10, Int: 10, Luck: 10, Pot: 0 },
          equipped: { weapon: null, armor: null, accessory1: null, accessory2: null },
          npcFloor: 1,
          npcLevel: 1,
          equippedPetId: null,
          lastActive: new Date(),
          storyAct: 1,
          storyCheckpoint: null,
          isDead: false,
          lastDeathTime: null,
          deathCount: 0,
          reviveTokens: 1,
          respawnLocation: "base",
          baseTier: 1,
          baseSkin: "default",
          baseRoomLevels: { storage: 1, rest: 1, crafting: 1, training: 1, vault: 1, defenses: 1 },
          trophies: [],
          equippedCharacterSkin: "default",
          equippedPetSkin: "default",
          equippedBirdSkin: "default",
          energy: 50,
          maxEnergy: 50,
          lastEnergyUpdate: new Date(),
          ghostState: false,
          weaknessDebuffExpires: null,
          heritageCount: 0,
          heritageBonusPercent: 0,
        } as Account;
      }

      setAccount(acc);
      loadAccountData(username);
      sessionStorage.setItem('lov_just_logged_in', 'true');
      return { account: acc };
    }
  }, [setAccount]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/accounts/logout", { method: "POST" });
    } catch (e) {
      console.error("Logout API failed", e);
    }
    localStorage.removeItem(SESSION_KEY);
    setAccountState(null);
    setInventory([]);
  }, []);

  const refreshInventory = useCallback(async () => {
    if (account) {
      try {
        const response = await fetch(`/api/accounts/${account.id}/inventory`);
        if (response.ok) {
          const data = await response.json();
          setInventory(data);
          localStorage.setItem(INVENTORY_STORAGE_PREFIX + account.username, JSON.stringify(data));
        }
      } catch (error) {
        console.error("Failed to refresh inventory:", error);
        const savedInventory = localStorage.getItem(INVENTORY_STORAGE_PREFIX + account.username);
        if (savedInventory) {
          setInventory(JSON.parse(savedInventory));
        }
      }
    }
  }, [account]);

  const refetchAccount = useCallback(async () => {
    if (!account) return;
    try {
      const response = await fetch(`/api/accounts/${account.id}`);
      if (response.ok) {
        const freshAccount = await response.json();
        setAccountState(freshAccount);
        localStorage.setItem(ACCOUNT_STORAGE_PREFIX + freshAccount.username, JSON.stringify(freshAccount));
        syncToGlobal(freshAccount);
      }
    } catch (error) {
      console.error("Failed to refetch account:", error);
    }
  }, [account]);

  const spendGold = useCallback((amount: number): boolean => {
    if (!account || account.gold < amount) return false;
    const newAccount = { ...account, gold: account.gold - amount };
    setAccount(newAccount);
    return true;
  }, [account, setAccount]);

  const addGold = useCallback((amount: number) => {
    if (!account) return;
    const newAccount = { ...account, gold: account.gold + amount };
    setAccount(newAccount);
  }, [account, setAccount]);

  const addToInventory = useCallback(async (item: Item): Promise<boolean> => {
    if (!account || account.gold < item.price) return false;
    
    try {
      // First deduct gold from account on server
      const goldRes = await fetch(`/api/accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gold: account.gold - item.price }),
      });
      
      if (!goldRes.ok) {
        console.error("Failed to deduct gold");
        return false;
      }
      
      // Then add item to inventory on server
      const invRes = await fetch(`/api/accounts/${account.id}/inventory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.id,
          stats: item.stats || {},
        }),
      });
      
      if (!invRes.ok) {
        console.error("Failed to add item to inventory");
        // Refund the gold if inventory add failed
        await fetch(`/api/accounts/${account.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gold: account.gold }),
        });
        return false;
      }
      
      const newItem = await invRes.json();
      
      // Update local state
      const newAccount = { ...account, gold: account.gold - item.price };
      setAccount(newAccount);
      setInventory(prev => [...prev, newItem]);
      
      return true;
    } catch (error) {
      console.error("Error adding to inventory:", error);
      return false;
    }
  }, [account, setAccount]);

  return (
    <GameContext.Provider
      value={{
        account,
        inventory,
        isLoading,
        setAccount,
        setInventory: (inv) => {
          setInventory(inv);
          if (account) localStorage.setItem(INVENTORY_STORAGE_PREFIX + account.username, JSON.stringify(inv));
        },
        addToInventory,
        spendGold,
        addGold,
        logout,
        login,
        refreshInventory,
        refetchAccount,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
}
