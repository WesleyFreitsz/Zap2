import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, LifeBuoy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { zendeskApi } from "@/api/apiClient";
import { Button } from "@/components/ui/button";

export default function ZendeskTicketButton({ conversation }) {
  const queryClient = useQueryClient();
  const config = useQuery({ queryKey: ["zendesk", "config"], queryFn: zendeskApi.config, staleTime: 60_000 });
  const createTicket = useMutation({
    mutationFn: () => zendeskApi.createTicket(conversation.id),
    onSuccess: ({ ticketUrl }) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      window.open(ticketUrl, "_blank", "noopener");
      toast.success("Ticket aberto no Zendesk. As respostas do agente chegam por aqui.");
    },
    onError: (error) => toast.error(error.response?.data?.message || "Não foi possível abrir o ticket"),
  });

  if (!config.data?.connected) return null;

  if (conversation.zendeskTicketId) {
    return (
      <Button asChild variant="outline" size="sm" className="h-7 gap-1 text-xs">
        <a
          href={`https://${config.data.subdomain}.zendesk.com/agent/tickets/${conversation.zendeskTicketId}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink className="h-3 w-3" /> Ticket #{conversation.zendeskTicketId}
        </a>
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 gap-1 text-xs"
      disabled={createTicket.isPending}
      onClick={() => createTicket.mutate()}
    >
      {createTicket.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <LifeBuoy className="h-3 w-3" />}
      Enviar ao Zendesk
    </Button>
  );
}
