import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  Phone,
  Mail,
  UserCheck,
} from "lucide-react";
import EmployeeFormModal from "./EmployeeFormModal";

const roleColors = {
  EMPLOYEE: "bg-blue-100 text-blue-700 border-blue-200",
  ADMIN: "bg-purple-100 text-purple-700 border-purple-200",
  SUPER_ADMIN: "bg-amber-100 text-amber-700 border-amber-200",
};
const roleLabels = {
  EMPLOYEE: "Funcionário",
  ADMIN: "Administrador",
  SUPER_ADMIN: "Super Admin",
};

export default function EmployeeList() {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const qc = useQueryClient();

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: () => usersApi.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => usersApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, isActive }) => usersApi.update(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });

  if (isLoading)
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-accent px-3 py-1.5 rounded-lg flex items-center gap-2">
            <Users className="w-4 h-4 text-accent-foreground" />
            <span className="text-sm font-medium">
              {employees.filter((e) => e.isActive !== false).length} ativos
            </span>
          </div>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setShowModal(true);
          }}
          className="gap-2"
        >
          <Plus className="w-4 h-4" /> Adicionar Funcionário
        </Button>
      </div>

      {employees.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium text-muted-foreground">
            Nenhum funcionário cadastrado
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map((emp) => {
            const isActive = emp.isActive !== false;
            return (
              <Card
                key={emp.id}
                className={`p-4 hover:shadow-lg transition-shadow ${!isActive ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                      {emp.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{emp.name}</p>
                      <Badge
                        variant="outline"
                        className={`text-[10px] mt-0.5 ${roleColors[emp.role] || "bg-muted text-muted-foreground"}`}
                      >
                        {roleLabels[emp.role] || emp.role}
                      </Badge>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${isActive ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500"}`}
                  >
                    {isActive ? "Ativo" : "Inativo"}
                  </Badge>
                </div>

                <div className="space-y-1.5 mb-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail className="w-3 h-3" /> {emp.email}
                  </div>
                  {emp.phone && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="w-3 h-3" /> {emp.phone}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-7 text-xs"
                    onClick={() => {
                      setEditing(emp);
                      setShowModal(true);
                    }}
                  >
                    <Pencil className="w-3 h-3 mr-1" /> Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() =>
                      toggleStatus.mutate({ id: emp.id, isActive: !isActive })
                    }
                  >
                    {isActive ? "Desativar" : "Ativar"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                    onClick={() => deleteMutation.mutate(emp.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showModal && (
        <EmployeeFormModal
          employee={editing}
          onClose={() => {
            setShowModal(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
