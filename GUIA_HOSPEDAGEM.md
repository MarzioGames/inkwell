# Guia de Hospedagem: Inkwell na Vercel + TiDB Cloud

Este guia explica como colocar seu site no ar gratuitamente utilizando a **Vercel** para o site e o **TiDB Cloud** para o banco de dados MySQL.

## Passo 1: Criar o Banco de Dados (TiDB Cloud)

1. Acesse [TiDB Cloud](https://pingcap.com/tidb-cloud) e crie uma conta gratuita.
2. Crie um novo cluster **Serverless** (é grátis para sempre dentro do limite).
3. No painel do cluster, clique em **Connect**.
4. Escolha o método de conexão **General** ou **Node.js**.
5. Você receberá uma URL de conexão parecida com esta:
   `mysql://usuário:senha@host:porta/nomedobanco?ssl={"rejectUnauthorized":true}`
6. **Importante**: Guarde essa URL, ela será sua `DATABASE_URL`.

## Passo 2: Preparar o Banco de Dados

Antes de subir para a Vercel, você precisa criar as tabelas no seu novo banco:
1. No seu computador, abra o terminal na pasta do projeto.
2. Crie um arquivo `.env` e cole sua URL: `DATABASE_URL=sua_url_aqui`.
3. Execute o comando: `pnpm run db:push`.
   *Isso vai criar todas as tabelas (usuários, posts, marketplace) no TiDB Cloud.*

## Passo 3: Hospedar na Vercel

1. Suba seu projeto para um repositório no **GitHub**.
2. Acesse a [Vercel](https://vercel.com) e importe o repositório.
3. Na tela de configuração, clique em **Environment Variables** e adicione:
   - `DATABASE_URL`: A URL que você pegou no TiDB Cloud.
   - `JWT_SECRET`: Uma frase secreta qualquer (ex: `minha_chave_super_secreta_123`).
   - `NODE_ENV`: `production`
4. Clique em **Deploy**.

## Resumo de Links Úteis

| Serviço | Função | Custo |
| :--- | :--- | :--- |
| **GitHub** | Armazenar o código | Grátis |
| **TiDB Cloud** | Banco de Dados MySQL | Grátis (Serverless) |
| **Vercel** | Hospedagem do Site | Grátis (Hobby) |

---
*Desenvolvido por Manus AI para o projeto Inkwell.*
