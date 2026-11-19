import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { leadsApi } from "@/api/apiClient";
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
  };
}

export default function LeadFormModal({ lead, tempLabels, statusLabels, onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => initialForm(lead));
  const isEditing = Boolean(lead);
  const hasPhone = !isEditing || Boolean(lead.phone);

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

  const handleSubmit = (event) => {
    event.preventDefault();
    saveMutation.mutate({
      name: form.name.trim(),
      ...(hasPhone && { phone: form.phone }),
      email: form.email.trim() || null,
      temperature: form.temperature,
      status: form.status,
      notes: form.notes.trim() || null,
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
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
