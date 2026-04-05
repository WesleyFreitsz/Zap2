import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { whatsappApi } from "@/api/apiClient";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Smartphone,
  Wifi,
  WifiOff,
  RefreshCw,
  QrCode,
  Power,
  PowerOff,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function WhatsAppSettings() {
  const queryClient = useQueryClient();
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrCode, setQrCode] = useState(null);

  // Fetch WhatsApp status
  const {
    data: statusData,
    isLoading: statusLoading,
    isError: statusError,
  } = useQuery({
    queryKey: ["whatsapp-status"],
    queryFn: () => whatsappApi.status(),
    refetchInterval: (query) => (query.state.error ? 15000 : 5000),
    retry: 1,
  });

  // Connect mutation
  const connectMutation = useMutation({
    mutationFn: () => whatsappApi.connect(),
    onSuccess: (data) => {
      toast.success("Instância criada! Escaneie o QR code.");
      if (data.qrCode) {
        setQrCode(data.qrCode);
        setShowQrModal(true);
      }
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Erro ao conectar WhatsApp");
    },
  });

  // Get QR Code mutation
  const getQrMutation = useMutation({
    mutationFn: () => whatsappApi.qrcode(),
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
    mutationFn: () => whatsappApi.reconnect(),
    onSuccess: (data) => {
      toast.success("Reconectando... Escaneie o novo QR code.");
      if (data.qrCode) {
        setQrCode(data.qrCode);
        setShowQrModal(true);
      }
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Erro ao reconectar");
    },
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: () => whatsappApi.disconnect(),
    onSuccess: () => {
      toast.success("WhatsApp desconectado!");
      setQrCode(null);
      setShowQrModal(false);
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Erro ao desconectar");
    },
  });

  // Clear QR code when connected
  useEffect(() => {
    if (statusData?.status === "CONNECTED") {
      setQrCode(null);
      setShowQrModal(false);
    }
  }, [statusData]);

  const status = statusData?.status || "DISCONNECTED";
  const instanceName = statusData?.instanceName || null;

  const statusConfig = {
    CONNECTED: {
      icon: Wifi,
      label: "Conectado",
      color: "text-emerald-600 bg-emerald-50 border-emerald-200",
      buttonVariant: "destructive",
      buttonIcon: PowerOff,
      buttonLabel: "Desconectar",
      buttonAction: () => disconnectMutation.mutate(),
      buttonDisabled: disconnectMutation.isPending,
    },
    DISCONNECTED: {
      icon: WifiOff,
      label: "Desconectado",
      color: "text-slate-500 bg-slate-50 border-slate-200",
      buttonVariant: "default",
      buttonIcon: Power,
      buttonLabel: "Conectar WhatsApp",
      buttonAction: () => connectMutation.mutate(),
      buttonDisabled: connectMutation.isPending,
    },
    CONNECTING: {
      icon: RefreshCw,
      label: "Conectando...",
      color: "text-amber-600 bg-amber-50 border-amber-200",
      buttonVariant: "outline",
      buttonIcon: QrCode,
      buttonLabel: "Ver QR Code",
      buttonAction: () => getQrMutation.mutate(),
      buttonDisabled: getQrMutation.isPending,
    },
  };

  const currentStatus = statusConfig[status] || statusConfig.DISCONNECTED;
  const StatusIcon = currentStatus.icon;

  if (statusLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Smartphone className="w-6 h-6 text-primary" />
          Conexão WhatsApp
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Conecte seu WhatsApp via Evolution API para enviar e receber mensagens
        </p>
      </div>

      {/* Evolution API offline banner */}
      {statusError && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3">
            <WifiOff className="w-5 h-5 text-destructive shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-destructive">
                Evolution API indisponível
              </p>
              <p className="text-xs text-muted-foreground">
                Não foi possível conectar à Evolution API. Verifique se o
                serviço está rodando (docker compose up) e se a URL está correta
                nas configurações.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1"
              onClick={() =>
                queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] })
              }
            >
              <RefreshCw className="w-3.5 h-3.5" /> Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Connection Status Card */}
      <Card className="border-l-4 border-l-primary">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`p-4 rounded-2xl ${
                  status === "CONNECTED" ? "bg-emerald-100" : "bg-muted"
                }`}
              >
                <Smartphone
                  className={`w-10 h-10 ${
                    status === "CONNECTED"
                      ? "text-emerald-600"
                      : "text-muted-foreground"
                  }`}
                />
              </div>
              <div>
                <p className="font-semibold text-lg">Status da Conexão</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className={currentStatus.color}>
                    <StatusIcon
                      className={`w-3 h-3 mr-1 ${
                        status === "CONNECTING" ? "animate-spin" : ""
                      }`}
                    />
                    {currentStatus.label}
                  </Badge>
                </div>
                {instanceName && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Instância: <span className="font-mono">{instanceName}</span>
                  </p>
                )}
                {statusData?.connectedAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Conectado desde:{" "}
                    {new Date(statusData.connectedAt).toLocaleString("pt-BR")}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              {/* Show QR Button (only when connecting) */}
              {status === "CONNECTING" && (
                <Button
                  variant="outline"
                  onClick={() => getQrMutation.mutate()}
                  disabled={getQrMutation.isPending}
                  className="gap-2"
                >
                  {getQrMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <QrCode className="w-4 h-4" />
                  )}
                  Ver QR Code
                </Button>
              )}

              {/* Main Action Button */}
              <Button
                variant={currentStatus.buttonVariant}
                onClick={currentStatus.buttonAction}
                disabled={currentStatus.buttonDisabled}
                className="gap-2 min-w-[160px]"
              >
                {currentStatus.buttonDisabled ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <currentStatus.buttonIcon className="w-4 h-4" />
                )}
                {currentStatus.buttonLabel}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
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
                <p className="font-medium">Clique em "Conectar WhatsApp"</p>
                <p className="text-sm text-muted-foreground">
                  Isso criará uma instância no Evolution API e gerará um QR code
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
                  Abra o WhatsApp no seu celular, vá em Configurações → WhatsApp
                  Web → Escanear
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
                  O status mudará para "Conectado" e você poderá enviar/receber
                  mensagens
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reconnect option for disconnected state */}
      {status === "DISCONNECTED" && instanceName && (
        <Card className="border-dashed">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Já tem uma instância criada?</p>
                <p className="text-sm text-muted-foreground">
                  Se o QR code expirou, você pode reconectar para gerar um novo.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => reconnectMutation.mutate()}
                disabled={reconnectMutation.isPending}
                className="gap-2"
              >
                {reconnectMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Reconectar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* QR Code Modal */}
      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              Escaneie o QR Code
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
              <div className="w-64 h-64 bg-muted rounded-lg flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            )}
            <p className="text-sm text-muted-foreground text-center">
              O QR code expira em alguns minutos. Se expirar, clique em
              "Reconectar" para gerar um novo.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => reconnectMutation.mutate()}
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
