# Relatório de qualidade e segurança do back-end

Data da revisão: 20 de agosto de 2026.

## Resumo

A revisão cobriu os arquivos de aplicação em `src`, schema e migração Prisma, configuração, imagens Docker, variáveis de ambiente, testes e regras de versionamento. As correções preservam o contrato público existente, exceto pelo fechamento intencional de entregas WebSocket entre canais sem uma assinatura válida.

## Problemas encontrados e soluções

| Severidade | Problema | Solução aplicada |
| --- | --- | --- |
| Crítica | `broadcastChannel` também enviava mensagens a todo socket com `channelId === null`. Como cada cadastro cria sua própria comunidade, usuários sem qualquer vínculo recebiam mensagens uns dos outros. | A entrega agora exige igualdade exata com o canal autorizado. O socket inicia no primeiro canal acessível e a suíte cria explicitamente uma comunidade compartilhada antes de testar chat. |
| Alta | Chamadas WebRTC eram agrupadas globalmente apenas por um `callId` escolhido pelo cliente. Usuários de comunidades diferentes podiam entrar na mesma sala e trocar sinalização. | A chave interna da chamada passou a ser `channelId:callId`. Entrar exige um canal autorizado e trocar de canal remove o socket da chamada anterior. |
| Alta | Presença era difundida globalmente e revelava IDs de usuários sem relação entre si. | Eventos de presença passaram a usar a mesma entrega restrita ao canal. |
| Alta | O handshake WebSocket não validava `Origin`, permitindo que uma página maliciosa tentasse usar uma sessão disponível ao navegador. | O handshake rejeita origens fora de `CORS_ORIGINS`. Clientes sem `Origin` continuam aceitos para permitir integrações não-browser autenticadas. |
| Alta | Login, cadastro, HTTP e eventos WebSocket não tinham proteção contra abuso, brute force ou consumo excessivo. | Foi criado um rate limiter de janela fixa: limites separados para autenticação, HTTP geral e cada conexão WebSocket. Respostas HTTP usam `429` e `Retry-After`. Os limites são configuráveis por ambiente. |
| Alta | O parser JSON e `formData()` podiam começar a alocar corpos arbitrariamente grandes. | JSON agora tem limite por bytes declarados e efetivamente lidos. Uploads rejeitam antecipadamente `Content-Length` incompatível e continuam validando o tamanho real do arquivo. |
| Média | Uma corrida entre a consulta e a criação de e-mail duplicado transformava uma condição esperada em erro `500`. | A restrição única continua sendo a autoridade; o erro Prisma `P2002` é convertido em retorno de domínio e resposta `409 EMAIL_IN_USE`. |
| Média | Respostas dinâmicas não aplicavam um conjunto consistente de headers defensivos. | Foi centralizada a aplicação de `nosniff`, bloqueio de frame, política de referência, restrição de permissões e `no-store`. Mídia versionada mantém seu cache imutável explícito. |
| Média | Validação de mídia e conteúdo estava misturada ao protocolo WebSocket e duplicava regras. URLs do Tenor aceitavam qualquer protocolo. | Regras foram extraídas para `validation.ts`; mídia remota só aceita GIF em `https://media.tenor.com`. |
| Média | Configurações numéricas novas ou inválidas poderiam ser aceitas silenciosamente. | Foi adicionada validação central de inteiros positivos e documentação em `.env.example`. |
| Média | O teste principal dependia acidentalmente do vazamento entre canais: Alice e Bob nunca compartilhavam uma comunidade. | O cenário agora cria convite, associação e assinatura do canal antes de chat, upload e chamada, tornando a autorização parte da especificação testada. |
| Baixa | O arquivo de entrada concentrava validações, segurança e detalhes de infraestrutura. | Limitação de requisições foi isolada em `rate-limit.ts`, validações de domínio em `validation.ts`, headers/parsing permanecem em `http.ts`, autenticação em `auth.ts` e persistência em `database.ts`. |
| Baixa | `database.ts` continha a criação transacional de usuário/comunidade em uma única linha extensa e escondia o tratamento de conflito. | A operação foi expandida, nomeada e passou a tratar explicitamente o conflito único, melhorando leitura e manutenção. |

## Pontos verificados sem alteração

- Tokens de sessão têm 256 bits aleatórios e somente SHA-256 é persistido.
- Senhas usam Argon2id e mensagens de login não enumeram contas.
- Consultas Prisma evitam interpolação SQL e verificam associação antes de ler canais/mensagens.
- Uploads usam nome UUID, lista fechada de extensões e inspeção de assinatura do arquivo.
- Os arquivos SQLite locais e `.env` estão cobertos pelo `.gitignore` e não estão versionados.
- O schema possui constraints para papéis, tipos de canal e tipos de mídia, além dos índices relevantes ao histórico.

## Validação executada

- `node_modules/.bin/tsc --noEmit`: aprovado.
- `prisma validate` com uma URL PostgreSQL de validação: aprovado.
- `git diff --check`: aprovado.
- A suíte `bun test` não pôde ser executada neste ambiente porque o binário Bun não está instalado e a integração Docker da distribuição WSL está desabilitada. A suíte foi atualizada e permaneceu coberta pelo typecheck.

## Risco residual conhecido

O cliente atual envia o token WebSocket na query string. Isso mantém compatibilidade, mas URLs podem aparecer em logs de proxy. A migração recomendada é transportar uma credencial efêmera de handshake (curta duração e uso único) ou um subprotocolo WebSocket, coordenando a mudança com o cliente e a infraestrutura. Não foi removido unilateralmente porque quebraria todos os clientes existentes e está fora do escopo exclusivo do back-end.
