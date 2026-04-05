import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi, plansApi } from "@/api/apiClient";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Building2,
  Users,
  MessageSquare,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  ToggleLeft,
  ToggleRight,
  Plus,
  Loader2,
  Palette,
  Upload,
  Link as LinkIcon,
} from "lucide-react";
import { toast } from "sonner";

function CreateCompanyModal({ open, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    adminEmail: "",
    plan: "basic",
    primaryColor: "#6366f1",
    secondaryColor: "#f59e0b",
    logo: "",
    logoMode: "url", // "url" | "upload"
  });
  const [logoFile, setLogoFile] = useState(null);

  const { data: plans = [] } = useQuery({
    queryKey: ["plans"],
    queryFn: () => plansApi.list(),
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const result = await adminApi.createCompany(data);
      // If there's a logo file, upload it after company creation
      if (logoFile && result?.company?.id) {
        const fd = new FormData();
        fd.append("logo", logoFile);
        await adminApi.uploadLogo(result.company.id, fd);
      }
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
      toast.success("Empresa criada e convite enviado!");
      onClose();
      setForm({
        name: "",
        adminEmail: "",
        plan: "basic",
        primaryColor: "#6366f1",
        secondaryColor: "#f59e0b",
        logo: "",
        logoMode: "url",
      });
      setLogoFile(null);
    },
    onError: (e) =>
      toast.error(e.response?.data?.message || "Erro ao criar empresa"),
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    if (!form.name || !form.adminEmail) {
      toast.error("Nome e email do admin são obrigatórios");
      return;
    }
    const payload = {
      name: form.name,
      adminEmail: form.adminEmail,
      plan: form.plan,
      primaryColor: form.primaryColor,
      secondaryColor: form.secondaryColor,
      logo: form.logoMode === "url" ? form.logo : undefined,
    };
    createMutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" /> Nova Empresa
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome da Empresa *</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ex: Empresa ABC"
            />
          </div>
          <div>
            <Label>Email do Admin *</Label>
            <Input
              type="email"
              value={form.adminEmail}
              onChange={(e) => set("adminEmail", e.target.value)}
              placeholder="admin@empresa.com"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Uma senha provisória será enviada para este email
            </p>
          </div>
          <div>
            <Label>Plano</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.plan}
              onChange={(e) => set("plan", e.target.value)}
            >
              {plans.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name} — R$ {p.price}/mês
                </option>
              ))}
              {plans.length === 0 && <option value="basic">Basic</option>}
            </select>
          </div>

          {/* White-label section */}
          <div className="border rounded-lg p-3 space-y-3">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Palette className="w-4 h-4" /> White-label
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cor Primária</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={form.primaryColor}
                    onChange={(e) => set("primaryColor", e.target.value)}
                    className="w-8 h-8 rounded border cursor-pointer"
                  />
                  <Input
                    value={form.primaryColor}
                    onChange={(e) => set("primaryColor", e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
              <div>
                <Label>Cor Secundária</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={form.secondaryColor}
                    onChange={(e) => set("secondaryColor", e.target.value)}
                    className="w-8 h-8 rounded border cursor-pointer"
                  />
                  <Input
                    value={form.secondaryColor}
                    onChange={(e) => set("secondaryColor", e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label>Logo</Label>
              <div className="flex gap-2 mb-2">
                <Button
                  type="button"
                  variant={form.logoMode === "url" ? "default" : "outline"}
                  size="sm"
                  onClick={() => set("logoMode", "url")}
                  className="gap-1 text-xs"
                >
                  <LinkIcon className="w-3 h-3" /> URL
                </Button>
                <Button
                  type="button"
                  variant={form.logoMode === "upload" ? "default" : "outline"}
                  size="sm"
                  onClick={() => set("logoMode", "upload")}
                  className="gap-1 text-xs"
                >
                  <Upload className="w-3 h-3" /> Upload
                </Button>
              </div>
              {form.logoMode === "url" ? (
                <Input
                  value={form.logo}
                  onChange={(e) => set("logo", e.target.value)}
                  placeholder="https://example.com/logo.png"
                />
              ) : (
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                />
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending && (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              )}
              Criar Empresa
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminDashboard() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => adminApi.dashboard(),
  });

  const toggleMutation = useMutation({
    mutationFn: (id) => adminApi.toggleCompany(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
      toast.success("Status da empresa atualizado");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Painel Administrativo</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const stats = [
    {
      label: "Total Empresas",
      value: data?.totalCompanies || 0,
      icon: Building2,
      color: "text-blue-600 bg-blue-100",
    },
    {
      label: "Empresas Ativas",
      value: data?.activeCompanies || 0,
      icon: TrendingUp,
      color: "text-green-600 bg-green-100",
    },
    {
      label: "Inadimplentes",
      value: data?.overdueCount || 0,
      icon: AlertTriangle,
      color: "text-red-600 bg-red-100",
    },
    {
      label: "Faturamento Mensal",
      value: `R$ ${(data?.totalRevenue || 0).toFixed(2)}`,
      icon: DollarSign,
      color: "text-emerald-600 bg-emerald-100",
    },
    {
      label: "Total Usuarios",
      value: data?.totalUsers || 0,
      icon: Users,
      color: "text-purple-600 bg-purple-100",
    },
    {
      label: "Total Conversas",
      value: data?.totalConversations || 0,
      icon: MessageSquare,
      color: "text-indigo-600 bg-indigo-100",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Painel Administrativo</h1>
          <p className="text-sm text-muted-foreground">
            Visao geral de todas as empresas e metricas da plataforma
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Empresa
        </Button>
      </div>

      <CreateCompanyModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-4 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${stat.color}`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="text-xl font-bold">{stat.value}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Plan Distribution */}
      {data?.planDistribution && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Distribuicao de Planos</h3>
          <div className="flex gap-4 flex-wrap">
            {Object.entries(data.planDistribution).map(([plan, count]) => (
              <div key={plan} className="flex items-center gap-2">
                <Badge
                  variant={
                    plan === data.mostPopularPlan ? "default" : "outline"
                  }
                >
                  {plan}
                </Badge>
                <span className="text-sm font-medium">{count} empresa(s)</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Companies Table */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Empresas</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Empresa</th>
                <th className="text-left p-3 font-medium">Plano</th>
                <th className="text-left p-3 font-medium">Usuarios</th>
                <th className="text-left p-3 font-medium">Conversas</th>
                <th className="text-left p-3 font-medium">Assinatura</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {(data?.companies || []).map((company) => (
                <tr key={company.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-medium">{company.name}</td>
                  <td className="p-3">
                    <Badge variant="outline">{company.plan}</Badge>
                  </td>
                  <td className="p-3">{company.usersCount}</td>
                  <td className="p-3">{company.conversationsCount}</td>
                  <td className="p-3">
                    {company.subscription ? (
                      <Badge
                        variant={
                          company.subscription.status === "ACTIVE"
                            ? "default"
                            : "destructive"
                        }
                        className="text-[10px]"
                      >
                        {company.subscription.status}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        Sem assinatura
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <Badge
                      variant={company.isActive ? "default" : "destructive"}
                      className="text-[10px]"
                    >
                      {company.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleMutation.mutate(company.id)}
                      className="h-7 text-xs gap-1"
                    >
                      {company.isActive ? (
                        <>
                          <ToggleRight className="w-3.5 h-3.5" /> Desativar
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-3.5 h-3.5" /> Ativar
                        </>
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
