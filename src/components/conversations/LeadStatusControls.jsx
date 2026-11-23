import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { leadsApi } from "@/api/apiClient";
import { statusLabels, tempLabels } from "@/components/leads/lead-labels";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function LeadSelect({ label, value, options, disabled, onChange }) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger aria-label={label} className="h-7 w-auto gap-1 px-2 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(options).map(([key, text]) => (
          <SelectItem key={key} value={key}>{text}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function LeadStatusControls({ lead }) {
  const update = useMutation({
    mutationFn: (data) => leadsApi.update(lead.id, data),
    onError: (error) => toast.error(error.response?.data?.message || "Não foi possível atualizar o lead"),
  });

  return (
    <div className="flex items-center gap-1">
      <LeadSelect
        label="Temperatura do lead"
        value={lead.temperature}
        options={tempLabels}
        disabled={update.isPending}
        onChange={(temperature) => update.mutate({ temperature })}
      />
      <LeadSelect
        label="Status do lead"
        value={lead.status}
        options={statusLabels}
        disabled={update.isPending}
        onChange={(status) => update.mutate({ status })}
      />
    </div>
  );
}
