import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { billingApi, plansApi } from "@/api/apiClient";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CreditCard,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  getDisplayPlans,
  getPlanBySlug,
  getPlanFeatureList,
  formatCurrency,
} from "@/lib/planUtils";
import { formatCpfCnpj, sanitizePersonName } from "@/lib/utils";

const statusColors = {
  ACTIVE: "bg-green-100 text-green-700 border-green-200",
  OVERDUE: "bg-red-100 text-red-700 border-red-200",
  CANCELLED: "bg-gray-100 text-gray-500 border-gray-200",
};

const statusLabels = {
  ACTIVE: "Ativa",
  OVERDUE: "Inadimplente",
  CANCELLED: "Cancelada",
};

const invoiceStatusColors = {
  PENDING: "bg-yellow-100 text-yellow-700",
  RECEIVED: "bg-green-100 text-green-700",
  OVERDUE: "bg-red-100 text-red-700",
  REFUNDED: "bg-gray-100 text-gray-500",
};

const invoiceStatusLabels = {
  PENDING: "Pendente",
  RECEIVED: "Pago",
  OVERDUE: "Atrasado",
  REFUNDED: "Estornado",
};

export default function Billing() {
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);

  const { data: subscription, isLoading: loadingSub } = useQuery({
    queryKey: ["subscription"],
    queryFn: () => billingApi.getSubscription(),
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["plans", "billing"],
    queryFn: () => plansApi.list({ active: true }),
  });

  const { data: invoices = [], isLoading: loadingInv } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => billingApi.getInvoices(),
  });

  const displayPlans = useMemo(() => getDisplayPlans(plans), [plans]);
  const currentPlan = useMemo(
    () => getPlanBySlug(displayPlans, subscription?.plan),
    [displayPlans, subscription?.plan],
  );

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Faturamento</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie sua assinatura e faturas
          </p>
        </div>
        {!subscription && (
          <Button onClick={() => setShowSubscribeModal(true)} className="gap-2">
            <CreditCard className="w-4 h-4" /> Assinar Plano
          </Button>
        )}
      </div>

      {/* Subscription Card */}
      {loadingSub ? (
        <div className="h-32 rounded-xl bg-muted animate-pulse" />
      ) : subscription ? (
        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Plano Atual</p>
              <p className="text-2xl font-bold capitalize">
                {currentPlan?.name || subscription.plan}
              </p>
              <p className="text-lg font-semibold text-primary mt-1">
                {formatCurrency(subscription.value)}/mês
              </p>
            </div>
            <Badge
              variant="outline"
              className={statusColors[subscription.status] || ""}
            >
              {statusLabels[subscription.status] || subscription.status}
            </Badge>
          </div>
          {subscription.nextDueDate && (
            <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Proxima cobranca:{" "}
              {new Date(subscription.nextDueDate).toLocaleDateString("pt-BR")}
            </p>
          )}
          {currentPlan && (
            <div className="mt-4 flex flex-wrap gap-2">
              {getPlanFeatureList(currentPlan).map((feature) => (
                <Badge
                  key={feature}
                  variant="secondary"
                  className="text-[10px]"
                >
                  {feature}
                </Badge>
              ))}
            </div>
          )}
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <CreditCard className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium text-muted-foreground">
            Nenhuma assinatura ativa
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Assine um plano para continuar usando a plataforma
          </p>
        </Card>
      )}

      {/* Invoices */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b flex items-center gap-2">
          <FileText className="w-4 h-4" />
          <h3 className="font-semibold">Faturas</h3>
        </div>
        {loadingInv ? (
          <div className="p-6">
            <div className="h-20 bg-muted animate-pulse rounded-lg" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Nenhuma fatura encontrada
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Vencimento</th>
                  <th className="text-left p-3 font-medium">Valor</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Pago em</th>
                  <th className="text-left p-3 font-medium">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-t hover:bg-muted/30">
                    <td className="p-3">
                      {new Date(inv.dueDate).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="p-3 font-medium">
                      R$ {inv.value?.toFixed(2)}
                    </td>
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${invoiceStatusColors[inv.status] || ""}`}
                      >
                        {invoiceStatusLabels[inv.status] || inv.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {inv.paidAt
                        ? new Date(inv.paidAt).toLocaleDateString("pt-BR")
                        : "—"}
                    </td>
                    <td className="p-3">
                      {inv.paymentUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => window.open(inv.paymentUrl, "_blank")}
                        >
                          <ExternalLink className="w-3 h-3" /> Pagar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showSubscribeModal && (
        <SubscribeModal
          plans={displayPlans}
          onClose={() => setShowSubscribeModal(false)}
        />
      )}
    </div>
  );
}

function SubscribeModal({ onClose, plans }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    plan: plans[0]?.slug || "basic",
    customerName: "",
    customerEmail: "",
    cpfCnpj: "",
    billingType: "BOLETO",
  });

  useEffect(() => {
    if (!plans.length) return;
    if (!plans.some((plan) => plan.slug === form.plan)) {
      setForm((prev) => ({ ...prev, plan: plans[0].slug }));
    }
  }, [plans, form.plan]);

  const mutation = useMutation({
    mutationFn: (data) => billingApi.createSubscription(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscription"] });
      toast.success("Assinatura criada com sucesso!");
      onClose();
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Erro ao criar assinatura");
    },
  });

  const selectedPlan = plans.find((p) => p.slug === form.plan);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assinar Plano</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate(form);
          }}
          className="space-y-4"
        >
          <div>
            <Label>Plano</Label>
            <Select
              value={form.plan}
              onValueChange={(v) => setForm({ ...form, plan: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.slug} value={p.slug}>
                    {p.name} — {formatCurrency(p.price)}/mês
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedPlan && (
              <div className="mt-2 rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Mensal: {formatCurrency(selectedPlan.price)} /mês
                </p>
                <p className="text-xs text-muted-foreground">
                  Anual: {formatCurrency(selectedPlan.annualPrice)} /mês
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {getPlanFeatureList(selectedPlan).map((feature) => (
                    <Badge
                      key={feature}
                      variant="secondary"
                      className="text-[10px]"
                    >
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div>
            <Label>Nome Completo *</Label>
            <Input
              value={form.customerName}
              onChange={(e) =>
                setForm({
                  ...form,
                  customerName: sanitizePersonName(e.target.value),
                })
              }
              autoComplete="name"
              required
            />
          </div>
          <div>
            <Label>Email *</Label>
            <Input
              value={form.customerEmail}
              onChange={(e) =>
                setForm({ ...form, customerEmail: e.target.value })
              }
              type="email"
              required
            />
          </div>
          <div>
            <Label>CPF/CNPJ</Label>
            <Input
              value={form.cpfCnpj}
              onChange={(e) =>
                setForm({ ...form, cpfCnpj: formatCpfCnpj(e.target.value) })
              }
              inputMode="numeric"
              maxLength={18}
            />
          </div>
          <div>
            <Label>Forma de Pagamento</Label>
            <Select
              value={form.billingType}
              onValueChange={(v) => setForm({ ...form, billingType: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BOLETO">Boleto</SelectItem>
                <SelectItem value="CREDIT_CARD">Cartao de Credito</SelectItem>
                <SelectItem value="PIX">PIX</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                mutation.isPending || !selectedPlan || !form.customerName.trim()
              }
            >
              {mutation.isPending ? "Processando..." : "Assinar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
