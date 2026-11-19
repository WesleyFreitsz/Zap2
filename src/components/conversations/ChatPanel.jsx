import React, { useState, useRef, useEffect } from "react";
import { messagesApi } from "@/api/apiClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/lib/AuthContext";
import { useTheme } from "@/lib/ThemeContext";
import {
  Send,
  Bot,
  Sparkles,
  Loader2,
  Package,
  FileText,
} from "lucide-react";
import ChatBubble from "./ChatBubble";
import TemplatePicker from "./TemplatePicker";
import QuickReplyMenu from "./QuickReplyMenu";
import { toast } from "sonner";
import SendProductModal from "@/components/products/SendProductModal";
import ConversationTags from "./ConversationTags";
import ChannelIcon, { getConversationName, getConversationPhone } from "@/components/channels/ChannelIcon";

const WHATSAPP_WINDOW_MS = 24 * 60 * 60 * 1000;

export default function ChatPanel({ conversation, messages = [] }) {
  const [input, setInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [expiredWindow, setExpiredWindow] = useState(null);
  const scrollRef = useRef(null);
  const openConversationIdRef = useRef(conversation?.id);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { branding } = useTheme();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const isWhatsAppMeta = conversation?.channel === "WHATSAPP" && conversation.provider === "META";
  const windowEndsAt = Date.parse(conversation?.lastClientMessageAt) + WHATSAPP_WINDOW_MS;
  const isWindowClosed = isWhatsAppMeta && !(Date.now() < windowEndsAt && expiredWindow !== windowEndsAt);
  const suggestedReply = suggestion?.conversationId === conversation?.id ? suggestion.text : "";

  useEffect(() => {
    openConversationIdRef.current = conversation?.id;
    setInput("");
    setSuggestion(null);
  }, [conversation?.id]);

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
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Erro ao enviar mensagem");
    },
  });

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
    sendMutation.mutate({ conversationId: conversation.id, content });
  };

  const handleSendTemplate = async ({ templateName, language, parameters }) => {
    const conversationId = conversation.id;
    await messagesApi.sendTemplate({ conversationId, templateName, language, parameters });
    queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30">
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
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
              {getConversationName(conversation)?.charAt(0)?.toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold">{getConversationName(conversation)}</p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ChannelIcon type={conversation.channel} className="h-3.5 w-3.5 shrink-0" />
              {getConversationPhone(conversation)}
            </p>
            {isAdmin && conversation.assignedTo?.name && (
              <p className="text-[11px] text-muted-foreground">
                Responsável: {conversation.assignedTo.name}
              </p>
            )}
          </div>
        </div>
        <ConversationTags conversationId={conversation.id} />
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
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
          <ChatBubble key={msg.id} message={msg} />
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

      {/* Input */}
      <div className="px-4 py-3 border-t border-border bg-card">
        <div className="flex items-center gap-2">
          {isWindowClosed ? (
            <p className="flex-1 text-sm text-muted-foreground">
              Janela de 24h fechada. Para retomar a conversa, envie um template.
            </p>
          ) : (
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
            </>
          )}
          {isWhatsAppMeta && (
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
      {showProductModal && !isWindowClosed && (
        <SendProductModal
          conversationId={conversation.id}
          onClose={() => setShowProductModal(false)}
        />
      )}
    </div>
  );
}
