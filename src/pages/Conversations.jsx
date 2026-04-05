import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { conversationsApi, messagesApi } from "@/api/apiClient";
import ContactList from "../components/conversations/ContactList";
import ChatPanel from "../components/conversations/ChatPanel";

export default function Conversations() {
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => conversationsApi.list(),
    refetchInterval: 10000,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["messages", selectedConversation?.id],
    queryFn: () => messagesApi.list(selectedConversation.id),
    enabled: !!selectedConversation?.id,
    refetchInterval: 5000,
  });

  // Auto-select from URL param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const convId = params.get("contact");
    if (convId && conversations.length > 0) {
      const found = conversations.find((c) => c.id === convId);
      if (found) setSelectedConversation(found);
    }
  }, [conversations]);

  return (
    <div className="h-screen flex">
      <div className="w-[340px] shrink-0">
        <ContactList
          conversations={conversations}
          selectedId={selectedConversation?.id}
          onSelect={setSelectedConversation}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />
      </div>
      <ChatPanel conversation={selectedConversation} messages={messages} />
    </div>
  );
}
