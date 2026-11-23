import React, { useState, useRef, useEffect, useMemo } from "react";
import { conversationsApi, messagesApi } from "@/api/apiClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/AuthContext";
import { useTheme } from "@/lib/ThemeContext";
import {
  Send,
  Bot,
  Sparkles,
  Loader2,
  Package,
  FileText,
  Paperclip,
  Trash2,
  X,
} from "lucide-react";
import AudioRecorder from "./AudioRecorder";
import StickerPicker from "./StickerPicker";
import ChatBubble from "./ChatBubble";
import TemplatePicker from "./TemplatePicker";
import QuickReplyMenu from "./QuickReplyMenu";
import { toast } from "sonner";
import SendProductModal from "@/components/products/SendProductModal";
import ConversationTags from "./ConversationTags";
import ChannelIcon, { getConversationName, getConversationPhone } from "@/components/channels/ChannelIcon";
import LinkLeadDialog from "./LinkLeadDialog";
import ZendeskTicketButton from "./ZendeskTicketButton";
import LeadStatusControls from "./LeadStatusControls";
import { cn } from "@/lib/utils";

const WHATSAPP_WINDOW_MS = 24 * 60 * 60 * 1000;

export default function ChatPanel({ conversation, messages = [], leadConversations = [], onSelectConversation, onConversationDeleted }) {
  const [input, setInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [expiredWindow, setExpiredWindow] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [caption, setCaption] = useState("");
  const [recording, setRecording] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);
  const openConversationIdRef = useRef(conversation?.id);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { branding } = useTheme();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const isWhatsAppMeta = conversation?.channel === "WHATSAPP" && conversation.provider === "META";
  const windowEndsAt = Date.parse(conversation?.lastClientMessageAt) + WHATSAPP_WINDOW_MS;
  const isWindowClosed = isWhatsAppMeta && !(Date.now() < windowEndsAt && expiredWindow !== windowEndsAt);
  const suggestedReply = suggestion && suggestion.conversationId === conversation?.id ? suggestion.text : "";
  const { data: isTyping = false } = useQuery({
    queryKey: ["typing", conversation?.id],
    queryFn: () => false,
    enabled: false,
  });

  const conversationId = conversation?.id;
  const unreadCount = conversation?.unreadCount ?? 0;
  useEffect(() => {
    if (!conversationId || unreadCount === 0) return;
    conversationsApi
      .markAsRead(conversationId)
      .then(() => queryClient.invalidateQueries({ queryKey: ["conversations"] }))
      .catch(() => undefined);
  }, [conversationId, unreadCount, queryClient]);

  useEffect(() => {
    openConversationIdRef.current = conversation?.id;
    setInput("");
    setSuggestion(null);
    setReplyTo(null);
    setPendingFile(null);
    setCaption("");
    setRecording(false);
  }, [conversation?.id]);

  const previewUrl = useMemo(
    () => (pendingFile?.type.startsWith("image/") ? URL.createObjectURL(pendingFile) : null),
    [pendingFile],
  );
  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);

  useEffect(() => {
    const remaining = windowEndsAt - Date.now();
    if (!isWhatsAppMeta || !(remaining > 0)) return;
    const timer = setTimeout(() => setExpiredWindow(windowEndsAt), remaining);
    return () => clearTimeout(timer);
  }, [isWhatsAppMeta, windowEndsAt]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: (message) => messagesApi.send(message),
    onSuccess: (_data, { conversationId }) => {
      queryClient.invalidateQueries({
        queryKey: ["messages", conversationId],
      });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (conversationId !== openConversationIdRef.current) return;
      setInput("");
      setSuggestion(null);
      setReplyTo(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Erro ao enviar mensagem");
    },
  });

  const sendMediaMutation = useMutation({
    mutationFn: ({ file, caption: mediaCaption, replyToId, conversationId }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("conversationId", conversationId);
      if (mediaCaption) formData.append("caption", mediaCaption);
      if (replyToId) formData.append("replyToId", replyToId);
      return messagesApi.sendMedia(formData);
    },
    onSuccess: (_data, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (conversationId !== openConversationIdRef.current) return;
      setPendingFile(null);
      setCaption("");
      setReplyTo(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Erro ao enviar arquivo");
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: () => conversationsApi.remove(conversation.id),
    onSuccess: () => {
      setConfirmingDelete(false);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      onConversationDeleted?.();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Erro ao excluir conversa");
    },
  });

  const sendMedia = (file, mediaCaption = "") =>
    sendMediaMutation.mutate({
      file,
      caption: mediaCaption.trim(),
      replyToId: replyTo?.id,
      conversationId: conversation.id,
    });

  const handleFileChosen = (event) => {
    const [file] = event.target.files;
    event.target.value = "";
    if (file) setPendingFile(file);
  };

  const handleSuggest = async () => {
    setGenerating(true);
    try {
      const conversationId = conversation.id;
      const text = await messagesApi.suggestReply(conversationId);
      setSuggestion({ conversationId, text });
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Não foi possível gerar a sugestão",
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = () => {
    const content = input.trim();
    if (!content || (isWhatsAppMeta && !(Date.now() < windowEndsAt))) return;
    sendMutation.mutate({ conversationId: conversation.id, content, replyToId: replyTo?.id });
  };

  const handleSendTemplate = async ({ templateName, language, parameters }) => {
    const conversationId = conversation.id;
    await messagesApi.sendTemplate({ conversationId, templateName, language, parameters });
    queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  };

  if (!conversation) {
    return (
      <div className="flex-1 min-w-0 flex items-center justify-center bg-muted/30">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mx-auto">
            <Bot className="w-8 h-8 text-primary" />
          </div>
          <p className="text-lg font-semibold">{branding.platformName}</p>
          <p className="text-sm text-muted-foreground">
            Selecione uma conversa para começar
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={conversation.avatarUrl || undefined} alt="" />
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
              {getConversationName(conversation)?.charAt(0)?.toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold">{getConversationName(conversation)}</p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ChannelIcon type={conversation.channel} className="h-3.5 w-3.5 shrink-0" />
              {getConversationPhone(conversation)}
              {isTyping && <span className="italic text-primary">digitando...</span>}
            </p>
            {leadConversations.length > 1 && (
              <div className="mt-1 flex flex-wrap gap-1" role="tablist" aria-label="Canais do contato">
                {leadConversations.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={item.id === conversation.id}
                    onClick={() => onSelectConversation?.(item.id)}
                    className={cn(
                      "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
                      item.id === conversation.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted",
                    )}
                  >
                    <ChannelIcon type={item.channel} className="h-3 w-3" />
                    {item.unreadCount > 0 && <span className="font-semibold">{item.unreadCount}</span>}
                  </button>
                ))}
              </div>
            )}
            {isAdmin && conversation.assignedTo?.name && (
              <p className="text-[11px] text-muted-foreground">
                Responsável: {conversation.assignedTo.name}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {conversation.lead ? <LeadStatusControls lead={conversation.lead} /> : <LinkLeadDialog conversationId={conversation.id} />}
          <ZendeskTicketButton conversation={conversation} />
          <ConversationTags conversationId={conversation.id} />
          {isAdmin && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => setConfirmingDelete(true)}
              title="Excluir conversa"
              aria-label="Excluir conversa"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, hsl(var(--border)) 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
      >
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-12">
            Nenhuma mensagem nesta conversa
          </p>
        )}
        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} onReply={setReplyTo} />
        ))}
      </div>

      {/* Suggested reply */}
      {suggestedReply && !isWindowClosed && (
        <div className="px-4 py-2 border-t border-border bg-accent/30">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-medium text-primary mb-1">
                Sugestão da IA (revise antes de enviar):
              </p>
              <p className="text-sm">{suggestedReply}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSuggestion(null)}
                className="text-xs h-7"
              >
                Ignorar
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setInput(suggestedReply);
                  setSuggestion(null);
                }}
                className="text-xs h-7 bg-primary hover:bg-primary/90"
              >
                Usar
              </Button>
            </div>
          </div>
        </div>
      )}

      {replyTo && !isWindowClosed && (
        <div className="flex items-center gap-2 px-4 py-2 border-t border-border bg-muted/50">
          <div className="min-w-0 flex-1 border-l-4 border-primary pl-2 text-xs">
            <p className="font-semibold">
              Respondendo a {replyTo.sender === "CLIENT" ? "contato" : "você"}
            </p>
            <p className="truncate text-muted-foreground">{replyTo.content || "Mídia"}</p>
          </div>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setReplyTo(null)} aria-label="Cancelar resposta">
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {pendingFile && !isWindowClosed && (
        <div className="flex items-center gap-3 px-4 py-2 border-t border-border bg-muted/50">
          {previewUrl ? (
            <img src={previewUrl} alt="Prévia do anexo" className="h-14 w-14 shrink-0 rounded-md object-cover" />
          ) : (
            <FileText className="h-8 w-8 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate text-xs font-medium">{pendingFile.name}</p>
            <Input
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && sendMedia(pendingFile, caption)}
              placeholder="Adicionar legenda..."
              aria-label="Legenda do anexo"
              className="h-8"
            />
          </div>
          <Button size="icon" variant="ghost" onClick={() => setPendingFile(null)} aria-label="Descartar anexo">
            <X className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            onClick={() => sendMedia(pendingFile, caption)}
            disabled={sendMediaMutation.isPending}
            aria-label="Enviar anexo"
            className="bg-primary hover:bg-primary/90 shrink-0"
          >
            {sendMediaMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t border-border bg-card">
        <div className="flex items-center gap-2">
          {isWindowClosed ? (
            <p className="flex-1 text-sm text-muted-foreground">
              Janela de 24h fechada. Para retomar a conversa, envie um template.
            </p>
          ) : recording ? null : (
            <>
              <Button
                variant="outline"
                size="icon"
                onClick={handleSuggest}
                disabled={generating || messages.length === 0}
                className="shrink-0"
                title="Sugerir resposta com IA"
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowProductModal(true)}
                className="shrink-0"
                title="Enviar produto"
              >
                <Package className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0"
                title="Anexar arquivo"
                aria-label="Anexar arquivo"
              >
                <Paperclip className="w-4 h-4" />
              </Button>
              <input ref={fileInputRef} type="file" hidden onChange={handleFileChosen} />
              {conversation.channel === "WHATSAPP" && conversation.provider !== "META" && (
                <StickerPicker
                  conversationId={conversation.id}
                  replyToId={replyTo?.id}
                  onSent={() => setReplyTo(null)}
                />
              )}
            </>
          )}
          {isWhatsAppMeta && !recording && (
            <TemplatePicker
              key={conversation.id}
              channelId={conversation.integrationId}
              confirmLabel="Enviar template"
              onConfirm={handleSendTemplate}
            >
              <Button
                variant="outline"
                size={isWindowClosed ? "sm" : "icon"}
                title="Enviar template"
                aria-label="Enviar template"
                className="shrink-0"
              >
                {isWindowClosed ? "Enviar template" : <FileText className="w-4 h-4" />}
              </Button>
            </TemplatePicker>
          )}
          {!isWindowClosed && (
            <AudioRecorder
              key={conversation.id}
              disabled={sendMediaMutation.isPending}
              onRecordingChange={setRecording}
              onRecorded={(file) => sendMedia(file)}
            />
          )}
          {!isWindowClosed && !recording && (
            <>
              <QuickReplyMenu
                key={conversation.id}
                companyId={user?.companyId}
                value={input}
                onChange={setInput}
                onSend={handleSend}
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!input.trim() || sendMutation.isPending}
                className="bg-primary hover:bg-primary/90 shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>
      <Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir conversa?</DialogTitle>
            <DialogDescription>
              A conversa e todas as mensagens serão removidas do sistema. O celular não é afetado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmingDelete(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConversationMutation.mutate()}
              disabled={deleteConversationMutation.isPending}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {showProductModal && !isWindowClosed && (
        <SendProductModal
          conversationId={conversation.id}
          onClose={() => setShowProductModal(false)}
        />
      )}
    </div>
  );
}
