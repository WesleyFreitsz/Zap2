import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plug, Plus } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { channelsApi } from "@/api/apiClient";
import ChannelIcon, { channelLabels } from "@/components/channels/ChannelIcon";
import MetaChannelConnect from "@/components/channels/MetaChannelConnect";
import WhatsAppQrConnect from "@/components/channels/WhatsAppQrConnect";
import AutomationSettings from "@/components/channels/AutomationSettings";
import ZendeskSettings from "@/components/channels/ZendeskSettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

const choices = [
  { type: "WHATSAPP", label: "WhatsApp oficial", configId: import.meta.env.VITE_META_WHATSAPP_CONFIG_ID },
  { type: "WHATSAPP", label: "WhatsApp por QR (beta)", qr: true },
  { type: "FACEBOOK", label: channelLabels.FACEBOOK, configId: import.meta.env.VITE_META_PAGES_CONFIG_ID },
  { type: "INSTAGRAM", label: channelLabels.INSTAGRAM, configId: import.meta.env.VITE_META_PAGES_CONFIG_ID },
];

const statuses = {
  CONNECTED: "Conectado",
  CONNECTING: "Conectando",
  DISCONNECTED: "Desconectado",
};

export default function Channels() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState(null);
  const [qrChannel, setQrChannel] = useState(null);
  const [complete, setComplete] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "social";
  const channels = useQuery({
    queryKey: ["channels"],
    queryFn: channelsApi.list,
    enabled: tab === "social",
    refetchInterval: (query) => query.state.error ? false : 5000,
  });
  const config = useQuery({
    queryKey: ["channels", "meta-config"],
    queryFn: channelsApi.metaConfig,
    enabled: open && !choice,
  });
  const canUseMeta = Boolean(config.data?.enabled && import.meta.env.VITE_META_APP_ID);
  const remove = useMutation({
    mutationFn: channelsApi.remove,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["channels"] });
      toast.success("Canal desconectado.");
    },
    onError: (error) => toast.error(error.response?.data?.message || "Não foi possível desconectar o canal."),
  });

  const finish = useCallback(() => {
    setComplete(true);
    queryClient.invalidateQueries({ queryKey: ["channels"], exact: true });
  }, [queryClient]);

  function changeOpen(nextOpen) {
    setOpen(nextOpen);
    setChoice(null);
    setQrChannel(null);
    setComplete(false);
  }

  function openQr(channel) {
    changeOpen(true);
    setChoice(choices.find((item) => item.qr));
    setQrChannel(channel);
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <div className="max-w-4xl space-y-6 p-6 lg:p-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Plug className="h-6 w-6 text-primary" /> Integrações
          </h1>
          {tab === "social" && (
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Conectar canal</Button>
            </DialogTrigger>
          )}
        </header>
        <Tabs value={tab} onValueChange={(value) => setSearchParams({ tab: value }, { replace: true })}>
          <TabsList>
            <TabsTrigger value="social">Redes sociais</TabsTrigger>
            <TabsTrigger value="support">Atendimento</TabsTrigger>
            <TabsTrigger value="automations">Automações</TabsTrigger>
          </TabsList>
          <TabsContent value="support" className="mt-6"><ZendeskSettings /></TabsContent>
          <TabsContent value="automations" className="mt-6"><AutomationSettings /></TabsContent>
          <TabsContent value="social" className="mt-6 space-y-6">
        {channels.isPending && <p role="status" className="text-sm text-muted-foreground">Carregando canais…</p>}
        {channels.isError && (
          <div className="flex flex-wrap items-center gap-3">
            <p role="alert" className="text-sm text-destructive">Não foi possível carregar os canais.</p>
            <Button variant="outline" size="sm" onClick={() => channels.refetch()}>Tentar novamente</Button>
          </div>
        )}
        {channels.isSuccess && channels.data.length === 0 && (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">Nenhum canal conectado.</CardContent></Card>
        )}
        <div className="space-y-3">
          {channels.data?.map((channel) => {
            const label = channel.label || channelLabels[channel.type];
            const isQr = channel.provider === "WPPCONNECT";
            return (
              <Card key={channel.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <ChannelIcon type={channel.type} className="h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0 space-y-1">
                      <p className="break-words font-semibold">{label}</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{isQr ? "Beta (QR)" : "Oficial"}</Badge>
                        <Badge variant={channel.connectionStatus === "CONNECTED" ? "default" : "outline"}>
                          {statuses[channel.connectionStatus]}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isQr && channel.connectionStatus !== "CONNECTED" && (
                      <Button size="sm" variant="outline" disabled={remove.isPending} onClick={() => openQr(channel)}>
                        {channel.connectionStatus === "CONNECTING" ? "Ver QR code" : "Reconectar"}
                      </Button>
                    )}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" disabled={remove.isPending}>Desconectar</Button>
                      </DialogTrigger>
                      <DialogContent role="alertdialog">
                        <DialogHeader>
                          <DialogTitle>Desconectar {label}?</DialogTitle>
                          <DialogDescription>
                            Você deixará de enviar e receber mensagens por este canal.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="gap-2">
                          <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                          <DialogClose asChild>
                            <Button variant="destructive" onClick={() => remove.mutate(channel.id)}>Desconectar</Button>
                          </DialogClose>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
          </TabsContent>
        </Tabs>
      </div>

      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{complete ? "Conexão concluída" : choice?.label || "Conectar canal"}</DialogTitle>
          <DialogDescription>
            {complete ? "A conexão foi registrada e já aparece na lista de canais."
              : choice?.qr ? "Escaneie o QR code para conectar o WhatsApp."
              : choice ? "Autorize o acesso à conta que deseja conectar."
              : "Escolha o canal que deseja conectar."}
          </DialogDescription>
        </DialogHeader>
        {open && !choice && (
          <div className="grid gap-2">
            {choices.map((item) => (
              <Button key={item.label} variant="outline" className="justify-start gap-2"
                disabled={!item.qr && (!canUseMeta || !item.configId)}
                onClick={() => setChoice(item)}>
                <ChannelIcon type={item.type} aria-hidden="true" className="h-4 w-4" /> {item.label}
              </Button>
            ))}
            {config.isPending ? (
              <p role="status" className="text-sm text-muted-foreground">Verificando a configuração da Meta…</p>
            ) : config.isError ? (
              <div className="flex flex-wrap items-center gap-2">
                <p role="alert" className="text-sm text-destructive">Não foi possível verificar a configuração da Meta.</p>
                <Button variant="outline" size="sm" onClick={() => config.refetch()}>Tentar novamente</Button>
              </div>
            ) : (!canUseMeta || choices.some((item) => !item.qr && !item.configId)) && (
              <p className="text-sm text-muted-foreground">Integração com a Meta ainda não configurada</p>
            )}
          </div>
        )}
        {open && choice && !complete && (
          <>
            {choice.qr
              ? <WhatsAppQrConnect channel={qrChannel} onComplete={finish} />
              : <MetaChannelConnect type={choice.type} configId={choice.configId} onComplete={finish} />}
            {!qrChannel && <Button variant="ghost" onClick={() => setChoice(null)}>Voltar</Button>}
          </>
        )}
        {complete && <Button onClick={() => changeOpen(false)}>Concluir</Button>}
      </DialogContent>
    </Dialog>
  );
}
