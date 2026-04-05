import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { aiConfigApi } from "@/api/apiClient";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Bot, Save, ShieldCheck, X, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function AIConfig() {
  const queryClient = useQueryClient();
  const { data: existing, isLoading } = useQuery({
    queryKey: ["ai-config"],
    queryFn: () => aiConfigApi.get().catch(() => null),
    retry: false,
  });

  const [form, setForm] = useState({
    business_name: "",
    business_type: "",
    tone: "friendly",
    products_services: "",
    custom_prompt: "",
    seller_mode: true,
    fallback_message:
      "Obrigado pela mensagem! Um atendente humano irá responder em breve.",
    keywords: ["preço", "comprar", "quanto custa", "promoção", "desconto"],
    response_delay_min: 1,
    response_delay_max: 5,
  });
  const [newKeyword, setNewKeyword] = useState("");

  useEffect(() => {
    if (existing) {
      setForm({
        business_name: existing.business_name || "",
        business_type: existing.business_type || "",
        tone: existing.tone || "friendly",
        products_services: existing.products_services || "",
        custom_prompt: existing.custom_prompt || "",
        seller_mode: existing.seller_mode ?? true,
        fallback_message: existing.fallback_message || "",
        keywords: existing.keywords || ["preço", "comprar", "quanto custa"],
        response_delay_min: existing.response_delay_min || 1,
        response_delay_max: existing.response_delay_max || 5,
      });
    }
  }, [existing]);

  const saveMutation = useMutation({
    mutationFn: (data) => aiConfigApi.save(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-config"] });
      toast.success("Configurações salvas com sucesso!");
    },
  });

  const addKeyword = () => {
    if (newKeyword.trim() && !form.keywords.includes(newKeyword.trim())) {
      setForm((f) => ({ ...f, keywords: [...f.keywords, newKeyword.trim()] }));
      setNewKeyword("");
    }
  };

  const removeKeyword = (kw) => {
    setForm((f) => ({ ...f, keywords: f.keywords.filter((k) => k !== kw) }));
  };

  const toneLabels = {
    formal: "Formal e Profissional",
    friendly: "Amigável e Casual",
    sales: "Vendedor Agressivo",
    technical: "Técnico e Detalhista",
  };

  if (isLoading)
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );

  return (
    <div className="p-6 lg:p-8 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Bot className="w-6 h-6 text-primary" />
          Configuração da IA
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Personalize como a IA se comporta nas conversas
        </p>
      </div>

      {/* Business Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Informações do Negócio</CardTitle>
          <CardDescription>
            A IA usará essas informações para contextualizar as respostas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome da Empresa</Label>
              <Input
                value={form.business_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, business_name: e.target.value }))
                }
                placeholder="Ex: TechStore"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Negócio</Label>
              <Input
                value={form.business_type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, business_type: e.target.value }))
                }
                placeholder="Ex: E-commerce de eletrônicos"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Produtos / Serviços</Label>
            <Textarea
              value={form.products_services}
              onChange={(e) =>
                setForm((f) => ({ ...f, products_services: e.target.value }))
              }
              placeholder="Descreva seus produtos e serviços principais, preços, promoções..."
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tone & Behavior */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tom e Comportamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Tom de Conversa</Label>
            <Select
              value={form.tone}
              onValueChange={(v) => setForm((f) => ({ ...f, tone: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(toneLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl border border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">Modo Vendedor</p>
                <p className="text-xs text-muted-foreground">
                  IA tenta identificar intenção de compra e fechar vendas
                </p>
              </div>
            </div>
            <Switch
              checked={form.seller_mode}
              onCheckedChange={(v) =>
                setForm((f) => ({ ...f, seller_mode: v }))
              }
            />
          </div>

          <div className="space-y-3">
            <Label>Delay de Resposta (simular humano)</Label>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground w-12">
                {form.response_delay_min}s
              </span>
              <Slider
                value={[form.response_delay_min, form.response_delay_max]}
                min={0}
                max={15}
                step={1}
                onValueChange={([min, max]) =>
                  setForm((f) => ({
                    ...f,
                    response_delay_min: min,
                    response_delay_max: max,
                  }))
                }
                className="flex-1"
              />
              <span className="text-sm text-muted-foreground w-12">
                {form.response_delay_max}s
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Respostas entre {form.response_delay_min}s e{" "}
              {form.response_delay_max}s para parecer natural
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Keywords */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Palavras-chave de Compra</CardTitle>
          <CardDescription>
            Quando detectadas, a IA ativa o modo vendedor
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {form.keywords.map((kw) => (
              <Badge key={kw} variant="secondary" className="gap-1 pl-3">
                {kw}
                <button
                  onClick={() => removeKeyword(kw)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              placeholder="Nova palavra-chave..."
              onKeyDown={(e) => e.key === "Enter" && addKeyword()}
              className="flex-1"
            />
            <Button variant="outline" onClick={addKeyword} size="icon">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Custom Prompt & Fallback */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Prompt Personalizado</CardTitle>
          <CardDescription>
            Instruções adicionais para a IA (opcional)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={form.custom_prompt}
            onChange={(e) =>
              setForm((f) => ({ ...f, custom_prompt: e.target.value }))
            }
            placeholder="Ex: Sempre pergunte o nome do cliente antes de oferecer produtos..."
            rows={4}
          />
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-muted-foreground" />
              Mensagem de Fallback
            </Label>
            <Input
              value={form.fallback_message}
              onChange={(e) =>
                setForm((f) => ({ ...f, fallback_message: e.target.value }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Enviada quando a IA não consegue gerar uma resposta
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button
          onClick={() => saveMutation.mutate(form)}
          disabled={saveMutation.isPending}
          className="bg-primary hover:bg-primary/90 gap-2"
        >
          <Save className="w-4 h-4" />
          {saveMutation.isPending ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </div>
    </div>
  );
}
