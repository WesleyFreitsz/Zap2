import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productsApi } from "@/api/apiClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Search, Package, Send, Tag } from "lucide-react";
import { toast } from "sonner";

export default function SendProductModal({ conversationId, onClose }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [customMessage, setCustomMessage] = useState("");

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => productsApi.list(),
  });

  const sendMutation = useMutation({
    mutationFn: async (message) => {
      await productsApi.sendToChat({
        conversationId,
        productId: selected.id,
        customMessage: message,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      onClose();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Erro ao enviar produto");
    },
  });

  const activeProducts = products.filter((p) => p.active);
  const filtered = activeProducts.filter(
    (p) =>
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.code?.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSelect = (product) => {
    setSelected(product);
    const price = product.promotionalPrice || product.price;
    const priceStr = `R$ ${parseFloat(price).toFixed(2).replace(".", ",")}`;
    setCustomMessage(
      product.whatsappMessage ||
        `🛍️ *${product.name}*\n${product.description ? product.description + "\n" : ""}${product.code ? `Cód: #${product.code}\n` : ""}💰 ${priceStr}\n\nDeseja fazer seu pedido? 😊`,
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-bold">Enviar Produto</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Products grid */}
          <div className="border rounded-xl overflow-hidden max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-8 text-center">
                <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nenhum produto encontrado
                </p>
              </div>
            ) : (
              filtered.map((product) => {
                const hasPromo =
                  product.promotionalPrice &&
                  product.promotionalPrice < product.price;
                const price = hasPromo
                  ? product.promotionalPrice
                  : product.price;
                return (
                  <div
                    key={product.id}
                    onClick={() => handleSelect(product)}
                    className={`flex items-center gap-3 p-3 cursor-pointer transition-colors border-b last:border-0 hover:bg-muted ${selected?.id === product.id ? "bg-accent border-l-2 border-l-primary" : ""}`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                      {product.imageUrl || product.image ? (
                        <img
                          src={product.imageUrl || product.image}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {product.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {product.code && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Tag className="w-2.5 h-2.5" />#{product.code}
                          </span>
                        )}
                        <span className="text-xs font-bold text-primary">
                          R$ {parseFloat(price).toFixed(2).replace(".", ",")}
                        </span>
                        {hasPromo && (
                          <Badge className="text-[10px] px-1 py-0 bg-destructive">
                            PROMO
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Message preview */}
          {selected && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Mensagem a enviar
              </p>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="w-full text-sm border rounded-xl p-3 min-h-[110px] bg-accent/30 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              disabled={
                !selected || !customMessage.trim() || sendMutation.isPending
              }
              onClick={() => sendMutation.mutate(customMessage)}
              className="gap-2"
            >
              <Send className="w-4 h-4" />
              {sendMutation.isPending ? "Enviando..." : "Enviar Produto"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
