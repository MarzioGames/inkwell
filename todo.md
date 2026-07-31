# Inkwell - TODO

## Design System
- [x] Paleta papel/tinta: tons creme, sépia, marrom (light) e azul-noite, âmbar (dark)
- [x] Tipografia serifada para títulos (Playfair Display via Google Fonts)
- [x] Variáveis CSS centralizadas em index.css
- [x] Fontes adicionadas em client/index.html

## Schema & Backend
- [x] Migrar schema completo do projeto original (books, readingList, goals, mentions, reviews, recommendations)
- [x] Migrar server/db.ts com todas as funções de livros
- [x] Migrar server/routers.ts com todos os routers
- [x] Adicionar router de busca externa de livros (Google Books + Open Library)
- [x] Adicionar router de detecção de menções via LLM
- [x] Adicionar router de chat com assistente de IA
- [x] Aplicar migrations SQL no banco

## Componentes Base
- [x] Migrar Navbar com links de navegação
- [x] Migrar PostCard com chips de livros clicáveis
- [x] Migrar CommunitiesSidebar
- [x] Migrar CreatePostDialog com detecção de menções
- [x] Migrar LandingPage
- [x] Migrar BookPage
- [x] Migrar CommunityPage, PostPage, SearchPage, etc.

## Home Redesenhada
- [x] Carrossel de livros trending
- [x] Seção "Escolha da Semana"
- [x] Seção de livros mais mencionados
- [x] Feed de posts integrado com referências de livros

## ProfilePage com Biblioteca Digital
- [x] Abas: Lidos / Lendo / Quero Ler
- [x] Estatísticas de leitura
- [x] Meta anual com barra de progresso
- [x] Resenhas do usuário

## Assistente de IA
- [x] Chat flutuante com LLM
- [x] Sugestões de leitura baseadas no histórico
- [x] Análise de resenhas

## Detecção de Menções de Livros
- [x] Detecção via LLM ao criar posts/comentários
- [x] Registro de bookMentions no banco
- [x] Chips clicáveis nos posts

## Integração com APIs Externas
- [x] Google Books API: capa, sinopse, autor, ISBN
- [x] Open Library API: fallback de metadados
- [x] UI de busca e importação de livros

## Testes & Entrega
- [x] Vitest para routers principais
- [x] Checkpoint final

## Seção 'Recomendado para você' Aprimorada
- [x] Backend: melhorar ai.suggestReading para buscar livros locais e retornar ID/capa/avaliação
- [x] Frontend: refatorar RecommendedSection com cards visuais horizontais (capa, título, autor, razão)
- [x] Botão 'Ver livro' funcional (navega ou importa via Google Books)
- [x] Botão 'Adicionar à lista' com seletor de status (Quero Ler, Lendo, Lido)
- [x] Botão 'Atualizar' para regenerar recomendações com loading
- [x] Animações de entrada com stagger de 60ms entre cards
- [x] Skeletons no formato dos cards reais durante loading
- [x] Testes para o endpoint aprimorado
