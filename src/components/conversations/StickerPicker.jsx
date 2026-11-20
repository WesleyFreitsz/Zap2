import React, { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, Loader2, Sticker } from "lucide-react";
import { messagesApi } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function StickerPicker({ conversationId, replyToId, onSent }) {
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: stickers = [], isLoading, isError } = useQuery({
    queryKey: ["whatsapp-stickers"],
    queryFn: messagesApi.listStickers,
    enabled: open,
    staleTime: 2 * 60 * 1000,
  });

  const afterSend = () => {
    queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    setOpen(false);
    onSent?.();
  };
  const onError = (error) => toast.error(error.response?.data?.message || "Erro ao enviar figurinha");

  const sendFile = useMutation({
    mutationFn: (file) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("conversationId", conversationId);
      formData.append("asSticker", "true");
      if (replyToId) formData.append("replyToId", replyToId);
      return messagesApi.sendMedia(formData);
    },
    onSuccess: afterSend,
    onError,
  });

  const handleFile = (event) => {
    const [file] = event.target.files;
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Escolha uma imagem para virar figurinha");
      return;
    }
    sendFile.mutate(file);
  };

  const sendSaved = (dataUrl) =>
    fetch(dataUrl)
      .then((response) => response.blob())
      .then((blob) => sendFile.mutate(new File([blob], "figurinha.webp", { type: blob.type || "image/webp" })));

  const busy = sendFile.isPending;

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setOpen(true)}
        className="shrink-0"
        title="Enviar figurinha"
        aria-label="Enviar figurinha"
      >
        <Sticker className="w-4 h-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Figurinhas</DialogTitle>
            <DialogDescription>Figurinhas recentes do WhatsApp conectado, ou uma imagem sua como figurinha.</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-muted-foreground" />
            ) : isError ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Não foi possível carregar as figurinhas do WhatsApp.
              </p>
            ) : stickers.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma figurinha salva neste WhatsApp.
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {stickers.map((sticker) => (
                  <button
                    key={sticker.id}
                    type="button"
                    disabled={busy}
                    onClick={() => sendSaved(sticker.dataUrl)}
                    aria-label="Enviar esta figurinha"
                    className="aspect-square rounded-lg p-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  >
                    <img src={sticker.dataUrl} alt="" loading="lazy" className="h-full w-full object-contain" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button variant="outline" disabled={busy} onClick={() => fileInputRef.current?.click()} className="gap-2">
            {sendFile.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            Enviar imagem como figurinha
          </Button>
          <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFile} />
        </DialogContent>
      </Dialog>
    </>
  );
}
