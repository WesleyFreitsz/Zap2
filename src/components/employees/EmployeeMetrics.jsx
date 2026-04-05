import React from "react";
import { useQuery } from "@tanstack/react-query";
import { usersApi } from "@/api/apiClient";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, TrendingUp, Users, UserCheck } from "lucide-react";

export default function EmployeeMetrics() {
  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: () => usersApi.list(),
  });

  const active = employees.filter((e) => e.isActive !== false);
  const admins = employees.filter((e) => e.role === "ADMIN");
  const total = employees.length;

  if (total === 0)
    return (
      <Card className="p-12 text-center">
        <TrendingUp className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="font-medium text-muted-foreground">
          Nenhum funcionário cadastrado ainda
        </p>
      </Card>
    );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Funcionários",
            value: total,
            Icon: Users,
            color: "text-primary",
          },
          {
            label: "Ativos",
            value: active.length,
            Icon: UserCheck,
            color: "text-green-600",
          },
          {
            label: "Inativos",
            value: total - active.length,
            Icon: Trophy,
            color: "text-amber-600",
          },
          {
            label: "Admins",
            value: admins.length,
            Icon: TrendingUp,
            color: "text-blue-600",
          },
        ].map(({ label, value, Icon, color }) => (
          <Card key={label} className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Equipe</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {employees.map((emp, idx) => {
              const isActive = emp.isActive !== false;
              return (
                <div key={emp.id} className="flex items-center gap-3">
                  <span className="text-sm font-bold w-5 text-center text-muted-foreground">
                    {idx + 1}
                  </span>
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    {emp.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate">
                      {emp.name}
                    </span>
                    <p className="text-xs text-muted-foreground">{emp.email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-[10px]">
                      {emp.role}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}
                    >
                      {isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
