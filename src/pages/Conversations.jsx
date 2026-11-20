import React, { useState, useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { conversationsApi, messagesApi } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { useTheme } from "@/lib/ThemeContext";
import { toast } from "sonner";
import ContactList from "../components/conversations/ContactList";
import ChatPanel from "../components/conversations/ChatPanel";

export default function Conversations() {
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { user } = useAuth();
  const { playNotificationSound } = useTheme();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const latestMessageIdRef = useRef(null);

  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => conversationsApi.list(),
  });

  const selectedConversation = useMemo(
    () =>
      conversations.find(
        (conversation) => conversation.id === selectedConversationId,
      ) || null,
    [conversations, selectedConversationId],
  );
  const leadConversations = useMemo(
    () =>
      selectedConversation?.leadId
        ? conversations.filter(({ leadId }) => leadId === selectedConversation.leadId)
        : [],
    [conversations, selectedConversation],
  );

  const { data: messages = [] } = useQuery({
    queryKey: ["messages", selectedConversationId],
    queryFn: () => messagesApi.list(selectedConversationId),
    enabled: !!selectedConversationId,
  });

  const createLeadMutation = useMutation({
    mutationFn: (conversationId) => conversationsApi.createLead(conversationId),
    onSuccess: (updatedConversation) => {
      toast.success("Lead vinculado com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      if (updatedConversation?.id) {
        setSelectedConversationId(updatedConversation.id);
      }
    },
    onError: (error) => {
      toast.error(
        error.response?.data?.message || "Erro ao criar ou vincular lead",
      );
    },
  });

  // Auto-select from URL param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const convId = params.get("contact");
    if (
      convId &&
      conversations.some((conversation) => conversation.id === convId)
    ) {
      setSelectedConversationId(convId);
    }
  }, [conversations]);

  useEffect(() => {
    if (
      selectedConversationId &&
      !conversations.some(
        (conversation) => conversation.id === selectedConversationId,
      )
    ) {
      setSelectedConversationId(null);
    }
  }, [conversations, selectedConversationId]);

  useEffect(() => {
    latestMessageIdRef.current = null;
  }, [selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId || messages.length === 0) return;

    const latestMessage = messages[messages.length - 1];
    if (!latestMessage?.id) return;

    if (!latestMessageIdRef.current) {
      latestMessageIdRef.current = latestMessage.id;
      return;
    }

    if (
      latestMessage.id !== latestMessageIdRef.current &&
      latestMessage.sender === "CLIENT"
    ) {
      playNotificationSound();
    }

    latestMessageIdRef.current = latestMessage.id;
  }, [messages, playNotificationSound, selectedConversationId]);

  return (
    <div className="h-screen flex min-w-0">
      <div className="w-72 xl:w-[340px] shrink-0">
        <ContactList
          conversations={conversations}
          selectedId={selectedConversationId}
          onSelect={(conversation) =>
            setSelectedConversationId(conversation.id)
          }
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          isAdmin={isAdmin}
          onAddLead={(conversation) =>
            createLeadMutation.mutate(conversation.id)
          }
          creatingLeadConversationId={
            createLeadMutation.isPending ? createLeadMutation.variables : null
          }
        />
      </div>
      <ChatPanel
        conversation={selectedConversation}
        messages={messages}
        leadConversations={leadConversations}
        onSelectConversation={setSelectedConversationId}
        onConversationDeleted={() => setSelectedConversationId(null)}
      />
    </div>
  );
}
