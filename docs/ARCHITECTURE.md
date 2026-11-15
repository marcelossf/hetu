# Arquitetura — Gestão Hetu

Este documento descreve a arquitetura de referência da Gestão Hetu, uma
aplicação para administrar cadastros, produtos, produção e vendas. Ele registra
as responsabilidades dos módulos, o fluxo esperado entre as camadas e um
modelo relacional conceitual para orientar a implementação.

> **Estado atual:** a organização por funcionalidades, o shell da aplicação,
> o manifesto PWA e os primeiros Route Handlers já existem. Os handlers de API
> ainda respondem com HTTP 501; as tabelas descritas neste documento são uma
> proposta conceitual e não significam que o schema já foi criado no Supabase.

## 1. Stack tecnológica

| Tecnologia | Responsabilidade |
| --- | --- |
| **Next.js (App Router)** | Aplicação web, rotas de página em `src/app/` e Route Handlers para a API em `src/app/api/`. |
| **TypeScript** | Tipagem estática para componentes, contratos entre camadas e integrações. |
| **Tailwind CSS** | Estilização utilitária e aplicação consistente dos tokens visuais. O projeto usa Tailwind CSS 4. |
| **Supabase (PostgreSQL)** | Persistência relacional e autenticação. O cliente compartilhado é inicializado sob demanda em `src/lib/supabase.ts`. |
| **Vercel** | Plataforma de referência para deploy do Next.js, com ambientes de Preview e Production. |
| **PWA** | Instalação da aplicação em dispositivos compatíveis por meio do manifesto em `public/manifest.json` e dos ícones em `public/`. |

As variáveis públicas necessárias para inicializar o cliente Supabase são
`NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`. A chave
`service_role` é um segredo de servidor e nunca deve ser exposta em variáveis
`NEXT_PUBLIC_*` nem enviada ao navegador.

O manifesto PWA configura nome, escopo, modo `standalone`, cores de tema e
ícones. Isso estabelece a configuração de instalação; suporte offline,
cache de recursos e sincronização em segundo plano dependem de implementação
adicional de service worker e estratégias de cache.

## 2. Arquitetura modular por funcionalidades

O código de negócio é organizado por domínio em `src/features/`. Cada
funcionalidade reúne sua interface, integração e apresentação, reduzindo
dependências entre áreas não relacionadas.

```text
src/
├── app/
│   ├── api/                 # Route Handlers da API, agrupados por domínio
│   ├── layout.tsx           # Layout raiz, metadados e viewport
│   └── page.tsx             # Página inicial
├── features/
│   ├── auth/
│   ├── cadastros/
│   │   ├── canais/
│   │   ├── categorias/
│   │   ├── fornecedores/
│   │   └── insumos/
│   ├── produtos/
│   ├── producao/
│   └── vendas/
└── lib/
    ├── api/                 # Utilitários compartilhados para API
    └── supabase.ts          # Cliente Supabase compartilhado
```

### Responsabilidades dos domínios

- **`src/features/auth`**: autenticação e experiência de entrada. O fluxo de
  login existente usa Supabase Auth com OAuth do Google.
- **`src/features/cadastros`**: dados auxiliares e de base, incluindo insumos,
  fornecedores, categorias e canais. Os subdomínios mantêm suas próprias
  pastas `components`, `services` e `facades`.
- **`src/features/produtos`**: produtos comercializáveis e suas fichas técnicas.
- **`src/features/producao`**: operações de produção que consomem insumos de
  acordo com a ficha técnica.
- **`src/features/vendas`**: registro e consulta de vendas e respectivos itens.

Cada feature pode conter:

```text
<feature>/
├── components/  # Componentes de interface específicos do domínio
├── services/    # Requisições e integração com a API
└── facades/     # Adaptadores para apresentação e formatação
```

Quando houver um subdomínio independente — como os itens de `cadastros` — suas
camadas devem ficar dentro do próprio subdomínio. Código realmente transversal
deve permanecer em `src/lib/`, evitando que uma feature se torne uma dependência
genérica para as demais.

## 3. Camadas de código e fluxo de dados

### Camadas

