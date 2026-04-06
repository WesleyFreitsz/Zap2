import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi, invitationsApi } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Mail } from "lucide-react";
import { toast } from "sonner";
import { sanitizePersonName } from "@/lib/utils";

export default function EmployeeFormModal({ employee, onClose }) {
  const qc = useQueryClient();
  const isEdit = !!employee;

  const [form, setForm] = useState({
    name: employee?.name || "",
    email: employee?.email || "",
    password: "",
    role: employee?.role || "EMPLOYEE",
    isTeamLeader: employee?.isTeamLeader || false,
  });

  // Edit existing user
  const saveMutation = useMutation({
    mutationFn: (data) => {
      const payload = { ...data };
      if (!payload.password) delete payload.password;
      return usersApi.update(employee.id, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Funcionário atualizado");
      onClose();
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Erro ao atualizar");
    },
  });

  // Invite new user
  const inviteMutation = useMutation({
    mutationFn: (data) =>
      invitationsApi.send({
        email: data.email,
        invitationRole: data.role,
        isTeamLeader: data.role === "EMPLOYEE" ? data.isTeamLeader : false,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Convite enviado por e-mail!");
      onClose();
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Erro ao enviar convite");
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-card z-10">
          <h2 className="font-bold text-lg">
            {isEdit ? "Editar Funcionário" : "Convidar Funcionário"}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-5 space-y-4">
          {!isEdit && (
            <div className="flex items-start gap-3 p-3 bg-accent/50 rounded-lg text-sm">
              <Mail className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <p className="text-muted-foreground">
                Um convite será enviado por e-mail. O funcionário criará sua
                própria conta ao aceitar.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {isEdit && (
              <div className="space-y-1 col-span-2">
                <Label>Nome *</Label>
                <Input
                  placeholder="Nome completo"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      name: sanitizePersonName(e.target.value),
                    }))
                  }
                  autoComplete="name"
                  required
                />
              </div>
            )}
            <div className={`space-y-1 ${isEdit ? "" : "col-span-2"}`}>
              <Label>E-mail *</Label>
              <Input
                type="email"
                placeholder="email@empresa.com"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                required
                disabled={isEdit}
              />
            </div>
            {isEdit && (
              <div className="space-y-1">
                <Label>Nova Senha</Label>
                <Input
                  type="password"
                  placeholder="Deixe vazio para manter"
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                />
              </div>
            )}
            <div className={`space-y-1 ${isEdit ? "" : "col-span-2"}`}>
              <Label>Cargo</Label>
              <Select
                value={form.role}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    role: v,
                    isTeamLeader: v === "EMPLOYEE" ? f.isTeamLeader : false,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMPLOYEE">Funcionário</SelectItem>
                  <SelectItem value="ADMIN">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.role === "EMPLOYEE" && (
              <div className="space-y-2 col-span-2">
                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <div>
                    <Label>Líder de equipe</Label>
                    <p className="text-xs text-muted-foreground">
                      Conta para o limite de líderes do plano.
                    </p>
                  </div>
                  <Switch
                    checked={form.isTeamLeader}
                    onCheckedChange={(checked) =>
                      setForm((f) => ({ ...f, isTeamLeader: checked }))
                    }
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            {isEdit ? (
              <Button
                onClick={() => saveMutation.mutate(form)}
                disabled={!form.name || !form.email || saveMutation.isPending}
              >
                {saveMutation.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            ) : (
              <Button
                onClick={() => inviteMutation.mutate(form)}
                disabled={!form.email || inviteMutation.isPending}
                className="gap-2"
              >
                <Mail className="w-4 h-4" />
                {inviteMutation.isPending ? "Enviando..." : "Enviar Convite"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
