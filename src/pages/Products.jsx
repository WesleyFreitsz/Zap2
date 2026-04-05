import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productsApi } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Package } from "lucide-react";
import ProductCard from "@/components/products/ProductCard";
import ProductFormModal from "@/components/products/ProductFormModal";
import { useAuth } from "@/lib/AuthContext";

export default function Products() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const qc = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => productsApi.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => productsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });

  const filtered = products.filter(
    (p) =>
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.code?.toLowerCase().includes(search.toLowerCase()) ||
      p.category?.toLowerCase().includes(search.toLowerCase()),
  );

  const activeCount = products.filter((p) => p.active).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Produtos</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {activeCount} produto{activeCount !== 1 ? "s" : ""} ativo
            {activeCount !== 1 ? "s" : ""}
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => {
              setEditing(null);
              setShowModal(true);
            }}
            className="gap-2"
          >
            <Plus className="w-4 h-4" /> Novo Produto
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, código ou categoria..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-64 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium text-muted-foreground">
            Nenhum produto encontrado
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onEdit={
                isAdmin
                  ? () => {
                      setEditing(product);
                      setShowModal(true);
                    }
                  : undefined
              }
              onDelete={
                isAdmin ? () => deleteMutation.mutate(product.id) : undefined
              }
            />
          ))}
        </div>
      )}

      {showModal && (
        <ProductFormModal
          product={editing}
          onClose={() => {
            setShowModal(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
