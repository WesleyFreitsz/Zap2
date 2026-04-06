import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Brain,
  Zap,
  TrendingUp,
  Users,
  AlertCircle,
  CheckCircle,
  BarChart3,
  RefreshCw,
  Play,
  Target
} from "lucide-react";
import { toast } from "sonner";
import { leadsApi } from "@/api/apiClient";

// API client para IA
const aiApi = {
  analyzeLead: (leadId) => leadsApi.request(`/leads/ai/analyze/${leadId}`, { method: 'POST' }),
  batchAnalyze: () => leadsApi.request('/leads/ai/batch-analyze', { method: 'POST' }),
  getInsights: () => leadsApi.request('/leads/ai/insights'),
  triggerAutoClassify: () => leadsApi.request('/leads/ai/auto-classify', { method: 'POST' }),
};

function InsightCard({ title, value, icon: Icon, color, description }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-xl font-bold">{value}</p>
          {description && (
            <p className="text-xs text-gray-500 mt-1">{description}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

function RecommendationCard({ recommendation, index }) {
  return (
    <Card className="p-3 border-l-4 border-l-blue-500">
      <div className="flex items-start gap-2">
        <Target className="w-4 h-4 text-blue-500 mt-0.5" />
        <p className="text-sm text-gray-700">{recommendation}</p>
      </div>
    </Card>
  );
}

function TemperatureDistribution({ distribution, total }) {
  const hotCount = distribution.HOT || 0;
  const warmCount = distribution.WARM || 0;
  const coldCount = distribution.COLD || 0;

  const hotPercentage = total > 0 ? (hotCount / total) * 100 : 0;
  const warmPercentage = total > 0 ? (warmCount / total) * 100 : 0;
  const coldPercentage = total > 0 ? (coldCount / total) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">{hotCount}</div>
          <div className="text-xs text-gray-600">HOT</div>
          <div className="text-xs text-gray-500">{hotPercentage.toFixed(1)}%</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-amber-600">{warmCount}</div>
          <div className="text-xs text-gray-600">WARM</div>
          <div className="text-xs text-gray-500">{warmPercentage.toFixed(1)}%</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{coldCount}</div>
          <div className="text-xs text-gray-600">COLD</div>
          <div className="text-xs text-gray-500">{coldPercentage.toFixed(1)}%</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-12 text-xs text-red-600">HOT</div>
          <Progress value={hotPercentage} className="flex-1 h-2" />
          <div className="w-12 text-xs text-right">{hotPercentage.toFixed(0)}%</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-12 text-xs text-amber-600">WARM</div>
          <Progress value={warmPercentage} className="flex-1 h-2" />
          <div className="w-12 text-xs text-right">{warmPercentage.toFixed(0)}%</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-12 text-xs text-blue-600">COLD</div>
          <Progress value={coldPercentage} className="flex-1 h-2" />
          <div className="w-12 text-xs text-right">{coldPercentage.toFixed(0)}%</div>
        </div>
      </div>
    </div>
  );
}

export default function AiTemperatureControl() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");

  // Query para insights
  const { data: insights, isLoading: insightsLoading } = useQuery({
    queryKey: ["ai-insights"],
    queryFn: () => aiApi.getInsights(),
    refetchInterval: 30000, // Atualizar a cada 30 segundos
  });

  // Mutation para análise em lote
  const batchAnalyzeMutation = useMutation({
    mutationFn: aiApi.batchAnalyze,
    onSuccess: (data) => {
      toast.success(`Análise concluída: ${data.data.updated} leads atualizados!`);
      qc.invalidateQueries({ queryKey: ["ai-insights"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Erro na análise em lote");
    },
  });

  // Mutation para classificação automática
  const autoClassifyMutation = useMutation({
    mutationFn: aiApi.triggerAutoClassify,
    onSuccess: () => {
      toast.success("Classificação automática iniciada!");
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Erro ao iniciar classificação");
    },
  });

  if (insightsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 animate-pulse" />
          <h3 className="text-lg font-semibold">IA de Temperatura</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-24 bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const insightsData = insights?.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">IA de Temperatura</h3>
            <p className="text-sm text-gray-600">
              Classificação inteligente de clientes baseada em comportamento
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => autoClassifyMutation.mutate()}
            disabled={autoClassifyMutation.isPending}
          >
            <Play className="w-4 h-4 mr-1" />
            Auto Classificar
          </Button>
          <Button
            size="sm"
            onClick={() => batchAnalyzeMutation.mutate()}
            disabled={batchAnalyzeMutation.isPending}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${batchAnalyzeMutation.isPending ? 'animate-spin' : ''}`} />
            Analisar Todos
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="distribution">Distribuição</TabsTrigger>
          <TabsTrigger value="recommendations">Recomendações</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <InsightCard
              title="Total de Leads"
              value={insightsData?.totalLeads || 0}
              icon={Users}
              color="bg-blue-500"
              description="Clientes ativos"
            />
            <InsightCard
              title="Leads HOT"
              value={insightsData?.distribution?.HOT || 0}
              icon={Zap}
              color="bg-red-500"
              description="Prontos para comprar"
            />
            <InsightCard
              title="Leads WARM"
              value={insightsData?.distribution?.WARM || 0}
              icon={TrendingUp}
              color="bg-amber-500"
              description="Interessados"
            />
            <InsightCard
              title="Leads COLD"
              value={insightsData?.distribution?.COLD || 0}
              icon={AlertCircle}
              color="bg-blue-500"
              description="Precisam de atenção"
            />
          </div>

          <Card className="p-4">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Como Funciona a Classificação
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="space-y-2">
                <Badge variant="destructive">🔥 HOT</Badge>
                <p className="text-gray-600">
                  Já compraram, mencionam interesse em comprar, perguntam preços,
                  alta taxa de resposta.
                </p>
              </div>
              <div className="space-y-2">
                <Badge variant="secondary">🌡️ WARM</Badge>
                <p className="text-gray-600">
                  Fazem perguntas, mostram interesse em produtos,
                  taxa de resposta moderada.
                </p>
              </div>
              <div className="space-y-2">
                <Badge variant="outline">❄️ COLD</Badge>
                <p className="text-gray-600">
                  Poucas mensagens, não fazem perguntas,
                  inativos há muito tempo.
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="distribution" className="space-y-4">
          <Card className="p-6">
            <h4 className="font-semibold mb-4">Distribuição de Temperaturas</h4>
            <TemperatureDistribution
              distribution={insightsData?.distribution || {}}
              total={insightsData?.totalLeads || 0}
            />
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <div className="space-y-3">
            <h4 className="font-semibold flex items-center gap-2">
              <Target className="w-4 h-4" />
              Recomendações da IA
            </h4>
            {insightsData?.recommendations?.length > 0 ? (
              insightsData.recommendations.map((rec, index) => (
                <RecommendationCard
                  key={index}
                  recommendation={rec}
                  index={index}
                />
              ))
            ) : (
              <Card className="p-4 text-center text-gray-500">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Nenhuma recomendação no momento</p>
                <p className="text-xs">Execute uma análise para gerar insights</p>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
