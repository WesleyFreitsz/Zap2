# Omnichannel SaaS Backend

Backend completo para plataforma SaaS de multiatendimento omnichannel (WhatsApp, Instagram e Facebook).

## Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Express
- **Database**: PostgreSQL + Prisma ORM
- **Cache/Filas**: Redis + BullMQ
- **Auth**: JWT + Refresh Token
- **Validação**: Zod
- **Logs**: Winston

## Estrutura de Pastas

```
src/
├── config/          # Configurações (env, prisma, redis)
├── middlewares/      # Auth, authorize, subscription, validate, errorHandler
├── modules/
│   ├── auth/        # Registro, login, refresh token
│   ├── users/       # CRUD de usuários + round-robin
│   ├── conversations/ # Conversas, assign, transfer
│   ├── messages/    # Envio e listagem de mensagens
│   ├── products/    # CRUD de produtos + enviar no chat
│   ├── schedule/    # Mensagens agendadas
│   ├── dashboard/   # Overview e ranking
│   ├── integrations/# WhatsApp, Instagram, Facebook
│   ├── companies/   # Gerenciamento de empresas (SUPER_ADMIN)
│   └── webhook/     # Webhooks para receber mensagens
├── routes/          # Índice de rotas
├── utils/           # Logger, AppError
├── workers/         # BullMQ workers
├── app.ts           # Express app setup
└── server.ts        # Entry point
```

## Como Rodar

### Pré-requisitos

- Node.js 18+
- PostgreSQL
- Redis

### 1. Clonar e instalar dependências

```bash
git clone <repo-url>
cd omnichannel-saas-backend
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
# Edite o .env com suas credenciais
```

### 3. Criar o banco e rodar migrations

```bash
npx prisma migrate dev --name init
```

### 4. Gerar o Prisma Client

```bash
npx prisma generate
```

### 5. Popular o banco (seed)

```bash
npm run prisma:seed
```

### 6. Iniciar o servidor

```bash
npm run dev
```

### 7. Iniciar o worker (em outro terminal)

```bash
npm run worker
```

## Credenciais do Seed

| Role        | Email                      | Senha    |
| ----------- | -------------------------- | -------- |
| SUPER_ADMIN | superadmin@omnichannel.com | super123 |
| ADMIN       | admin@demo.com             | admin123 |
| EMPLOYEE    | employee1@demo.com         | emp123   |
| EMPLOYEE    | employee2@demo.com         | emp123   |
| EMPLOYEE    | employee3@demo.com         | emp123   |

## Rotas da API

Base URL: `http://localhost:3000/api`

### Auth

- `POST /api/auth/register` - Registrar empresa + admin
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token

### Users

- `GET /api/users` - Listar usuários (ADMIN)
- `GET /api/users/:id` - Buscar usuário (ADMIN)
- `POST /api/users` - Criar usuário (ADMIN)
- `PUT /api/users/:id` - Atualizar usuário (ADMIN)
- `DELETE /api/users/:id` - Remover usuário (ADMIN)

### Conversations

- `GET /api/conversations` - Listar conversas
- `GET /api/conversations/:id` - Detalhes da conversa
- `POST /api/conversations` - Nova conversa (auto-assign round-robin)
- `POST /api/conversations/assign` - Atribuir conversa (ADMIN)
- `POST /api/conversations/transfer` - Transferir conversa
- `PATCH /api/conversations/:id/close` - Fechar conversa

### Messages

- `POST /api/messages/send` - Enviar mensagem
- `GET /api/messages/:conversationId` - Histórico de mensagens

### Products

- `GET /api/products` - Listar produtos
- `GET /api/products/:id` - Detalhes do produto
- `POST /api/products` - Criar produto (ADMIN)
- `PUT /api/products/:id` - Atualizar produto (ADMIN)
- `DELETE /api/products/:id` - Remover produto (ADMIN)
- `POST /api/products/send-to-chat` - Enviar produto no chat

### Scheduled Messages

