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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bot, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";

const TONES = {
  friendly: "Amigável e próximo",
  professional: "Profissional e cordial",
  formal: "Formal",
  technical: "Técnico e detalhista",
};

const EMPTY_FORM = { personality: "friendly", productContext: "", systemPrompt: "" };

export default function AIConfig() {
  const queryClient = useQueryClient();
  const { data: existing, isLoading } = useQuery({
    queryKey: ["ai-config"],
    queryFn: () => aiConfigApi.get(),
  });

  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (existing) {
      setForm({
        personality: TONES[existing.personality] ? existing.personality : "friendly",
        productContext: existing.productContext || "",
        systemPrompt: existing.systemPrompt || "",
      });
    }
  }, [existing]);

  const saveMutation = useMutation({
    mutationFn: (data) => aiConfigApi.save(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-config"] });
      toast.success("Configurações salvas.");
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Erro ao salvar configurações");
    },
  });

  const handleSave = () =>
    saveMutation.mutate({
      personality: form.personality,
      productContext: form.productContext.trim() || null,
      systemPrompt: form.systemPrompt.trim() || null,
    });

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
          A IA sugere respostas no chat. O atendente revisa e decide se envia.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Informações do negócio</CardTitle>
          <CardDescription>
            A IA só usa o que estiver aqui e no catálogo de produtos. O que não
            estiver escrito, ela responde que vai verificar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={form.productContext}
            onChange={(e) => setForm((f) => ({ ...f, productContext: e.target.value }))}
            placeholder="Ex.: Frete para o Sul: R$ 15. Trocas em até 30 dias. Atendimento de seg a sex, 9h às 18h. Pagamento por Pix ou cartão."
            className="min-h-[140px]"
            maxLength={5000}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tom e instruções</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Tom das respostas</Label>
            <Select
              value={form.personality}
              onValueChange={(personality) => setForm((f) => ({ ...f, personality }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TONES).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>
              Instruções extras{" "}
              <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Textarea
              value={form.systemPrompt}
              onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
              placeholder="Ex.: Chame o cliente pelo primeiro nome. Não use emojis."
              className="min-h-[100px]"
              maxLength={5000}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          Use o botão de sugestão no chat para testar.
        </p>
        <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2">
          <Save className="w-4 h-4" />
          {saveMutation.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
