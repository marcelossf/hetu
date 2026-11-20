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
ao entrar em uma nova sessão do app; atualizar a aba atual preserva a sessão.
A preferência vale para a conta inteira. O dispositivo pode usar
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
   uma migração que já esteja registrada como aplicada. A migração
   `20261118123000_create_product_production_sales.sql` adiciona fichas,
   produção, ajustes de estoque, vendas e pagamentos.
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

## Cópia pontual de dados entre contas

O script `supabase/copiar_dados_entre_usuarios.sql` é uma operação manual de
administrador, não uma migração nem uma sincronização contínua. Antes de usá-lo,
faça um backup recuperável do banco, pare alterações nas duas contas e aplique
todas as migrações. Confira os UUIDs em **Supabase > Authentication > Users**:
origem é a conta de onde vêm os dados; destino é a conta que os receberá.
No SQL Editor do projeto correto, copie o script inteiro, preencha `v_origem`
e `v_destino` no início com os UUIDs entre aspas simples e execute-o uma vez.
Não compartilhe tokens ou chaves. O script valida as contas e executa
atomicamente: qualquer erro desfaz as alterações. Examine o erro antes de
tentar novamente.

**Atenção:** o script substitui integralmente os históricos de compras, ajustes
de estoque de produtos e custos de fichas da conta de destino pelos da origem.
Não use se esses históricos precisarem ser preservados. Categorias, insumos,
fornecedores e produtos com o mesmo nome (ignorando maiúsculas e espaços nas
extremidades) são atualizados com os dados da origem; seus IDs no destino são
mantidos. Os demais cadastros do destino não são removidos. Estoques e custos
são copiados como saldos atuais, sem executar novamente as movimentações.
Compras, cancelamentos e históricos de custo recebem os vínculos adequados ao
destino; o autor original de um cancelamento permanece registrado.
Fichas existentes somente no destino que usem insumos atualizados podem ficar
com custos desatualizados e devem ser revisadas.

Produções, vendas e seus históricos **não** são copiados nem removidos. Os
saldos copiados podem refletir produções e vendas que não constarão no histórico
da conta de destino. Autenticação, passkeys e preferências também não são
copiadas. Após executar, confira os totais e vínculos no aplicativo. As contas
continuam independentes; uma nova execução sobrescreverá novamente os dados e
históricos indicados acima.

Na lista de produtos, é possível buscar pelo nome do produto ou de um insumo.
O botão **Copiar produto** abre uma nova ficha preenchida para revisão. Ela só
é criada ao salvar, começa com estoque zero e não copia histórico. Insumos
inativos precisam ser substituídos antes de salvar.

## Organização

- `src/features/`: módulos de negócio e suas camadas `components`, `services`
  e `facades`. Insumos, categorias, produtos, produção, vendas e canais estão
  disponíveis após aplicar as migrações; a estrutura está em
  `src/features/README.md`.
- `src/app/api/`: Route Handlers protegidos separados por domínio. Operações de
  estoque, produção e vendas são feitas por funções transacionais no Supabase.
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
