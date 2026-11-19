import React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ScheduledMessages from "@/components/schedule/ScheduledMessages";
import ContactTagsManager from "@/components/schedule/ContactTagsManager";
import ContactTemperatureBoard from "@/components/schedule/ContactTemperatureBoard";
import AiTemperatureControl from "@/components/schedule/AiTemperatureControl";

export default function Schedule() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Agenda & Segmentação</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie mensagens agendadas, tags e temperatura dos contatos
        </p>
      </div>

      <Tabs defaultValue="schedule">
        <TabsList className="bg-muted">
          <TabsTrigger value="schedule">📅 Mensagens Agendadas</TabsTrigger>
          <TabsTrigger value="board">🌡️ Hot / Cold Board</TabsTrigger>
          <TabsTrigger value="tags">🏷️ Gerenciar Tags</TabsTrigger>
          <TabsTrigger value="ai">⚙️ Classificação automática</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="mt-4">
          <ScheduledMessages />
        </TabsContent>

        <TabsContent value="board" className="mt-4">
          <ContactTemperatureBoard />
        </TabsContent>

        <TabsContent value="tags" className="mt-4">
          <ContactTagsManager />
        </TabsContent>

        <TabsContent value="ai" className="mt-4">
          <AiTemperatureControl />
        </TabsContent>
      </Tabs>
    </div>
  );
}
