# Omnichannel SaaS Backend

Backend completo para plataforma SaaS de multiatendimento omnichannel (WhatsApp, Instagram e Facebook).

## Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Express
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: JWT + Refresh Token
- **Validação**: Zod
- **Logs**: Winston

## Estrutura de Pastas

```
src/
├── config/          # Configurações (env, prisma)
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
├── routes/          # Índice de rotas
├── utils/           # Logger, AppError
├── workers/         # Processamento de mensagens agendadas
├── app.ts           # Express app setup
└── server.ts        # Entry point
```

## Como Rodar

### Pré-requisitos

- Node.js 22+
- Docker (para o PostgreSQL local)

### 1. Instalar dependências

```bash
npm install --ignore-scripts
npx prisma generate
```

`--ignore-scripts` evita o download do Chromium do puppeteer, que só é necessário para conectar o WhatsApp via WPPConnect.

### 2. Banco e variáveis de ambiente

```bash
docker compose up -d
cp .env.example .env
```

No `.env`, troque `JWT_SECRET`, `JWT_REFRESH_SECRET` e `ASAAS_WEBHOOK_TOKEN` por valores aleatórios (o servidor não sobe sem os segredos JWT). `GROQ_API_KEY` é necessária para a sugestão de resposta.

### 3. Migrations e dados

```bash
npx prisma migrate deploy
npx tsx --env-file=.env prisma/seed.ts   # super admin e planos
npm run prisma:seed:dev                  # empresa de teste com conversas, leads e produtos
```

### 4. Iniciar o servidor

```bash
npm run dev
```

O processo do servidor executa o envio de mensagens agendadas a cada minuto com node-cron.

### Testes

```bash
npm test
```

## Credenciais locais

| Role        | Email                      | Senha                                  |
| ----------- | -------------------------- | -------------------------------------- |
| SUPER_ADMIN | superadmin@omnichannel.com | definida em `prisma/seed.ts`           |
| ADMIN       | admin@zap2.test            | `DEV_PASSWORD` em `prisma/seed-dev.ts` |
| EMPLOYEE    | atendente@zap2.test        | `DEV_PASSWORD` em `prisma/seed-dev.ts` |

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

- `POST /api/messages/suggest-reply` - Sugerir resposta com IA (Groq)
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

### WhatsApp (WPPConnect)

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

## Integração WhatsApp (WPPConnect)

Conexão pelo WhatsApp Web via [WPPConnect](https://github.com/wppconnect-team/wppconnect), com um Chromium por número conectado.

### Fluxo de Conexão

1. Admin chama `POST /api/integrations/whatsapp/connect`
2. Backend abre a sessão e retorna o QR Code (base64)
3. Usuário escaneia o QR Code no WhatsApp
4. Mensagens recebidas são salvas no banco e distribuídas por round-robin

### Funcionalidades

- **Envio de mensagens**: via `POST /api/integrations/whatsapp/send` ou automático ao responder conversa
- **Reconexão**: `POST /api/integrations/whatsapp/reconnect/:integrationId`
- **Desconexão**: `POST /api/integrations/whatsapp/disconnect/:integrationId`
- **Restauração**: sessões salvas são reabertas quando o servidor sobe
- **Deduplicação**: mensagens com `externalId` duplicado são ignoradas

## Regras de Negócio

1. **Multi-tenant**: Todos os dados isolados por `companyId`
2. **Round-robin**: Novos contatos distribuídos automaticamente entre funcionários ativos (persistido em `lastAssignedUserId` na Company)
3. **Permissões**: SUPER_ADMIN > ADMIN > EMPLOYEE
4. **Subscription Guard**: Empresas inativas são bloqueadas
5. **Mensagens Agendadas**: Enviadas pelo WhatsApp pelo processo do servidor
6. **Status de Conversa**: OPEN, CLOSED, TRANSFERRED, PENDING, BOT
