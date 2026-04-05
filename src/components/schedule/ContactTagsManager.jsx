import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tagsApi } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

const categoryConfig = {
  hot: {
    label: "Hot — Alta intenção",
    color: "bg-red-100 text-red-700 border-red-200",
  },
  warm: {
    label: "Warm — Interesse médio",
    color: "bg-amber-100 text-amber-700 border-amber-200",
  },
  cold: {
    label: "Cold — Baixo engajamento",
    color: "bg-blue-100 text-blue-700 border-blue-200",
  },
  custom: {
    label: "Personalizada",
    color: "bg-purple-100 text-purple-700 border-purple-200",
  },
};

const DEFAULT_TAGS = [
  {
    name: "Comprador Ativo",
    category: "hot",
    description: "Está no processo ativo de compra",
  },
  {
    name: "Comparando Preço",
    category: "warm",
    description: "Pesquisando preços e opções",
  },
  {
    name: "Aguardando Follow-up",
    category: "warm",
    description: "Precisa de contato proativo",
  },
  {
    name: "Cliente Fiel",
    category: "hot",
    description: "Já comprou múltiplas vezes",
  },
  { name: "Lead Frio", category: "cold", description: "Sem interação recente" },
  {
    name: "Interesse em Promoção",
    category: "warm",
    description: "Interessado apenas em descontos",
  },
  {
    name: "Suporte Pendente",
    category: "custom",
    description: "Tem problema em aberto",
  },
  { name: "VIP", category: "hot", description: "Cliente de alto valor" },
];

export default function ContactTagsManager() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    category: "custom",
    description: "",
  });
  const [showForm, setShowForm] = useState(false);

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ["contact_tags"],
    queryFn: () => tagsApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => tagsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contact_tags"] });
      setForm({ name: "", category: "custom", description: "" });
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => tagsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contact_tags"] }),
  });

  const bulkCreate = async () => {
    for (const t of DEFAULT_TAGS) {
      await tagsApi.create(t);
    }
    qc.invalidateQueries({ queryKey: ["contact_tags"] });
  };

  const grouped = tags.reduce((acc, t) => {
    const cat = t.category || "custom";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={() => setShowForm((s) => !s)} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Tag
        </Button>
        {tags.length === 0 && (
          <Button variant="outline" onClick={bulkCreate} className="gap-2">
            Criar Tags Padrão
          </Button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <Card className="p-4 border-primary/30 bg-accent/30">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Nome da Tag *</Label>
              <Input
                placeholder="Ex: Comprador Ativo"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Categoria</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryConfig).map(([val, cfg]) => (
                    <SelectItem key={val} value={val}>
                      {cfg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>
                Descrição{" "}
                <span className="text-muted-foreground font-normal">
                  (opcional)
                </span>
              </Label>
              <Input
                placeholder="Descrição da tag"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowForm(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={!form.name || createMutation.isPending}
              onClick={() => createMutation.mutate(form)}
            >
              {createMutation.isPending ? "Criando..." : "Criar Tag"}
            </Button>
          </div>
        </Card>
      )}

      {/* Tags grouped */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : tags.length === 0 ? (
        <Card className="p-10 text-center">
          <Tag className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium text-muted-foreground">
            Nenhuma tag criada
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Crie tags personalizadas ou use as tags padrão
          </p>
        </Card>
      ) : (
        Object.entries(categoryConfig).map(([cat, cfg]) => {
          const list = grouped[cat] || [];
          if (list.length === 0) return null;
          return (
            <div key={cat}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {cfg.label}
              </p>
              <div className="flex flex-wrap gap-2">
                {list.map((tag) => (
                  <div
                    key={tag.id}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium",
                      cfg.color,
                    )}
                  >
                    <span>{tag.name}</span>
                    {tag.description && (
                      <span className="text-xs opacity-70">
                        — {tag.description}
                      </span>
                    )}
                    <button
                      onClick={() => deleteMutation.mutate(tag.id)}
                      className="ml-1 opacity-60 hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
