import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link2, Loader2 } from "lucide-react";
import { conversationsApi, leadsApi } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export default function LinkLeadDialog({ conversationId }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const term = search.trim();

  const { data: leads = [], isFetching } = useQuery({
    queryKey: ["leads", { search: term }],
    queryFn: () => leadsApi.list(term ? { search: term } : {}),
    enabled: open,
  });

  const linkMutation = useMutation({
    mutationFn: (leadId) => conversationsApi.update(conversationId, { leadId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      setOpen(false);
      toast.success("Conversa vinculada ao lead");
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Não foi possível vincular a conversa");
    },
  });

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1 text-xs"
        onClick={() => setOpen(true)}
        title="Juntar com um lead de outro canal"
      >
        <Link2 className="h-3.5 w-3.5" />
        Vincular a lead
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular a um lead existente</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Buscar lead por nome ou telefone"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="max-h-72 overflow-y-auto space-y-1">
            {isFetching && <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />}
            {!isFetching && leads.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">Nenhum lead encontrado</p>
            )}
            {leads.map((lead) => (
              <button
                key={lead.id}
                type="button"
                disabled={linkMutation.isPending}
                onClick={() => linkMutation.mutate(lead.id)}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
              >
                <span className="truncate font-medium">{lead.name}</span>
                {lead.phone && <span className="text-xs text-muted-foreground">{lead.phone}</span>}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
