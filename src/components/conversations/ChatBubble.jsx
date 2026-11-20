import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Bot, User, Check, CheckCheck, CircleAlert, FileText } from "lucide-react";
import { format } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { messagesApi } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import MessageMenu from "./MessageMenu";
import AudioPlayer from "./AudioPlayer";

const MEDIA_PLACEHOLDER = /^\[(imagem|áudio|vídeo|figurinha|documento|mídia recebida)\]$/i;

const MEDIA_LABELS = { image: "Foto", video: "Vídeo", audio: "Áudio", document: "Documento", sticker: "Figurinha" };

function formatFileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MessageMedia({ message, inverted }) {
  const { mediaType, mediaUrl, fileName, fileSize } = message;
  if (!mediaUrl) return null;

  if (mediaType === "image" || mediaType === "sticker") {
    return (
      <a href={mediaUrl} target="_blank" rel="noreferrer" aria-label="Abrir imagem em nova aba">
        <img
          src={mediaUrl}
          alt={fileName || "Imagem da mensagem"}
          loading="lazy"
          className={cn(
            "block rounded-xl",
            mediaType === "sticker" ? "h-36 w-36 object-contain" : "max-h-96 w-72 max-w-full object-cover",
          )}
        />
      </a>
    );
  }
  if (mediaType === "video") {
    return <video src={mediaUrl} controls preload="metadata" className="block max-h-96 w-72 max-w-full rounded-xl bg-black" />;
  }
  if (mediaType === "audio") {
    return <AudioPlayer src={mediaUrl} inverted={inverted} />;
  }
  return (
    <a
      href={mediaUrl}
      target="_blank"
      rel="noreferrer"
      className="flex w-64 max-w-full items-center gap-2 rounded-lg bg-black/10 px-3 py-2 text-sm underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <FileText className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 truncate">{fileName || "Documento"}</span>
      {fileSize ? <span className="shrink-0 text-xs opacity-70">{formatFileSize(fileSize)}</span> : null}
    </a>
  );
}

function ReplyQuote({ replyTo }) {
  return (
    <div className="mb-1 rounded-md border-l-4 border-primary/60 bg-black/10 px-2 py-1 text-xs">
      <p className="font-semibold opacity-80">{replyTo.sender === "CLIENT" ? "Contato" : "Você"}</p>
      <p className="line-clamp-2 opacity-80">{replyTo.content || MEDIA_LABELS[replyTo.mediaType] || "Mensagem"}</p>
    </div>
  );
}

