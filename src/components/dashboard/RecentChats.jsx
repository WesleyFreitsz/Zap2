import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";

const statusColors = {
  OPEN: "bg-primary/15 text-primary border-primary/30",
  PENDING: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  BOT: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  CLOSED: "bg-muted text-muted-foreground border-border",
  TRANSFERRED: "bg-purple-500/15 text-purple-600 border-purple-500/30",
};

const statusLabels = {
  OPEN: "Aberta",
  PENDING: "Pendente",
  BOT: "Bot",
  CLOSED: "Fechada",
  TRANSFERRED: "Transferida",
};

export default function RecentChats({ conversations = [] }) {
  const recent = conversations.slice(0, 6);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Conversas Recentes</CardTitle>
          <Link
            to="/conversations"
            className="text-sm text-primary hover:underline"
          >
            Ver todas
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {recent.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma conversa ainda
          </p>
        )}
        {recent.map((conv) => (
          <Link key={conv.id} to={`/conversations?contact=${conv.id}`}>
            <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                  {conv.contactName?.charAt(0)?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold truncate">
                    {conv.contactName}
                  </p>
                  {conv.updatedAt && (
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {format(new Date(conv.updatedAt), "HH:mm", {
                        locale: ptBR,
                      })}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-xs text-muted-foreground truncate">
                    {conv.contactPhone}
                  </p>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 ${statusColors[conv.status] || statusColors.OPEN}`}
                  >
                    {statusLabels[conv.status] || conv.status}
                  </Badge>
                </div>
              </div>
              {conv.unreadCount > 0 && (
                <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
                  {conv.unreadCount}
                </div>
              )}
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
