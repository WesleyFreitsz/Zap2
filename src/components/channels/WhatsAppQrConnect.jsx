import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { whatsappApi } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sanitizeCompanyName } from "@/lib/utils";

export default function WhatsAppQrConnect({ channel, onComplete }) {
  const [label, setLabel] = useState("");
  const queryClient = useQueryClient();
  const start = useMutation({
    mutationFn: (id) => id ? whatsappApi.reconnect(id) : whatsappApi.connect(label.trim() || undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["channels"] }),
  });
  const sessionId = start.data?.integrationId || channel?.id;
  const needsReconnect = channel?.connectionStatus === "DISCONNECTED" && !start.isSuccess;
  const session = useQuery({
    queryKey: ["whatsapp-qr-session", sessionId, start.submittedAt],
    enabled: Boolean(sessionId && !needsReconnect && !start.isPending),
    queryFn: async () => {
      const status = await whatsappApi.status(sessionId);
      if (status.status === "CONNECTING" && !status.qrCode) {
        const { qrCode } = await whatsappApi.qrcode(sessionId);
        return { ...status, qrCode };
      }
      return status;
    },
    refetchInterval: (query) =>
      query.state.error || query.state.data?.status === "CONNECTED" ? false : 2000,
  });

  useEffect(() => {
    if (session.isFetchedAfterMount && session.data?.status === "CONNECTED") onComplete();
  }, [session.isFetchedAfterMount, session.data?.status, onComplete]);

  const qrCode = session.data ? session.data.qrCode : start.data?.qrCode;
  const error = start.error || session.error;
  const showQr = sessionId && !needsReconnect && session.data?.status !== "DISCONNECTED";

  return (
    <div className="space-y-4">
      {!sessionId && !start.isPending && (
        <form className="space-y-3" onSubmit={(event) => {
          event.preventDefault();
          start.mutate();
        }}>
          <Label htmlFor="channel-qr-label">Nome da sessão (opcional)</Label>
          <Input id="channel-qr-label" value={label} placeholder="Ex.: Atendimento"
            onChange={(event) => setLabel(sanitizeCompanyName(event.target.value))} />
          <Button type="submit">Gerar QR code</Button>
        </form>
      )}
      {error && <p role="alert" className="text-sm text-destructive">
        {error.response?.data?.message || "Não foi possível obter a conexão do WhatsApp."}
      </p>}
      {start.isPending ? (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Preparando a conexão…
        </p>
      ) : sessionId && (
        <>
          {showQr && qrCode && (
            <div className="space-y-2 text-center">
              <p className="text-sm text-muted-foreground">
                No WhatsApp, abra Dispositivos conectados e escaneie o código.
              </p>
              <img src={qrCode} alt="QR code para conectar o WhatsApp" className="mx-auto w-56 max-w-full rounded-lg bg-white p-3" />
            </div>
          )}
          {showQr && !qrCode && !error && <p role="status" className="text-sm text-muted-foreground">
            Aguardando o QR code…
          </p>}
          <Button variant="outline" onClick={() => start.mutate(sessionId)}>
            {needsReconnect ? "Reconectar" : "Gerar novo QR code"}
          </Button>
        </>
      )}
    </div>
  );
}
