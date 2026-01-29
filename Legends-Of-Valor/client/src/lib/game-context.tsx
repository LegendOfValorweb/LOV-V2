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
  login: (username: string, password: string, role: "player" | "admin", race?: string, gender?: string) => Promise<{ account: Account | null; error?: string; needsRaceSelection?: boolean }>;
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

  const loadAccountData = (username: string) => {
    const savedAccount = localStorage.getItem(ACCOUNT_STORAGE_PREFIX + username);
    const savedInventory = localStorage.getItem(INVENTORY_STORAGE_PREFIX + username);
    
    if (savedAccount) {
      const acc = JSON.parse(savedAccount);
      setAccountState(acc);
      syncToGlobal(acc);
    }
    if (savedInventory) {
      setInventory(JSON.parse(savedInventory));
    } else {
      setInventory([]);
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

  const login = useCallback(async (username: string, _password: string, role: "player" | "admin", race?: string, gender?: string) => {
    try {
      // Try API login first
      const response = await fetch("/api/accounts/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password: _password, role, race, gender }),
      });

      if (response.ok) {
        const acc = await response.json();
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
        } as Account;
      }

      setAccount(acc);
      loadAccountData(username);
      sessionStorage.setItem('lov_just_logged_in', 'true');
      return { account: acc };
    }
  }, [setAccount]);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setAccountState(null);
    setInventory([]);
  }, []);

  const refreshInventory = useCallback(async () => {
    if (account) {
      const savedInventory = localStorage.getItem(INVENTORY_STORAGE_PREFIX + account.username);
      if (savedInventory) {
        setInventory(JSON.parse(savedInventory));
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
    
    const newAccount = { ...account, gold: account.gold - item.price };
    const newItem: InventoryItem = {
      id: Math.floor(Math.random() * 1000000).toString(),
      accountId: account.id,
      itemId: item.id,
      stats: {},
      purchasedAt: new Date()
    };

    const newInventory = [...inventory, newItem];
    setAccount(newAccount);
    setInventory(newInventory);
    localStorage.setItem(INVENTORY_STORAGE_PREFIX + account.username, JSON.stringify(newInventory));
    
    return true;
  }, [account, inventory, setAccount]);

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
