import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { leadsApi } from "@/api/apiClient";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, Snowflake, Thermometer, User, Phone, Mail } from "lucide-react";
import { toast } from "sonner";

const tempConfig = {
  HOT: {
    label: "🔥 Hot",
    color: "from-red-500 to-orange-500",
    border: "border-red-200",
    bg: "bg-red-50",
    icon: Flame,
  },
  WARM: {
    label: "🌡️ Warm",
    color: "from-amber-500 to-yellow-500",
    border: "border-amber-200",
    bg: "bg-amber-50",
    icon: Thermometer,
  },
  COLD: {
    label: "❄️ Cold",
    color: "from-blue-500 to-cyan-500",
    border: "border-blue-200",
    bg: "bg-blue-50",
    icon: Snowflake,
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

function LeadCard({ lead, onDragStart }) {
  return (
    <Card
      draggable
      onDragStart={() => onDragStart(lead)}
      className="p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition"
    >
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">
          {(lead.name || lead.phone)?.charAt(0).toUpperCase()}
        </div>

        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">
            {lead.name || "Sem nome"}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">
            {lead.phone}
          </p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        <Badge variant="outline" className="text-[10px]">
          {statusLabels[lead.status] || lead.status}
        </Badge>

        {lead.assignedTo && (
          <Badge variant="outline" className="text-[10px]">
            {lead.assignedTo.name}
          </Badge>
        )}
      </div>

      {lead.notes && (
        <p className="text-xs mt-2 text-muted-foreground line-clamp-2">
          {lead.notes}
        </p>
      )}
    </Card>
  );
}

export default function ContactTemperatureBoard() {
  const qc = useQueryClient();
  const [draggingLead, setDraggingLead] = useState(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: () => leadsApi.list(),
  });

  const mutation = useMutation({
    mutationFn: ({ id, temperature }) =>
      leadsApi.update(id, { temperature }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Temperatura atualizada");
    },
  });

  const grouped = useMemo(
    () => ({
      HOT: leads.filter((l) => l.temperature === "HOT"),
      WARM: leads.filter((l) => l.temperature === "WARM"),
      COLD: leads.filter((l) => l.temperature === "COLD"),
    }),
    [leads]
  );

  const handleDrop = (temperature) => {
    if (!draggingLead || draggingLead.temperature === temperature) return;

    mutation.mutate({
      id: draggingLead.id,
      temperature,
    });

    setDraggingLead(null);
  };

  if (isLoading) {
    return (
      <div className="grid md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-64 bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-3 gap-4">
      {Object.entries(tempConfig).map(([key, config]) => {
        const Icon = config.icon;
        const list = grouped[key];

        return (
          <div
            key={key}
            className={`rounded-xl border ${config.border} ${config.bg}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(key)}
          >
            {/* Header */}
            <div
              className={`bg-gradient-to-r ${config.color} text-white p-3 flex justify-between`}
            >
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4" />
                <span className="font-bold text-sm">{config.label}</span>
              </div>
              <span className="text-xs font-bold">{list.length}</span>
            </div>

            {/* Cards */}
            <div className="p-3 space-y-2 min-h-[200px]">
              {list.length === 0 ? (
                <p className="text-xs text-center text-muted-foreground py-6">
                  Nenhum lead
                </p>
              ) : (
                list.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onDragStart={setDraggingLead}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}