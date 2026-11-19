import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { productsApi } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { X } from "lucide-react";
import { toast } from "sonner";

export default function ProductFormModal({ product, onClose }) {
  const qc = useQueryClient();
  const isEdit = !!product;
  const initialImage = product?.imageUrl || "";

  const [form, setForm] = useState({
    name: product?.name || "",
    code: product?.code || "",
    description: product?.description || "",
    price: product?.price || "",
    promotionalPrice: product?.promotionalPrice || "",
    category: product?.category || "",
    imageUrl: initialImage,
    imageFile: null,
    imagePreview: initialImage,
    stock: product?.stock ?? 0,
    active: product?.active ?? true,
    whatsappMessage: product?.whatsappMessage || "",
  });

  const saveMutation = useMutation({
    mutationFn: (data) =>
      isEdit
        ? productsApi.update(product.id, buildPayload(data))
        : productsApi.create(buildPayload(data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      onClose();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Erro ao salvar produto");
    },
  });

  const f = (val) => setForm((prev) => ({ ...prev, ...val }));

  const buildPayload = (data) => {
    const payload = new FormData();
    payload.append("name", data.name);
    if (data.code) payload.append("code", data.code);
    if (data.description) payload.append("description", data.description);
    payload.append("price", String(data.price));
    if (data.promotionalPrice !== "") {
      payload.append("promotionalPrice", String(data.promotionalPrice));
    }
    if (data.category) payload.append("category", data.category);
    if (data.imageUrl) payload.append("imageUrl", data.imageUrl);
    if (data.imageFile) payload.append("imageFile", data.imageFile);
    payload.append("stock", String(data.stock ?? 0));
    payload.append("active", String(Boolean(data.active)));
    if (data.whatsappMessage) {
      payload.append("whatsappMessage", data.whatsappMessage);
    }
    return payload;
  };

  // Auto-generate WhatsApp message when name/price changes
  const generateMessage = () => {
    const price = form.promotionalPrice || form.price;
    const priceStr = price
      ? `R$ ${parseFloat(price).toFixed(2).replace(".", ",")}`
      : "";
    const msg = `🛍️ *${form.name}*\n${form.description ? form.description + "\n" : ""}${form.code ? `Cód: #${form.code}\n` : ""}💰 ${priceStr}\n\nDeseja fazer seu pedido? 😊`;
    f({ whatsappMessage: msg });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-card z-10">
          <h2 className="font-bold text-lg">
            {isEdit ? "Editar Produto" : "Novo Produto"}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <Label>Nome do Produto *</Label>
              <Input
                placeholder="Ex: Kit Premium de Acessórios"
                value={form.name}
                onChange={(e) => f({ name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Código / SKU</Label>
              <Input
                placeholder="Ex: KIT-001"
                value={form.code}
                onChange={(e) => f({ code: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Categoria</Label>
              <Input
                placeholder="Ex: Eletrônicos"
                value={form.category}
                onChange={(e) => f({ category: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Preço (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={form.price}
                onChange={(e) => f({ price: parseFloat(e.target.value) || "" })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Preço Promocional (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={form.promotionalPrice}
                onChange={(e) =>
                  f({ promotionalPrice: parseFloat(e.target.value) || "" })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Estoque</Label>
              <Input
                type="number"
                min="0"
                value={form.stock}
                onChange={(e) => f({ stock: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-1">
              <Label>URL da Imagem</Label>
              <Input
                placeholder="https://..."
                value={form.imageUrl}
                onChange={(e) =>
                  f({ imageUrl: e.target.value, imagePreview: e.target.value })
                }
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Upload da Imagem</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  f({
                    imageFile: file,
                    imagePreview: file
                      ? URL.createObjectURL(file)
                      : form.imageUrl,
                  });
                }}
              />
              {form.imagePreview && (
                <div className="mt-2 rounded-lg border overflow-hidden bg-muted w-28 h-28">
                  <img
                    src={form.imagePreview}
                    alt="Pré-visualização"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label>Descrição</Label>
            <Textarea
              placeholder="Descrição do produto..."
              value={form.description}
              onChange={(e) => f({ description: e.target.value })}
              className="min-h-[70px]"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Mensagem WhatsApp</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={generateMessage}
              >
                ✨ Gerar automático
              </Button>
            </div>
            <Textarea
              placeholder="Mensagem que será enviada no WhatsApp ao compartilhar o produto..."
              value={form.whatsappMessage}
              onChange={(e) => f({ whatsappMessage: e.target.value })}
              className="min-h-[90px] text-sm"
            />
          </div>

          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Switch
              checked={form.active}
              onCheckedChange={(v) => f({ active: v })}
            />
            <div>
              <p className="text-sm font-medium">Produto Ativo</p>
              <p className="text-xs text-muted-foreground">
                Aparece nas buscas e conversas
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={!form.name || !form.price || saveMutation.isPending}
            >
              {saveMutation.isPending
                ? "Salvando..."
                : isEdit
                  ? "Salvar Alterações"
                  : "Cadastrar Produto"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
