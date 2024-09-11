"use client";

import React from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import AuthDialog from "./AuthDialog";

const AuthSection: React.FC = () => {
  const { isAuthenticated, logout, user } = useAuth();

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center space-x-4">
        <span>Welcome, {user.name || user.email}</span>
        <Button onClick={logout}>Logout</Button>
      </div>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Login / Register</Button>
      </DialogTrigger>
      <DialogContent>
        <AuthDialog onClose={() => {}} />
      </DialogContent>
    </Dialog>
  );
};

export default AuthSection;
