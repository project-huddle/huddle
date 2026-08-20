# Relatório de qualidade full-stack

Data da revisão: 20 de agosto de 2026.

## Resumo executivo

Esta revisão conferiu no código as correções descritas nos relatórios anteriores de back-end e front-end, tratou as pendências de maior impacto que ainda estavam abertas e realizou uma nova auditoria dos fluxos de autenticação, autorização em tempo real, mensagens, chamadas WebRTC, acessibilidade e testes.

As proteções críticas descritas anteriormente — isolamento de canais e chamadas, validação de origem, limites de requisição e corpo, validação de mídia e correção do sender de compartilhamento — estavam presentes. A nova análise encontrou uma quebra crítica de revogação de acesso e três problemas de alta prioridade: exposição do token de sessão em URLs WebSocket, reações sem autoria e classificação frágil das tracks de vídeo. Todos foram corrigidos.

## Problemas corrigidos

| Severidade | Área | Problema | Correção |
| --- | --- | --- | --- |
| Crítica | Back-end / WebSocket | Um membro removido ou que saísse de um servidor permanecia inscrito no canal pela conexão já aberta e continuava recebendo broadcasts. | Após a remoção do vínculo, todos os sockets do usuário são revalidados. Assinaturas sem autorização são anuladas, chamadas são encerradas e o cliente recebe `access_revoked`. Um teste confirma também que o usuário removido não consegue enviar nova mensagem. |
| Alta | Full-stack / autenticação | O token de sessão era enviado em `?token=` no WebSocket e podia aparecer em logs de proxy, histórico de observabilidade e ferramentas de diagnóstico. | Foi criado `POST /auth/ws-ticket`, protegido por Bearer, que emite um ticket aleatório, válido por 30 segundos e de uso único. O WebSocket aceita somente `?ticket=` e consome o ticket no primeiro uso. A reutilização e o formato antigo são rejeitados por teste. |
| Alta | Back-end / dados | Reações eram um contador JSON por emoji. Qualquer usuário removia o contador inteiro ao clicar em uma reação já existente, mesmo quando pertencia a outra pessoa. | Foi criada a tabela `message_reactions`, com chave composta por mensagem, usuário e emoji. A alternância agora afeta somente a reação do usuário atual e as contagens são agregadas na leitura. O teste cobre dois usuários reagindo e um deles removendo apenas a própria reação. |
| Alta | Front-end / WebRTC | Câmera e tela remota eram diferenciadas pela ordem de chegada das tracks de vídeo. Renegociação, ausência de câmera ou mudança de ordem podia exibir a tela como câmera e limpar ambos os streams ao encerrar uma track. | O sinal `screen_share` agora mantém o estado explícito por participante e orienta a classificação da track. O encerramento limpa apenas câmera ou tela, conforme o tipo identificado. |
| Média | Front-end / chamada | A entrada na chamada exigia câmera e microfone simultaneamente. Pessoas sem câmera não conseguiam entrar, embora áudio estivesse disponível. | Em erros de dispositivo ausente ou restrição de vídeo, o cliente tenta novamente somente com áudio e marca a câmera como desligada. Negação de permissão e falhas de microfone continuam gerando erro explícito. |
| Média | Front-end / acessibilidade | O modal restaurava foco e fechava por `Escape`, mas o usuário podia navegar com `Tab` para elementos atrás do diálogo. | Foi implementado confinamento de foco nos elementos interativos do modal, incluindo navegação reversa com `Shift+Tab` e fallback para o próprio painel. |
| Média | Testes E2E | O teste de edição ainda esperava um `window.prompt`, embora a interface já tivesse migrado para modal. | O cenário Playwright passou a localizar o diálogo “Editar mensagem”, preencher o campo e salvar pelo botão visível. |
| Baixa | Front-end / lint | `button.tsx` exportava um helper não utilizado junto do componente e gerava aviso de Fast Refresh. | O helper passou a ser privado ao módulo; o lint agora termina sem avisos. |

## Migração e compatibilidade de dados

A migração `20260820000000_message_reactions` adiciona a tabela normalizada sem apagar a coluna JSON anterior. Contadores históricos válidos continuam aparecendo somados às novas reações para evitar perda visual de dados. Como o formato antigo não registra quem reagiu, não é possível reconstruir autoria nem permitir a remoção individual dessas reações legadas. Novas reações têm autoria correta e são alternadas individualmente.

## Arquivos principais alterados

- `server/src/index.ts`: tickets descartáveis e revogação imediata de sockets sem acesso;
- `server/src/database.ts`: persistência e agregação de reações por usuário;
- `server/src/index.test.ts`: regressões para ticket, replay, reações independentes e remoção de acesso;
- `server/prisma/schema.prisma` e nova migração: modelo `MessageReaction`;
- `client/src/hooks/use-realtime.ts`: obtenção do ticket, áudio sem câmera, classificação e limpeza de tracks;
- `client/src/components/ui/modal.tsx`: focus trap;
- `client/src/lib/api.ts`: URL WebSocket com ticket;
- `client/e2e/mobile-chat.spec.ts`: edição por modal;
- `client/src/components/ui/button.tsx`: remoção do export auxiliar não utilizado.

## Validações executadas

- `npx prisma generate`: aprovado;
- `npx prisma migrate deploy` em PostgreSQL 17 temporário e isolado: duas migrações aplicadas com sucesso;
- `bun test` em contêiner Bun 1.3.11: **5 testes, 49 asserções, 0 falhas**;
- `npm run typecheck` no servidor: aprovado;
- `npm run build` no cliente: aprovado;
- `npm run lint` no cliente: aprovado, sem avisos após a correção final;
- `docker compose -f compose.yaml -f compose.dev.yaml config`: aprovado;
- `git diff --check`: aprovado.

O PostgreSQL temporário usado na validação foi encerrado e removido após os testes. Nenhum banco persistente do projeto foi usado pela suíte.

## Riscos residuais e recomendações

### Prioridade alta

1. Executar o Playwright completo em navegador real com banco isolado. O cenário foi atualizado e compila, mas a suíte E2E não foi executada nesta revisão porque o ambiente local não possui Bun/Chromium configurados diretamente para o `webServer` do Playwright.
2. Validar chamada com dois navegadores e dispositivos reais, cobrindo câmera, entrada somente com áudio, compartilhamento e renegociação em redes distintas com TURN.
3. Se a API passar a operar com múltiplas réplicas, mover os tickets WebSocket do mapa em memória para um armazenamento compartilhado com consumo atômico e TTL, como Redis. Na arquitetura atual de uma instância, o armazenamento local mantém o uso único corretamente.

### Prioridade média

1. Migrar confirmações destrutivas de `window.confirm` para um `ConfirmDialog` acessível e testável.
2. Adicionar testes de componentes para o focus trap, estados da chamada e fallback somente com áudio.
3. Implementar reconexão WebSocket com backoff e novo ticket após quedas transitórias; hoje a falha é informada, mas exige nova montagem da tela.
4. Separar mais responsabilidades de `chat-page.tsx`, especialmente navegação, composer e gerenciamento de membros.

## Conclusão

Os problemas críticos descritos anteriormente continuam protegidos e a nova revisão fechou uma falha adicional de autorização em conexões persistentes. Sessões deixaram de trafegar na URL do WebSocket, reações novas têm autoria consistente e o ciclo de mídia ficou menos dependente de comportamento incidental do navegador. As validações estáticas, build, migrações e integração do back-end estão aprovadas. A principal lacuna restante é a validação E2E de mídia em navegadores e redes reais.
