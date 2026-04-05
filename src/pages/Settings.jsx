import React, { useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Settings as SettingsIcon,
  Palette,
  Crown,
  Save,
  Check,
  Moon,
  Sun,
  Upload,
  RotateCcw,
  Image,
  KeyRound,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { useTheme } from "@/lib/ThemeContext";
import { usersApi } from "@/api/apiClient";

const plans = [
  {
    name: "Free",
    price: "R$ 0",
    period: "/mês",
    features: [
      "100 mensagens/mês",
      "1 número WhatsApp",
      "IA básica",
      "Suporte email",
    ],
    current: true,
  },
  {
    name: "Pro",
    price: "R$ 97",
    period: "/mês",
    features: [
      "5.000 mensagens/mês",
      "3 números WhatsApp",
      "IA avançada",
      "Modo vendedor",
      "Analytics",
      "Suporte prioritário",
    ],
    popular: true,
  },
  {
    name: "Business",
    price: "R$ 297",
    period: "/mês",
    features: [
      "Mensagens ilimitadas",
      "Números ilimitados",
      "IA premium",
      "White label",
      "API access",
      "Suporte dedicado",
      "Multi-atendentes",
    ],
  },
];

export default function Settings() {
  const { user } = useAuth();
  const { darkMode, toggleDarkMode, branding, setBranding, resetBranding } =
    useTheme();
  const logoInputRef = useRef(null);

  // Password change state
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const changePasswordMutation = useMutation({
    mutationFn: (data) => usersApi.changePassword(data),
    onSuccess: () => {
      toast.success("Senha alterada com sucesso!");
      setPasswords({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    },
    onError: (e) =>
      toast.error(e.response?.data?.message || "Erro ao alterar senha"),
  });

  const handleChangePassword = () => {
    if (!passwords.currentPassword || !passwords.newPassword) {
      toast.error("Preencha todos os campos");
      return;
    }
    if (passwords.newPassword.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast.error("As senhas não conferem");
      return;
    }
    changePasswordMutation.mutate({
      currentPassword: passwords.currentPassword,
      newPassword: passwords.newPassword,
    });
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo deve ter no máximo 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setBranding((b) => ({ ...b, logoUrl: ev.target.result }));
      toast.success("Logo atualizada!");
    };
    reader.readAsDataURL(file);
  };

  const handleSaveBranding = () => {
    toast.success("Configurações de branding salvas!");
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl space-y-6">
      {/* Must change password banner */}
      {user?.mustChangePassword && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div>
            <p className="text-sm font-semibold">Troque sua senha provisória</p>
            <p className="text-xs opacity-80">
              Você está usando uma senha provisória. Por segurança, altere-a
              abaixo.
            </p>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-primary" />
          Configurações
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie sua conta, aparência e plano
        </p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Perfil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={user?.name || ""}
                disabled
                className="bg-muted/50"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={user?.email || ""}
                disabled
                className="bg-muted/50"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card
        className={user?.mustChangePassword ? "ring-2 ring-amber-500/50" : ""}
      >
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <KeyRound className="w-5 h-5" />
            Alterar Senha
          </CardTitle>
          <CardDescription>Atualize sua senha de acesso</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Senha Atual</Label>
              <Input
                type="password"
                value={passwords.currentPassword}
                onChange={(e) =>
                  setPasswords((p) => ({
                    ...p,
                    currentPassword: e.target.value,
                  }))
                }
                placeholder="••••••"
              />
            </div>
            <div className="space-y-2">
              <Label>Nova Senha</Label>
              <Input
                type="password"
                value={passwords.newPassword}
                onChange={(e) =>
                  setPasswords((p) => ({ ...p, newPassword: e.target.value }))
                }
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="space-y-2">
              <Label>Confirmar Nova Senha</Label>
              <Input
                type="password"
                value={passwords.confirmPassword}
                onChange={(e) =>
                  setPasswords((p) => ({
                    ...p,
                    confirmPassword: e.target.value,
                  }))
                }
                placeholder="Repetir nova senha"
              />
            </div>
          </div>
          <Button
            onClick={handleChangePassword}
            disabled={changePasswordMutation.isPending}
            className="gap-2"
          >
            {changePasswordMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <KeyRound className="w-4 h-4" />
            )}
            Alterar Senha
          </Button>
        </CardContent>
      </Card>

      {/* Appearance: Dark Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            {darkMode ? (
              <Moon className="w-5 h-5" />
            ) : (
              <Sun className="w-5 h-5" />
            )}
            Aparência
          </CardTitle>
          <CardDescription>Personalize o visual da plataforma</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 rounded-xl border border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent">
                <Moon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">Modo Escuro</p>
                <p className="text-xs text-muted-foreground">
                  Alterne entre tema claro e escuro
                </p>
              </div>
            </div>
            <Switch checked={darkMode} onCheckedChange={toggleDarkMode} />
          </div>
        </CardContent>
      </Card>

      {/* White Label */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Palette className="w-5 h-5" />
            White Label
          </CardTitle>
          <CardDescription>
            Personalize nome, cor e logo da plataforma
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome da Plataforma</Label>
              <Input
                value={branding.platformName}
                onChange={(e) =>
                  setBranding((b) => ({ ...b, platformName: e.target.value }))
                }
                placeholder="Ex: MinhaEmpresa"
              />
              <p className="text-xs text-muted-foreground">
                Aparece na sidebar e na página de login
              </p>
            </div>
            <div className="space-y-2">
              <Label>Cor Principal</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={branding.primaryColor}
                  onChange={(e) =>
                    setBranding((b) => ({ ...b, primaryColor: e.target.value }))
                  }
                  className="w-10 h-10 rounded-lg border border-border cursor-pointer"
                />
                <Input
                  value={branding.primaryColor}
                  onChange={(e) =>
                    setBranding((b) => ({ ...b, primaryColor: e.target.value }))
                  }
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Aplicada em tempo real em toda a plataforma
              </p>
            </div>
          </div>

          {/* Logo Upload */}
          <div className="space-y-2">
            <Label>Logo da Plataforma</Label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden shrink-0">
                {branding.logoUrl ? (
                  <img
                    src={branding.logoUrl}
                    alt="Logo"
                    className="w-full h-full object-contain p-1"
                  />
                ) : (
                  <Image className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => logoInputRef.current?.click()}
                >
                  <Upload className="w-3.5 h-3.5" />
                  Enviar Logo
                </Button>
                {branding.logoUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-muted-foreground"
                    onClick={() => setBranding((b) => ({ ...b, logoUrl: "" }))}
                  >
                    Remover
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  PNG, JPG, SVG ou WebP. Máx 2MB.
                </p>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="p-4 rounded-xl border border-border bg-muted/20">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Preview
            </p>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border">
              {branding.logoUrl ? (
                <img
                  src={branding.logoUrl}
                  alt="Logo"
                  className="w-9 h-9 rounded-lg object-contain"
                />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
                  <span className="text-primary-foreground font-bold text-sm">
                    {branding.platformName?.charAt(0)?.toUpperCase() || "Z"}
                  </span>
                </div>
              )}
              <span className="text-lg font-bold">
                {branding.platformName || "ZapAI"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button className="gap-2" onClick={handleSaveBranding}>
              <Save className="w-4 h-4" />
              Salvar Branding
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                resetBranding();
                toast.info("Branding resetado para padrão");
              }}
            >
              <RotateCcw className="w-4 h-4" />
              Resetar Padrão
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Plans */}
      <div>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Crown className="w-5 h-5 text-primary" />
          Planos
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative overflow-hidden ${plan.popular ? "border-primary shadow-lg shadow-primary/10" : ""}`}
            >
              {plan.popular && (
                <div className="absolute top-0 right-0">
                  <Badge className="rounded-none rounded-bl-lg bg-primary text-primary-foreground">
                    Popular
                  </Badge>
                </div>
              )}
              <CardContent className="p-6">
                <h3 className="text-lg font-bold">{plan.name}</h3>
                <div className="mt-2 mb-6">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">
                    {plan.period}
                  </span>
                </div>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={
                    plan.current
                      ? "outline"
                      : plan.popular
                        ? "default"
                        : "outline"
                  }
                  className={`w-full ${plan.popular ? "bg-primary hover:bg-primary/90" : ""}`}
                  disabled={plan.current}
                >
                  {plan.current ? "Plano Atual" : "Assinar"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
