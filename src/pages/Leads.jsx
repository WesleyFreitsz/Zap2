import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { leadsApi } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Flame,
  Snowflake,
  ThermometerSun,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { digitsOnly, formatPhoneInput, sanitizePersonName } from "@/lib/utils";

const tempColors = {
  HOT: "bg-red-100 text-red-700 border-red-200",
  WARM: "bg-orange-100 text-orange-700 border-orange-200",
  COLD: "bg-blue-100 text-blue-700 border-blue-200",
  CONVERTED: "bg-green-100 text-green-700 border-green-200",
};

const tempIcons = {
  HOT: Flame,
  WARM: ThermometerSun,
  COLD: Snowflake,
  CONVERTED: CheckCircle2,
};

const tempLabels = {
  HOT: "Quente",
  WARM: "Morno",
  COLD: "Frio",
  CONVERTED: "Convertido",
};

const statusLabels = {
  NEW: "Novo",
  IN_ATTENDANCE: "Em Atendimento",
  WAITING: "Aguardando",
  FOLLOW_UP: "Follow-up",
  CLOSED: "Fechado",
  LOST: "Perdido",
};

export default function Leads() {
  const [search, setSearch] = useState("");
  const [tempFilter, setTempFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const qc = useQueryClient();

  const params = {};
  if (tempFilter !== "ALL") params.temperature = tempFilter;
  if (statusFilter !== "ALL") params.status = statusFilter;
  if (search) params.search = search;

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads", params],
    queryFn: () => leadsApi.list(params),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => leadsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead removido");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie seus leads e oportunidades
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setShowModal(true);
          }}
          className="gap-2"
        >
          <Plus className="w-4 h-4" /> Novo Lead
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={tempFilter} onValueChange={setTempFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Temperatura" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas</SelectItem>
            <SelectItem value="HOT">Quente</SelectItem>
            <SelectItem value="WARM">Morno</SelectItem>
            <SelectItem value="COLD">Frio</SelectItem>
            <SelectItem value="CONVERTED">Convertido</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="NEW">Novo</SelectItem>
            <SelectItem value="IN_ATTENDANCE">Em Atendimento</SelectItem>
            <SelectItem value="WAITING">Aguardando</SelectItem>
            <SelectItem value="FOLLOW_UP">Follow-up</SelectItem>
            <SelectItem value="CLOSED">Fechado</SelectItem>
            <SelectItem value="LOST">Perdido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lead cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">Nenhum lead encontrado</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {leads.map((lead) => {
            const TempIcon = tempIcons[lead.temperature] || Snowflake;
            return (
              <Card
                key={lead.id}
                className="p-4 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold">{lead.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatPhoneInput(lead.phone)}
                    </p>
                    {lead.email && (
                      <p className="text-xs text-muted-foreground">
                        {lead.email}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] gap-1 ${tempColors[lead.temperature] || ""}`}
                  >
                    <TempIcon className="w-3 h-3" />
                    {tempLabels[lead.temperature] || lead.temperature}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="secondary" className="text-[10px]">
                    {statusLabels[lead.status] || lead.status}
                  </Badge>
                  {lead.assignedTo && (
                    <span className="text-[10px] text-muted-foreground">
                      {lead.assignedTo.name}
                    </span>
                  )}
                  {lead._count?.conversations > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {lead._count.conversations} conversa(s)
                    </span>
                  )}
                </div>
                {lead.notes && (
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                    {lead.notes}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-7 text-xs"
                    onClick={() => {
                      setEditing(lead);
                      setShowModal(true);
                    }}
                  >
                    <Pencil className="w-3 h-3 mr-1" /> Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                    onClick={() => deleteMutation.mutate(lead.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showModal && (
        <LeadFormModal
          lead={editing}
          onClose={() => {
            setShowModal(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function LeadFormModal({ lead, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: lead?.name || "",
    phone: formatPhoneInput(lead?.phone || ""),
    email: lead?.email || "",
    temperature: lead?.temperature || "COLD",
    status: lead?.status || "NEW",
    notes: lead?.notes || "",
  });

  const mutation = useMutation({
    mutationFn: (data) =>
      lead ? leadsApi.update(lead.id, data) : leadsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success(lead ? "Lead atualizado" : "Lead criado");
      onClose();
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Erro ao salvar lead");
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!form.name.trim()) {
      toast.error("Informe um nome válido");
      return;
    }

    if (digitsOnly(form.phone).length < 8) {
      toast.error("Informe um telefone válido");
      return;
    }

    mutation.mutate({
      ...form,
      name: form.name.trim(),
      phone: digitsOnly(form.phone),
      email: form.email.trim() || null,
      notes: form.notes?.trim() || null,
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{lead ? "Editar Lead" : "Novo Lead"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nome *</Label>
            <Input
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: sanitizePersonName(e.target.value) })
              }
              autoComplete="name"
              required
            />
          </div>
          <div>
            <Label>Telefone *</Label>
            <Input
              value={form.phone}
              onChange={(e) =>
                setForm({ ...form, phone: formatPhoneInput(e.target.value) })
              }
              inputMode="tel"
              maxLength={16}
              placeholder="(11) 99999-9999"
              required
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              type="email"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Temperatura</Label>
              <Select
                value={form.temperature}
                onValueChange={(v) => setForm({ ...form, temperature: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOT">Quente</SelectItem>
                  <SelectItem value="WARM">Morno</SelectItem>
                  <SelectItem value="COLD">Frio</SelectItem>
                  <SelectItem value="CONVERTED">Convertido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEW">Novo</SelectItem>
                  <SelectItem value="IN_ATTENDANCE">Em Atendimento</SelectItem>
                  <SelectItem value="WAITING">Aguardando</SelectItem>
                  <SelectItem value="FOLLOW_UP">Follow-up</SelectItem>
                  <SelectItem value="CLOSED">Fechado</SelectItem>
                  <SelectItem value="LOST">Perdido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Notas</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? "Salvando..."
                : lead
                  ? "Atualizar"
                  : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
