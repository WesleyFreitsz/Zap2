import React, { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { channelsApi } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const categoryLabels = { MARKETING: "Marketing", UTILITY: "Utilidade" };

export default function TemplatePicker({ channelId, onConfirm, confirmLabel, children }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [values, setValues] = useState({});
  const queryClient = useQueryClient();
  const inputId = useId();
  const queryKey = ["whatsapp-templates", channelId];
  const templates = useQuery({
    queryKey,
    queryFn: () => channelsApi.whatsappTemplates(channelId),
    enabled: open && Boolean(channelId),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  function selectTemplate(template) {
    setSelected(template);
    setValues({});
  }

  const refresh = useMutation({
    mutationFn: () => channelsApi.whatsappTemplates(channelId, true),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
      selectTemplate(null);
    },
  });
  const confirm = useMutation({
    mutationFn: async (data) => onConfirm(data),
    onSuccess: () => setOpen(false),
    onError: (error) => {
      toast.error(error.response?.data?.message || "Não foi possível usar o template");
    },
  });

  const template = templates.data?.find(
    ({ name, language }) => name === selected?.name && language === selected?.language,
  );
  const parameters = Object.fromEntries(
    (template?.variables || []).map((variable) => [
      variable,
      Object.hasOwn(values, variable) ? values[variable].trim() : "",
    ]),
  );
  const preview = template?.body.replace(
    /\{\{([^{}]+)\}\}/g,
    (placeholder, variable) =>
      (Object.hasOwn(parameters, variable.trim()) && parameters[variable.trim()]) || placeholder,
  );
  const busy = refresh.isPending || confirm.isPending;
  const error = refresh.error || templates.error;

  function handleOpenChange(nextOpen) {
    if (busy) return;
    if (nextOpen) {
      selectTemplate(null);
      refresh.reset();
    }
    setOpen(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pr-6">
          <DialogTitle>Templates do WhatsApp</DialogTitle>
          <DialogDescription>Selecione um template aprovado para esta conversa.</DialogDescription>
        </DialogHeader>

        <Button
          type="button"
          variant="outline"
          className="justify-self-start"
          disabled={!channelId || templates.isFetching || busy}
          onClick={() => refresh.mutate()}
        >
          Atualizar lista
        </Button>

        {(templates.isFetching || refresh.isPending) && (
          <p role="status" className="text-sm text-muted-foreground">Carregando templates…</p>
        )}
        {(!channelId || error) && (
          <p role="alert" className="text-sm text-destructive">
            {channelId
              ? error.response?.data?.message || "Não foi possível carregar os templates"
              : "Canal sem suporte a templates"}
          </p>
        )}
        {!error && !templates.isFetching && !refresh.isPending && templates.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum template aprovado. Crie no WhatsApp Manager da Meta.
          </p>
        )}

        {!!templates.data?.length && (
          <ul aria-label="Templates disponíveis" className="max-h-44 space-y-1 overflow-y-auto">
            {templates.data.map((item) => (
              <li key={JSON.stringify([item.name, item.language])}>
                <button
                  type="button"
                  aria-pressed={item === template}
                  disabled={busy}
                  className="w-full rounded-lg px-3 py-2 text-left hover:bg-muted aria-pressed:bg-accent"
                  onClick={() => selectTemplate(item)}
                >
                  <span className="block break-words text-sm font-medium">{item.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {categoryLabels[item.category] || item.category} · {item.language}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {template && (
          <div className="min-w-0 space-y-3">
            {template.variables.map((variable) => (
              <div key={variable} className="space-y-1">
                <Label htmlFor={`${inputId}-${variable}`}>{`{{${variable}}}`}</Label>
                <Input
                  id={`${inputId}-${variable}`}
                  value={Object.hasOwn(values, variable) ? values[variable] : ""}
                  onChange={(event) => setValues({ ...values, [variable]: event.target.value })}
                  disabled={busy}
                />
              </div>
            ))}
            <div role="group" aria-label="Prévia da mensagem" className="ml-auto w-fit max-w-full space-y-2 break-words rounded-2xl rounded-tr-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
              {template.header && <p className="whitespace-pre-wrap font-semibold">{template.header}</p>}
              <p className="whitespace-pre-wrap">{preview}</p>
              {template.footer && <p className="whitespace-pre-wrap text-xs opacity-80">{template.footer}</p>}
              {template.buttons.map((button, index) => (
                <p key={index} className="border-t border-current pt-2 text-center font-medium">{button}</p>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            disabled={!template || busy || templates.isFetching || Object.values(parameters).some((value) => !value)}
            onClick={() => confirm.mutate({
              templateName: template.name,
              language: template.language,
              parameters,
              preview,
            })}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