export default function ChatBubble({ message, onReply }) {
  const isContact = message.sender === "CLIENT";
  const isBot = message.sender === "SYSTEM";
  const isDeleted = Boolean(message.deletedAt);
  const isOwn = !isContact && !isBot;
  const isSticker = !isDeleted && message.mediaType === "sticker" && Boolean(message.mediaUrl);
  const hasVisualMedia = !isDeleted && Boolean(message.mediaUrl) && ["image", "sticker", "video"].includes(message.mediaType);
  const text = message.mediaUrl && MEDIA_PLACEHOLDER.test(message.content?.trim() ?? "") ? "" : message.content;
  const reactions = isDeleted ? [] : [message.reaction, message.ownReaction].filter(Boolean);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const queryClient = useQueryClient();

  const refreshMessages = () =>
    queryClient.invalidateQueries({ queryKey: ["messages", message.conversationId] });
  const onError = (fallback) => (error) => toast.error(error.response?.data?.message || fallback);

  const reactMutation = useMutation({
    mutationFn: (emoji) => messagesApi.react(message.id, emoji),
    onSuccess: () => toast.success("Reação enviada"),
    onError: onError("Erro ao reagir à mensagem"),
  });
  const editMutation = useMutation({
    mutationFn: (content) => messagesApi.edit(message.id, content),
    onSuccess: () => {
      setEditing(false);
      refreshMessages();
    },
    onError: onError("Erro ao editar mensagem"),
  });
  const deleteMutation = useMutation({
    mutationFn: () => messagesApi.remove(message.id),
    onSuccess: () => {
      setConfirmingDelete(false);
      refreshMessages();
    },
    onError: onError("Erro ao apagar mensagem"),
  });

  const copyContent = () =>
    navigator.clipboard
      .writeText(message.content)
      .then(() => toast.success("Mensagem copiada"))
      .catch(() => toast.error("Não foi possível copiar"));

  const startEditing = () => {
    setDraft(message.content);
    setEditing(true);
  };

  const submitEdit = () => {
    const content = draft.trim();
    if (!content || content === message.content) {
      setEditing(false);
      return;
    }
    editMutation.mutate(content);
  };

  const handleEditKeyDown = (event) => {
    if (event.key === "Escape") setEditing(false);
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitEdit();
    }
  };

  const statusIcons = {
    SENT: <Check className="w-3.5 h-3.5 opacity-70" aria-label="Enviada" role="img" />,
    DELIVERED: <CheckCheck className="w-3.5 h-3.5 opacity-70" aria-label="Entregue" role="img" />,
    READ: <CheckCheck className={cn("w-3.5 h-3.5", isOwn && !isSticker ? "text-sky-300" : "text-sky-500")} aria-label="Lida" role="img" />,
    FAILED: <CircleAlert className="w-3 h-3" aria-label="Falha no envio" role="img" />,
  };

  return (
    <div
      className={cn(
        "flex gap-2",
        reactions.length ? "mb-6" : "mb-2",
        isContact ? "justify-start" : "justify-end",
      )}
    >
      {isContact && (
        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
          <User className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      )}
      <div
        className={cn(
          "group relative max-w-[75%] rounded-2xl",
          hasVisualMedia ? "p-1" : "px-3 py-2",
          isSticker
            ? "bg-transparent border-0 text-foreground"
            : isContact
            ? "bg-card border border-border rounded-tl-md"
            : isBot
              ? "bg-accent text-accent-foreground rounded-tr-md"
              : "bg-primary text-primary-foreground rounded-tr-md",
        )}
      >
        {!isDeleted && !editing && (
          <MessageMenu
            message={message}
            onReply={() => onReply?.(message)}
            onReact={(emoji) => reactMutation.mutate(emoji)}
            onCopy={copyContent}
            onEdit={startEditing}
            onDelete={() => setConfirmingDelete(true)}
          />
        )}
        {isBot && (
          <div className="flex items-center gap-1 mb-1">
            <Bot className="w-3 h-3" />
            <span className="text-[10px] font-semibold opacity-70">IA</span>
          </div>
        )}
        {isDeleted ? (
          <p className="text-sm italic opacity-70">Mensagem apagada</p>
        ) : (
          <>
            {message.replyTo && <ReplyQuote replyTo={message.replyTo} />}
            <MessageMedia message={message} inverted={isOwn} />
            {editing ? (
              <div className="space-y-2">
                <Textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={handleEditKeyDown}
                  aria-label="Editar mensagem"
                  autoFocus
                  rows={2}
                  className="min-w-56 bg-background text-foreground"
                />
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-current hover:bg-black/10" onClick={() => setEditing(false)}>
                    Cancelar
                  </Button>
                  <Button size="sm" className="h-7 text-xs bg-background text-foreground hover:bg-background/90" onClick={submitEdit} disabled={editMutation.isPending}>
                    Salvar
                  </Button>
                </div>
              </div>
            ) : (
              text && (
                <p className={cn("text-sm leading-relaxed whitespace-pre-wrap break-words", hasVisualMedia && "px-2 pt-1")}>
                  {text}
                </p>
              )
            )}
          </>
        )}
        <div
          className={cn(
            "mt-1 flex items-center justify-end gap-1",
            hasVisualMedia && "px-2 pb-1",
            isContact && "text-muted-foreground",
          )}
        >
          {message.editedAt && !isDeleted && <span className="text-[10px] opacity-75">editada</span>}
          <span className="text-[10px] opacity-75">
            {message.createdAt && format(new Date(message.createdAt), "HH:mm")}
          </span>
          {!isContact && statusIcons[message.status]}
        </div>
        {reactions.length > 0 && (
          <span
            className={cn(
              "absolute -bottom-4 flex items-center gap-0.5 rounded-full border border-border bg-card px-1.5 py-0.5 text-sm leading-none shadow-sm",
              isContact ? "left-2" : "right-2",
            )}
            aria-label={`Reações: ${reactions.join(" ")}`}
          >
            {reactions.map((emoji, index) => (
              <span key={`${emoji}-${index}`} aria-hidden="true">{emoji}</span>
            ))}
          </span>
        )}
      </div>
      {!isContact && isBot && (
        <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center shrink-0 mt-1">
          <Bot className="w-3.5 h-3.5 text-primary" />
        </div>
      )}
      <Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apagar mensagem para todos?</DialogTitle>
            <DialogDescription>
              A mensagem será apagada também para o contato. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmingDelete(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
              Apagar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
