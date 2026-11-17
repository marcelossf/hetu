# Arquitetura — Gestão Hetu

Este documento descreve a arquitetura de referência do **Hetu**, estruturada com **Next.js 16 (App Router)**, **Tailwind CSS 4**, **Supabase (PostgreSQL)** e suporte a **PWA**.

---

## 1. Stack Tecnológica

| Camada / Tecnologia | Função Principal |
| --- | --- |
| **Next.js 16 (App Router)** | Framework web completo para páginas, layouts e Route Handlers (`src/app/api/`). |
| **TypeScript** | Tipagem estática rigorosa em toda a aplicação. |
| **Tailwind CSS v4** | Estilização utilitária de alta performance. |
| **Supabase (PostgreSQL)** | Banco de dados relacional na nuvem, autenticação e políticas de segurança (RLS). |
| **Vercel** | Plataforma de deploy contínuo e hospedagem oficial. |
| **PWA (Progressive Web App)** | Permite instalar o site como aplicativo nativo no celular (via manifesto e service worker) e computadores. |

---

## 2. Paleta de Cores Institucional

| Elemento Visual | Descrição | Código Hexadecimal |
| --- | --- | --- |
| **Verde Principal** | Cor de marca institucional | `#1F3D2B` |
| **Creme Natural** | Fundo e superfícies claras | `#F7F5F2` |
| **Texto Escuro** | Tipografia principal | `#2A2A2A` |
| **Dourado** | Destaques e acentos visuais | `#C2A46D` |

---

## 3. Estruturação do Repositório

```text
src/
├── app/                      # Camada de entrada do Next.js App Router
│   ├── api/                  # Route Handlers corporativos / API endpoints
│   ├── layout.tsx            # Layout raiz e metadados PWA
│   └── page.tsx              # Página inicial
├── features/                 # Módulos organizados por domínio (DDD)
│   ├── auth/
│   ├── cadastros/
│   ├── produtos/
│   ├── producao/
│   └── vendas/
└── lib/
    ├── api/                  # Utilitários compartilhados de API
    └── supabase.ts           # Cliente Supabase compartilhado