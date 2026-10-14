import { createContext } from "react";

export interface AuthContextValue {
  token: string;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
