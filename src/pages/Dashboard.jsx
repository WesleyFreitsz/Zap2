import React from "react";
import { useQuery } from "@tanstack/react-query";
import { dashboardApi, whatsappApi } from "@/api/apiClient";
import { MessageSquare, Users, Bot, TrendingUp, Zap } from "lucide-react";
import StatCard from "../components/dashboard/StatCard";
import RecentChats from "../components/dashboard/RecentChats";
import ActivityChart from "../components/dashboard/ActivityChart";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const { data: overview, isLoading } = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: () => dashboardApi.overview(),
  });

  const { data: waStatus } = useQuery({
    queryKey: ["whatsapp-status"],
    queryFn: () => whatsappApi.status().catch(() => null),
    retry: false,
  });

  const connected = waStatus?.connectionStatus === "CONNECTED";

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-[140px] rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[360px] rounded-xl" />
          <Skeleton className="h-[360px] rounded-xl" />
        </div>
      </div>
    );
  }

  const stats = overview || {};

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão geral do seu atendimento inteligente
          </p>
        </div>
        <Badge
          variant="outline"
          className={
            connected
              ? "border-primary/50 text-primary bg-primary/10"
              : "border-destructive/50 text-destructive bg-destructive/10"
          }
        >
          <div
            className={`w-2 h-2 rounded-full mr-2 ${connected ? "bg-primary animate-pulse" : "bg-destructive"}`}
          />
          WhatsApp {connected ? "Conectado" : "Desconectado"}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total Mensagens"
          value={stats.totalMessages ?? 0}
          icon={MessageSquare}
        />
        <StatCard
          title="Conversas Abertas"
          value={stats.openConversations ?? 0}
          icon={Users}
        />
        <StatCard
          title="Total Conversas"
          value={stats.totalConversations ?? 0}
          subtitle="Todas as conversas"
          icon={Bot}
        />
        <StatCard
          title="Funcionários Ativos"
          value={stats.activeEmployees ?? 0}
          icon={TrendingUp}
        />
      </div>

      {/* Charts & Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActivityChart />
        <RecentChats conversations={stats.recentConversations || []} />
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link
              to="/ai-config"
              className="flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-accent/50 transition-all cursor-pointer group"
            >
              <div className="p-2 rounded-lg bg-accent group-hover:bg-primary/10 transition-colors">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">Configurar IA</p>
                <p className="text-xs text-muted-foreground">
                  Ajustar tom e produtos
                </p>
              </div>
            </Link>
            <Link
              to="/whatsapp"
              className="flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-accent/50 transition-all cursor-pointer group"
            >
              <div className="p-2 rounded-lg bg-accent group-hover:bg-primary/10 transition-colors">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">Conectar WhatsApp</p>
                <p className="text-xs text-muted-foreground">
                  Gerenciar conexão
                </p>
              </div>
            </Link>
            <Link
              to="/conversations"
              className="flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-accent/50 transition-all cursor-pointer group"
            >
              <div className="p-2 rounded-lg bg-accent group-hover:bg-primary/10 transition-colors">
                <MessageSquare className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">Ver Conversas</p>
                <p className="text-xs text-muted-foreground">
                  Atender clientes
                </p>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
