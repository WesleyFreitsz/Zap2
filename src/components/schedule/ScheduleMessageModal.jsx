import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { scheduleApi, conversationsApi } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Send, Search } from "lucide-react";
import { format } from "date-fns";

export default function ScheduleMessageModal({ initial, onClose }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({
    message: initial?.message || "",
    scheduled_at: initial?.scheduled_at
      ? format(new Date(initial.scheduled_at), "yyyy-MM-dd'T'HH:mm")
      : "",
    repeat: initial?.repeat || "none",
    notes: initial?.notes || "",
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => conversationsApi.list(),
  });

  const contacts = conversations.map((c) => ({
    id: c.id,
    name: c.contactName || c.contactPhone,
    phone: c.contactPhone,
  }));

  const createMutation = useMutation({
    mutationFn: (data) => scheduleApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduled_messages"] });
      onClose();
    },
  });

  const filtered = contacts.filter(
    (c) =>
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search),
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selected && !initial) return;
    createMutation.mutate({
      contact_id: selected?.id || initial?.contact_id,
      contact_name: selected?.name || initial?.contact_name,
      contact_phone: selected?.phone || initial?.contact_phone,
      message: form.message,
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      repeat: form.repeat,
      notes: form.notes,
      status: "pending",
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-lg">Agendar Mensagem</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Contact Picker */}
          <div className="space-y-2">
            <Label>Contato *</Label>
            {selected ? (
              <div className="flex items-center justify-between p-3 bg-accent rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary text-sm">
                    {selected.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{selected.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {selected.phone}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelected(null)}
                >
                  Trocar
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar contato..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {search && (
                  <div className="border rounded-lg max-h-40 overflow-y-auto">
                    {filtered.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-3 text-center">
                        Nenhum contato encontrado
                      </p>
                    ) : (
                      filtered.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => {
                            setSelected(c);
                            setSearch("");
                          }}
                          className="flex items-center gap-2 p-3 hover:bg-muted cursor-pointer transition-colors"
                        >
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary text-xs">
                            {c.name?.charAt(0)?.toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{c.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {c.phone}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label>Mensagem *</Label>
            <Textarea
              placeholder="Digite a mensagem que será enviada..."
              value={form.message}
              onChange={(e) =>
                setForm((f) => ({ ...f, message: e.target.value }))
              }
              className="min-h-[100px]"
              required
            />
          </div>

          {/* Date/Time + Repeat */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data e Hora *</Label>
              <Input
                type="datetime-local"
                value={form.scheduled_at}
                onChange={(e) =>
                  setForm((f) => ({ ...f, scheduled_at: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Repetição</Label>
              <Select
                value={form.repeat}
                onValueChange={(v) => setForm((f) => ({ ...f, repeat: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem repetição</SelectItem>
                  <SelectItem value="daily">Diário</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>
              Notas internas{" "}
              <span className="text-muted-foreground font-normal">
                (opcional)
              </span>
            </Label>
            <Input
              placeholder="Ex: Follow-up após demonstração"
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || (!selected && !initial)}
              className="gap-2"
            >
              <Send className="w-4 h-4" />
              {createMutation.isPending ? "Agendando..." : "Agendar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
