"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { pb } from "@/lib/db";
import { useRouter } from "next/navigation";
import type { AuthProviderInfo, Record } from "pocketbase";

interface PbUser {
  id: string;
  name: string;
  email: string;
  username: string;
  avatarUrl: string;
}

type AuthContextType = {
  user: PbUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (email: string, password: string) => Promise<void>;
  googleSignIn: () => void;
  githubSignIn: () => void;
  setUserData: (user: Record) => void;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<PbUser | null>(null);
  const [googleAuthProvider, setGoogleAuthProvider] =
    useState<AuthProviderInfo | null>(null);
  const [githubAuthProvider, setGithubAuthProvider] =
    useState<AuthProviderInfo | null>(null);
  const router = useRouter();

  useEffect(() => {
    const initAuth = async () => {
      const authData = pb.authStore.model;
      if (authData) {
        setIsAuthenticated(true);
        setUserData(authData);
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }

      const authMethods = await pb
        .collection("users")
        .listAuthMethods()
        .then((methods) => methods)
        .catch((err) => {
          console.error(err);
        });

      if (authMethods)
        for (const provider of authMethods.authProviders) {
          if (provider.name === "google") setGoogleAuthProvider(provider);
          if (provider.name === "github") setGithubAuthProvider(provider);
        }
    };

    initAuth();

    // Add this listener to update auth state on changes
    pb.authStore.onChange(() => {
      setIsAuthenticated(pb.authStore.isValid);
      if (pb.authStore.model) {
        setUserData(pb.authStore.model);
      } else {
        setUser(null);
      }
    });
  }, []);

  const setUserData = (pbUser: Record) => {
    const { id, name, email, username, avatarUrl } = pbUser;
    setUser({ id, name, email, username, avatarUrl });
  };

  const login = async (email: string, password: string) => {
    const authData = await pb
      .collection("users")
      .authWithPassword(email, password);
    setIsAuthenticated(true);
    setUserData(authData.record);
  };

  const logout = () => {
    pb.authStore.clear();
    setIsAuthenticated(false);
    setUser(null);
  };

  const register = async (email: string, password: string) => {
    await pb
      .collection("users")
      .create({ email, password, passwordConfirm: password });
    await login(email, password);
  };

  const googleSignIn = () => {
    logout();
    localStorage.setItem("provider", JSON.stringify(googleAuthProvider));
    const redirectUrl = `${location.origin}/signin`;
    const url = googleAuthProvider?.authUrl + redirectUrl;

    router.push(url);
  };

  const githubSignIn = () => {
    logout();
    localStorage.setItem("provider", JSON.stringify(githubAuthProvider));
    const redirectUrl = `${location.origin}/signin`;
    const url = githubAuthProvider?.authUrl + redirectUrl;

    router.push(url);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        login,
        logout,
        register,
        googleSignIn,
        githubSignIn,
        setUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
