# Gestão Hetu

Aplicação de gestão de produtos, produção e vendas, construída com Next.js,
TypeScript, Tailwind CSS 4 e Supabase.

## Começar

1. Instale as dependências com `npm install`.
2. Crie `.env.local` na raiz e preencha `NEXT_PUBLIC_SUPABASE_URL` e
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` com os valores do projeto Supabase.
3. Execute `npm run dev`.

O cliente Supabase é inicializado sob demanda por `getSupabaseClient()` em
`src/lib/supabase.ts`. A chave `anon`/publishable é pública; nunca coloque a
chave `service_role` em variáveis `NEXT_PUBLIC_*`.

Para autenticação Google, habilite o provedor Google no Supabase Auth e configure
as URLs de redirecionamento para os ambientes local e de produção. O login da
tela inicial usa `signInWithOAuth` do Supabase; as credenciais do Google ficam
configuradas no provedor Google do Supabase, não no navegador.

## Organização

- `src/features/`: módulos de negócio e suas camadas `components`, `services`
  e `facades`. A estrutura detalhada está em `src/features/README.md`.
- `src/app/api/`: Route Handlers separados por domínio. Os handlers iniciais
  respondem com HTTP 501 até que cada operação seja implementada.
- `src/lib/`: integrações compartilhadas, incluindo o cliente Supabase.
- `public/manifest.json`: manifesto da PWA; a aplicação pode ser instalada
  quando servida por HTTPS (ou localhost).
- `public/hetu-logo.png`: logo original; a versão enquadrada da tela de login e
  os ícones da PWA também ficam em `public/`.

A paleta do Hetu está disponível como `hetu.green`, `hetu.cream` e `hetu.text`
no arquivo `tailwind.config.js` e como tokens CSS (`hetu-green`,
`hetu-cream`, `hetu-text`) compatíveis com Tailwind CSS 4.

## Testar no Vercel e instalar no celular

1. Importe o repositório no Vercel e configure, nos ambientes **Preview** e
   **Production**, `NEXT_PUBLIC_SUPABASE_URL` e
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Não publique o segredo OAuth do Google como
   variável do frontend.
2. No Supabase, confirme que o provedor Google está ativo. Em **Authentication
   > URL Configuration**, defina o domínio de produção como **Site URL** e
   permita os endereços de redirecionamento local (`http://localhost:3000/**`),
   de produção e do Preview que será testado. No Google Cloud, o URI de callback
   autorizado do cliente OAuth deve ser o callback exibido nas configurações do
   provedor Google no Supabase.
3. Envie uma branch ou abra um pull request. O Vercel cria uma URL **Preview**
   sem substituir o site de produção; teste o login nessa URL HTTPS. Para cada
   domínio Preview usado, confira se ele está permitido na configuração de
   redirecionamentos do Supabase.
4. No celular, abra a URL Preview pelo navegador. No Android/Chrome, use
   **Instalar app** quando aparecer ou **Adicionar à tela inicial** no menu. No
   iPhone/iPad, abra no Safari, toque em **Compartilhar** e escolha
   **Adicionar à Tela de Início**.
5. Depois da validação, mescle a branch configurada como produção. O Vercel
   fará o deploy de produção. A instalação no celular funciona sobre HTTPS; não
   exige publicação em uma loja de aplicativos.
