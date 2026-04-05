import React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function StatCard({ title, value, subtitle, icon: Icon, trend, trendUp }) {
  return (
    <Card className="p-6 hover:shadow-lg transition-shadow duration-300">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className="p-3 rounded-xl bg-accent">
          <Icon className="w-5 h-5 text-accent-foreground" />
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center gap-1">
          <span className={cn(
            "text-xs font-semibold",
            trendUp ? "text-primary" : "text-destructive"
          )}>
            {trendUp ? '↑' : '↓'} {trend}
          </span>
          <span className="text-xs text-muted-foreground">vs última semana</span>
        </div>
      )}
    </Card>
  );
}