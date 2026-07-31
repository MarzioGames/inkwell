# O que foi implementado

Baseado no guia que você recebeu, mas adaptado para o código real do projeto
(o guia original descrevia arquivos e uma arquitetura de auth que não existiam
aqui — ver seção "O que ficou de fora" no fim).

## 1. Rate limiting
- Novo: `server/_core/rateLimit.ts` — limiter em memória, sem dependência nova.
- Aplicado em: criar post, criar comentário, criar anúncio, criar checkout,
  criar denúncia.
- Escala: 1 processo só. Se um dia rodar múltiplas instâncias do servidor,
  troque o `Map` interno por Redis (`INCR`+`EXPIRE`) — os pontos de chamada
  (`checkRateLimit(...)`) não mudam.

## 2. Moderação e denúncias
- Novo no schema: tabelas `reports`, `moderation_actions`, `banned_users`.
- Novo router `moderation`: `reportContent`, `listReports` (admin),
  `reviewReport` (admin — dismiss / apagar conteúdo / avisar / banir),
  `checkIfBanned`, `unbanUser` (admin), `stats` (admin).
- Novo: `activeProcedure` em `server/_core/trpc.ts` — como `protectedProcedure`,
  mas também barra usuário banido. Aplicado em criar post/comentário/anúncio/
  checkout/denúncia.
- "Apagar conteúdo" é soft-delete (o texto vira um aviso de remoção) para não
  quebrar threads de comentários e contagens.
- Nova página `/admin/moderation` — visível só para `user.role === 'admin'`.
- Novo componente `ReportButton` (botão de bandeirinha) plugado no `PostCard`.
  Reaproveitável em `ListingPage`/`CommentThread` passando `targetType`
  diferente — não pluguei em todo canto pra não me estender demais.

## 3. Marketplace / Stripe — fechando o ciclo
- Novo: webhook `POST /api/stripe/webhook` (`server/_core/stripeWebhook.ts`),
  registrado **antes** do `express.json()` (a verificação de assinatura da
  Stripe precisa do corpo raw da requisição).
  - `checkout.session.completed` → marca a `checkout_session` local como
    `completed`, marca o anúncio como `sold`, notifica o vendedor.
  - `checkout.session.expired` → marca como `expired`.
  - Idempotente (Stripe reenvia eventos às vezes).
- Novo: `checkout.status` (query) e `checkout.confirmDelivery` (mutation) no
  router — o comprador confirma que recebeu o livro.
- **O que NÃO fiz, de propósito**: escrow de verdade (dinheiro ficar retido até
  a entrega ser confirmada) e repasse automático pro vendedor. Isso precisa de
  **Stripe Connect** (conta conectada por vendedor + `transfer_data` ou
  `stripe.transfers.create` manual). Hoje, como antes, o valor cheio da venda
  cai direto na sua conta Stripe. Se quiser threat isso, é a próxima decisão
  de arquitetura — me avisa e eu faço.

## 4. Busca full-text
- Novo arquivo `drizzle/manual/0002_fulltext_indexes.sql` — roda uma vez,
  manualmente, direto no MySQL (não passa pelo `drizzle-kit`, que não
  gerencia bem índice FULLTEXT nessa versão). Idempotente.
- `db.globalSearch` e `db.searchBooks` agora tentam `MATCH ... AGAINST`
  primeiro e caem pra `LIKE` automaticamente se o índice ainda não existir —
  ou seja, funciona antes e depois de você rodar o SQL acima.

## 5. Paginação por cursor
- `db.listPosts` e `db.listListings` ganharam um parâmetro `cursor` opcional.
- Novos endpoints **adicionais** `posts.listCursor` e `listings.listCursor`
  (mantive `posts.list`/`listings.list` originais intactos pra não quebrar
  nada que já existe no front). Use os `listCursor` em UI nova de
  infinite-scroll.
- Cursor funciona de verdade pra ordenação por `new`/criação (listings só tem
  uma ordenação). Pra `hot`/`top` (ordenados por score, que muda com o tempo),
  cursor por id não é seguro — esses continuam com offset.

## 6. Bug que encontrei e corrigi (não pedido, mas travava tudo)
`MarketplacePage`, `ListingPage` e `MessagesPage` existiam no projeto e a
Navbar linkava pra elas, mas **não estavam registradas no `App.tsx`** — eram
404 na prática. Adicionei as rotas `/marketplace`, `/listing/:id` e
`/messages`.

---

# O que fazer antes de rodar

```bash
# 1. Atualizar o banco com as novas tabelas (reports, moderation_actions, banned_users,
#    + a nova coluna deliveryConfirmedAt em checkout_sessions)
npm run db:push

# 2. Rodar UMA VEZ, manualmente, os índices full-text (não passa pelo drizzle-kit)
mysql -u <user> -p <database> < drizzle/manual/0002_fulltext_indexes.sql

# 3. Variável de ambiente nova (além de STRIPE_SECRET_KEY que já existia):
# .env
STRIPE_WEBHOOK_SECRET=whsec_...

# 4. Testar o webhook localmente com a Stripe CLI:
stripe listen --forward-to localhost:3000/api/stripe/webhook
# em produção: dashboard.stripe.com → Developers → Webhooks →
# adicionar endpoint https://seudominio.com/api/stripe/webhook
# escutando pelo menos: checkout.session.completed, checkout.session.expired
```

Pra virar admin e testar `/admin/moderation`: mude `role` pra `'admin'`
direto no banco, na sua linha em `users` (não existe fluxo de UI pra isso —
de propósito, é uma ação sensível).

---

# O que ficou de fora (decisão sua)

1. **Cadastro com email/senha + verificação por código** — o guia original
   pedia isso, mas o projeto usa OAuth (login social) via SDK do Manus, e os
   dois sistemas não convivem bem sem um replanejamento de auth. Combinamos
   de manter só OAuth por enquanto. Se decidir migrar, é bom conversarmos
   antes — mexe em `context.ts`, `oauth.ts`, no schema de `users` e no
   frontend de login inteiro.
2. **Escrow real / Stripe Connect** — ver seção 3 acima.
3. **Upload via S3 direto** — não precisou: o projeto já tem upload
   funcionando via proxy do Manus (`server/storageProxy.ts`), o
   `@aws-sdk/client-s3` do guia seria redundante.
