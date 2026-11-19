import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Smartphone,
  Users,
  Shield,
  BellRing,
  Play,
} from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { useTheme } from "@/lib/ThemeContext";
import { plansApi, usersApi, whatsappApi } from "@/api/apiClient";
import {
  formatCurrency,
  getDisplayPlans,
  getPlanBySlug,
  getPlanFeatureList,
} from "@/lib/planUtils";
import {
  sanitizeCompanyName,
  sanitizeHexColor,
  sanitizePersonName,
} from "@/lib/utils";

export default function Settings() {
  const queryClient = useQueryClient();
  const { user, updateUser } = useAuth();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const {
    darkMode,
    toggleDarkMode,
    branding,
    setBranding,
    resetBranding,
    notificationSound,
    setNotificationSound,
    notificationSoundOptions,
    playNotificationSound,
  } = useTheme();
  const logoInputRef = useRef(null);
  const [profileForm, setProfileForm] = useState({ name: user?.name || "" });

  const { data: profile } = useQuery({
    queryKey: ["profile", "settings"],
    queryFn: () => usersApi.getProfile(),
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["plans", "settings"],
    queryFn: () => plansApi.list({ active: true }),
    enabled: isAdmin,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees", "settings"],
    queryFn: () => usersApi.list(),
    enabled: isAdmin,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["whatsapp-sessions", "settings"],
    queryFn: () => whatsappApi.sessions(),
    enabled: isAdmin,
  });

  const displayPlans = useMemo(() => getDisplayPlans(plans), [plans]);
  const currentPlan = useMemo(
    () => getPlanBySlug(displayPlans, profile?.company?.plan || "basic"),
    [displayPlans, profile?.company?.plan],
  );
  const teamLeadersCount = employees.filter(
    (employee) => employee.role === "EMPLOYEE" && employee.isTeamLeader,
  ).length;

  useEffect(() => {
    setProfileForm({ name: profile?.name || user?.name || "" });
  }, [profile?.name, user?.name]);

  const updateProfileMutation = useMutation({
    mutationFn: (data) => usersApi.updateProfile(data),
    onSuccess: (updatedProfile) => {
      queryClient.invalidateQueries({ queryKey: ["profile", "settings"] });
      updateUser((prev) => ({
        ...prev,
        name: updatedProfile.name,
        email: updatedProfile.email,
        role: updatedProfile.role,
        isTeamLeader: updatedProfile.isTeamLeader,
        mustChangePassword: updatedProfile.mustChangePassword,
        companyId: updatedProfile.company?.id || prev?.companyId,
      }));
      toast.success("Perfil atualizado com sucesso!");
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Erro ao atualizar perfil");
    },
  });

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

  const handleSaveProfile = () => {
    if (!profileForm.name.trim()) {
      toast.error("Informe um nome válido");
      return;
    }

    updateProfileMutation.mutate({ name: profileForm.name.trim() });
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
          {isAdmin
            ? "Gerencie sua conta, aparência e plano"
            : "Gerencie sua conta e aparência"}
        </p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Perfil</CardTitle>
          <CardDescription>
            Atualize os dados básicos da sua conta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{user?.role}</Badge>
            {user?.isTeamLeader && (
              <Badge variant="outline">Líder de equipe</Badge>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={profileForm.name}
                onChange={(e) =>
                  setProfileForm({ name: sanitizePersonName(e.target.value) })
                }
                autoComplete="name"
                placeholder="Seu nome"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={profile?.email || user?.email || ""}
                disabled
                className="bg-muted/50"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handleSaveProfile}
              disabled={
                updateProfileMutation.isPending ||
                !profileForm.name.trim() ||
                profileForm.name.trim() === (profile?.name || user?.name || "")
              }
              className="gap-2"
            >
              {updateProfileMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Salvar Perfil
            </Button>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BellRing className="w-5 h-5" />
            Som de notificação
          </CardTitle>
          <CardDescription>
            Escolha o som usado quando novas mensagens chegarem.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {notificationSoundOptions.map((sound) => {
              const isSelected = notificationSound === sound.id;

              return (
                <button
                  key={sound.id}
                  type="button"
                  onClick={() => setNotificationSound(sound.id)}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{sound.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {sound.description}
                      </p>
                    </div>
                    {isSelected && <Badge variant="secondary">Ativo</Badge>}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end">
            <Button
              variant="outline"
              className="gap-2"
              onClick={playNotificationSound}
              disabled={notificationSound === "none"}
            >
              <Play className="w-4 h-4" />
              Testar som
            </Button>
          </div>
        </CardContent>
      </Card>

      {isAdmin && (
        <>
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
                      setBranding((b) => ({
                        ...b,
                        platformName: sanitizeCompanyName(e.target.value),
                      }))
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
                        setBranding((b) => ({
                          ...b,
                          primaryColor: sanitizeHexColor(e.target.value),
                        }))
                      }
                      className="w-10 h-10 rounded-lg border border-border cursor-pointer"
                    />
                    <Input
                      value={branding.primaryColor}
                      onChange={(e) =>
                        setBranding((b) => ({
                          ...b,
                          primaryColor: sanitizeHexColor(e.target.value),
                        }))
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
                        onClick={() =>
                          setBranding((b) => ({ ...b, logoUrl: "" }))
                        }
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
                    {branding.platformName || "Zap2"}
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
          <div className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Crown className="w-5 h-5 text-primary" />
              Planos
            </h2>

            {currentPlan && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Plano atual</CardTitle>
                  <CardDescription>
                    Acompanhe o uso atual da sua assinatura
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-2xl font-bold">{currentPlan.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(currentPlan.price)}/mês
                      </p>
                    </div>
                    <Badge variant="secondary" className="w-fit">
                      Plano ativo: {profile?.company?.plan || currentPlan.slug}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-xl border border-border p-4 space-y-1">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Smartphone className="w-4 h-4 text-primary" />
                        Sessões WhatsApp
                      </div>
                      <p className="text-2xl font-bold">
                        {sessions.length} / {currentPlan.maxNumbers}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border p-4 space-y-1">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Users className="w-4 h-4 text-primary" />
                        Equipe
                      </div>
                      <p className="text-2xl font-bold">
                        {employees.length} / {currentPlan.maxEmployees}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border p-4 space-y-1">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Shield className="w-4 h-4 text-primary" />
                        Líderes de equipe
                      </div>
                      <p className="text-2xl font-bold">
                        {teamLeadersCount} / {currentPlan.maxTeamLeaders}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {displayPlans.map((plan, index) => {
                const isPopular = plan.slug === "plus" || index === 1;
                const isCurrent = currentPlan?.slug === plan.slug;

                return (
                  <Card
                    key={plan.slug}
                    className={`relative overflow-hidden ${isPopular ? "border-primary shadow-lg shadow-primary/10" : ""}`}
                  >
                    {isPopular && (
                      <div className="absolute top-0 right-0">
                        <Badge className="rounded-none rounded-bl-lg bg-primary text-primary-foreground">
                          Popular
                        </Badge>
                      </div>
                    )}
                    <CardContent className="p-6">
                      <h3 className="text-lg font-bold">{plan.name}</h3>
                      <div className="mt-2 mb-6">
                        <span className="text-3xl font-bold">
                          {formatCurrency(plan.price)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          /mês
                        </span>
                        <p className="text-xs text-muted-foreground mt-2">
                          Anual a partir de {formatCurrency(plan.annualPrice)}
                          /mês
                        </p>
                      </div>
                      <ul className="space-y-2 mb-6">
                        {getPlanFeatureList(plan).map((feature) => (
                          <li
                            key={feature}
                            className="flex items-center gap-2 text-sm"
                          >
                            <Check className="w-4 h-4 text-primary shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                      <Button
                        variant={
                          isCurrent
                            ? "outline"
                            : isPopular
                              ? "default"
                              : "outline"
                        }
                        className={`w-full ${isPopular && !isCurrent ? "bg-primary hover:bg-primary/90" : ""}`}
                        disabled={isCurrent}
                      >
                        {isCurrent ? "Plano Atual" : "Assinar"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
