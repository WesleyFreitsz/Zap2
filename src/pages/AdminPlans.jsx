import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { plansApi } from "@/api/apiClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Crown,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  Wifi,
  Users,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { sanitizeCompanyName, sanitizeSlug } from "@/lib/utils";

const emptyPlan = {
  name: "",
  slug: "",
  price: 0,
  annualPrice: 0,
  maxNumbers: 1,
  maxEmployees: 5,
  maxTeamLeaders: 0,
  features: [],
  founderSlots: 10,
};

function PlanFormModal({ plan, onClose, onSave, isSaving }) {
  const [form, setForm] = useState(plan || { ...emptyPlan });
  const [featureInput, setFeatureInput] = useState("");

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const addFeature = () => {
    if (featureInput.trim()) {
      set("features", [...(form.features || []), featureInput.trim()]);
      setFeatureInput("");
    }
  };

  const removeFeature = (idx) => {
    set(
      "features",
      (form.features || []).filter((_, i) => i !== idx),
    );
  };

  const handleSubmit = () => {
    if (!form.name?.trim() || !form.slug?.trim()) {
      toast.error("Informe nome e slug do plano");
      return;
    }

    onSave({
      ...form,
      name: form.name.trim(),
      slug: form.slug.trim(),
      features: (form.features || []).filter(Boolean),
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5" />
            {plan ? "Editar Plano" : "Novo Plano"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  set("name", sanitizeCompanyName(e.target.value))
                }
                placeholder="Ex: Pro"
              />
            </div>
            <div>
              <Label>Slug</Label>
              <Input
                value={form.slug}
                onChange={(e) => set("slug", sanitizeSlug(e.target.value))}
                placeholder="Ex: pro"
                disabled={!!plan}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Preço Mensal (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={form.price}
                onChange={(e) => set("price", parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>Preço Anual (R$/mês)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={form.annualPrice}
                onChange={(e) =>
                  set("annualPrice", parseFloat(e.target.value) || 0)
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Nº WhatsApp</Label>
              <Input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={form.maxNumbers}
                onChange={(e) =>
                  set("maxNumbers", parseInt(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <Label>Funcionários</Label>
              <Input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={form.maxEmployees}
                onChange={(e) =>
                  set("maxEmployees", parseInt(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <Label>Líderes</Label>
              <Input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={form.maxTeamLeaders}
                onChange={(e) =>
                  set("maxTeamLeaders", parseInt(e.target.value) || 0)
                }
              />
            </div>
          </div>
          <div>
            <Label>Vagas Fundador</Label>
            <Input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={form.founderSlots}
              onChange={(e) =>
                set("founderSlots", parseInt(e.target.value) || 0)
              }
            />
          </div>
          <div>
            <Label>Features</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={featureInput}
                onChange={(e) => setFeatureInput(e.target.value)}
                placeholder="Adicionar feature..."
                onKeyDown={(e) =>
                  e.key === "Enter" && (e.preventDefault(), addFeature())
                }
              />
              <Button type="button" size="sm" onClick={addFeature}>
                +
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(form.features || []).map((f, i) => (
                <Badge key={i} variant="secondary" className="gap-1 pr-1">
                  {f}
                  <button
                    onClick={() => removeFeature(i)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {plan ? "Salvar" : "Criar Plano"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminPlans() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["plans"],
    queryFn: () => plansApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => plansApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plans"] });
      toast.success("Plano criado!");
      setShowModal(false);
    },
    onError: (e) =>
      toast.error(e.response?.data?.message || "Erro ao criar plano"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => plansApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plans"] });
      toast.success("Plano atualizado!");
      setShowModal(false);
      setEditing(null);
    },
    onError: (e) =>
      toast.error(e.response?.data?.message || "Erro ao atualizar"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => plansApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plans"] });
      toast.success("Plano removido!");
    },
  });

  const handleSave = (form) => {
    if (editing) {
      const { slug, ...data } = form;
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate(form);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Crown className="w-6 h-6" /> Gerenciar Planos
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Crown className="w-6 h-6 text-amber-500" /> Gerenciar Planos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure os planos e preços da plataforma
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setShowModal(true);
          }}
          className="gap-2"
        >
          <Plus className="w-4 h-4" /> Novo Plano
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {plans.map((plan) => (
          <Card key={plan.id} className="p-5 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold">{plan.name}</h3>
                {!plan.isActive && (
                  <Badge variant="destructive" className="text-[10px]">
                    Inativo
                  </Badge>
                )}
              </div>
              <Badge variant="outline" className="text-xs">
                {plan.slug}
              </Badge>
            </div>
            <div className="mb-4">
              <p className="text-3xl font-bold text-primary">
                R$ {plan.price.toFixed(2)}
                <span className="text-sm font-normal text-muted-foreground">
                  /mês
                </span>
              </p>
              <p className="text-sm text-muted-foreground">
                Anual: R$ {plan.annualPrice.toFixed(2)}/mês
              </p>
            </div>
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2 text-sm">
                <Wifi className="w-4 h-4 text-blue-500" />
                <span>{plan.maxNumbers} número(s) WhatsApp</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-green-500" />
                <span>Até {plan.maxEmployees} funcionários</span>
              </div>
              {plan.maxTeamLeaders > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="w-4 h-4 text-purple-500" />
                  <span>{plan.maxTeamLeaders} líder(es) de equipe</span>
                </div>
              )}
              <div className="flex flex-wrap gap-1 mt-2">
                {(plan.features || []).map((f, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px]">
                    {f}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex gap-2 mt-4 pt-3 border-t">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1"
                onClick={() => {
                  setEditing(plan);
                  setShowModal(true);
                }}
              >
                <Pencil className="w-3.5 h-3.5" /> Editar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive gap-1"
                onClick={() => {
                  if (confirm(`Remover plano "${plan.name}"?`))
                    deleteMutation.mutate(plan.id);
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {showModal && (
        <PlanFormModal
          plan={editing}
          onClose={() => {
            setShowModal(false);
            setEditing(null);
          }}
          onSave={handleSave}
          isSaving={createMutation.isPending || updateMutation.isPending}
        />
      )}
    </div>
  );
}
