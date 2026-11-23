import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { automationsApi } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SecretReveal, { CopyField } from "./SecretReveal";

const errorMessage = (error, fallback) =>
  error.response?.data?.message || error.response?.data?.errors?.[0]?.message || fallback;

const samplePayload = JSON.stringify(
  {
    event: "message.received",
    companyId: "…",
    occurredAt: "2026-11-20T12:00:00.000Z",
    data: {
      messageId: "…",
      conversationId: "…",
      channel: "WHATSAPP",
      contact: { name: "Maria", phone: "5511999999999", remoteId: "…" },
      content: "Olá, quero um orçamento",
    },
  },
  null,
  2,
);

export default function AutomationSettings() {
  const queryClient = useQueryClient();
  const [webhookUrl, setWebhookUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const config = useQuery({ queryKey: ["automations", "config"], queryFn: automationsApi.config });
  const onConfig = (data) => queryClient.setQueryData(["automations", "config"], data);

  useEffect(() => {
    if (config.data) setWebhookUrl(config.data.webhookUrl ?? "");
  }, [config.data]);

  const save = useMutation({
    mutationFn: () => automationsApi.updateConfig({ webhookUrl: webhookUrl.trim() || null }),
    onSuccess: (data) => {
      onConfig(data);
      toast.success("Webhook salvo");
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível salvar o webhook")),
  });
  const test = useMutation({
    mutationFn: automationsApi.testWebhook,
    onSuccess: () => toast.success("Evento de teste enviado. Confira no n8n ou no Zapier."),
    onError: (error) => toast.error(errorMessage(error, "Não foi possível enviar o teste")),
  });
  const rotate = useMutation({
    mutationFn: automationsApi.rotateApiKey,
    onSuccess: ({ apiKey: key }) => {
      setApiKey(key);
      queryClient.invalidateQueries({ queryKey: ["automations", "config"] });
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível gerar a chave")),
  });
  const revoke = useMutation({
    mutationFn: automationsApi.revokeApiKey,
    onSuccess: (data) => {
      onConfig(data);
      setApiKey("");
      toast.success("Chave revogada");
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível revogar a chave")),
  });

  if (config.isPending) return <p role="status" className="text-sm text-muted-foreground">Carregando…</p>;
  if (config.isError) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p role="alert" className="text-sm text-destructive">Não foi possível carregar as automações.</p>
        <Button variant="outline" size="sm" onClick={() => config.refetch()}>Tentar novamente</Button>
      </div>
    );
  }

  const sendUrl = `${window.location.origin}/api/automations/messages`;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gatilhos (Zap2 → n8n / Zapier)</CardTitle>
          <CardDescription>
            Cole a URL de um nó Webhook do n8n ou de um “Catch Hook” do Zapier. O Zap2 envia um POST em JSON a cada
            mensagem recebida de cliente (<code>message.received</code>) e a cada lead criado (<code>lead.created</code>).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="grid gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <Label htmlFor="automation-webhook">URL do webhook</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="automation-webhook"
                type="url"
                className="min-w-0 flex-1"
                placeholder="https://hooks.zapier.com/hooks/catch/…"
                value={webhookUrl}
                onChange={(event) => setWebhookUrl(event.target.value)}
              />
              <Button type="submit" disabled={save.isPending}>
                {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!config.data.webhookUrl || test.isPending}
                onClick={() => test.mutate()}
              >
                Enviar teste
              </Button>
            </div>
          </form>
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">Exemplo do corpo enviado</summary>
            <pre className="mt-2 overflow-x-auto rounded-md bg-muted/40 p-3 text-xs">{samplePayload}</pre>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ações (n8n / Zapier → Zap2)</CardTitle>
          <CardDescription>
            Use uma requisição HTTP para responder o cliente a partir da automação, com o{" "}
            <code>conversationId</code> recebido no gatilho.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={rotate.isPending} onClick={() => rotate.mutate()}>
              {config.data.hasApiKey ? "Gerar nova chave" : "Gerar chave de API"}
            </Button>
            {config.data.hasApiKey && (
              <Button size="sm" variant="ghost" disabled={revoke.isPending} onClick={() => revoke.mutate()}>
                Revogar chave
              </Button>
            )}
          </div>
          <SecretReveal secret={apiKey} />
          <div className="space-y-2">
            <p><strong>POST</strong> com o cabeçalho <code>X-Api-Key</code>:</p>
            <CopyField value={sendUrl} />
            <CopyField value={'{"conversationId": "…", "content": "Sua mensagem"}'} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