1. **Interface (`components`)**: captura ações e apresenta estado e dados.
   Componentes devem depender de serviços ou facades da própria feature, sem
   concentrar acesso direto ao banco.
2. **Services (`services`)**: encapsulam requisições HTTP, métodos, parâmetros,
   serialização de payloads e tratamento explícito de respostas e erros. São o
   ponto de integração usado pelos componentes.
3. **Facades (`facades`)**: adaptam os dados recebidos para a interface,
   centralizando formatação e regras de apresentação — por exemplo, rótulos,
   unidades, datas e valores monetários. Não substituem validações de domínio
   nem regras de integridade do banco.
4. **Route Handlers (`src/app/api`)**: formam a fronteira HTTP do servidor.
   Devem validar entrada, aplicar autorização, coordenar operações e devolver
   respostas tipadas com códigos HTTP apropriados.
5. **Supabase/PostgreSQL**: persiste os dados relacionais. O acesso pelo
   servidor deve respeitar autenticação e autorização, incluindo políticas
   Row Level Security (RLS) quando habilitadas no schema.

### Fluxo esperado

```text
Componente da feature
        │ ação do usuário
        ▼
Facade (adaptação e apresentação, quando necessária)
        │ chamada
        ▼
Service (requisição HTTP e interpretação da resposta)
        │ HTTP
        ▼
Route Handler do domínio (validação e autorização)
        │ acesso ao Supabase
        ▼
Supabase / PostgreSQL
        │ resposta
        └────────── retorno pelo caminho inverso
```

As regras de apresentação pertencem à facade; validação de payload e
autorização devem ser garantidas no servidor, mesmo que a interface também
valide os campos para melhorar a experiência. Operações que atualizem várias
tabelas relacionadas devem preservar a consistência transacional no banco.

### Organização dos endpoints

Os Route Handlers devem acompanhar os domínios, por exemplo:

```text
src/app/api/
├── auth/
├── cadastros/
│   ├── canais/
│   ├── categorias/
│   ├── fornecedores/
│   └── insumos/
├── producao/
├── produtos/
└── vendas/
```

No estado atual, os handlers iniciais usam um helper comum e retornam HTTP 501
até que as operações sejam implementadas. Portanto, o fluxo acima descreve a
arquitetura de referência, não um fluxo completo já ativo em produção.

## 4. Modelo conceitual de dados

O PostgreSQL deve representar entidades de negócio com chaves primárias,
relacionamentos por chaves estrangeiras, restrições de integridade e índices
adequados às consultas. Os nomes abaixo são conceituais; a migração do schema
deve definir nomes, tipos, nulabilidade e políticas RLS definitivos.

### Entidades principais

| Tabela conceitual | Campos sugeridos | Observações |
| --- | --- | --- |
| **`insumos`** | `id`, `nome`, `unidade_medida`, `custo_unitario`, `categoria_id`, `ativo`, `created_at`, `updated_at` | Matérias-primas utilizadas em fichas técnicas e compras. |
| **`fornecedores`** | `id`, `nome`, `documento`, `email`, `telefone`, `ativo`, `created_at`, `updated_at` | Dados de fornecedores; documento e contatos devem ser opcionais conforme a necessidade do negócio. |
| **`categorias`** | `id`, `nome`, `tipo`, `ativo` | Pode classificar insumos e/ou produtos; `tipo` deve distinguir o escopo quando necessário. |
| **`produtos`** | `id`, `nome`, `descricao`, `categoria_id`, `preco_venda`, `ativo`, `created_at`, `updated_at` | Itens disponíveis para produção e comercialização. |
| **`fichas_tecnicas`** | `id`, `produto_id`, `versao`, `rendimento`, `unidade_rendimento`, `ativa`, `created_at` | Define uma versão de composição e rendimento de um produto. |
| **`ficha_tecnica_itens`** | `id`, `ficha_tecnica_id`, `insumo_id`, `quantidade`, `unidade_medida` | Tabela associativa que registra insumos e quantidades de cada ficha. |
| **`compras`** | `id`, `fornecedor_id`, `data_compra`, `status`, `valor_total`, `observacoes`, `created_at` | Cabeçalho da compra e seu vínculo opcional/obrigatório com um fornecedor, conforme regra de negócio. |
| **`compra_itens`** | `id`, `compra_id`, `insumo_id`, `quantidade`, `custo_unitario`, `subtotal` | Itens da compra; preservar o custo praticado no momento da compra. |
| **`vendas`** | `id`, `data_venda`, `canal_id`, `status`, `valor_total`, `observacoes`, `created_at` | Cabeçalho da venda, associado ao canal quando aplicável. |
| **`venda_itens`** | `id`, `venda_id`, `produto_id`, `quantidade`, `preco_unitario`, `subtotal` | Itens vendidos; preservar o preço praticado no momento da venda. |
| **`canais`** | `id`, `nome`, `ativo` | Canais pelos quais as vendas são realizadas. |

