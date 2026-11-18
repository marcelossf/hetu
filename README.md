# Gestão Hetu

Aplicação de gestão de produtos, produção e vendas, construída com Next.js,
TypeScript, Tailwind CSS 4 e Supabase.

## Começar

Requer Node.js 22 ou superior. Instale as dependências com `npm install`, crie
`.env.local` a partir de `.env.example` e execute `npm run dev`.

O cliente Supabase é inicializado sob demanda por `getSupabaseClient()` em
`src/lib/supabase.ts`. A chave `anon`/publishable é pública; nunca coloque a
chave `service_role` em variáveis `NEXT_PUBLIC_*`. O servidor usa
`SUPABASE_SERVICE_ROLE_KEY` exclusivamente para acessar as tabelas de passkeys
e desafios. Configure essa chave apenas como segredo de servidor.

Para autenticação Google, habilite o provedor Google no Supabase Auth e configure
as URLs de redirecionamento para os ambientes local e de produção. O login da
tela inicial usa `signInWithOAuth` do Supabase; as credenciais do Google ficam
configuradas no provedor Google do Supabase, não no navegador.

Após o login Google, a tela sugere cadastrar uma passkey, mas é possível
continuar sem biometria. Quando ativada e cadastrada, a verificação é solicitada
ao entrar; a preferência vale para a conta inteira. O dispositivo pode usar
biometria ou outro método de verificação do sistema, como PIN. O site não acessa
nem armazena dados biométricos. As passkeys são validadas pelo servidor via
WebAuthn e as tabelas não concedem acesso direto ao cliente.

Para habilitar esse fluxo:

1. No terminal, na raiz do repositório, vincule o projeto com
   `npx supabase link --project-ref SEU_PROJECT_REF` e aplique as migrações
   pendentes com `npx supabase db push`. Isso inclui as migrações de passkeys,
   preferências biométricas e cadastros, como
   `20261118095900_create_supply_catalog_tables.sql` e
   `20261118103700_scope_supply_catalog_by_user.sql`. A última copia os
   cadastros existentes para cada conta Supabase ativa; não execute manualmente
   uma migração que já esteja registrada como aplicada.
2. Configure `NEXT_PUBLIC_APP_URL` com a origem exata do ambiente, por exemplo
   `http://localhost:3000` localmente e `https://app.example.com` em produção.
3. Configure `WEBAUTHN_SESSION_SECRET` com um segredo aleatório de pelo menos
   32 caracteres, diferente entre ambientes. Não o exponha em `NEXT_PUBLIC_*`.
   Configure `SUPABASE_SERVICE_ROLE_KEY` com uma chave de servidor e nunca a
   exponha no navegador.
4. Use HTTPS em produção. WebAuthn só funciona em contexto seguro, exceto
   `localhost`.

Passkeys são vinculadas ao usuário e podem ser sincronizadas pelo provedor do
dispositivo. Se não houver passkey disponível, a pessoa pode autenticar-se
novamente com Google para cadastrar outra neste dispositivo. No iPhone/iPad,
instale a PWA por **Compartilhar > Adicionar à Tela de Início**; no Android,
use **Instalar app** ou **Adicionar à tela inicial** no menu do navegador.

Handlers de API protegidos validam a sessão do usuário. Quando há passkey
cadastrada e a biometria está ativada, também exigem a sessão desbloqueada. Os
serviços de módulos devem enviar `Authorization: Bearer <access_token>` e o
cabeçalho `X-Hetu-Page-Nonce`; use `getUnlockedApiHeaders()` em
`src/features/auth/services/auth-service.ts` para construí-los. Não remova essa
verificação ao implementar os endpoints de negócio.

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

A paleta do Hetu está disponível como `hetu.green`, `hetu.cream`, `hetu.text` e
`hetu.gold`
no arquivo `tailwind.config.js` e como tokens CSS (`hetu-green`,
`hetu-cream`, `hetu-text`, `hetu-gold`) compatíveis com Tailwind CSS 4.

## Testar no Vercel e instalar no celular

1. Importe o repositório no Vercel e configure, nos ambientes **Preview** e
   **Production**, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `NEXT_PUBLIC_APP_URL`, `WEBAUTHN_SESSION_SECRET` e
   `SUPABASE_SERVICE_ROLE_KEY`. Use a origem correta para cada ambiente e
   um `WEBAUTHN_SESSION_SECRET` distinto por ambiente. A chave de serviço deve
   corresponder ao projeto Supabase configurado e permanecer apenas no servidor.
   Não publique o segredo OAuth do Google ou a chave de serviço no frontend.
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
