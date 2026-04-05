import React, { useState, useRef, useEffect } from "react";
import { messagesApi, conversationsApi } from "@/api/apiClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Send,
  Bot,
  Sparkles,
  Loader2,
  Package,
  XCircle,
  User,
} from "lucide-react";
import ChatBubble from "./ChatBubble";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import SendProductModal from "@/components/products/SendProductModal";

export default function ChatPanel({ conversation, messages = [] }) {
  const [input, setInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [suggestedReply, setSuggestedReply] = useState("");
  const [showProductModal, setShowProductModal] = useState(false);
  const scrollRef = useRef(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: async (content) => {
      await messagesApi.send({
        conversationId: conversation.id,
        content,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["messages", conversation.id],
      });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      setInput("");
      setSuggestedReply("");
    },
  });

  const toggleAutoMode = useMutation({
    mutationFn: () =>
      conversationsApi.update(conversation.id, {
        autoMode: !conversation.autoMode,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast.success(
        conversation.autoMode
          ? "Modo manual ativado"
          : "Modo automático ativado",
      );
    },
  });

  const handleSuggest = async () => {
    setGenerating(true);
    const recentMessages = messages
      .slice(-6)
      .map(
        (m) =>
          `${m.sender === "contact" ? "Cliente" : "Atendente"}: ${m.content}`,
      )
      .join("\n");

    const result = await messagesApi.suggestReply({
      conversationId: conversation.id,
      recentMessages,
    });
    setSuggestedReply(result);
    setGenerating(false);
  };

  const handleSend = () => {
    const content = input.trim();
    if (!content) return;
    sendMutation.mutate(content);
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mx-auto">
            <Bot className="w-8 h-8 text-primary" />
          </div>
          <p className="text-lg font-semibold">ZapAI</p>
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
              {conversation.contactName?.charAt(0)?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold">{conversation.contactName}</p>
            <p className="text-xs text-muted-foreground">
              {conversation.contactPhone}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-muted-foreground" />
            <Switch
              checked={conversation.autoMode}
              onCheckedChange={() => toggleAutoMode.mutate()}
              className="data-[state=checked]:bg-primary"
            />
            <Bot className="w-3.5 h-3.5 text-primary" />
          </div>
          <Badge variant="outline" className="text-[10px]">
            {conversation.autoMode ? "Automático" : "Manual"}
          </Badge>
        </div>
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
      {suggestedReply && (
        <div className="px-4 py-2 border-t border-border bg-accent/30">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-medium text-primary mb-1">
                Sugestão da IA:
              </p>
              <p className="text-sm">{suggestedReply}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSuggestedReply("")}
                className="text-xs h-7"
              >
                Ignorar
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setInput(suggestedReply);
                  setSuggestedReply("");
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
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Digite sua mensagem..."
            className="flex-1 bg-muted/50 border-0"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || sendMutation.isPending}
            className="bg-primary hover:bg-primary/90 shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
      {showProductModal && (
        <SendProductModal
          conversationId={conversation.id}
          onClose={() => setShowProductModal(false)}
        />
      )}
    </div>
  );
}
