---

name: testing-quality
description: Criar testes úteis, legíveis e orientados a comportamento em vez de perseguir cobertura artificial.
----------------------------------------------------------------------------------------------------------------

# Testes

Testes devem aumentar confiança na mudança.

Coverage é indicador, não objetivo isolado.

## Prioridade

Priorize:

1. autenticação;
2. autorização;
3. regras de domínio;
4. persistência;
5. protocolo realtime;
6. fluxos críticos do frontend.

## Teste comportamento

Evite testes acoplados a detalhes internos sem necessidade.

Prefira:

```text
owner can remove member
moderator cannot change owner role
anonymous request returns 401
```

em vez de testar exatamente quais funções internas foram chamadas.

## Legibilidade

Use Arrange / Act / Assert quando ajudar.

Um teste deve deixar evidente:

* contexto;
* ação;
* resultado esperado.

Não compacte preparação e assertions em uma única expressão.

## Fixtures

Crie builders/helpers quando setups começam a se repetir significativamente.

Não esconda toda a configuração atrás de helpers genéricos impossíveis de entender.

## Regression tests

Ao corrigir um bug:

1. escreva um teste que reproduza o bug;
2. confirme que ele falha;
3. implemente a correção;
4. confirme que passa.

## Frontend

Use o nível de teste correto:

* função/store/hook → unit;
* componente → component;
* fluxo completo → E2E.

Não transforme tudo em E2E.
