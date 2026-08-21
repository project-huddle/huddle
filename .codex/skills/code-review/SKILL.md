---

name: code-review
description: Revisar mudanças como um maintainer humano antes de considerar uma tarefa concluída.
-------------------------------------------------------------------------------------------------

# Revisão de implementação

Depois de implementar uma tarefa, não finalize imediatamente.

Faça uma segunda passada tratando o código como se fosse um pull request escrito por outra pessoa.

## 1. Revisar o diff

Leia todo o diff.

Não revise apenas os últimos arquivos alterados.

Procure:

* mudanças fora do escopo;
* código duplicado;
* handlers grandes;
* arquivos grandes;
* abstrações prematuras;
* validação duplicada;
* ternários aninhados;
* nomes pouco claros;
* imports estranhos;
* comentários obsoletos.

## 2. Legibilidade

Identifique trechos que exigem esforço excessivo para compreender.

Refatore código excessivamente compacto.

Um reviewer humano deve conseguir seguir o fluxo sem reconstruir mentalmente várias expressões simultaneamente.

## 3. Arquitetura

Confirme:

* regras estão na camada adequada;
* transport layer não contém domínio excessivo;
* domínio não depende de framework;
* infraestrutura não vazou para camadas indevidas;
* arquivos continuam coesos.

## 4. Tipos

Procure:

* `any`;
* `unknown` desnecessário;
* assertions `!`;
* casts;
* strings mágicas;
* contratos ambíguos;
* schemas permissivos demais.

Melhore quando possível sem alterar comportamento.

## 5. Segurança

Revise especialmente:

* autenticação;
* autorização;
* input externo;
* uploads;
* paths;
* tokens;
* sessão;
* WebSocket;
* logging.

Nunca assuma que o frontend protege uma operação.

## 6. Testes

Confirme que a mudança importante possui teste adequado.

Não adicione testes apenas para aumentar porcentagem de coverage.

## 7. Complexidade

Quando encontrar um arquivo ou função grande, pergunte:

"Existe mais de uma responsabilidade aqui?"

Se sim, separe por conceito.

Não quebre funções apenas para satisfazer métricas.

## 8. Simplificação

Procure oportunidades para remover:

* abstrações redundantes;
* branches duplicadas;
* helpers sem valor;
* wrappers desnecessários;
* comentários que compensam código confuso.

## 9. Validação

Depois da refatoração de revisão:

* rode testes;
* rode typecheck;
* rode lint;
* rode build relevante.

## 10. Relatório

Na resposta final, informe brevemente:

* problemas de legibilidade encontrados;
* refactors realizados;
* testes executados;
* qualquer dívida técnica que permaneceu.

Não diga apenas "implementation completed".
