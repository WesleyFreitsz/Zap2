import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { scheduleApi } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Clock,
  Trash2,
  CheckCircle,
  XCircle,
  RefreshCw,
  Send,
} from "lucide-react";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";
import ScheduleMessageModal from "./ScheduleMessageModal";

const statusConfig = {
  pending: {
    label: "Aguardando",
    color: "bg-amber-100 text-amber-700 border-amber-200",
  },
  sending: {
    label: "Enviando",
    color: "bg-blue-100 text-blue-700 border-blue-200",
  },
  sent: {
    label: "Enviada",
    color: "bg-green-100 text-green-700 border-green-200",
  },
  failed: { label: "Falhou", color: "bg-red-100 text-red-700 border-red-200" },
  cancelled: {
    label: "Cancelada",
    color: "bg-gray-100 text-gray-500 border-gray-200",
  },
};

const repeatLabels = {
  none: "Sem repetição",
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
};

function safeDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function getDateLabel(dateStr) {
  const d = safeDate(dateStr);
  if (!d) return "Data inválida";
  if (isToday(d)) return "Hoje";
  if (isTomorrow(d)) return "Amanhã";
  return format(d, "dd 'de' MMM", { locale: ptBR });
}

export default function ScheduledMessages() {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const qc = useQueryClient();

  const { data: scheduled = [], isLoading } = useQuery({
    queryKey: ["scheduled_messages"],
    queryFn: () => scheduleApi.list(),
    select: (messages) =>
      messages.map((message) => ({ ...message, status: message.status.toLowerCase() })),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => scheduleApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scheduled_messages"] }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id) => scheduleApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scheduled_messages"] }),
  });

  // Group by date
  const grouped = scheduled.reduce((acc, msg) => {
    const key = getDateLabel(msg.sendAt || msg.scheduled_at);
    if (!acc[key]) acc[key] = [];
    acc[key].push(msg);
    return acc;
  }, {});

  const pending = scheduled.filter((m) => m.status === "pending");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
            <Clock className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-700">
              {pending.length} pendentes
            </span>
          </div>
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-700">
              {scheduled.filter((m) => m.status === "sent").length} enviadas
            </span>
          </div>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setShowModal(true);
          }}
          className="gap-2"
        >
          <Plus className="w-4 h-4" /> Agendar Mensagem
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : scheduled.length === 0 ? (
        <Card className="p-12 text-center">
          <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium text-muted-foreground">
            Nenhuma mensagem agendada
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Clique em "Agendar Mensagem" para começar
          </p>
        </Card>
      ) : (
        Object.entries(grouped).map(([dateLabel, msgs]) => (
          <div key={dateLabel}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {dateLabel}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="space-y-2">
              {msgs.map((msg) => (
                <Card
                  key={msg.id}
                  className="p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 font-semibold text-primary text-sm">
                        {msg.contact_name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">
                            {msg.contact_name || "Contato"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {msg.contact_phone}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-xs ${statusConfig[msg.status]?.color}`}
                            title={msg.status === "failed" ? msg.error : undefined}
                          >
                            {statusConfig[msg.status]?.label}
                          </Badge>
                          {msg.repeat !== "none" && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <RefreshCw className="w-2.5 h-2.5" />{" "}
                              {repeatLabels[msg.repeat]}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-foreground mt-1 line-clamp-2">
                          {msg.message}
                        </p>
                        {msg.notes && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            {msg.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="text-right mr-2">
                        <p className="text-sm font-semibold text-primary">
                          {safeDate(msg.sendAt || msg.scheduled_at)
                            ? format(
                                safeDate(msg.sendAt || msg.scheduled_at),
                                "HH:mm",
                              )
                            : "--:--"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {safeDate(msg.sendAt || msg.scheduled_at)
                            ? format(
                                safeDate(msg.sendAt || msg.scheduled_at),
                                "dd/MM/yyyy",
                              )
                            : "--/--/----"}
                        </p>
                      </div>
                      {msg.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-amber-600"
                          onClick={() => cancelMutation.mutate(msg.id)}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteMutation.mutate(msg.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}

      {showModal && (
        <ScheduleMessageModal
          initial={editing}
          onClose={() => {
            setShowModal(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
