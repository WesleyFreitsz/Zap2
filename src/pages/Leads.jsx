import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { leadsApi, usersApi, conversationsApi, tagsApi } from "@/api/apiClient";
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
  MessageSquare,
  UserCheck,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../lib/AuthContext";

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
  const [showTagModal, setShowTagModal] = useState(false);
  const [selectedLeadForTags, setSelectedLeadForTags] = useState(null);
  const [leadTags, setLeadTags] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [editing, setEditing] = useState(null);
  const qc = useQueryClient();
  const { user } = useAuth();

  const params = {};
  if (tempFilter !== "ALL") params.temperature = tempFilter;
  if (statusFilter !== "ALL") params.status = statusFilter;
  if (search) params.search = search;

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads", params],
    queryFn: () => leadsApi.list(params),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: () => usersApi.list(),
    enabled: showTransferModal,
  });

  const { data: tags = [] } = useQuery({
    queryKey: ["tags"],
    queryFn: () => tagsApi.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => leadsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead removido");
    },
  });

  const startConversationMutation = useMutation({
    mutationFn: (lead) => conversationsApi.create({
      contactName: lead.name,
      contactPhone: lead.phone,
      companyId: user.companyId,
      leadId: lead.id,
    }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["leads"] }); // Atualizar contador de conversas
      toast.success("Conversa iniciada com sucesso");

      // Redirecionar para a conversa criada
      if (data?.data?.id) {
        window.location.href = `/conversations/${data.data.id}`;
      }
    },
    onError: (err) => {
      if (err?.response?.status === 409) {
        toast.info("Conversa já existe, redirecionando...");
        // Buscar conversa existente e redirecionar
        conversationsApi.list({ search: err.response.data.phone }).then(conversations => {
          const existingConversation = conversations.data?.[0];
          if (existingConversation) {
            window.location.href = `/conversations/${existingConversation.id}`;
          }
        });
      } else {
        toast.error(err?.response?.data?.message || "Erro ao iniciar conversa");
      }
    },
  });

  const transferLeadMutation = useMutation({
    mutationFn: ({ leadId, employeeId }) => leadsApi.update(leadId, {
      assignedToId: employeeId,
      status: "IN_ATTENDANCE",
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead transferido com sucesso");
      setShowTransferModal(false);
      setSelectedLead(null);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Erro ao transferir lead");
    },
  });

  const assignTagsMutation = useMutation({
    mutationFn: ({ leadId, tags }) => leadsApi.update(leadId, { tags }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Tags atribuídas com sucesso!");
      setShowTagModal(false);
      setSelectedLeadForTags(null);
    },
    onError: (err) => {
      console.error("Erro ao atribuir tags:", err);
      toast.error(err?.response?.data?.message || "Erro ao atribuir tags");
      setShowTagModal(false); // Fechar modal mesmo em caso de erro
      setSelectedLeadForTags(null);
    },
  });

  const handleStartConversation = (lead) => {
    // Desabilitar botão durante processamento
    if (startConversationMutation.isPending) {
      return;
    }

    // Verificar se já existe conversa para este lead
    if (lead._count.conversations > 0) {
      toast.info("Redirecionando para conversa existente...");
      // Buscar a conversa existente e redirecionar
      conversationsApi.list({ search: lead.phone }).then(conversations => {
        const existingConversation = conversations.data?.find(c =>
          c.contactPhone === lead.phone || c.leadId === lead.id
        );
        if (existingConversation) {
          window.location.href = `/conversations/${existingConversation.id}`;
        }
      });
      return;
    }

    startConversationMutation.mutate(lead);
  };

  const handleTransferLead = (lead) => {
    setSelectedLead(lead);
    setShowTransferModal(true);
  };

  const handleAssignTags = (lead) => {
    setSelectedLeadForTags(lead);
    setLeadTags(lead.tags?.map(t => t.id) || []);
    setShowTagModal(true);
  };

  const handleSaveTags = () => {
    if (selectedLeadForTags && leadTags.length > 0) {
      try {
        assignTagsMutation.mutate({
          leadId: selectedLeadForTags.id,
          tags: leadTags
        });
      } catch (error) {
        console.error("Erro ao salvar tags:", error);
        toast.error("Erro ao salvar tags");
        setShowTagModal(false);
        setSelectedLeadForTags(null);
      }
    } else {
      toast.error("Selecione pelo menos uma tag");
    }
  };

  const handleTransferToEmployee = (employeeId) => {
    if (selectedLead) {
      transferLeadMutation.mutate({
        leadId: selectedLead.id,
        employeeId,
      });
    }
  };

  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="my-3 mx-4">
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie seus leads e oportunidades
          </p>
        </div>
        <Button className="my-3 mx-4"
          onClick={() => {
            setEditing(null);
            setShowModal(true);
          }}
        >
          <Plus className="w-4 h-4" /> Novo Lead
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 my-3 mx-4">
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
        <Card className="p-12 text-center ">
          <p className="text-muted-foreground">Nenhum lead encontrado</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {leads.map((lead) => {
            const TempIcon = tempIcons[lead.temperature] || Snowflake;
            return (
              <Card key={lead.id} className="p-4 my-3 mx-4 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold">{lead.name}</p>
                    <p className="text-xs text-muted-foreground">{lead.phone}</p>
                    {lead.email && (
                      <p className="text-xs text-muted-foreground">{lead.email}</p>
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

                {/* Tags */}
                {lead.tags && lead.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {lead.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${getTagColor(
                          tag.category
                        )}`}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Atribuir Tags ao Contato */}
                <div className="flex items-center gap-2 mb-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => handleAssignTags(lead)}
                  >
                    <Tag className="w-3 h-3 mr-1" />
                    Atribuir Tags
                  </Button>
                </div>

                <div className="flex gap-2">
                  {isAdmin ? (
                    <>
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
                        variant="outline"
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        onClick={() => handleStartConversation(lead)}
                        disabled={startConversationMutation.isPending}
                      >
                        <MessageSquare className="w-3 h-3 mr-1" /> Iniciar Conversa
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        onClick={() => handleTransferLead(lead)}
                      >
                        <UserCheck className="w-3 h-3 mr-1" /> Transferir
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-7 text-xs"
                      onClick={() => handleStartConversation(lead)}
                      disabled={startConversationMutation.isPending}
                    >
                      <MessageSquare className="w-3 h-3 mr-1" /> Iniciar Conversa
                    </Button>
                  )}
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

      {showTransferModal && (
        <TransferModal
          lead={selectedLead}
          employees={employees.filter(emp => emp.role === "EMPLOYEE" && emp.isActive)}
          onClose={() => {
            setShowTransferModal(false);
            setSelectedLead(null);
          }}
          onTransfer={handleTransferToEmployee}
        />
      )}

      {/* Modal de Atribuição de Tags */}
      {showTagModal && (
        <Dialog open={showTagModal} onOpenChange={(open) => {
          if (!open) {
            setShowTagModal(false);
            setSelectedLeadForTags(null);
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Atribuir Tags - {selectedLeadForTags?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Tags Disponíveis</Label>
                <div className="mt-2 flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border rounded-md">
                  {tags.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma tag disponível</p>
                  ) : (
                    tags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        disabled={assignTagsMutation.isPending}
                        onClick={() => {
                          setLeadTags(prev =>
                            prev.includes(tag.id)
                              ? prev.filter(id => id !== tag.id)
                              : [...prev, tag.id]
                          );
                        }}
                        className={`px-3 py-1 rounded-full border text-sm font-medium transition-colors ${leadTags?.includes(tag.id)
                            ? getTagColor(tag.category)
                            : "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200"
                          }`}
                      >
                        {tag.name}
                      </button>
                    ))
                  )}
                </div>
                {leadTags?.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {leadTags.length} tag(s) selecionada(s)
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowTagModal(false)}
                  disabled={assignTagsMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveTags}
                  disabled={leadTags?.length === 0 || assignTagsMutation.isPending}
                >
                  {assignTagsMutation.isPending ? "Salvando..." : "Salvar Tags"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function LeadFormModal({ lead, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: lead?.name || "",
    phone: lead?.phone || "",
    email: lead?.email || "",
    temperature: lead?.temperature || "COLD",
    status: lead?.status || "NEW",
    notes: lead?.notes || "",
    tags: lead?.tags?.map(t => t.id) || [],
  });

  // Reset form when lead changes
  React.useEffect(() => {
    setForm({
      name: lead?.name || "",
      phone: lead?.phone || "",
      email: lead?.email || "",
      temperature: lead?.temperature || "COLD",
      status: lead?.status || "NEW",
      notes: lead?.notes || "",
      tags: lead?.tags?.map(t => t.id) || [],
    });
  }, [lead]);

  const { data: tags = [] } = useQuery({
    queryKey: ["tags"],
    queryFn: () => tagsApi.list(),
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
    mutation.mutate(form);
  };

  const handleTagToggle = (tagId) => {
    setForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tagId)
        ? prev.tags.filter(id => id !== tagId)
        : [...prev.tags, tagId]
    }));
  };

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
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label>Telefone *</Label>
            <Input
              value={form.phone}
              onChange={(e) => {
                // Remove tudo que não é número
                const phoneNumbersOnly = e.target.value.replace(/\D/g, '');
                setForm({ ...form, phone: phoneNumbersOnly });
              }}
              placeholder="Digite apenas os números (ex: 11987654321)"
              required
              maxLength={15}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Digite apenas os números do telefone com DDD
            </p>
          </div>
          <div>
            <Label>Email (opcional)</Label>
            <Input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              type="email"
              placeholder="email@exemplo.com"
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

          {/* Tags Section */}
          <div>
            <Label className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Tags de Segmentação
            </Label>
            <div className="mt-2 flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {tags.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma tag disponível</p>
              ) : (
                tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleTagToggle(tag.id)}
                    className={`px-3 py-1 rounded-full border text-sm font-medium transition-colors ${form.tags?.includes(tag.id)
                      ? getTagColor(tag.category)
                      : "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200"
                      }`}
                  >
                    {tag.name}
                  </button>
                ))
              )}
            </div>
            {form.tags?.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {form.tags.length} tag(s) selecionada(s)
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando..." : lead ? "Atualizar" : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TransferModal({ lead, employees, onClose, onTransfer }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Transferir Lead</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="font-medium">{lead?.name}</p>
            <p className="text-sm text-muted-foreground">{lead?.phone}</p>
          </div>
          <div>
            <Label>Selecionar Atendente</Label>
            <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
              {employees.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum atendente disponível</p>
              ) : (
                employees.map((employee) => (
                  <Button
                    key={employee.id}
                    variant="outline"
                    className="w-full justify-start h-12"
                    onClick={() => onTransfer(employee.id)}
                  >
                    <div className="text-left">
                      <p className="font-medium">{employee.name}</p>
                      <p className="text-xs text-muted-foreground">{employee.email}</p>
                    </div>
                  </Button>
                ))
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
