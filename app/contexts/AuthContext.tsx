"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { pb } from "@/lib/db";
import { useRouter } from "next/navigation";
import type { AuthProviderInfo, RecordModel } from "pocketbase";

interface PbUser {
  id: string;
  name: string;
  email: string;
  username: string;
  avatarUrl: string;
  isAdmin?: boolean;
}

type AuthContextType = {
  user: PbUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (email: string, password: string) => Promise<void>;
  googleSignIn: () => void;
  githubSignIn: () => void;
  setUserData: (user: RecordModel) => void;
};

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<PbUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
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
        setIsAdmin(authData.isAdmin || false);
      } else {
        setIsAuthenticated(false);
        setUser(null);
        setIsAdmin(false);
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

    pb.authStore.onChange(() => {
      setIsAuthenticated(pb.authStore.isValid);
      if (pb.authStore.model) {
        setUserData(pb.authStore.model);
      } else {
        setUser(null);
        setIsAdmin(false);
      }
    });
  }, []);

  const setUserData = (pbUser: RecordModel) => {
    const { id, name, email, username, avatarUrl, isAdmin: userIsAdmin } = pbUser;
    setUser({ id, name, email, username, avatarUrl, isAdmin: userIsAdmin });
    setIsAdmin(userIsAdmin || false);
  };

  const login = async (email: string, password: string) => {
    try {
      const authData = await pb
        .collection("users")
        .authWithPassword(email, password);
      setIsAuthenticated(true);
      setUserData(authData.record);
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  };

  const logout = () => {
    pb.authStore.clear();
    setIsAuthenticated(false);
    setUser(null);
    setIsAdmin(false);
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
        isAdmin,
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
