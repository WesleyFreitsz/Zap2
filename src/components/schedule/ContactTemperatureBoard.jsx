import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { leadsApi } from "@/api/apiClient";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Flame, Snowflake, Thermometer, User, Phone, Mail, Tag } from "lucide-react";
import { toast } from "sonner";

const tempConfig = {
  HOT: {
    label: "🔥 Hot",
    description: "Prontos para comprar",
    color: "from-red-500 to-orange-500",
    bg: "bg-gradient-to-br from-red-50 to-orange-50",
    border: "border-red-200",
    cardBg: "bg-white",
    icon: Flame,
  },
  WARM: {
    label: "🌡️ Warm",
    description: "Interessados, mas precisam de atenção",
    color: "from-amber-500 to-yellow-500",
    bg: "bg-gradient-to-br from-amber-50 to-yellow-50",
    border: "border-amber-200",
    cardBg: "bg-white",
    icon: Thermometer,
  },
  COLD: {
    label: "❄️ Cold",
    description: "Leads frios, precisam de nutrição",
    color: "from-blue-500 to-cyan-500",
    bg: "bg-gradient-to-br from-blue-50 to-cyan-50",
    border: "border-blue-200",
    cardBg: "bg-white",
    icon: Snowflake,
  },
};

const statusLabels = {
  NEW: "Novo",
  IN_ATTENDANCE: "Em Atendimento",
  WAITING: "Aguardando",
  FOLLOW_UP: "Follow-up",
  CLOSED: "Fechado",
  LOST: "Perdido",
};

function LeadCard({ lead, isDragging }) {
  const getTagColor = (category) => {
    const colors = {
      hot: "bg-red-100 text-red-700 border-red-200",
      warm: "bg-amber-100 text-amber-700 border-amber-200",
      cold: "bg-blue-100 text-blue-700 border-blue-200",
      custom: "bg-purple-100 text-purple-700 border-purple-200",
    };
    return colors[category] || colors.custom;
  };

  return (
    <Card
      className={`p-4 cursor-move shadow-sm hover:shadow-lg transition-all duration-200 ${isDragging ? "opacity-50 rotate-2 scale-105 shadow-2xl" : "hover:scale-[1.02]"
        } ${tempConfig[lead.temperature]?.cardBg}`}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white font-bold shadow-sm">
              {(lead.name || "Contato")?.charAt(0)?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <h4 className="font-semibold text-sm text-gray-900 truncate">
                {lead.name || "Sem nome"}
              </h4>
              <p className="text-xs text-gray-500">
                {statusLabels[lead.status] || lead.status}
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={`text-[10px] font-medium ${lead.temperature === "HOT" ? "border-red-200 text-red-700 bg-red-50" :
                lead.temperature === "WARM" ? "border-amber-200 text-amber-700 bg-amber-50" :
                  "border-blue-200 text-blue-700 bg-blue-50"
              }`}
          >
            {tempConfig[lead.temperature]?.label}
          </Badge>
        </div>

        {/* Contact Info */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Phone className="w-3 h-3" />
            <span>{lead.phone}</span>
          </div>
          {lead.email && (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Mail className="w-3 h-3" />
              <span className="truncate">{lead.email}</span>
            </div>
          )}
          {lead.assignedTo && (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <User className="w-3 h-3" />
              <span>{lead.assignedTo.name}</span>
            </div>
          )}
        </div>

        {/* Tags */}
        {lead.tags && lead.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {lead.tags.slice(0, 3).map((tag) => (
              <span
                key={tag.id}
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${getTagColor(
                  tag.category
                )}`}
              >
                {tag.name}
              </span>
            ))}
            {lead.tags.length > 3 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600 border-gray-200">
                +{lead.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Notes */}
        {lead.notes && (
          <p className="text-xs text-gray-600 line-clamp-2 bg-gray-50 p-2 rounded-md">
            {lead.notes}
          </p>
        )}
      </div>
    </Card>
  );
}

function TemperatureColumn({ temperature, leads, onDrop }) {
  const config = tempConfig[temperature];
  const Icon = config.icon;
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div
      className={`rounded-2xl border-2 ${config.border} ${config.bg} overflow-hidden backdrop-blur-sm transition-all duration-300 ${isDragOver ? "ring-2 ring-offset-2 ring-primary/50 scale-[1.02]" : ""
        }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        onDrop(temperature);
      }}
    >
      {/* Header */}
      <div className={`bg-gradient-to-r ${config.color} p-4 shadow-lg`}>
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-lg">{config.label}</h3>
              <p className="text-xs text-white/80">{config.description}</p>
            </div>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
            <span className="font-bold text-sm">{leads.length}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 min-h-[400px] max-h-[600px] overflow-y-auto space-y-3">
        {leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <Icon className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm text-center">Nenhum contato aqui</p>
            <p className="text-xs text-center">Arraste contatos para esta coluna</p>
          </div>
        ) : (
          leads.map((lead) => (
            <div
              key={lead.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("leadId", lead.id);
                e.dataTransfer.setData("currentTemperature", lead.temperature);
              }}
            >
              <LeadCard lead={lead} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function ContactTemperatureBoard() {
  const qc = useQueryClient();
  const [draggedLead, setDraggedLead] = useState(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: () => leadsApi.list(),
  });

  const updateLeadMutation = useMutation({
    mutationFn: ({ leadId, temperature }) => leadsApi.update(leadId, { temperature }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Temperatura atualizada com sucesso!");
    },
    onError: (err) => {
      console.error("Erro ao atualizar temperatura:", err);
      toast.error("Erro ao atualizar temperatura");
    },
  });

  const grouped = {
    HOT: leads.filter((l) => l.temperature === "HOT"),
    WARM: leads.filter((l) => l.temperature === "WARM"),
    COLD: leads.filter((l) => l.temperature === "COLD"),
  };

  const handleDrop = (targetTemperature) => {
    const leadId = draggedLead?.id;
    if (!leadId || draggedLead.temperature === targetTemperature) return;

    updateLeadMutation.mutate({
      leadId,
      temperature: targetTemperature,
    });
  };

  const handleDragStart = (e) => {
    const leadId = e.dataTransfer.getData("leadId");
    const lead = leads.find(l => l.id === leadId);
    setDraggedLead(lead);
  };

  const handleDragEnd = () => {
    setDraggedLead(null);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Object.keys(tempConfig).map((temp) => (
          <div key={temp} className="h-96 rounded-2xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">Hot / Cold Board</h2>
        <p className="text-gray-600">
          Arraste e solte os contatos para transicioná-los entre as temperaturas
        </p>
      </div>

      {/* Board */}
      <div
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        {Object.entries(grouped).map(([temperature, temperatureLeads]) => (
          <TemperatureColumn
            key={temperature}
            temperature={temperature}
            leads={temperatureLeads}
            onDrop={handleDrop}
          />
        ))}
      </div>

      {/* Instructions */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 border border-blue-200">
        <h4 className="font-semibold text-sm text-blue-900 mb-2">💡 Como usar:</h4>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>• Arraste e solte os contatos entre as colunas para mudar a temperatura</li>
          <li>• <strong>Hot:</strong> Contatos prontos para comprar ou converter</li>
          <li>• <strong>Warm:</strong> Contatos interessados que precisam de atenção</li>
          <li>• <strong>Cold:</strong> Contatos frios que precisam de nutrição</li>
        </ul>
      </div>
    </div>
  );
}
