import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Tag } from "lucide-react";
import { toast } from "sonner";
import { tagsApi } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function TagChip({ tag }) {
  return (
    <span
      className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium text-white"
      style={{ backgroundColor: tag.color }}
    >
      {tag.name}
    </span>
  );
}

export default function ConversationTags({ conversationId }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const queryKey = ["conversation-tags", conversationId];

  const { data: assigned = [] } = useQuery({
    queryKey,
    queryFn: () => tagsApi.forConversation(conversationId),
  });

  const { data: allTags = [], isLoading: loadingTags } = useQuery({
    queryKey: ["contact_tags"],
    queryFn: () => tagsApi.list(),
    enabled: open,
  });

  const assignedIds = new Set(assigned.map((item) => item.tagId));

  const toggleMutation = useMutation({
    mutationFn: ({ tagId, active }) =>
      active
        ? tagsApi.unassign(conversationId, tagId)
        : tagsApi.assign(conversationId, tagId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (error) => {
      toast.error(error.response?.data?.message || "Erro ao atualizar tags");
    },
  });

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {assigned.map(({ tag }) => (
        <TagChip key={tag.id} tag={tag} />
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 px-2 text-xs"
        onClick={() => setOpen(true)}
      >
        <Tag className="w-3.5 h-3.5" />
        Tags
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Tags da conversa</DialogTitle>
            <DialogDescription>
              Clique para marcar ou desmarcar. Crie tags novas em Agenda → Gerenciar Tags.
            </DialogDescription>
          </DialogHeader>
          {loadingTags ? (
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" />
          ) : allTags.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma tag criada ainda.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {allTags.map((tag) => {
                const active = assignedIds.has(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    disabled={toggleMutation.isPending}
                    onClick={() => toggleMutation.mutate({ tagId: tag.id, active })}
                    className="flex items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-muted disabled:opacity-60"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </span>
                    {active && <Check className="w-4 h-4 text-primary" />}
                  </button>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
