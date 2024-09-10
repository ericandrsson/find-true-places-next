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
    <div className="max-w-md mx-auto bg-white rounded-xl p-6">
      <h2 className="text-3xl font-bold mb-2 text-center text-primary">
        Unlock Your Personalized Map! 🗺️
      </h2>
      <p className="text-sm text-center text-gray-600 mb-6">
        Join our community to save your favorite spots 📍 discover hidden gems
        💎, and share your 💡 recommendations 🗣️.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full"
        />
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full"
        />
        <Button
          type="submit"
          className="w-full bg-primary text-white hover:bg-primary-dark"
        >
          {isLogin ? "Login" : "Sign Up Now to Start Pinning"}
        </Button>
      </form>

      <div className="mt-4 flex items-center justify-between">
        <hr className="w-full" />
        <span className="px-2 text-gray-500">or</span>
        <hr className="w-full" />
      </div>

      <Button
        variant="link"
        onClick={() => setIsLogin(!isLogin)}
        className="mt-4 w-full"
      >
        {isLogin
          ? "Need an account? Register"
          : "Already have an account? Login"}
      </Button>

      <p className="text-xs text-center text-gray-500 mt-4">
        No spam, ever. We value your privacy.
      </p>
    </div>
  );
};

export default AuthDialog;
