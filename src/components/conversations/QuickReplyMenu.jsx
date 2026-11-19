import React, { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { quickRepliesQuery } from "@/api/apiClient";
import { Textarea } from "@/components/ui/textarea";

export default function QuickReplyMenu({ companyId, value, onChange, onSend }) {
  const listId = useId();
  const activeOptionRef = useRef(null);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const open = Boolean(companyId && focused && !dismissed && value.startsWith("/"));
  const { data: replies = [], isPending, isError } = useQuery({
    ...quickRepliesQuery(companyId),
    enabled: open,
  });
  const search = value.slice(1).toLowerCase();
  const matches = open ? replies.filter(({ shortcut }) => shortcut.startsWith(search)) : [];
  const activeIndex = Math.min(selectedIndex, matches.length - 1);
  const activeReply = matches[activeIndex];
  const optionId = (id) => `${listId}-${id}`;

  useEffect(() => {
    activeOptionRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeReply?.id]);

  function selectReply(reply) {
    setDismissed(true);
    onChange(reply.content);
  }

  function handleKeyDown(event) {
    if (event.nativeEvent.isComposing) return;
    if (open && event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setDismissed(true);
    } else if (open && matches.length && ["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setSelectedIndex((activeIndex + direction + matches.length) % matches.length);
    } else if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!open) onSend();
      else if (activeReply) selectReply(activeReply);
    }
  }

  return (
    <div className="relative min-w-0 flex-1">
      {open && (
        <div className="absolute inset-x-0 bottom-full z-20 mb-2 rounded-lg border border-border bg-popover text-popover-foreground shadow-md">
          {matches.length ? (
            <ul id={listId} role="listbox" aria-label="Respostas rápidas" className="max-h-56 overflow-y-auto p-1">
              {matches.map((reply) => {
                const selected = reply.id === activeReply?.id;
                return (
                  <li
                    key={reply.id}
                    id={optionId(reply.id)}
                    ref={selected ? activeOptionRef : null}
                    role="option"
                    aria-selected={selected}
                    className={`cursor-pointer rounded-md px-3 py-2 hover:bg-accent ${selected ? "bg-accent" : ""}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectReply(reply)}
                  >
                    <p className="truncate text-sm font-medium">/{reply.shortcut}</p>
                    <p className="truncate text-xs text-muted-foreground">{reply.content}</p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p role="status" className="px-3 py-2 text-sm text-muted-foreground">
              {isPending
                ? "Carregando respostas rápidas…"
                : isError
                  ? "Não foi possível carregar as respostas rápidas."
                  : replies.length
                    ? "Nenhum atalho encontrado."
                    : "Cadastre respostas rápidas em Configurações"}
            </p>
          )}
        </div>
      )}
      <Textarea
        value={value}
        rows={Math.min(4, value.split("\n").length)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(event) => {
          setDismissed(false);
          setSelectedIndex(0);
          onChange(event.target.value);
        }}
        onKeyDown={handleKeyDown}
        aria-label="Mensagem"
        aria-controls={activeReply ? listId : undefined}
        aria-activedescendant={activeReply ? optionId(activeReply.id) : undefined}
        placeholder="Digite sua mensagem..."
        className="min-h-9 resize-none bg-muted/50 py-1.5"
      />
    </div>
  );
}
