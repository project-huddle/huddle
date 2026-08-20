![Huddle — seu espaço, do seu jeito](docs/assets/Banner-git.png)

# Huddle

**Seu espaço. Do seu jeito.** Uma plataforma brasileira de comunicação para comunidades conversarem por texto, voz e vídeo.

> [!WARNING]
> **Em desenvolvimento ativo.** O Huddle ainda não está pronto para uso em produção e pode apresentar bugs, mudanças incompatíveis e limitações. Testes, relatos e contribuições são bem-vindos.

## Sobre o Huddle

O Huddle nasceu para oferecer uma alternativa mais segura, humana e aberta às plataformas de comunicação atuais: um lugar onde grupos de amigos, gamers, artistas, estudantes, fandoms, criadores e equipes possam conversar, criar e estar juntos.

O projeto é gratuito, open source, feito no Brasil e financiado coletivamente. Não usa anúncios nem comercializa dados pessoais. Privacidade e transparência fazem parte da base do produto — não são recursos premium.

### O que orienta o projeto

- **Feito para pessoas:** o bem-estar das comunidades vem antes de métricas de publicidade.
- **Privacidade desde a base:** respeito aos dados pessoais desde as decisões iniciais de produto e engenharia.
- **Sem anúncios:** a atenção das pessoas não é o produto.
- **Gratuito e aberto:** o código pode ser estudado, testado e melhorado pela comunidade.
- **Segurança contínua:** proteção de dados e cuidado com cada pessoa não são tratados como nota de rodapé.
- **Construído em comunidade:** bugs, ideias, documentação, testes e código ajudam a decidir os próximos passos.

## O que já funciona

A implementação atual inclui:

- criação de conta, login, logout e sessões persistentes;
- criação de servidores e canais de texto;
- convites com validade, entrada e saída de servidores;
- membros com papéis de proprietário, moderador e membro;
- chat em tempo real por WebSocket, histórico persistente e presença online;
- respostas, edição, exclusão e reações em mensagens;
- envio de JPEG, PNG, GIF e WebP de até 8 MB;
- busca opcional de GIFs pelo Tenor, para quem já possui uma chave compatível;
- chamadas entre participantes com áudio, câmera e compartilhamento de tela via WebRTC;
- interface responsiva e temas claro e escuro;
- controles básicos de moderação para alterar papéis e remover membros.

Não há um roadmap versionado no repositório. Por isso, intenções futuras não são apresentadas aqui como funcionalidades prometidas.

## Tecnologias e arquitetura

O Huddle é organizado como uma aplicação web com três serviços:

| Camada | Tecnologias | Responsabilidade |
| --- | --- | --- |
| Cliente | React 19, TypeScript, Vite, Tailwind CSS, Zustand e Zod | Interface, estado local, chamadas WebRTC e conexão em tempo real |
| API | Bun, TypeScript e Prisma | Autenticação, regras de negócio, HTTP, WebSocket e sinalização WebRTC |
| Dados | PostgreSQL 17 | Usuários, sessões, comunidades, canais, mensagens, reações e convites |
| Entrega | Docker Compose e Nginx | Orquestração local, cliente estático e proxy de HTTP/WebSocket |

No ambiente empacotado, o navegador acessa somente o Nginx. Ele serve o cliente e encaminha `/api`, `/media` e `/ws` para a API. Mensagens e eventos de presença passam pelo WebSocket; áudio, vídeo e tela trafegam diretamente entre navegadores por WebRTC. Em redes restritivas, essa mídia pode precisar de um servidor TURN externo.

Os dados do PostgreSQL e as imagens enviadas ficam nos volumes Docker `huddle-postgres` e `huddle-data`. As migrações Prisma são aplicadas automaticamente antes da API iniciar.

## Pré-requisitos

### Caminho recomendado

- Docker com Compose v2.

### Execução sem Docker

- Bun 1.3 (a CI e as imagens usam 1.3.12);
- PostgreSQL; a configuração de referência usa PostgreSQL 17;
- um navegador moderno com suporte a WebSocket e WebRTC.

Microfone, câmera e compartilhamento de tela exigem um contexto seguro: `localhost` durante o desenvolvimento ou HTTPS nos demais ambientes.

## Executar com Docker

