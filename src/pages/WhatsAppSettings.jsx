import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { whatsappApi } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Smartphone,
  Wifi,
  WifiOff,
  RefreshCw,
  QrCode,
  Plus,
  PowerOff,
  Loader2,
  Hash,
} from "lucide-react";
import { toast } from "sonner";
import { sanitizeCompanyName } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const statusBadge = {
  CONNECTED: {
    icon: Wifi,
    label: "Conectado",
    cls: "text-emerald-600 bg-emerald-50 border-emerald-200",
  },
  DISCONNECTED: {
    icon: WifiOff,
    label: "Desconectado",
    cls: "text-slate-500 bg-slate-50 border-slate-200",
  },
  CONNECTING: {
    icon: RefreshCw,
    label: "Conectando...",
    cls: "text-amber-600 bg-amber-50 border-amber-200",
  },
};

function SessionCard({ session, onQr, onReconnect, onDisconnect, isAdmin }) {
  const s = statusBadge[session.connectionStatus] || statusBadge.DISCONNECTED;
  const Icon = s.icon;

  return (
    <Card className="border-l-4 border-l-primary">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`p-3 rounded-xl ${session.connectionStatus === "CONNECTED" ? "bg-emerald-100" : "bg-muted"}`}
            >
              <Smartphone
                className={`w-7 h-7 ${session.connectionStatus === "CONNECTED" ? "text-emerald-600" : "text-muted-foreground"}`}
              />
            </div>
            <div className="min-w-0">
              <p className="font-semibold truncate">
                {session.label || "Sessão WhatsApp"}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className={s.cls}>
                  <Icon
                    className={`w-3 h-3 mr-1 ${session.connectionStatus === "CONNECTING" ? "animate-spin" : ""}`}
                  />
                  {s.label}
                </Badge>
              </div>
              {session.connectedAt && (
                <p className="text-xs text-muted-foreground mt-1">
                  Desde: {new Date(session.connectedAt).toLocaleString("pt-BR")}
                </p>
              )}
            </div>
          </div>

          {isAdmin && (
            <div className="flex gap-2 shrink-0">
              {session.connectionStatus === "CONNECTING" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => onQr(session.id)}
                >
                  <QrCode className="w-3.5 h-3.5" /> QR Code
                </Button>
              )}
              {session.connectionStatus === "DISCONNECTED" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => onReconnect(session.id)}
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Reconectar
                </Button>
              )}
              {session.connectionStatus === "CONNECTED" && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1"
                  onClick={() => onDisconnect(session.id)}
                >
                  <PowerOff className="w-3.5 h-3.5" /> Desconectar
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function WhatsAppSettings() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const [showQrModal, setShowQrModal] = useState(false);
  const [qrCode, setQrCode] = useState(null);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [newLabel, setNewLabel] = useState("");
  const [showNewSession, setShowNewSession] = useState(false);

  // Fetch all sessions
  const {
    data: sessions = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["whatsapp-sessions"],
    queryFn: () => whatsappApi.sessions(),
    refetchInterval: (query) =>
      query.state.error ? 15000 : showQrModal ? 2000 : 5000,
    retry: 1,
  });

  useEffect(() => {
    if (!showQrModal || !activeSessionId) return;

    const activeSession = sessions.find(
      (session) => session.id === activeSessionId,
    );
    if (activeSession?.connectionStatus === "CONNECTED") {
      setShowQrModal(false);
      setQrCode(null);
      setActiveSessionId(null);
      toast.success("Sessão conectada com sucesso!");
    }
  }, [activeSessionId, sessions, showQrModal]);

  const connectedCount = sessions.filter(
    (s) => s.connectionStatus === "CONNECTED",
  ).length;
  const totalCount = sessions.length;

  // Connect mutation (new session)
  const connectMutation = useMutation({
    mutationFn: (label) => {
      // Show QR modal immediately with loading spinner
      setQrCode(null);
      setShowNewSession(false);
      setShowQrModal(true);
      return whatsappApi.connect(label);
    },
    onSuccess: (data) => {
      toast.success("Sessão criada! Escaneie o QR code.");
      if (data.qrCode) {
        setQrCode(data.qrCode);
        setActiveSessionId(data.integrationId);
      }
      setNewLabel("");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-sessions"] });
    },
    onError: (error) => {
      setShowQrModal(false);
      toast.error(error.response?.data?.message || "Erro ao criar sessão");
    },
  });

  // QR Code mutation
  const qrMutation = useMutation({
    mutationFn: (integrationId) => whatsappApi.qrcode(integrationId),
    onSuccess: (data) => {
      if (data.qrCode) {
        setQrCode(data.qrCode);
        setShowQrModal(true);
      } else {
        toast.info("QR Code não disponível. Tente reconectar.");
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Erro ao obter QR code");
    },
  });

  // Reconnect mutation
  const reconnectMutation = useMutation({
    mutationFn: (integrationId) => {
      // Show QR modal immediately with loading spinner
      setQrCode(null);
      setActiveSessionId(integrationId);
      setShowQrModal(true);
      return whatsappApi.reconnect(integrationId);
    },
    onSuccess: (data) => {
      toast.success("Reconectando... Escaneie o novo QR code.");
      if (data.qrCode) {
        setQrCode(data.qrCode);
      }
      queryClient.invalidateQueries({ queryKey: ["whatsapp-sessions"] });
    },
    onError: (error) => {
      setShowQrModal(false);
      toast.error(error.response?.data?.message || "Erro ao reconectar");
    },
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: (integrationId) => whatsappApi.disconnect(integrationId),
    onSuccess: () => {
      toast.success("Sessão desconectada!");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-sessions"] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Erro ao desconectar");
    },
  });

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-40 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-primary" />
            Sessões WhatsApp
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie os números WhatsApp conectados à sua empresa
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1 text-sm py-1">
            <Hash className="w-3.5 h-3.5" />
            {connectedCount} de {totalCount} conectado(s)
          </Badge>
          {isAdmin && (
            <Button
              className="gap-2"
              onClick={() => setShowNewSession(true)}
              disabled={connectMutation.isPending}
            >
              <Plus className="w-4 h-4" /> Nova Sessão
            </Button>
          )}
        </div>
      </div>

      {/* API error banner */}
      {isError && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3">
            <WifiOff className="w-5 h-5 text-destructive shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-destructive">
                Serviço WhatsApp indisponível
              </p>
              <p className="text-xs text-muted-foreground">
                Não foi possível carregar as sessões. Verifique se o servidor
                está rodando.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1"
              onClick={() =>
                queryClient.invalidateQueries({
                  queryKey: ["whatsapp-sessions"],
                })
              }
            >
              <RefreshCw className="w-3.5 h-3.5" /> Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Session list */}
      {sessions.length === 0 && !isError ? (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center">
            <Smartphone className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-lg font-semibold">Nenhuma sessão WhatsApp</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Conecte um número WhatsApp para começar a enviar e receber
              mensagens.
            </p>
            {isAdmin && (
              <Button className="gap-2" onClick={() => setShowNewSession(true)}>
                <Plus className="w-4 h-4" /> Criar Sessão
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              isAdmin={isAdmin}
              onQr={(id) => {
                setActiveSessionId(id);
                qrMutation.mutate(id);
              }}
              onReconnect={(id) => {
                setActiveSessionId(id);
                reconnectMutation.mutate(id);
              }}
              onDisconnect={(id) => disconnectMutation.mutate(id)}
            />
          ))}
        </div>
      )}

      {/* How to connect info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Como Conectar</CardTitle>
          <CardDescription>
            Siga os passos abaixo para conectar seu WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-semibold text-primary">
                1
              </div>
              <div>
                <p className="font-medium">Clique em "Nova Sessão"</p>
                <p className="text-sm text-muted-foreground">
                  Dê um nome para identificar o número e confirme a criação
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-semibold text-primary">
                2
              </div>
              <div>
                <p className="font-medium">Escaneie o QR Code</p>
                <p className="text-sm text-muted-foreground">
                  Abra o WhatsApp no celular → Configurações → Dispositivos
                  conectados → Conectar
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-semibold text-primary">
                3
              </div>
              <div>
                <p className="font-medium">Pronto!</p>
                <p className="text-sm text-muted-foreground">
                  O status mudará para "Conectado" e mensagens serão
                  enviadas/recebidas por esse número
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* New Session Dialog */}
      <Dialog open={showNewSession} onOpenChange={setShowNewSession}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" /> Nova Sessão WhatsApp
            </DialogTitle>
            <DialogDescription>
              Crie uma nova conexão para um número WhatsApp diferente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome / Label (opcional)</Label>
              <Input
                placeholder="Ex: Atendimento, Vendas, Suporte..."
                value={newLabel}
                onChange={(e) =>
                  setNewLabel(sanitizeCompanyName(e.target.value))
                }
              />
            </div>
            <Button
              className="w-full gap-2"
              onClick={() => connectMutation.mutate(newLabel || undefined)}
              disabled={connectMutation.isPending}
            >
              {connectMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Criar Sessão
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Code Modal */}
      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" /> Escaneie o QR Code
            </DialogTitle>
            <DialogDescription>
              Abra o WhatsApp no celular e escaneie este código para conectar
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {qrCode ? (
              <div className="bg-white p-4 rounded-lg">
                <img
                  src={qrCode}
                  alt="QR Code WhatsApp"
                  className="w-64 h-64"
                />
              </div>
            ) : (
              <div className="w-64 h-64 bg-muted rounded-lg flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                <p className="text-xs text-muted-foreground text-center px-4">
                  Iniciando navegador e gerando QR code... Isso pode levar até 1
                  minuto na primeira vez.
                </p>
              </div>
            )}
            <p className="text-sm text-muted-foreground text-center">
              {qrCode
                ? "O QR code expira em alguns minutos. Se expirar, reconecte a sessão para gerar um novo."
                : "Aguarde enquanto preparamos a conexão..."}
            </p>
            <div className="flex gap-2">
              {activeSessionId && (
                <Button
                  variant="outline"
                  onClick={() => reconnectMutation.mutate(activeSessionId)}
                  disabled={reconnectMutation.isPending}
                  className="gap-2"
                >
                  {reconnectMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Novo QR Code
                </Button>
              )}
              <Button variant="default" onClick={() => setShowQrModal(false)}>
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
