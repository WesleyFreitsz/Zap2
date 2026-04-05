import React from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/api/apiClient";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Receipt,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Building2,
} from "lucide-react";

export default function AdminBilling() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => adminApi.dashboard(),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Receipt className="w-6 h-6" /> Faturamento Geral
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const stats = data || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Receipt className="w-6 h-6 text-green-500" /> Faturamento Geral
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão geral de receita e assinaturas
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Receita Mensal</p>
              <p className="text-2xl font-bold">
                R$ {(stats.totalRevenue || 0).toFixed(2)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Empresas Ativas</p>
              <p className="text-2xl font-bold">{stats.activeCompanies || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Plano Mais Popular</p>
              <p className="text-2xl font-bold capitalize">
                {stats.mostPopularPlan || "—"}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Inadimplentes</p>
              <p className="text-2xl font-bold">{stats.overdueCount || 0}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Plan distribution */}
      <Card className="p-5">
        <h2 className="text-lg font-semibold mb-4">Distribuição de Planos</h2>
        <div className="space-y-3">
          {Object.entries(stats.planDistribution || {}).map(([plan, count]) => {
            const total = stats.totalCompanies || 1;
            const pct = Math.round((count / total) * 100);
            return (
              <div key={plan} className="flex items-center gap-3">
                <Badge variant="outline" className="w-20 justify-center capitalize">
                  {plan}
                </Badge>
                <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-16 text-right">
                  {count} ({pct}%)
                </span>
              </div>
            );
          })}
          {Object.keys(stats.planDistribution || {}).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma empresa cadastrada ainda
            </p>
          )}
        </div>
      </Card>

      {/* Company billing list */}
      <Card className="p-5">
        <h2 className="text-lg font-semibold mb-4">Empresas e Assinaturas</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Empresa</th>
                <th className="pb-2 font-medium">Plano</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(stats.companies || []).map((c) => (
                <tr key={c.id} className="hover:bg-muted/50">
                  <td className="py-2.5 font-medium">{c.name}</td>
                  <td className="py-2.5">
                    <Badge variant="outline" className="capitalize">
                      {c.subscription?.plan || c.plan}
                    </Badge>
                  </td>
                  <td className="py-2.5">
                    <Badge
                      variant={
                        c.subscription?.status === "ACTIVE"
                          ? "default"
                          : c.subscription?.status === "OVERDUE"
                            ? "destructive"
                            : "secondary"
                      }
                      className="text-[10px]"
                    >
                      {c.subscription?.status || (c.isActive ? "ATIVA" : "INATIVA")}
                    </Badge>
                  </td>
                  <td className="py-2.5 text-right">
                    {c.subscription?.value
                      ? `R$ ${c.subscription.value.toFixed(2)}`
                      : "—"}
                  </td>
                </tr>
              ))}
              {(stats.companies || []).length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-6 text-muted-foreground">
                    Nenhuma empresa encontrada
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
