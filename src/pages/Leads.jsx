import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { leadsApi, usersApi, conversationsApi, tagsApi } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Flame,
  Snowflake,
  ThermometerSun,
  CheckCircle2,
  MessageSquare,
  UserCheck,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../lib/AuthContext";
import { digitsOnly, formatPhoneInput, sanitizePersonName } from "@/lib/utils";

const getTagColor = (category) => {
  const colors = {
    hot: "bg-red-100 text-red-700 border-red-200",
    warm: "bg-amber-100 text-amber-700 border-amber-200",
    cold: "bg-blue-100 text-blue-700 border-blue-200",
    custom: "bg-purple-100 text-purple-700 border-purple-200",
  };
  return colors[category] || colors.custom;
};

const tempColors = {
  HOT: "bg-red-100 text-red-700 border-red-200",
  WARM: "bg-orange-100 text-orange-700 border-orange-200",
  COLD: "bg-blue-100 text-blue-700 border-blue-200",
  CONVERTED: "bg-green-100 text-green-700 border-green-200",
};

const tempIcons = {
  HOT: Flame,
  WARM: ThermometerSun,
  COLD: Snowflake,
  CONVERTED: CheckCircle2,
};

const tempLabels = {
  HOT: "Quente",
  WARM: "Morno",
  COLD: "Frio",
  CONVERTED: "Convertido",
};

const statusLabels = {
  NEW: "Novo",
  IN_ATTENDANCE: "Em Atendimento",
  WAITING: "Aguardando",
  FOLLOW_UP: "Follow-up",
  CLOSED: "Fechado",
  LOST: "Perdido",
};

export default function Leads() {
  const [search, setSearch] = useState("");
  const [tempFilter, setTempFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showTagModal, setShowTagModal] = useState(false);
  const [selectedLeadForTags, setSelectedLeadForTags] = useState(null);
  const [leadTags, setLeadTags] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [editing, setEditing] = useState(null);

  const qc = useQueryClient();
  const { user } = useAuth();

  const params = {};
  if (tempFilter !== "ALL") params.temperature = tempFilter;
  if (statusFilter !== "ALL") params.status = statusFilter;
  if (search) params.search = search;

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads", params],
    queryFn: () => leadsApi.list(params),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: () => usersApi.list(),
    enabled: showTransferModal,
  });

  const { data: tags = [] } = useQuery({
    queryKey: ["tags"],
    queryFn: () => tagsApi.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => leadsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead removido");
    },
  });

  const startConversationMutation = useMutation({
    mutationFn: (lead) =>
      conversationsApi.create({
        contactName: lead.name,
        contactPhone: lead.phone,
        companyId: user.companyId,
        leadId: lead.id,
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Conversa iniciada com sucesso");

      if (data?.data?.id) {
        window.location.href = `/conversations/${data.data.id}`;
      }
    },
  });

  const isAdmin =
    user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="my-3 mx-4">
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie seus leads e oportunidades
          </p>
        </div>

        <Button
          className="my-3 mx-4"
          onClick={() => {
            setEditing(null);
            setShowModal(true);
          }}
        >
          <Plus className="w-4 h-4" /> Novo Lead
        </Button>
      </div>

      {/* LISTA */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {leads.map((lead) => {
            const TempIcon = tempIcons[lead.temperature] || Snowflake;

            return (
              <Card
                key={lead.id}
                className="p-4 hover:shadow-lg transition-shadow"
              >
                <p className="font-semibold">{lead.name}</p>

                <p className="text-xs text-muted-foreground">
                  {formatPhoneInput(lead.phone)}
                </p>

                <Badge className={tempColors[lead.temperature]}>
                  <TempIcon className="w-3 h-3" />
                  {tempLabels[lead.temperature]}
                </Badge>

                {/* TAGS */}
                <div className="flex gap-1 mt-2 flex-wrap">
                  {lead.tags?.map((tag) => (
                    <span
                      key={tag.id}
                      className={`px-2 py-0.5 rounded-full text-[10px] ${getTagColor(
                        tag.category
                      )}`}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>

                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    onClick={() =>
                      startConversationMutation.mutate(lead)
                    }
                  >
                    <MessageSquare className="w-3 h-3 mr-1" />
                    Conversar
                  </Button>

                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditing(lead);
                        setShowModal(true);
                      }}
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(lead.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}