Na raiz do repositório:

```bash
cp .env.example .env
docker compose up --build -d
docker compose ps
```

Acesse <http://localhost:8080>. Para acompanhar os serviços ou encerrá-los:

```bash
docker compose logs -f
docker compose down
```

O comando `docker compose down` preserva os volumes com banco e uploads.

### Desenvolvimento com recarga automática

```bash
docker compose -f compose.yaml -f compose.dev.yaml up --build
```

O cliente usa HMR e o servidor reinicia ao detectar alterações. A aplicação continua disponível em <http://localhost:8080>. Para encerrar:

```bash
docker compose -f compose.yaml -f compose.dev.yaml down
```

## Executar sem Docker

Crie previamente um banco PostgreSQL vazio e use dois terminais.

No primeiro, inicie a API:

```bash
cd server
bun install --frozen-lockfile
cp .env.example .env
# Ajuste DATABASE_URL no arquivo .env para o seu banco.
# Inclua http://localhost:8080 em CORS_ORIGINS.
bun run db:generate
bun run db:migrate
bun run dev
```

No segundo, inicie o cliente:

```bash
cd client
bun install --frozen-lockfile
VITE_API_URL=http://localhost:3000 bun run dev
```

Cliente e API ficam disponíveis, respectivamente, em `http://localhost:8080` e `http://localhost:3000`.

## Variáveis de ambiente

Use [`.env.example`](.env.example) com Docker Compose. Para executar apenas a API, use [`server/.env.example`](server/.env.example). Nunca envie credenciais reais ao repositório.

### Docker Compose

| Variável | Necessária | Finalidade |
| --- | --- | --- |
| `APP_PORT` | Não | Porta pública do Nginx; padrão `8080` |
| `APP_ORIGIN` | Não | Origem exata permitida pela API; padrão `http://localhost:8080` |
| `POSTGRES_DB` | Não | Nome do banco criado pelo contêiner |
| `POSTGRES_USER` | Não | Usuário do PostgreSQL |
| `POSTGRES_PASSWORD` | Não | Senha do PostgreSQL; deve ser trocada fora do desenvolvimento local |
| `DATABASE_URL` | Não no Compose | URL de conexão usada pela API; o Compose fornece um valor local padrão |
| `TURN_URL` | Não | URL do servidor TURN usada pelo cliente |
| `TURN_USERNAME` | Não | Usuário TURN |
| `TURN_CREDENTIAL` | Não | Credencial TURN |
| `TENOR_API_KEY` | Não | Chave existente da API do Tenor para busca de GIFs |
| `TENOR_CLIENT_KEY` | Não | Identificador de cliente enviado ao Tenor; padrão `huddle` |

### API

| Variável | Necessária | Finalidade |
| --- | --- | --- |
| `DATABASE_URL` | Sim | Conexão PostgreSQL usada pelo Prisma |
| `HOST` | Não | Interface de rede; padrão `0.0.0.0` |
| `PORT` | Não | Porta da API; padrão `3000` |
| `UPLOADS_PATH` | Não | Diretório dos uploads; padrão `data/uploads` |
| `CORS_ORIGINS` | Não | Lista de origens permitidas, separadas por vírgula |
| `MAX_JSON_BYTES` | Não | Limite dos corpos JSON; padrão `16384` |
| `AUTH_ATTEMPTS_PER_MINUTE` | Não | Limite por IP para login e cadastro; padrão `20` |
| `REQUESTS_PER_MINUTE` | Não | Limite geral de requisições por IP; padrão `300` |
| `TENOR_API_KEY` | Não | Habilita a busca integrada de GIFs |
| `TENOR_CLIENT_KEY` | Não | Identificador usado nas requisições ao Tenor |

No cliente, `VITE_API_URL` define a origem da API. `VITE_TURN_URL`, `VITE_TURN_USERNAME` e `VITE_TURN_CREDENTIAL` são incorporadas ao build e, portanto, chegam ao navegador. Em produção, prefira credenciais TURN temporárias.

## Validação, testes e build

### API

```bash
cd server
bun install --frozen-lockfile
bun run db:generate
bun run typecheck
```

Os testes de integração limpam o banco informado. Use **sempre um banco PostgreSQL exclusivo para testes**, já criado e migrado:

