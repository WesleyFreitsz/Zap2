import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { plansApi } from "@/api/apiClient";
import {
  formatCurrency,
  getDisplayPlans,
  getPlanFeatureList,
} from "@/lib/planUtils";
import {
  Zap,
  Bot,
  MessageSquare,
  BarChart3,
  Users,
  ShieldCheck,
  ArrowRight,
  Check,
  Smartphone,
  Sparkles,
  Clock,
  Globe,
} from "lucide-react";

const features = [
  {
    icon: Bot,
    title: "IA Vendedora",
    desc: "Inteligência artificial que identifica intenção de compra e fecha vendas automaticamente pelo WhatsApp.",
  },
  {
    icon: MessageSquare,
    title: "Atendimento Omnichannel",
    desc: "Gerencie todas as conversas do WhatsApp em um painel centralizado com visão completa do cliente.",
  },
  {
    icon: Smartphone,
    title: "WhatsApp Nativo",
    desc: "Integração direta com WPPConnect para conexão estável e confiável com o WhatsApp, sem Docker.",
  },
  {
    icon: Users,
    title: "Multi-Atendentes",
    desc: "Distribua conversas entre sua equipe, transfira atendimentos e monitore a performance de cada um.",
  },
  {
    icon: BarChart3,
    title: "Analytics em Tempo Real",
    desc: "Dashboards com métricas de conversas, taxa de resposta da IA, conversões e desempenho da equipe.",
  },
  {
    icon: Clock,
    title: "Agendamento Inteligente",
    desc: "Agende mensagens, gerencie follow-ups automáticos e segmente contatos por temperatura.",
  },
];

export default function LandingPage() {
  const { data: plans = [] } = useQuery({
    queryKey: ["plans", "landing"],
    queryFn: () => plansApi.list({ active: true }),
  });

  const displayPlans = useMemo(() => getDisplayPlans(plans), [plans]);

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight">Zap2</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a
              href="#features"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Recursos
            </a>
            <a
              href="#pricing"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Preços
            </a>
            <a
              href="#integration"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Integração
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Entrar
              </Button>
            </Link>
            <Link to="/login">
              <Button size="sm" className="gap-1.5">
                Começar Grátis <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="max-w-7xl mx-auto px-6 py-24 lg:py-32 relative">
          <div className="max-w-3xl mx-auto text-center">
            <Badge
              variant="outline"
              className="mb-6 px-4 py-1.5 text-sm font-medium border-primary/30 text-primary"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              Plataforma de Atendimento com IA
            </Badge>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight">
              Transforme seu WhatsApp em uma{" "}
              <span className="text-primary">máquina de vendas</span>
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              IA que vende, atende e agenda. Conecte seu WhatsApp e deixe a
              inteligência artificial trabalhar por você 24/7.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
              <Link to="/login">
                <Button size="lg" className="text-base px-8 gap-2 h-12">
                  <Zap className="w-5 h-5" />
                  Começar Grátis
                </Button>
              </Link>
              <a href="#features">
                <Button
                  variant="outline"
                  size="lg"
                  className="text-base px-8 h-12"
                >
                  Ver Recursos
                </Button>
              </a>
            </div>
            <div className="mt-12 flex items-center justify-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <span>Sem cartão de crédito</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                <span>WhatsApp integrado</span>
              </div>
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-primary" />
                <span>IA pronta para usar</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Tudo que você precisa para vender mais
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Uma plataforma completa para gerenciar atendimento, vendas e
              relacionamento com clientes via WhatsApp.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <Card
                key={i}
                className="group hover:shadow-lg hover:border-primary/30 transition-all duration-300"
              >
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <f.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {f.desc}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* WhatsApp Integration */}
      <section id="integration" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge
                variant="outline"
                className="mb-4 text-primary border-primary/30"
              >
                Integração
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                Conectado com <span className="text-primary">WhatsApp</span>
              </h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                Nossa plataforma se integra nativamente com o WhatsApp via
                WPPConnect. Configure em minutos, sem Docker, e comece a
                atender.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  "Conexão via QR Code ou API Token",
                  "Envio e recebimento de mensagens em tempo real",
                  "Webhook automático para notificações",
                  "Suporte a múltiplas instâncias",
                  "Status de conexão monitorado no painel",
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Link to="/login">
                  <Button className="gap-2">
                    Configurar Agora <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </div>
            <div className="relative">
              <div className="bg-card border border-border rounded-2xl p-8 shadow-xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                    <Smartphone className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="font-bold">WhatsApp Conectado</p>
                    <p className="text-xs text-muted-foreground">
                      via WPPConnect
                    </p>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs text-green-600 font-medium">
                      Online
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="bg-muted/50 rounded-xl p-4">
                    <p className="text-xs text-muted-foreground mb-1">
                      Provedor API
                    </p>
                    <p className="text-sm font-semibold">WPPConnect</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/50 rounded-xl p-4">
                      <p className="text-xs text-muted-foreground mb-1">
                        Mensagens Hoje
                      </p>
                      <p className="text-2xl font-bold text-primary">247</p>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-4">
                      <p className="text-xs text-muted-foreground mb-1">
                        Conversas Ativas
                      </p>
                      <p className="text-2xl font-bold text-primary">38</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Planos para todos os tamanhos
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Comece grátis e escale conforme seu negócio cresce
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {displayPlans.map((plan, index) => {
              const isPopular = plan.slug === "plus" || index === 1;

              return (
                <Card
                  key={plan.slug}
                  className={`relative overflow-hidden ${isPopular ? "border-primary shadow-xl shadow-primary/10 scale-105" : ""}`}
                >
                  {isPopular && (
                    <div className="absolute top-0 right-0">
                      <Badge className="rounded-none rounded-bl-lg bg-primary text-primary-foreground px-4">
                        Popular
                      </Badge>
                    </div>
                  )}
                  <CardContent className="p-8">
                    <h3 className="text-xl font-bold">{plan.name}</h3>
                    <div className="mt-3 mb-8">
                      <span className="text-4xl font-extrabold">
                        {formatCurrency(plan.price)}
                      </span>
                      <span className="text-muted-foreground">/mês</span>
                      <p className="text-xs text-muted-foreground mt-2">
                        Anual a partir de {formatCurrency(plan.annualPrice)}/mês
                      </p>
                    </div>
                    <ul className="space-y-3 mb-8">
                      {getPlanFeatureList(plan).map((feature) => (
                        <li
                          key={feature}
                          className="flex items-center gap-2.5 text-sm"
                        >
                          <Check className="w-4 h-4 text-primary shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Link to="/login">
                      <Button
                        variant={isPopular ? "default" : "outline"}
                        className={`w-full ${isPopular ? "bg-primary hover:bg-primary/90" : ""}`}
                      >
                        {index === 0 ? "Começar Agora" : "Assinar Agora"}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Pronto para automatizar seu atendimento?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Junte-se a centenas de empresas que já usam IA para vender mais pelo
            WhatsApp.
          </p>
          <div className="mt-10">
            <Link to="/login">
              <Button size="lg" className="text-base px-10 h-12 gap-2">
                <Zap className="w-5 h-5" />
                Criar Conta Grátis
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-bold">Zap2</span>
          </div>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Zap2. Todos os direitos
            reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