### Relacionamentos

```text
categorias 1 ─── N insumos
categorias 1 ─── N produtos
produtos 1 ───── N fichas_tecnicas
fichas_tecnicas 1 ─ N ficha_tecnica_itens N ─ 1 insumos
fornecedores 1 ─ N compras
compras 1 ────── N compra_itens N ─────────── 1 insumos
canais 1 ─────── N vendas
vendas 1 ─────── N venda_itens N ─────────── 1 produtos
```

Uma ficha técnica é versionada para que mudanças futuras de composição não
alterem silenciosamente a interpretação histórica de produtos já produzidos.
Quantidades e valores monetários devem usar tipos decimais apropriados, nunca
aritmética de ponto flutuante sem controle. Compras e vendas devem guardar os
valores unitários aplicados no momento da operação, mesmo que o custo do insumo
ou o preço atual do produto mude depois.

### Integridade e evolução

- Definir chaves estrangeiras e regras de exclusão que protejam o histórico de
  compras, fichas técnicas e vendas; preferir desativação lógica quando o
  registro já for referenciado.
- Criar índices para chaves estrangeiras e filtros frequentes, validando o
  benefício com as consultas reais.
- Definir restrições para quantidades positivas, status válidos e campos
  obrigatórios no banco, além da validação de entrada na API.
- Avaliar o vínculo fornecedor-insumo como relacionamento muitos-para-muitos
  (`fornecedor_insumos`) caso seja necessário registrar catálogo, código ou
  preço por fornecedor.
- Aplicar políticas RLS e escopo de acesso coerentes com os usuários e papéis
  da aplicação. Não considerar a chave pública `anon` uma substituta para
  autorização.

## 5. Identidade visual

A paleta institucional de referência é:

| Uso | Cor | Código |
| --- | --- | --- |
| Verde principal | Verde Hetu | `#1F3D2B` |
| Fundo/base | Creme natural | `#F7F5F2` |
| Texto principal | Texto escuro | `#2A2A2A` |
| Destaques e acentos | Dourado | `#C2A46D` |

Os tokens devem ser centralizados no tema do Tailwind e/ou em variáveis CSS,
para que componentes não definam cores institucionais isoladamente. Usar o
creme como superfície clara, o verde como cor de marca e o dourado com
moderação para destaques. Verificar contraste entre texto, fundo e estados
interativos antes de aplicar a paleta em controles e mensagens.

> **Alinhamento pendente:** os tokens encontrados atualmente em
> `src/app/globals.css` e `tailwind.config.js` usam `#1E3F20`, `#F4F1EA` e
> `#2C3E30`, e ainda não incluem o dourado institucional. A implementação
> visual deve ser alinhada aos valores de referência desta seção em uma
> alteração própria.

## 6. Diretrizes para implementação

- Manter cada capacidade de negócio dentro da feature correspondente e
  compartilhar somente integrações e utilitários realmente transversais.
- Definir contratos de request/response explícitos entre services e Route
  Handlers, com erros previsíveis e validação no servidor.
- Centralizar acesso ao Supabase e proteger credenciais; manter operações
  privilegiadas exclusivamente no servidor.
- Evoluir o schema por migrações versionadas e revisar relacionamentos,
  restrições e RLS junto com cada funcionalidade.
- Tratar consistência histórica em compras, fichas técnicas e vendas por meio
  de versões e valores registrados no momento da operação.
- Considerar a PWA instalável como capacidade já configurada no manifesto;
  implementar e testar separadamente requisitos offline ou de sincronização.
