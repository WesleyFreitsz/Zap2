export const FALLBACK_PLANS = [
  {
    id: "basic",
    slug: "basic",
    name: "Basic",
    price: 97,
    annualPrice: 77.6,
    maxNumbers: 1,
    maxEmployees: 5,
    maxTeamLeaders: 0,
    features: ["1 número WhatsApp", "Até 5 funcionários", "Suporte por email"],
  },
  {
    id: "plus",
    slug: "plus",
    name: "Plus",
    price: 197,
    annualPrice: 157.6,
    maxNumbers: 2,
    maxEmployees: 15,
    maxTeamLeaders: 0,
    features: [
      "2 números WhatsApp",
      "Até 15 funcionários",
      "Suporte por email",
      "Analytics avançado",
    ],
  },
  {
    id: "pro",
    slug: "pro",
    name: "Pro",
    price: 397,
    annualPrice: 317.6,
    maxNumbers: 4,
    maxEmployees: 40,
    maxTeamLeaders: 4,
    features: [
      "4 números WhatsApp",
      "Até 40 funcionários",
      "4 líderes de equipe",
      "Suporte prioritário",
      "Analytics avançado",
    ],
  },
];

export function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

export function normalizePlan(plan) {
  return {
    ...plan,
    slug: plan.slug || plan.id,
    id: plan.id || plan.slug,
    price: Number(plan.price || 0),
    annualPrice: Number(plan.annualPrice || 0),
    maxNumbers: Number(plan.maxNumbers || 0),
    maxEmployees: Number(plan.maxEmployees || 0),
    maxTeamLeaders: Number(plan.maxTeamLeaders || 0),
    features: Array.isArray(plan.features) ? plan.features : [],
  };
}

export function sortPlans(plans = []) {
  return [...plans].sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
}

export function getDisplayPlans(plans = []) {
  const normalized = plans.map(normalizePlan);
  return normalized.length ? sortPlans(normalized) : FALLBACK_PLANS;
}

export function getPlanBySlug(plans = [], slug) {
  return getDisplayPlans(plans).find((plan) => plan.slug === slug) || null;
}

export function getPlanLimitItems(plan) {
  if (!plan) return [];

  const items = [
    `${plan.maxNumbers} número(s) WhatsApp`,
    `Até ${plan.maxEmployees} funcionário(s)`,
  ];

  if (plan.maxTeamLeaders > 0) {
    items.push(`${plan.maxTeamLeaders} líder(es) de equipe`);
  }

  return items;
}

export function getPlanFeatureList(plan) {
  if (!plan) return [];

  return [...new Set([...getPlanLimitItems(plan), ...(plan.features || [])])];
}
