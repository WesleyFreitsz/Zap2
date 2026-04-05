import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Package, Tag } from "lucide-react";

export default function ProductCard({ product, onEdit, onDelete }) {
  const hasPromo =
    product.promotional_price && product.promotional_price < product.price;

  return (
    <Card
      className={`overflow-hidden hover:shadow-lg transition-shadow ${!product.active ? "opacity-60" : ""}`}
    >
      {/* Image */}
      <div className="h-36 bg-muted flex items-center justify-center relative overflow-hidden">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <Package className="w-10 h-10 text-muted-foreground" />
        )}
        {!product.active && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
            <Badge variant="outline" className="bg-background">
              Inativo
            </Badge>
          </div>
        )}
        {hasPromo && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-destructive text-destructive-foreground text-[10px]">
              PROMO
            </Badge>
          </div>
        )}
      </div>

      <div className="p-3 space-y-2">
        <div>
          <p className="font-semibold text-sm leading-tight line-clamp-2">
            {product.name}
          </p>
          {product.code && (
            <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
              <Tag className="w-2.5 h-2.5" /> #{product.code}
            </p>
          )}
          {product.category && (
            <Badge variant="outline" className="text-[10px] mt-1 px-1.5 py-0">
              {product.category}
            </Badge>
          )}
        </div>

        <div className="flex items-baseline gap-2">
          {hasPromo ? (
            <>
              <span className="text-base font-bold text-primary">
                R$ {product.promotional_price?.toFixed(2).replace(".", ",")}
              </span>
              <span className="text-xs text-muted-foreground line-through">
                R$ {product.price?.toFixed(2).replace(".", ",")}
              </span>
            </>
          ) : (
            <span className="text-base font-bold">
              R$ {product.price?.toFixed(2).replace(".", ",")}
            </span>
          )}
        </div>

        {product.stock !== undefined && (
          <p className="text-[10px] text-muted-foreground">
            Estoque: {product.stock} un.
          </p>
        )}

        {(onEdit || onDelete) && (
          <div className="flex gap-1.5 pt-1">
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={onEdit}
              >
                <Pencil className="w-3 h-3 mr-1" /> Editar
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                onClick={onDelete}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