```bash
cd server
DATABASE_URL=postgresql://USUARIO:SENHA@localhost:5432/huddle_test?schema=public bun run db:migrate
DATABASE_URL=postgresql://USUARIO:SENHA@localhost:5432/huddle_test?schema=public bun test
```

### Cliente

```bash
cd client
bun install --frozen-lockfile
bun run lint
bun run build
```

Há também uma suíte de interface com Playwright. Ela inicia cliente e API, mas requer o banco de teste configurado e o Chromium do Playwright instalado:

```bash
cd client
bunx playwright install chromium
DATABASE_URL=postgresql://USUARIO:SENHA@localhost:5432/huddle_test?schema=public bun run e2e
```

O repositório não possui atualmente um comando próprio de formatação. A CI executa testes e verificação de tipos da API, além de lint e build do cliente. Em `main`, ela também publica imagens do cliente e do servidor no GitHub Container Registry.

## Estrutura do projeto

```text
.
├── client/                 # aplicação React e testes Playwright
│   ├── e2e/
│   └── src/
├── server/                 # API Bun, WebSocket e regras de negócio
│   ├── prisma/             # schema e migrações do PostgreSQL
│   └── src/
├── docs/                   # identidade visual e relatórios técnicos
├── compose.yaml            # ambiente empacotado
└── compose.dev.yaml        # sobreposições para desenvolvimento
```

Os endpoints de saúde são `/health` na API e `/healthz` no Nginx.

## Como contribuir

Você pode participar reportando bugs, propondo melhorias, testando fluxos ou contribuindo com código e documentação.

1. Crie uma branch curta e focada.
2. Faça a alteração e inclua testes quando aplicável.
3. Execute as validações das áreas alteradas.
4. Abra uma contribuição explicando o problema, a solução e como ela foi verificada.

Antes de relatar um bug, evite incluir tokens, senhas, dados pessoais, conteúdo privado de comunidades ou outros segredos.

> **TODO:** adicionar os links oficiais do repositório e do rastreador de issues quando forem definidos. 

## Segurança e privacidade

O compromisso público do Huddle é construir uma plataforma responsável, alinhada à legislação brasileira de proteção de dados, à LGPD e aos princípios de proteção integral previstos no ECA. Esse é um trabalho contínuo, não uma declaração de que a versão atual passou por auditoria independente ou está pronta para produção.

Na implementação atual:

- senhas são derivadas com Argon2id;
- somente o hash SHA-256 dos tokens de sessão é persistido;
- conexões WebSocket usam tickets descartáveis com validade de 30 segundos;
- acesso a servidores, canais e mensagens é verificado na API;
- há limites de requisições HTTP e eventos WebSocket;
- uploads têm tamanho, assinatura e formatos validados;
- respostas recebem cabeçalhos básicos de segurança;
- mídia de chamadas usa WebRTC entre navegadores; a API atua na sinalização.

Não há uma política formal de divulgação de vulnerabilidades versionada neste repositório. Até que ela exista, não publique credenciais, dados pessoais ou detalhes exploráveis em relatos públicos.

## Estado atual e limitações

- O produto está em desenvolvimento ativo e pode mudar sem garantia de compatibilidade.
- A arquitetura WebRTC atual é ponto a ponto e pode precisar de TURN em redes restritivas.
- Fora de `localhost`, recursos de mídia dependem de HTTPS.
- A busca de GIFs depende de uma chave existente do Tenor; sem ela, uploads locais de GIF continuam funcionando.
- Não há evidência de auditoria independente de segurança ou prontidão para produção.
- Não há política de segurança, código de conduta ou guia de contribuição dedicados no repositório neste momento.

## Licença

> **TODO:** definir e adicionar um arquivo de licença. Embora o projeto se apresente publicamente como open source, nenhuma licença pôde ser confirmada neste repositório; até que uma seja publicada, não presuma permissões de uso, modificação ou redistribuição.

## Apoie o Huddle

O projeto é independente e financiado coletivamente. Se você acredita em uma comunicação mais humana, aberta e segura, pode [apoiar o Huddle no Ko-fi](https://ko-fi.com/huddlesocial).

Feito com cuidado, código aberto e café no Brasil.
