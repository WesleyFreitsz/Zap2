import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { scheduleApi, conversationsApi } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X, Send, Search } from "lucide-react";
import { toast } from "sonner";

export default function ScheduleMessageModal({ onClose }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [content, setContent] = useState("");
  const [sendAt, setSendAt] = useState("");

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
      toast.success("Mensagem agendada.");
      onClose();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Erro ao agendar mensagem");
    },
  });

  const filtered = contacts.filter(
    (c) =>
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search),
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selected) return;
    createMutation.mutate({
      conversationId: selected.id,
      content,
      sendAt: new Date(sendAt).toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl shadow-menu w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-semibold text-lg">Agendar Mensagem</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
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
                  <div className="rounded-lg shadow-field max-h-40 overflow-y-auto">
                    {filtered.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-3 text-center">
                        Nenhum contato encontrado
                      </p>
                    ) : (
                      filtered.map((c) => (
                        <button
                          type="button"
                          key={c.id}
                          onClick={() => {
                            setSelected(c);
                            setSearch("");
                          }}
                          className="flex w-full items-center gap-2 p-3 text-left hover:bg-muted transition-colors"
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
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Mensagem *</Label>
            <Textarea
              placeholder="Digite a mensagem que será enviada..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[100px]"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Data e Hora *</Label>
            <Input
              type="datetime-local"
              value={sendAt}
              onChange={(e) => setSendAt(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || !selected}
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
