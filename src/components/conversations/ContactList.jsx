import React from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

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
}) {
  const filtered = conversations.filter(
    (c) =>
      c.contactName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.contactPhone?.includes(searchTerm),
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
                {conv.contactName?.charAt(0)?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold truncate">
                  {conv.contactName}
                </p>
                {conv.updatedAt && (
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {format(new Date(conv.updatedAt), "HH:mm")}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-muted-foreground truncate">
                  {conv.contactPhone}
                </span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {statusLabels[conv.status] || conv.status}
                </Badge>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
