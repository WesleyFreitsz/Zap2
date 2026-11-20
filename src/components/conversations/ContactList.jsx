import React, { useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import ChannelIcon, { getConversationName, getConversationPhone, isSocialConversation } from "@/components/channels/ChannelIcon";

const statusLabels = {
  OPEN: "Aberta",
  CLOSED: "Fechada",
  TRANSFERRED: "Transferida",
};

const channelFilters = {
  WHATSAPP: "WhatsApp",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
};

function groupConversations(conversations) {
  const groups = new Map();
  const recentFirst = [...conversations].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

  for (const conversation of recentFirst) {
    const key = conversation.leadId ? `lead:${conversation.leadId}` : `conversation:${conversation.id}`;
    const group = groups.get(key) ?? { key, conversations: [], channels: new Set(), unreadCount: 0 };
    group.conversations.push(conversation);
    group.channels.add(conversation.channel ?? "WHATSAPP");
    group.unreadCount += conversation.unreadCount ?? 0;
    groups.set(key, group);
  }

  return [...groups.values()];
}

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
  const [channel, setChannel] = useState("ALL");
  const groups = useMemo(() => groupConversations(conversations), [conversations]);
  const search = searchTerm.trim().toLowerCase();
  const filtered = groups.filter(
    (group) =>
      (channel === "ALL" || group.channels.has(channel)) &&
      (!search || group.conversations.some((conv) =>
        conv.lead?.name?.toLowerCase().includes(search) ||
        getConversationName(conv)?.toLowerCase().includes(search) ||
        (!isSocialConversation(conv) && (conv.displayPhone?.includes(search) || conv.contactPhone?.includes(search))),
      )),
  );

  return (
    <div className="h-full flex flex-col border-r border-border bg-card">
      {/* Search */}
      <div className="p-3 space-y-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversa..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9 bg-muted/50 border-0"
          />
        </div>
        <Select value={channel} onValueChange={setChannel}>
          <SelectTrigger aria-label="Filtrar por canal">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            {Object.entries(channelFilters).map(([type, label]) => (
              <SelectItem key={type} value={type}>
                <span className="flex items-center gap-2">
                  <ChannelIcon type={type} className="size-4" aria-hidden="true" />
                  {label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-12">
            Nenhuma conversa encontrada
          </p>
        )}
        {filtered.map((group) => {
          const [conv] = group.conversations;
          const name = conv.lead?.name || getConversationName(conv) || "Contato sem nome";
          const isSelected = group.conversations.some(({ id }) => id === selectedId);
          return (
          <div
            key={group.key}
            className={cn(
              "relative flex items-center gap-3 px-3 py-3 transition-colors border-b border-border/50",
              isSelected ? "bg-accent" : "hover:bg-muted/50",
            )}
          >
            <button
              type="button"
              aria-label={`Abrir conversa com ${name}${group.unreadCount ? `, mensagens não lidas: ${group.unreadCount}` : ""}`}
              aria-current={isSelected ? "true" : undefined}
              className="absolute inset-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              onClick={() => onSelect(conv)}
            />
            <Avatar className="h-11 w-11 shrink-0">
              <AvatarImage src={conv.avatarUrl || undefined} alt="" />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold truncate">
                  {name}
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
                    {[...group.channels].map((type) => (
                      <ChannelIcon key={type} type={type} className="h-3.5 w-3.5 shrink-0" />
                    ))}
                    <span className="truncate">{getConversationPhone(conv)}</span>
                  </span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {statusLabels[conv.status] || conv.status}
                  </Badge>
                  {group.unreadCount > 0 && <Badge>{group.unreadCount}</Badge>}
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
                        className="relative h-6 px-2 text-[10px] gap-1"
                        onClick={() => onAddLead(conv)}
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
          );
        })}
      </div>
    </div>
  );
}
