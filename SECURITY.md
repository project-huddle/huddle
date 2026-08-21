# Política de Segurança

Segurança é uma parte importante do Huddle.

Agradecemos a usuários, contribuidores e pesquisadores de segurança que dedicam tempo para relatar vulnerabilidades de maneira responsável.

## Versões suportadas

O Huddle está atualmente em desenvolvimento ativo e ainda não possui uma versão estável.

Correções de segurança são, em geral, aplicadas à versão mais recente disponível na branch `master`.

Commits antigos, forks, builds não oficiais e deployments modificados podem não receber atualizações de segurança.

## Reportando uma vulnerabilidade

Não reporte vulnerabilidades de segurança por meio de:

* GitHub Issues públicas;
* GitHub Discussions;
* Pull Requests;
* comentários públicos;
* qualquer outro canal público do projeto.

Caso tenha identificado uma possível vulnerabilidade no Huddle, utilize o **GitHub Private Vulnerability Reporting**, disponível na seção **Security** do repositório.

Ao enviar o relatório, inclua, sempre que possível:

* uma descrição clara da vulnerabilidade;
* o componente ou funcionalidade afetada;
* passos necessários para reproduzir o problema;
* o impacto de segurança esperado;
* logs, screenshots, requests, responses ou provas de conceito relevantes;
* uma possível mitigação ou correção, caso tenha alguma sugestão.

Evite incluir informações pessoais desnecessárias, credenciais, tokens de acesso, chaves privadas ou outros dados sensíveis no relatório.

## O que deve ser reportado

Exemplos de problemas que devem ser reportados de forma privada incluem:

* bypass de autenticação;
* bypass de autorização ou permissões;
* tomada de controle de contas;
* Cross-Site Scripting (XSS);
* Cross-Site Request Forgery (CSRF), quando aplicável;
* SQL Injection;
* outras vulnerabilidades de injeção;
* Server-Side Request Forgery (SSRF);
* acesso não autorizado a mensagens, servidores, canais, arquivos ou informações de usuários;
* vulnerabilidades de autenticação ou autorização em WebSocket;
* vulnerabilidades relacionadas à sinalização WebRTC;
* vazamento de sessões, tokens ou tickets WebSocket;
* upload arbitrário de arquivos;
* acesso indevido a arquivos;
* path traversal;
* execução remota de código;
* exposição de segredos ou informações sensíveis;
* vulnerabilidades capazes de afetar significativamente a disponibilidade de uma instalação do Huddle.

Bugs comuns, solicitações de funcionalidades, problemas de performance ou situações sem impacto de segurança devem ser relatados pelo fluxo normal de Issues.

## Divulgação responsável

Pedimos que pesquisadores de segurança:

* concedam tempo razoável para investigação e correção antes da divulgação pública;
* evitem acessar, modificar, excluir ou baixar dados que não lhes pertençam;
* não degradem ou interrompam intencionalmente serviços e infraestrutura;
* realizem testes em sua própria instalação do Huddle sempre que possível;
* interrompam os testes e entrem em contato conosco caso obtenham acesso inesperado a dados privados ou sensíveis.

## Nosso compromisso

Faremos um esforço razoável para:

* confirmar o recebimento de relatórios válidos;
* investigar vulnerabilidades relatadas;
* manter o pesquisador informado quando apropriado;
* corrigir vulnerabilidades confirmadas de acordo com sua severidade e impacto;
* creditar pesquisadores que realizarem divulgação responsável, caso desejem ser creditados.

## Atualizações de segurança

Correções de segurança podem ser disponibilizadas antes de qualquer divulgação pública quando a publicação antecipada de detalhes puder colocar usuários ou instalações do Huddle em risco.

Após a correção, informações relevantes poderão ser publicadas por meio de GitHub Security Advisories, release notes ou outros canais apropriados.

## Escopo

Esta política se aplica ao código-fonte oficial do Huddle mantido pela organização `project-huddle`.

Serviços de terceiros, dependências externas, forks, deployments não oficiais e versões modificadas podem possuir políticas de segurança próprias e estão fora deste escopo.

## Contato

O método preferencial para relatar vulnerabilidades é o **GitHub Private Vulnerability Reporting**.

Caso esse mecanismo esteja temporariamente indisponível, entre em contato com os mantenedores de forma privada em vez de publicar detalhes da vulnerabilidade.
