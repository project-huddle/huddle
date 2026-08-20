# Refatoração do bootstrap e da persistência do back-end

Data: 20 de agosto de 2026

## Problemas encontrados

`server/src/index.ts` acumulava bootstrap, rotas HTTP, upload de arquivos, controle de chamadas e protocolo WebSocket. A primeira extração apenas transferiu esse conteúdo para `runtime.ts`, criando outro god object. Essa solução intermediária não atendia ao separation of concerns e foi substituída pela decomposição descrita abaixo.

`server/src/database.ts` concentrava cliente Prisma, tipos de projeção, conversão de entidades e repositórios de identidade, sessão, servidor, membro, canal, convite e mensagem. Além do tamanho, consumidores importavam o módulo inteiro e ficavam acoplados a responsabilidades que não utilizavam.

Também foi identificado o risco de regressão na autorização durante a extração: convites e criação de canais não podem depender apenas de uma role genérica; precisam consultar a permission específica e os overrides persistidos no membro.

## Correções implementadas

- `server/src/index.ts` passou a ser um composition root de seis linhas: cria o runtime e anuncia a porta. Não contém regras HTTP, WebSocket ou persistência.
- `server/src/runtime.ts` passou a ter somente 45 linhas e compõe rate limiting, roteador HTTP e handler WebSocket. Ele expõe `createRuntimeServer`, sem iniciar processos por efeito colateral de importação.
- `interfaces/http/router.ts` concentra apenas o despacho do transporte HTTP, incluindo autenticação, recursos da comunidade e mídia.
- `interfaces/realtime/realtime-gateway.ts` encapsula conexões, presença, inscrições em canais, chamadas, sinalização WebRTC e eventos de mensagem.
- O roteador HTTP interage com realtime por uma interface pequena (`notifyUser`, tickets e revogação), sem acessar os mapas internos de sockets ou chamadas.
- Elysia foi adotado como framework de transporte em `interfaces/http/application.ts`, controlando HTTP e a rota `/ws`, além de lifecycle, rate limit, CORS, headers de segurança e erros. O código de produção não instancia mais `Bun.serve`, não executa `server.upgrade` e não usa `Bun.ServerWebSocket`.
- `server/src/database.ts` foi reduzido a uma fachada temporária de compatibilidade, documentada para não ser usada por código novo.
- A implementação Prisma foi separada por responsabilidade em `infra/database`:
  - `client.ts`: acesso ao cliente;
  - `mappers.ts`: projeções, tipos e conversões entre Prisma e respostas da aplicação;
  - `identity-repository.ts`: usuários e sessões;
  - `server-repository.ts`: servidores, membros, roles, permissions, convites e canais;
  - `message-repository.ts`: histórico, edição, exclusão e reações.
- Runtime, serviços de aplicação, validações e rotas sociais agora importam somente o repositório necessário.
- `createUser` continua sem criar comunidade ou canal automaticamente, mantendo o fluxo de entrada semelhante ao Discord.
- Convites e canais usam `hasServerPermission` com `invites.create` e `channels.create`, incluindo overrides persistidos.

## Qualidade e validação

- Código formatado com Prettier, sem compactação artificial de funções.
- `npm run typecheck`: aprovado.
- `git diff --check`: aprovado.
- A suíte Bun não pôde ser executada nesta sessão porque o binário `bun` não está disponível no PATH do ambiente; o typecheck cobre integralmente os novos limites de módulo, mas os testes de integração ainda devem ser executados no ambiente Docker/Bun antes do merge.

## Atenções adicionais

A fachada `database.ts` existe somente para compatibilidade com testes e módulos legados e deve ser removida quando essas importações forem migradas. Dentro do transporte HTTP, novas funcionalidades devem ser adicionadas em handlers de feature, não diretamente no dispatcher, para impedir que `router.ts` volte a crescer sem limites.
