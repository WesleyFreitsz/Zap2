import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { leadsApi } from "@/api/apiClient";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, Snowflake, Thermometer } from "lucide-react";
import { toast } from "sonner";

const tempConfig = {
  hot: {
    apiValue: "HOT",
    label: "Hot",
    icon: Flame,
    bg: "bg-red-500/5 dark:bg-red-500/10",
    border: "border-red-500/20",
    header: "bg-red-500",
  },
  warm: {
    apiValue: "WARM",
    label: "Warm",
    icon: Thermometer,
    bg: "bg-amber-500/5 dark:bg-amber-500/10",
    border: "border-amber-500/20",
    header: "bg-amber-500",
  },
  cold: {
    apiValue: "COLD",
    label: "Cold",
    icon: Snowflake,
    bg: "bg-blue-500/5 dark:bg-blue-500/10",
    border: "border-blue-500/20",
    header: "bg-blue-500",
  },
};

const statusLabels = {
  NEW: "Novo",
  IN_ATTENDANCE: "Em atendimento",
  WAITING: "Aguardando",
  FOLLOW_UP: "Follow-up",
  CLOSED: "Fechado",
  LOST: "Perdido",
};

export default function ContactTemperatureBoard() {
  const queryClient = useQueryClient();
  const [draggingLeadId, setDraggingLeadId] = useState(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads", "temperature-board"],
    queryFn: () => leadsApi.list(),
  });

  const updateTemperatureMutation = useMutation({
    mutationFn: ({ id, temperature }) => leadsApi.update(id, { temperature }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Temperatura do lead atualizada.");
    },
    onError: (error) => {
      toast.error(
        error.response?.data?.message ||
          "Erro ao atualizar temperatura do lead",
      );
    },
  });

  const grouped = useMemo(
    () => ({
      hot: leads.filter((lead) => lead.temperature === "HOT"),
      warm: leads.filter((lead) => lead.temperature === "WARM"),
      cold: leads.filter((lead) => lead.temperature === "COLD"),
    }),
    [leads],
  );

  const handleDrop = (lead, temperature) => {
    if (!lead || lead.temperature === temperature) return;
    updateTemperatureMutation.mutate({ id: lead.id, temperature });
  };

  if (isLoading)
    return (
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-64 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {Object.entries(tempConfig).map(([temp, cfg]) => {
        const Icon = cfg.icon;
        const list = grouped[temp] || [];
        return (
          <div
            key={temp}
            className={`rounded-xl border ${cfg.border} ${cfg.bg} overflow-hidden`}
            onDragOver={(event) => event.preventDefault()}
          >
            <div
              className={`${cfg.header} px-4 py-3 flex items-center justify-between`}
            >
              <div className="flex items-center gap-2 text-white">
                <Icon className="w-4 h-4" />
                <span className="font-bold text-sm">{cfg.label}</span>
              </div>
              <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {list.length}
              </span>
            </div>
            <div
              className="p-3 space-y-2 min-h-[200px]"
              onDrop={() => {
                const lead = leads.find((item) => item.id === draggingLeadId);
                handleDrop(lead, cfg.apiValue);
                setDraggingLeadId(null);
              }}
            >
              {list.length === 0 && (
                <p className="text-xs text-center text-muted-foreground py-8">
                  Nenhum contato aqui
                </p>
              )}
              {list.map((lead) => (
                <Card
                  key={lead.id}
                  draggable
                  onDragStart={() => setDraggingLeadId(lead.id)}
                  onDragEnd={() => setDraggingLeadId(null)}
                  className={`p-3 bg-card shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing ${draggingLeadId === lead.id ? "opacity-60" : ""}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary text-xs shrink-0">
                      {(lead.name || lead.phone)?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {lead.name || lead.phone}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {lead.phone}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1 flex-wrap">
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0"
                    >
                      {statusLabels[lead.status] || lead.status}
                    </Badge>
                    {lead.assignedTo?.name && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {lead.assignedTo.name}
                      </Badge>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
