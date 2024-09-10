import React, { useState } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AuthDialogProps {
  onClose: () => void;
}

const AuthDialog: React.FC<AuthDialogProps> = ({ onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password);
      }
      onClose();
    } catch (error) {
      console.error("Authentication error:", error);
      // Handle error (e.g., show error message to user)
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">
        {isLogin ? "Login" : "Register"}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button type="submit" className="w-full">
          {isLogin ? "Login" : "Register"}
        </Button>
      </form>
      <Button
        variant="link"
        onClick={() => setIsLogin(!isLogin)}
        className="mt-4 w-full"
      >
        {isLogin
          ? "Need an account? Register"
          : "Already have an account? Login"}
      </Button>
    </div>
  );
};

export default AuthDialog;
