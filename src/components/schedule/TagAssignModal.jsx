import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { conversationsApi } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { X, Check, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

const categoryColors = {
  hot: "bg-red-100 text-red-700 border-red-300 hover:bg-red-200",
  warm: "bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200",
  cold: "bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200",
  custom: "bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-200",
};

export default function TagAssignModal({ contact, allTags, onClose }) {
  const qc = useQueryClient();
  const [selectedTags, setSelectedTags] = useState(contact.tags || []);
  const [notes, setNotes] = useState(contact.notes || "");

  const updateMutation = useMutation({
    mutationFn: (data) => conversationsApi.update(contact.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      onClose();
    },
  });

  const toggleTag = (tagId) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId],
    );
  };

  const handleSave = () => {
    updateMutation.mutate({ tags: selectedTags, notes });
  };

  const groupedTags = allTags.reduce((acc, tag) => {
    const cat = tag.category || "custom";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(tag);
    return acc;
  }, {});

  const catLabels = {
    hot: "🔥 Hot",
    warm: "🌡️ Warm",
    cold: "❄️ Cold",
    custom: "🏷️ Personalizadas",
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary text-sm">
              {contact.name?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <h2 className="font-bold">{contact.name}</h2>
              <p className="text-xs text-muted-foreground">{contact.phone}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <Label className="mb-2 block">Tags do contato</Label>
            {allTags.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Crie tags na aba "Gerenciar Tags" primeiro.
              </p>
            ) : (
              Object.entries(groupedTags).map(([cat, tags]) => (
                <div key={cat} className="mb-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">
                    {catLabels[cat]}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => {
                      const active = selectedTags.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleTag(tag.id)}
                          className={cn(
                            "text-xs px-2.5 py-1 rounded-full border font-medium transition-all flex items-center gap-1",
                            categoryColors[tag.category || "custom"],
                            active && "ring-2 ring-offset-1 ring-primary",
                          )}
                        >
                          {active && <Check className="w-2.5 h-2.5" />}
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-1">
            <Label>Notas internas</Label>
            <Textarea
              placeholder="Anotações sobre este contato..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="gap-2"
            >
              <Check className="w-4 h-4" />
              {updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
