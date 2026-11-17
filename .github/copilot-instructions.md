# Diretrizes do GitHub Copilot — Gestão Hetu

Estas diretrizes são obrigatórias para todo trabalho neste repositório, tanto nas respostas quanto no código gerado. Consulte também [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) para o contexto arquitetural detalhado e [docs/DATABASE_SCHEMA.md](../docs/DATABASE_SCHEMA.md) para o schema do banco.

## Storytelling e Contexto do Projeto
- **O que é o Hetu:** Sistema de gestão de custos, engenharia de produtos (fichas técnicas), produção e vendas voltado para o setor de fabricação artesanal (como velas aromáticas e cosméticos).
- **Propósito:** Automatizar o cálculo de custos de insumos, gerenciar estoque real, padronizar compras e fornecer alta performance via Next.js PWA (instalável no celular e acessível no PC).

## Padrão de Código e TypeScript
- Use TypeScript estrito e preserve a segurança de tipos. **Proibido o uso de `any`**, casts inseguros ou supressões de erro.
- Siga estritamente a separação de responsabilidades (DDD):
  - `src/app/`: Camada de entrada do Next.js (páginas, layouts e Route Handlers em `src/app/api/`).
  - `src/features/`: Código de negócio organizado por domínio (`auth`, `cadastros`, `produtos`, `producao`, `vendas`).
    - `components/`: Interface visual (HTML/React puro com Tailwind). Componentes NUNCA conversam diretamente com o Supabase.
    - `services/`: Camada exclusiva para requisições e integração com o Supabase.
    - `facades/`: Adaptação e formatação de dados para apresentação.

## Estilização e Identidade Visual (Tailwind CSS v4)
- Use exclusivamente **Tailwind CSS (v4)** para estilização. Não introduza CSS inline ou arquivos de estilos paralelos desnecessários.
- Utilize rigorosamente a paleta de cores institucional Hetu:
  - **Verde principal:** `#1F3D2B`
  - **Creme natural:** `#F7F5F2`
  - **Texto escuro:** `#2A2A2A`
  - **Dourado (destaques):** `#C2A46D`
- Formatação numérica: Valores monetários com precisão de 2 casas decimais (`NUMERIC(10,2)`). Quantidades de insumos em fichas técnicas com 4 casas decimais (`NUMERIC(10,4)`).

## Supabase e Segurança
- Use o cliente Supabase compartilhado de `src/lib/supabase.ts`.
- Para operações protegidas, utilize Route Handlers do Next.js em `src/app/api/` como fronteira de servidor.
- Nunca exponha chaves administrativas (`service_role`) no código cliente. Respeite as políticas de RLS do Supabase.