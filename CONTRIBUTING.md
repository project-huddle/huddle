# Contribuindo com o Huddle

Obrigado pelo interesse em contribuir com o Huddle.

O Huddle é uma plataforma de comunicação open source, e contribuições da comunidade são bem-vindas — seja com código, documentação, testes, design, acessibilidade, relatos de bugs ou novas ideias.

## Primeiros passos

Antes de iniciar uma contribuição significativa:

1. Verifique issues e pull requests existentes para confirmar se o problema ou funcionalidade já está sendo discutido.
2. Para funcionalidades maiores ou mudanças arquiteturais relevantes, abra uma issue ou discussão antes de iniciar a implementação.
3. Mantenha as contribuições focadas. Pull requests menores e bem delimitados geralmente são mais fáceis de revisar e integrar.

Pequenas correções de bugs, melhorias de documentação, testes e alterações semelhantes normalmente não exigem discussão prévia.

## Ambiente de desenvolvimento

O Huddle é organizado como um monorepo contendo o cliente, o servidor e a infraestrutura de suporte.

As principais tecnologias utilizadas atualmente incluem:

* TypeScript
* React
* Bun
* Elysia
* PostgreSQL
* Prisma
* WebSocket
* WebRTC
* Docker

Consulte o `README.md` e a documentação do projeto para instruções atualizadas sobre configuração do ambiente e comandos de desenvolvimento.

## Arquitetura

O backend do Huddle segue uma arquitetura modular baseada em:

* Vertical Slice Architecture
* Functional Core / Imperative Shell
* limites de domínio explícitos
* separação clara entre domínio, infraestrutura e interfaces externas

Regras de negócio devem permanecer, sempre que possível, independentes de frameworks, bibliotecas de transporte e detalhes de infraestrutura.

Elysia e outras dependências relacionadas a HTTP, WebSocket, persistência ou integração externa devem permanecer nas bordas apropriadas do sistema.

Evite introduzir abstrações genéricas, facades de compatibilidade ou camadas intermediárias sem uma necessidade arquitetural clara.

Quando uma migração exigir compatibilidade temporária, essa camada deve ser explicitamente tratada como transitória e possuir uma estratégia de remoção.

A arquitetura do projeto continua evoluindo. Em caso de dúvida, siga os padrões utilizados nas partes mais recentemente atualizadas do código ou abra uma discussão antes de implementar mudanças estruturais significativas.

## Diretrizes de código

Ao contribuir com código:

* Siga as convenções TypeScript existentes no projeto.
* Prefira código claro e explícito a abstrações desnecessárias.
* Mantenha módulos focados em responsabilidades bem definidas.
* Evite novas dependências quando o benefício não justificar o custo de manutenção.
* Valide dados recebidos de clientes ou sistemas externos.
* Nunca dependa exclusivamente do frontend para decisões de autorização ou segurança.
* Não faça commit de segredos, credenciais, tokens, chaves privadas ou configurações específicas de ambiente.
* Adicione ou atualize testes ao modificar comportamentos importantes.
* Prefira funções pequenas e legíveis.
* Evite funções ou módulos que acumulem responsabilidades de múltiplos domínios.
* Não introduza código de compatibilidade legado sem um plano explícito de remoção.

Para funcionalidades realtime, trate mensagens WebSocket como uma API externa.

Novos eventos devem possuir:

* payload claramente definido;
* validação de entrada;
* regras de autorização apropriadas;
* tratamento explícito de erros quando necessário.

## Convenção de branches

Branches devem seguir o formato:

`<tipo>/<descricao-em-kebab-case>`

Tipos permitidos:

* `feat` — nova funcionalidade.
* `fix` — correção de bug.
* `refactor` — refatoração sem mudança intencional de comportamento.
* `chore` — manutenção, configuração ou tarefas internas.
* `docs` — documentação.
* `test` — testes.
* `perf` — melhorias de performance.
* `ci` — CI/CD e automações.
* `security` — alterações relacionadas à segurança.
* `build` — sistema de build, containers ou empacotamento.

Exemplos válidos:

* `feat/channel-permissions`
* `fix/websocket-reconnect`
* `refactor/remove-legacy-auth-facade`
* `chore/github-governance`
* `docs/architecture-guidelines`
* `security/session-hardening`

A descrição deve utilizar letras minúsculas, números quando necessário e `kebab-case`.

Evite:

* nomes vagos;
* nomes pessoais;
* underscores;
* branches como `teste`, `nova`, `ajuste`, `temp` ou similares;
* tipos fora da convenção estabelecida.

O padrão utilizado pelo Ruleset do repositório é:

`^(feat|fix|refactor|chore|docs|test|perf|ci|security|build)\/[a-z0-9]+(?:-[a-z0-9]+)*$`

## Commits

Os commits devem seguir, sempre que possível, a convenção Conventional Commits.

Formato recomendado:

`<tipo>(<escopo>): <descrição>`

Exemplos:

* `feat(auth): add session expiration handling`
* `fix(websocket): reject expired connection tickets`
* `refactor(server): remove legacy database facade`
* `docs(architecture): document vertical slice adoption`
* `chore(github): add repository governance templates`

Commits devem representar mudanças coesas e compreensíveis.

Evite commits como:

* `fix`
* `changes`
* `update`
* `ajustes`
* `teste`
* `final`
* `final-final`

## Pull Requests

Pull requests devem:

* possuir título e descrição claros;
* explicar qual problema está sendo resolvido;
* descrever decisões de implementação relevantes;
* permanecer focados no objetivo proposto;
* incluir testes quando aplicável;
* passar pelas verificações automatizadas do projeto;
* atualizar documentação quando necessário.

Mudanças arquiteturais relevantes devem explicar seus impactos e trade-offs.

Screenshots ou gravações são recomendados para alterações visuais significativas.

Durante a revisão, alterações podem ser solicitadas antes do merge. Isso faz parte do fluxo normal de desenvolvimento.

O método preferencial de integração na `master` é **squash merge**, mantendo o histórico principal limpo e cada pull request representado por um commit coeso.

## Segurança

Não relate vulnerabilidades de segurança ainda não divulgadas por meio de issues, discussions ou pull requests públicos.

Siga as instruções do `SECURITY.md` para relatar vulnerabilidades de maneira privada.

## Licenciamento

O Huddle é licenciado sob a GNU Affero General Public License versão 3.0 (`AGPL-3.0-only`).

Ao enviar uma contribuição para o Huddle, você concorda que ela poderá ser distribuída sob a mesma licença do projeto.

Você também declara possuir o direito de enviar o código, assets, documentação ou qualquer outro material incluído na contribuição.

Não envie conteúdo cuja distribuição não seja permitida sob termos compatíveis com a licença do Huddle.

## Contribuições assistidas por IA

O uso de ferramentas de desenvolvimento assistido por IA é permitido.

Entretanto, o colaborador continua responsável por:

* compreender o código enviado;
* revisar a implementação;
* verificar sua correção;
* executar ou adicionar testes;
* garantir compatibilidade de licenciamento;
* evitar introdução de código legado, abstrações desnecessárias ou vulnerabilidades.

Pull requests contendo grandes quantidades de código gerado automaticamente sem revisão, explicação ou entendimento adequado poderão ser rejeitados.

## Comunidade

Seja respeitoso e construtivo ao interagir com mantenedores e outros colaboradores.

Discordâncias técnicas são bem-vindas.

Ataques pessoais, assédio, discriminação ou comportamento abusivo não são aceitáveis.

O objetivo é desenvolver o Huddle de forma colaborativa, mantendo um ambiente saudável para contribuidores e usuários.
