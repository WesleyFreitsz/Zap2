import React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import EmployeeList from "@/components/employees/EmployeeList";
import EmployeeMetrics from "@/components/employees/EmployeeMetrics";

export default function Employees() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Funcionários</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie sua equipe, atribuições e métricas de desempenho
        </p>
      </div>
      <Tabs defaultValue="team">
        <TabsList className="bg-muted">
          <TabsTrigger value="team">👥 Equipe</TabsTrigger>
          <TabsTrigger value="metrics">📊 Métricas</TabsTrigger>
        </TabsList>
        <TabsContent value="team" className="mt-4">
          <EmployeeList />
        </TabsContent>
        <TabsContent value="metrics" className="mt-4">
          <EmployeeMetrics />
        </TabsContent>
      </Tabs>
    </div>
  );
}
