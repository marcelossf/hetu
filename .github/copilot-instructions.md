# Diretrizes do GitHub Copilot — Gestão Hetu

Estas diretrizes são obrigatórias para todo trabalho neste repositório, tanto
nas respostas quanto no código gerado. Siga também as instruções aplicáveis
existentes no repositório e consulte [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)
para o contexto arquitetural detalhado.

## Padrão de código

- Use TypeScript estrito e preserve a segurança de tipos. Evite `any`, casts
  inseguros e supressões de erros; prefira tipos explícitos, validações e
  narrowing.
- Escreva código limpo, legível e modular. Prefira componentes reutilizáveis
  com responsabilidades bem definidas e evite duplicação.
- Faça alterações focadas, compatíveis com os padrões existentes e sem mudanças
  não relacionadas ao pedido.
- Ao concluir uma alteração, informe claramente o que foi feito e quais
  verificações foram executadas; não afirme que algo foi testado se não foi.

## Estilização e identidade visual

- Use exclusivamente Tailwind CSS para estilização. Não introduza CSS inline,
  estilos em linha, CSS Modules ou novas folhas de estilo para estilizar
  componentes.
- Use a paleta institucional Hetu:
  - Verde principal: `#1F3D2B`
  - Creme natural: `#F7F5F2`
  - Texto escuro: `#2A2A2A`
  - Dourado: `#C2A46D`
- Prefira os tokens de tema compartilhados em vez de repetir valores de cor nas
  classes. Se os tokens existentes não corresponderem à paleta, alinhe-os
  apenas quando isso fizer parte do escopo da alteração; não invente cores
  substitutas.
- Garanta contraste legível e estados visuais claros para foco, interação,
  desabilitação e mensagens.

## Arquitetura por funcionalidades

- Organize código de negócio por domínio em `src/features/<dominio>/`, seguindo
  as funcionalidades existentes, como `auth`, `cadastros`, `produtos`,
  `producao` e `vendas`.
- Preserve a separação de responsabilidades:
  - `components/`: interface e interação visual;
  - `services/`: requisições e integração com a API;
  - `facades/`: adaptação e formatação dos dados para apresentação.
- Mantenha subdomínios independentes dentro de sua feature, seguindo o padrão
  já usado em `cadastros`. Coloque código compartilhado em `src/lib/` somente
  quando ele for realmente transversal.
- Não concentre acesso a dados, regras de apresentação e interface no mesmo
  componente.

## PWA e responsividade

- Desenvolva telas com abordagem mobile-first e valide os layouts em telas
  pequenas antes de ampliá-los para desktop.
- Considere viewport, navegação por toque, legibilidade, estados de carregamento
  e áreas interativas adequadas ao uso no celular.
- Preserve os metadados, o manifesto e os ícones da PWA. Não declare suporte
  offline como existente sem implementar e validar service worker e estratégia
  de cache apropriados.

## Supabase, API e segurança

- Use o cliente Supabase compartilhado de `src/lib/supabase.ts`; não crie
  clientes paralelos sem necessidade justificada.
- Para operações de negócio, faça as requisições pelos services da feature e
  use Route Handlers do Next.js em `src/app/api/` como fronteira de servidor,
  seguindo os domínios existentes.
- Valide entradas e aplique autorização no servidor. Trate erros e respostas
  explicitamente; não esconda falhas nem retorne sucesso como fallback.
- Nunca exponha segredos, chaves privilegiadas ou credenciais em código cliente,
  respostas da API ou variáveis `NEXT_PUBLIC_*`. Respeite as políticas de acesso
  do Supabase e Row Level Security (RLS).
- Não presuma que tabelas ou endpoints estejam implementados: confira o estado
  atual do código e das migrações antes de depender deles.

## Verificação

- Execute as verificações relevantes para a alteração, usando os scripts
  existentes do projeto, como `npm run lint` e `npm run build`, quando
  apropriado.
- Atualize a documentação diretamente relacionada quando contratos ou padrões
  arquiteturais forem alterados.
