import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { channelsApi } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { authorizeWhatsApp, loadMetaSdk, loginForCode } from "@/lib/metaSdk";
import { channelLabels } from "./ChannelIcon";

export default function MetaChannelConnect({ type, configId, onComplete }) {
  const queryClient = useQueryClient();
  const authAttempt = useRef(null);
  const [pageId, setPageId] = useState("");
  const [selectedChannels, setSelectedChannels] = useState([]);
  const sdk = useQuery({
    queryKey: ["meta-sdk"],
    queryFn: async () => {
      await loadMetaSdk();
      return true;
    },
    staleTime: Infinity,
    retry: false,
  });
  const refreshChannels = () => queryClient.invalidateQueries({ queryKey: ["channels"] });
  const authorize = useMutation({
    mutationFn: async ({ authorization, signal }) => {
      const result = await authorization;
      signal.throwIfAborted();
      return type === "WHATSAPP"
        ? channelsApi.connectWhatsAppCloud(result)
        : channelsApi.discoverPages(result);
    },
    onSuccess: type === "WHATSAPP" ? refreshChannels : undefined,
  });
  const connect = useMutation({
    mutationFn: channelsApi.connectPages,
    onSuccess: refreshChannels,
  });

  useEffect(() => () => authAttempt.current?.abort(), []);

  function choosePage(id, pages) {
    const page = pages.find((item) => item.id === id);
    setPageId(id);
    setSelectedChannels([type === "INSTAGRAM" && !page.instagram ? "FACEBOOK" : type]);
  }

  function startAuthorization() {
    const controller = new AbortController();
    authAttempt.current = controller;
    const authorization = type === "WHATSAPP"
      ? authorizeWhatsApp(configId, controller.signal)
      : loginForCode(configId);

    authorize.mutate({ authorization, signal: controller.signal }, {
      onSuccess: (result) => {
        if (type === "WHATSAPP") onComplete();
        else if (result.pages.length) {
          const firstPage = (type === "INSTAGRAM" && result.pages.find((page) => page.instagram)) || result.pages[0];
          choosePage(firstPage.id, result.pages);
        }
      },
    });
  }

  const discovery = type !== "WHATSAPP" ? authorize.data : null;
  const page = discovery?.pages.find((item) => item.id === pageId);
  const busy = authorize.isPending || connect.isPending;
  const error = sdk.error || authorize.error || connect.error;

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-sm text-destructive">
        {error.response?.data?.message || error.message || "Não foi possível conectar o canal."}
      </p>}
      {sdk.isPending && <p role="status" className="text-sm text-muted-foreground">Carregando a integração com a Meta…</p>}
      {sdk.isError && <Button onClick={() => sdk.refetch()} disabled={sdk.isFetching}>Tentar carregar novamente</Button>}
      {sdk.isSuccess && !page && (
        <>
          {discovery && <p className="text-sm text-muted-foreground">Nenhuma página disponível para esta conta.</p>}
          <Button onClick={startAuthorization} disabled={busy}>
            {busy ? "Aguardando autorização…" : "Continuar com a Meta"}
          </Button>
        </>
      )}
      {page && (
        <form className="space-y-4" onSubmit={(event) => {
          event.preventDefault();
          connect.mutate({ discoveryId: discovery.discoveryId, pageId, channels: selectedChannels }, { onSuccess: onComplete });
        }}>
          <div className="space-y-2">
            <Label htmlFor="channel-page">Página do Facebook</Label>
            <Select value={pageId} disabled={busy} onValueChange={(id) => choosePage(id, discovery.pages)}>
              <SelectTrigger id="channel-page"><SelectValue /></SelectTrigger>
              <SelectContent>
                {discovery.pages.map(({ id, name }) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {(page.instagram ? ["FACEBOOK", "INSTAGRAM"] : ["FACEBOOK"]).map((channel) => (
            <div key={channel} className="flex items-center gap-2">
              <input type="checkbox" id={`connect-${channel}`} className="h-4 w-4 accent-primary"
                disabled={busy} checked={selectedChannels.includes(channel)}
                onChange={({ target: { checked } }) => setSelectedChannels((current) =>
                  checked ? [...current, channel] : current.filter((item) => item !== channel))} />
              <Label htmlFor={`connect-${channel}`}>
                {channelLabels[channel]}{channel === "INSTAGRAM" && page.instagram.username ? ` (@${page.instagram.username})` : ""}
              </Label>
            </div>
          ))}
          {type === "INSTAGRAM" && !page.instagram && (
            <p className="text-sm text-muted-foreground">Esta página não tem uma conta do Instagram vinculada.</p>
          )}
          <Button type="submit" disabled={busy || selectedChannels.length === 0}>
            {connect.isPending ? "Conectando…" : "Conectar canais"}
          </Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={() => {
            connect.reset();
            authorize.reset();
          }}>Trocar conta da Meta</Button>
        </form>
      )}
    </div>
  );
}