- `POST /api/schedule` - Agendar mensagem
- `GET /api/schedule` - Listar agendamentos
- `DELETE /api/schedule/:id` - Cancelar agendamento

### Dashboard

- `GET /api/dashboard/overview` - Visão geral (ADMIN)
- `GET /api/dashboard/ranking` - Ranking de funcionários (ADMIN)
- `GET /api/dashboard/my-stats` - Estatísticas pessoais

### Integrations (Genéricas)

- `GET /api/integrations` - Listar integrações (ADMIN)
- `POST /api/integrations` - Criar integração (ADMIN)
- `PATCH /api/integrations/:id/toggle` - Ativar/desativar (ADMIN)
- `DELETE /api/integrations/:id` - Remover integração (ADMIN)

### WhatsApp via Evolution API

- `POST /api/integrations/whatsapp/connect` - Criar instância e gerar QR Code (ADMIN)
- `GET /api/integrations/whatsapp/status` - Status da conexão
- `GET /api/integrations/whatsapp/qrcode` - Obter QR Code atual (ADMIN)
- `POST /api/integrations/whatsapp/reconnect` - Reconectar instância (ADMIN)
- `POST /api/integrations/whatsapp/disconnect` - Desconectar instância (ADMIN)
- `POST /api/integrations/whatsapp/send` - Enviar mensagem via WhatsApp

### Companies (SUPER_ADMIN)

- `GET /api/companies` - Listar empresas
- `GET /api/companies/:id` - Detalhes da empresa
- `PUT /api/companies/:id` - Atualizar empresa
- `PATCH /api/companies/:id/toggle` - Ativar/desativar empresa
- `DELETE /api/companies/:id` - Remover empresa

### Webhooks

- `POST /api/webhook/evolution/:companyId` - Webhook da Evolution API (WhatsApp)
- `POST /api/webhook/instagram` - Receber mensagem Instagram
- `POST /api/webhook/facebook` - Receber mensagem Facebook

## Integração WhatsApp (Evolution API)

### Pré-requisitos

- [Evolution API](https://github.com/EvolutionAPI/evolution-api) rodando (Docker ou local)
- Configurar `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` e `EVOLUTION_WEBHOOK_BASE_URL` no `.env`

### Fluxo de Conexão

1. Admin chama `POST /api/integrations/whatsapp/connect`
2. Backend cria instância na Evolution API e retorna QR Code (base64)
3. Usuário escaneia o QR Code no WhatsApp
4. Evolution API envia webhook de `connection.update` → status atualiza para `CONNECTED`
5. Mensagens recebidas chegam via webhook `messages.upsert` → salvas no banco com round-robin

### Funcionalidades

- **QR Code**: gerado automaticamente, atualizado via webhook
- **Envio de mensagens**: via `POST /api/integrations/whatsapp/send` ou automático ao responder conversa
- **Reconexão**: `POST /api/integrations/whatsapp/reconnect` gera novo QR se necessário
- **Desconexão**: `POST /api/integrations/whatsapp/disconnect` encerra sessão
- **Multi-tenant**: cada empresa tem sua própria instância (`company-{companyId}`)
- **Deduplicação**: mensagens com `externalId` duplicado são ignoradas

## Regras de Negócio

1. **Multi-tenant**: Todos os dados isolados por `companyId`
2. **Round-robin**: Novos contatos distribuídos automaticamente entre funcionários ativos (persistido em `lastAssignedUserId` na Company)
3. **Permissões**: SUPER_ADMIN > ADMIN > EMPLOYEE
4. **Subscription Guard**: Empresas inativas são bloqueadas
5. **Mensagens Agendadas**: Processadas via BullMQ worker
6. **Webhooks**: Endpoints para receber mensagens de canais externos
7. **Evolution API**: Integração real com WhatsApp via QR Code, conexão persistente e envio/recebimento
8. **Status de Conversa**: OPEN, CLOSED, TRANSFERRED, PENDING, BOT
