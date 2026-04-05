import React from "react";
import { useQuery } from "@tanstack/react-query";
import { conversationsApi } from "@/api/apiClient";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, Snowflake, Thermometer } from "lucide-react";

const tempConfig = {
  hot: {
    label: "Hot",
    icon: Flame,
    bg: "bg-red-50",
    border: "border-red-200",
    header: "bg-red-500",
  },
  warm: {
    label: "Warm",
    icon: Thermometer,
    bg: "bg-amber-50",
    border: "border-amber-200",
    header: "bg-amber-500",
  },
  cold: {
    label: "Cold",
    icon: Snowflake,
    bg: "bg-blue-50",
    border: "border-blue-200",
    header: "bg-blue-500",
  },
};

const statusLabels = { OPEN: "Aberta", CLOSED: "Fechada", PENDING: "Pendente" };

export default function ContactTemperatureBoard() {
  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => conversationsApi.list(),
  });

  const grouped = {
    hot: conversations.filter((c) => c.status === "OPEN" && c.isAutoMode),
    warm: conversations.filter((c) => c.status === "OPEN" && !c.isAutoMode),
    cold: conversations.filter((c) => c.status !== "OPEN"),
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
            <div className="p-3 space-y-2 min-h-[200px]">
              {list.length === 0 && (
                <p className="text-xs text-center text-muted-foreground py-8">
                  Nenhum contato aqui
                </p>
              )}
              {list.map((conv) => (
                <Card
                  key={conv.id}
                  className="p-3 bg-white shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary text-xs shrink-0">
                      {(conv.contactName || conv.contactPhone)
                        ?.charAt(0)
                        ?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {conv.contactName || conv.contactPhone}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {conv.contactPhone}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1 flex-wrap">
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0"
                    >
                      {statusLabels[conv.status] || conv.status}
                    </Badge>
                    {conv.isAutoMode && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 bg-accent"
                      >
                        IA Auto
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
