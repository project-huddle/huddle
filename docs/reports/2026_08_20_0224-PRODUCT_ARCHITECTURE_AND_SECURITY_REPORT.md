# Relatório de evolução de produto, arquitetura e segurança

Data: 20 de agosto de 2026.

## Resultado

A revisão tratou as falhas que impediam os fluxos básicos, redesenhou o onboarding para não criar comunidades automaticamente, adicionou a primeira versão das áreas social, identidade e moderação e iniciou a migração do back-end para DDD pragmático em camadas. A interface principal agora ocupa toda a viewport e removeu o grande destaque decorativo que competia com a conversa.

## Correções dos fluxos existentes

- criação de servidor e canal continua autorizada por papel/permissão e possui onboarding explícito quando a conta não participa de nenhum servidor;
- convites são criados por proprietário, moderador ou permissão específica;
- mensagens e sinalização de chamadas continuam isoladas por canal e foram cobertas novamente pela suíte de integração;
- o WebSocket usa ticket de uso único e revoga imediatamente sockets de membros removidos;
- o teste E2E passou a criar o servidor explicitamente, refletindo o novo onboarding;
- o aviso duplicado `noUncheckedIndexedAccess` foi removido do `tsconfig`.

## Produto e front-end

### Onboarding e layout

- contas novas não recebem mais “Minha comunidade” e “geral” automaticamente;
- o estado vazio oferece três ações claras: criar servidor, usar convite ou encontrar amigos;
- o grid deixou de usar largura máxima centralizada e ocupa toda a tela;
- o banner grande no topo da conversa foi removido;
- atalhos de amigos/mensagens e configurações foram adicionados ao cabeçalho e à navegação.

### Amigos e mensagens privadas

- solicitação por e-mail;
- estados pendente recebido, pendente enviado e aceito;
- aceite e remoção de amizade na API;
- conversa privada permitida somente entre amizades aceitas;
- histórico privado limitado e ordenado;
- entrega de novos eventos ao destinatário conectado por WebSocket.

### Perfil e segurança da conta

- alteração de nome e foto usando o pipeline seguro de upload existente;
- alteração de senha com confirmação da senha atual e revogação de todas as sessões;
- confirmação de e-mail por código com hash e expiração;
- 2FA por e-mail com desafio pré-sessão, código de seis dígitos, hash, expiração de dez minutos e consumo único;
- telas para país, confirmação de e-mail e 2FA.

## Identificação e aferição de idade

Atualização de 22/08/2026: a proposta de identificar usuários e aferir idade por CPF foi rejeitada após a avaliação de custo, privacidade e complexidade operacional. A integração externa avaliada foi removida, assim como a coleta de CPF e data de nascimento, os resultados derivados de idade e as configurações específicas. A [ADR-007](../ADR/007-cpf-idade-e-privacidade.md) registra a decisão e condiciona qualquer alternativa futura a uma nova investigação.

## Moderação, roles e permissions

Papéis continuam sendo `owner`, `moderator` e `member`, agora associados a permissões explícitas:

- `channels.create`;
- `invites.create`;
- `members.manage`;
- `messages.moderate`;
- `reports.review`.

O proprietário pode definir overrides de permissões por membro. Reports aceitam servidor, mensagem, usuário alvo e justificativa; revisores precisam da permissão correspondente. Quando `MODERATION_EMAIL` está configurado, um novo report gera notificação por e-mail.

## E-mail

Nodemailer foi configurado com SMTP por variáveis de ambiente. Confirmação de e-mail, 2FA e alertas de moderação usam o adaptador em `infra/email`. Em desenvolvimento sem SMTP, o transporte JSON evita dependência externa. Produção ainda precisa configurar SPF, DKIM, DMARC, reputação e monitoramento de entrega.

## Arquitetura

Foram criadas as camadas:

```text
server/src/
├── core/        # roles e permissions sem infraestrutura
├── app/         # casos de uso de identidade
├── infra/       # Nodemailer e Prisma
├── interfaces/  # rotas HTTP das novas áreas
├── database.ts  # fachada legada de persistência
└── index.ts     # bootstrap e rotas/protocolo legados
```

Todo o código foi formatado, eliminando o estilo de múltiplas operações comprimidas na mesma linha. Isso tornou visível o tamanho real dos módulos. A migração arquitetural está funcional, mas não deve ser descrita como concluída: `index.ts`, `database.ts`, `chat-page.tsx` e o novo router social ainda excedem o tamanho desejável. A próxima extração deve separar agregados de servidor, mensagens e chamada sem mudar contratos públicos.

## Banco e migração

A migração `20260820020000_identity_social_moderation` adiciona:

- perfil, confirmação de e-mail e 2FA;
- tokens de e-mail;
- amizades;
- mensagens privadas;
- reports;
- overrides de permissões.

Contas existentes mantêm suas comunidades; somente novas contas deixam de receber uma comunidade automática.

## Testes e cobertura

Executado em PostgreSQL 17 temporário e Bun 1.3.11:

- migrações: aprovadas;
- suíte de back-end com cobertura: **10 testes, 77 asserções e 0 falhas**;
- cobertura medida: **93,14% de funções e 89,71% de linhas**;
- regras unitárias: permissions e rate limiter;
- integração: autenticação, ticket WebSocket, servidores, convites, canais, chat, uploads, WebRTC, reações, revogação, perfil protegido, amizades e mensagens privadas;
- typecheck do servidor: aprovado;
- lint e build do cliente: aprovados;
- Prisma schema e três migrações: aprovados.
- imagens Docker de desenvolvimento do cliente e servidor: construídas com sucesso usando lockfiles congelados;
- configuração Compose e integridade de whitespace: aprovadas.

O Playwright foi atualizado e o Chromium baixado. A execução não chegou aos cenários porque o host não possui `libatk-1.0.so.0`; a instalação automática das bibliotecas exigiu senha de `sudo`, indisponível no ambiente. Isso é uma limitação ambiental, não aprovação dos testes E2E.

## Riscos e próximos passos

1. Concluir a extração das fachadas legadas para repositórios e casos de uso por agregado.
2. Executar Playwright em CI/imagem oficial com todas as bibliotecas do Chromium.
3. Adicionar TOTP ou WebAuthn; e-mail 2FA depende da segurança da própria caixa postal.
4. Elaborar política de privacidade, retenção e processo de direitos do titular antes de produção.
5. Mover tickets WebSocket e desafios para armazenamento compartilhado antes de múltiplas réplicas.
6. Acompanhar quatro advisories altos transitivos do CLI Prisma. O npm recomenda downgrade para 6.12, que não foi aplicado por risco de incompatibilidade; o cliente não apresentou advisories.
