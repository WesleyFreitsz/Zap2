import React from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import ChannelIcon, { getConversationName, getConversationPhone, isSocialConversation } from "@/components/channels/ChannelIcon";

const statusLabels = {
  OPEN: "Aberta",
  PENDING: "Pendente",
  BOT: "Bot",
  CLOSED: "Fechada",
  TRANSFERRED: "Transferida",
};

export default function ContactList({
  conversations = [],
  selectedId,
  onSelect,
  searchTerm,
  onSearchChange,
  isAdmin,
  onAddLead,
  creatingLeadConversationId,
}) {
  const filtered = conversations.filter(
    (c) =>
      getConversationName(c)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (!isSocialConversation(c) && (c.displayPhone?.includes(searchTerm) || c.contactPhone?.includes(searchTerm))),
  );

  return (
    <div className="h-full flex flex-col border-r border-border bg-card">
      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversa..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9 bg-muted/50 border-0"
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-12">
            Nenhuma conversa encontrada
          </p>
        )}
        {filtered.map((conv) => (
          <div
            key={conv.id}
            onClick={() => onSelect(conv)}
            className={cn(
              "flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors border-b border-border/50",
              selectedId === conv.id ? "bg-accent" : "hover:bg-muted/50",
            )}
          >
            <Avatar className="h-11 w-11 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {getConversationName(conv)?.charAt(0)?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold truncate">
                  {getConversationName(conv)}
                </p>
                {conv.updatedAt && (
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {format(new Date(conv.updatedAt), "HH:mm")}
                  </span>
                )}
              </div>
              <div className="mt-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <ChannelIcon type={conv.channel} className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{getConversationPhone(conv)}</span>
                  </span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {statusLabels[conv.status] || conv.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 flex-wrap min-w-0">
                    {isAdmin && conv.assignedTo?.name && (
                      <span className="text-[10px] text-muted-foreground truncate">
                        Responsável: {conv.assignedTo.name}
                      </span>
                    )}
                    {conv.leadId ? (
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0"
                      >
                        Lead vinculado
                      </Badge>
                    ) : null}
                  </div>
                  {!conv.leadId &&
                    onAddLead &&
                    !String(conv.contactPhone || "").includes("broadcast") && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-[10px] gap-1"
                        onClick={(event) => {
                          event.stopPropagation();
                          onAddLead(conv);
                        }}
                        disabled={creatingLeadConversationId === conv.id}
                      >
                        {creatingLeadConversationId === conv.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <UserPlus className="w-3 h-3" />
                        )}
                        Adicionar lead
                      </Button>
                    )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
