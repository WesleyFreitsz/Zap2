import React from "react";
import { cn } from "@/lib/utils";
import { Bot, User, Check, CheckCheck } from "lucide-react";
import { format } from "date-fns";

export default function ChatBubble({ message }) {
  const isContact = message.sender === "CLIENT";
  const isBot = message.sender === "SYSTEM";

  const statusIcons = {
    sent: <Check className="w-3 h-3" />,
    delivered: <CheckCheck className="w-3 h-3" />,
    read: <CheckCheck className="w-3 h-3 text-blue-500" />,
  };

  return (
    <div
      className={cn(
        "flex gap-2 mb-3",
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
          "max-w-[70%] rounded-2xl px-4 py-2.5 relative",
          isContact
            ? "bg-card border border-border rounded-tl-md"
            : isBot
              ? "bg-accent text-accent-foreground rounded-tr-md"
              : "bg-primary text-primary-foreground rounded-tr-md",
        )}
      >
        {isBot && (
          <div className="flex items-center gap-1 mb-1">
            <Bot className="w-3 h-3" />
            <span className="text-[10px] font-semibold opacity-70">IA</span>
          </div>
        )}
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {message.content}
        </p>
        <div
          className={cn(
            "flex items-center gap-1 mt-1 justify-end",
            isContact ? "text-muted-foreground" : "opacity-60",
          )}
        >
          <span className="text-[10px]">
            {message.createdAt && format(new Date(message.createdAt), "HH:mm")}
          </span>
          {!isContact && statusIcons[message.status]}
        </div>
      </div>
      {!isContact && isBot && (
        <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center shrink-0 mt-1">
          <Bot className="w-3.5 h-3.5 text-primary" />
        </div>
      )}
    </div>
  );
}
