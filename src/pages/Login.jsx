import React, { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useTheme } from "@/lib/ThemeContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Zap, Loader2, Eye, EyeOff } from "lucide-react";

export default function Login() {
  const { login, isLoggingIn } = useAuth();
  const { branding } = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await login(loginForm.email, loginForm.password);
    } catch (err) {
      setError(err.response?.data?.message || "Credenciais inválidas");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt="Logo"
              className="w-12 h-12 rounded-2xl object-contain"
            />
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center">
              <Zap className="w-6 h-6 text-primary-foreground" />
            </div>
          )}
          <span className="text-3xl font-bold tracking-tight">
            {branding.platformName || "ZapAI"}
          </span>
        </div>

        <Card className="shadow-xl border-border/50">
          <CardHeader className="pb-4 text-center">
            <CardTitle className="text-xl">Entrar na plataforma</CardTitle>
          </CardHeader>

          <CardContent>
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={loginForm.email}
                  onChange={(e) =>
                    setLoginForm((f) => ({ ...f, email: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Senha</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Sua senha"
                    value={loginForm.password}
                    onChange={(e) =>
                      setLoginForm((f) => ({
                        ...f,
                        password: e.target.value,
                      }))
                    }
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoggingIn}>
                {isLoggingIn ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Entrar
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Plataforma de atendimento inteligente via WhatsApp
        </p>
      </div>
    </div>
  );
}
