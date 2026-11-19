import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { leadsApi, tagsApi, usersApi } from "@/api/apiClient";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ChannelIcon, { channelLabels } from "@/components/channels/ChannelIcon";
import { formatPhoneInput } from "@/lib/utils";

function initialForm(lead) {
  return {
    name: lead?.name || "",
    phone: lead?.phone ? formatPhoneInput(lead.phone) : "",
    email: lead?.email || "",
    temperature: lead?.temperature || "COLD",
    status: lead?.status || "NEW",
    notes: lead?.notes || "",
    assignedToId: lead?.assignedToId ?? null,
    tags: lead?.tags?.map((tag) => tag.id) ?? [],
  };
}

export default function LeadFormModal({ lead, isAdmin, tempLabels, statusLabels, onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => initialForm(lead));
  const isEditing = Boolean(lead);
  const hasPhone = !isEditing || Boolean(lead.phone);

  const { data: users = [], isError: usersError } = useQuery({
    queryKey: ["employees"],
    queryFn: usersApi.list,
    enabled: isAdmin,
  });
  const activeUsers = users.filter((user) => user.isActive);
  const showCurrentAssignee =
    lead?.assignedTo?.id === form.assignedToId &&
    !activeUsers.some((user) => user.id === form.assignedToId);

  const { data: tags = [], isPending: tagsPending, isError: tagsError } = useQuery({
    queryKey: ["contact_tags"],
    queryFn: tagsApi.list,
  });

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      isEditing ? leadsApi.update(lead.id, payload) : leadsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success(isEditing ? "Lead atualizado" : "Lead criado");
      onClose();
    },
    onError: (error) => {
      const data = error.response?.data;
      toast.error(data?.errors?.[0]?.message || data?.message || "Erro ao salvar lead");
    },
  });

  const update = (field) => (value) => setForm((current) => ({ ...current, [field]: value }));

  const toggleTag = (id) => {
    setForm((current) => ({
      ...current,
      tags: current.tags.includes(id)
        ? current.tags.filter((tagId) => tagId !== id)
        : [...current.tags, id],
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    saveMutation.mutate({
      name: form.name.trim(),
      ...(hasPhone && { phone: form.phone }),
      email: form.email.trim() || null,
      temperature: form.temperature,
      status: form.status,
      notes: form.notes.trim() || null,
      ...(isAdmin && { assignedToId: form.assignedToId }),
      tags: form.tags,
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar lead" : "Novo lead"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lead-name">Nome *</Label>
            <Input
              id="lead-name"
              value={form.name}
              onChange={(e) => update("name")(e.target.value)}
              required
            />
          </div>

          {hasPhone ? (
            <div className="space-y-2">
              <Label htmlFor="lead-phone">Telefone (com DDD) *</Label>
              <Input
                id="lead-phone"
                value={form.phone}
                onChange={(e) => update("phone")(formatPhoneInput(e.target.value))}
                placeholder="(41) 99999-9999"
                required
              />
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <ChannelIcon type={lead.channel} className="w-4 h-4" />
              Contato do {channelLabels[lead.channel]}, sem telefone.
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="lead-email">E-mail</Label>
            <Input
              id="lead-email"
              type="email"
              value={form.email}
              onChange={(e) => update("email")(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Temperatura</Label>
              <Select value={form.temperature} onValueChange={update("temperature")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(tempLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={update("status")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isAdmin && (
            <div className="space-y-2">
              <Label htmlFor="lead-assignee">Responsável</Label>
              <Select
                value={form.assignedToId ?? "none"}
                onValueChange={(value) => update("assignedToId")(value === "none" ? null : value)}
              >
                <SelectTrigger id="lead-assignee">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {showCurrentAssignee && (
                    <SelectItem value={lead.assignedTo.id} disabled>
                      {lead.assignedTo.name}
                    </SelectItem>
                  )}
                  {activeUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {usersError && <p className="text-sm text-muted-foreground">Erro ao carregar responsáveis.</p>}
            </div>
          )}

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Tags</legend>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const selected = form.tags.includes(tag.id);
                return (
                  <Button
                    key={tag.id}
                    type="button"
                    size="sm"
                    variant={selected ? "default" : "outline"}
                    className="rounded-full"
                    aria-pressed={selected}
                    onClick={() => toggleTag(tag.id)}
                  >
                    {tag.name}
                  </Button>
                );
              })}
            </div>
            {tagsPending && <p className="text-sm text-muted-foreground">Carregando tags...</p>}
            {tagsError && <p className="text-sm text-muted-foreground">Erro ao carregar tags.</p>}
            {!tagsPending && !tagsError && !tags.length && (
              <p className="text-sm text-muted-foreground">Nenhuma tag cadastrada.</p>
            )}
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="lead-notes">Observações</Label>
            <Textarea
              id="lead-notes"
              value={form.notes}
              onChange={(e) => update("notes")(e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
