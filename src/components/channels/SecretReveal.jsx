import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function copyText(text) {
  Promise.resolve()
    .then(() => navigator.clipboard.writeText(text))
    .then(
      () => toast.success("Copiado"),
      () => toast.error("Não foi possível copiar. Selecione o texto e copie manualmente."),
    );
}

export function CopyField({ value }) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
      <code className="min-w-0 flex-1 break-all text-xs">{value}</code>
      <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" aria-label="Copiar" onClick={() => copyText(value)}>
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export default function SecretReveal({ secret }) {
  if (!secret) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
        Copie agora: por segurança, este valor não será exibido de novo.
      </p>
      <CopyField value={secret} />
    </div>
  );
}
