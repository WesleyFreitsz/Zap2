import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Copy, Pencil, Reply, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
const EDIT_WINDOW_MS = 15 * 60 * 1000;

const itemClass =
  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-foreground hover:bg-accent focus-visible:bg-accent focus-visible:outline-none";

export default function MessageMenu({ message, onReply, onReact, onCopy, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);

  const isOwn = message.sender === "USER";
  const canEdit = isOwn && Date.now() - Date.parse(message.createdAt) <= EDIT_WINDOW_MS;

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector("[role=menuitem]")?.focus();
    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const run = (action) => () => {
    setOpen(false);
    action();
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    if (!(event.key in keys)) return;
    event.preventDefault();
    const items = [...menuRef.current.querySelectorAll("[role=menuitem]")];
    const next = (items.indexOf(document.activeElement) + keys[event.key] + items.length) % items.length;
    items[next].focus();
  };

  return (
    <div ref={rootRef} className="absolute right-1 top-1 z-10">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Ações da mensagem"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          open
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
        )}
      >
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Ações da mensagem"
          onKeyDown={handleKeyDown}
          className={cn(
            "absolute top-6 min-w-44 rounded-md border border-border bg-popover p-1 shadow-md",
            message.sender === "CLIENT" ? "left-0" : "right-0",
          )}
        >
          <button type="button" role="menuitem" tabIndex={-1} className={itemClass} onClick={run(onReply)}>
            <Reply className="h-4 w-4" aria-hidden="true" />
            Responder
          </button>
          {message.sender === "CLIENT" && (
            <div role="group" aria-label="Reagir" className="flex justify-between px-1 py-1">
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  aria-label={`Reagir com ${emoji}`}
                  className="rounded-sm px-1 text-base hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                  onClick={run(() => onReact(emoji))}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          {message.content && (
            <button type="button" role="menuitem" tabIndex={-1} className={itemClass} onClick={run(onCopy)}>
              <Copy className="h-4 w-4" aria-hidden="true" />
              Copiar
            </button>
          )}
          {canEdit && (
            <button type="button" role="menuitem" tabIndex={-1} className={itemClass} onClick={run(onEdit)}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Editar
            </button>
          )}
          {isOwn && (
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={cn(itemClass, "text-destructive")}
              onClick={run(onDelete)}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Apagar para todos
            </button>
          )}
        </div>
      )}
    </div>
  );
}
