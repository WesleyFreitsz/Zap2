import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { zendeskApi } from "@/api/apiClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SecretReveal, { CopyField } from "./SecretReveal";

const errorMessage = (error, fallback) => error.response?.data?.message || fallback;

export default function ZendeskSettings() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ subdomain: "", email: "", apiToken: "" });
  const [webhookToken, setWebhookToken] = useState("");
  const config = useQuery({ queryKey: ["zendesk", "config"], queryFn: zendeskApi.config });
  const onConfig = (data) => queryClient.setQueryData(["zendesk", "config"], data);

  const save = useMutation({
    mutationFn: zendeskApi.saveConfig,
    onSuccess: (data) => {
      onConfig(data);
      setForm({ subdomain: "", email: "", apiToken: "" });
      toast.success("Zendesk conectado");
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível conectar o Zendesk")),
  });
  const remove = useMutation({
    mutationFn: zendeskApi.removeConfig,
    onSuccess: (data) => {
      onConfig(data);
      setWebhookToken("");
      toast.success("Zendesk desconectado");
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível desconectar")),
  });
  const rotate = useMutation({
    mutationFn: zendeskApi.rotateWebhookToken,
    onSuccess: ({ token }) => {
      setWebhookToken(token);
      queryClient.invalidateQueries({ queryKey: ["zendesk", "config"] });
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível gerar o token")),
  });

  if (config.isPending) return <p role="status" className="text-sm text-muted-foreground">Carregando…</p>;
  if (config.isError) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p role="alert" className="text-sm text-destructive">Não foi possível carregar a configuração do Zendesk.</p>
        <Button variant="outline" size="sm" onClick={() => config.refetch()}>Tentar novamente</Button>
      </div>
    );
  }

  const webhookUrl = `${window.location.origin}/api/webhooks/zendesk`;

  if (!config.data.connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conectar Zendesk</CardTitle>
          <CardDescription>
            Leve conversas do WhatsApp, Instagram e Messenger para tickets no Zendesk. Gere o token em
            Central de administração › Apps e integrações › APIs › API do Zendesk.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate(form);
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="zendesk-subdomain">Subdomínio</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="zendesk-subdomain"
                  required
                  placeholder="suaempresa"
                  value={form.subdomain}
                  onChange={(event) => setForm({ ...form, subdomain: event.target.value })}
                />
                <span className="shrink-0 text-sm text-muted-foreground">.zendesk.com</span>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="zendesk-email">E-mail do agente</Label>
              <Input
                id="zendesk-email"
                type="email"
                required
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="zendesk-token">Token da API</Label>
              <Input
                id="zendesk-token"
                type="password"
                required
                autoComplete="off"
                value={form.apiToken}
                onChange={(event) => setForm({ ...form, apiToken: event.target.value })}
              />
            </div>
            <Button type="submit" className="justify-self-start" disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Conectar
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="space-y-1">
            <p className="font-semibold">{config.data.subdomain}.zendesk.com</p>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge>Conectado</Badge> {config.data.email}
            </div>
          </div>
          <Button variant="outline" size="sm" disabled={remove.isPending} onClick={() => remove.mutate()}>
            Desconectar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Como funciona</CardTitle>
          <CardDescription>
            Na conversa, clique em <strong>Enviar ao Zendesk</strong>: o Zap2 abre um ticket com o histórico e
            passa a copiar as novas mensagens do cliente para ele.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Responder pelo Zendesk</CardTitle>
          <CardDescription>
            Para que as respostas públicas dos agentes cheguem ao cliente, configure um webhook no Zendesk.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <ol className="list-decimal space-y-3 pl-5">
            <li className="space-y-2">
              <p>Gere o token de autenticação do webhook:</p>
              <Button size="sm" variant="outline" disabled={rotate.isPending} onClick={() => rotate.mutate()}>
                {config.data.hasWebhookToken ? "Gerar novo token" : "Gerar token"}
              </Button>
              <SecretReveal secret={webhookToken} />
            </li>
            <li className="space-y-2">
              <p>
                Em Central de administração › Apps e integrações › Webhooks, crie um webhook <strong>POST</strong> em
                JSON para a URL abaixo, com autenticação <strong>Token do portador</strong> usando o token gerado:
              </p>
              <CopyField value={webhookUrl} />
            </li>
            <li className="space-y-2">
              <p>
                Em Objetos e regras › Gatilhos, crie um gatilho com as condições <em>Ticket é Atualizado</em>,{" "}
                <em>Comentário é Público</em>, <em>Usuário atual é (agente)</em> e <em>Tags contém zap2</em>. Na ação,
                notifique o webhook com o corpo:
              </p>
              <CopyField value={'{"ticketId": "{{ticket.id}}"}'} />
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
