import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const defaultData = [
  { day: 'Seg', mensagens: 24, ia: 20 },
  { day: 'Ter', mensagens: 38, ia: 32 },
  { day: 'Qua', mensagens: 42, ia: 36 },
  { day: 'Qui', mensagens: 31, ia: 28 },
  { day: 'Sex', mensagens: 55, ia: 48 },
  { day: 'Sáb', mensagens: 18, ia: 15 },
  { day: 'Dom', mensagens: 12, ia: 10 },
];

export default function ActivityChart({ data }) {
  const chartData = data || defaultData;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Atividade Semanal</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorMsg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(145, 65%, 42%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(145, 65%, 42%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorAI" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(200, 70%, 50%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(200, 70%, 50%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ 
                  borderRadius: '12px', 
                  border: '1px solid hsl(220, 13%, 91%)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
                }} 
              />
              <Area type="monotone" dataKey="mensagens" stroke="hsl(145, 65%, 42%)" fillOpacity={1} fill="url(#colorMsg)" strokeWidth={2} name="Mensagens" />
              <Area type="monotone" dataKey="ia" stroke="hsl(200, 70%, 50%)" fillOpacity={1} fill="url(#colorAI)" strokeWidth={2} name="Respostas IA" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-6 mt-2 justify-center">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-xs text-muted-foreground">Mensagens</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: 'hsl(200, 70%, 50%)' }} />
            <span className="text-xs text-muted-foreground">Respostas IA</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}