---

name: readable-code
description: Produzir e revisar código priorizando legibilidade humana, auditabilidade, simplicidade e manutenção.
------------------------------------------------------------------------------------------------------------------

# Código legível e auditável

Código neste projeto deve ser escrito primeiro para seres humanos e depois para o compilador.

Funcionamento correto não é suficiente se a implementação for desnecessariamente difícil de entender, revisar, testar ou modificar.

## Princípios

Priorize, nesta ordem:

1. correção;
2. clareza;
3. auditabilidade;
4. manutenção;
5. simplicidade;
6. performance, quando necessária.

Não sacrifique clareza em nome de concisão.

Código menor não significa necessariamente código melhor.

## Evite densidade excessiva

Não comprima múltiplas decisões em uma única expressão.

Evite:

```ts
return result === "ok"
  ? new Response(null, { status: 204 })
  : error(
      result === "forbidden" ? 403 : 404,
      result === "forbidden" ? "FORBIDDEN" : "NOT_FOUND",
      result === "forbidden"
        ? "Only the owner can change roles."
        : "Member not found.",
    );
```

Prefira:

```ts
if (result === "ok") {
  return new Response(null, { status: 204 });
}

if (result === "forbidden") {
  return error(
    403,
    "FORBIDDEN",
    "Only the owner can change roles.",
  );
}

return error(
  404,
  "NOT_FOUND",
  "Member not found.",
);
```

Duplicar algumas linhas é aceitável quando reduz significativamente a carga cognitiva.

## Handlers devem ser curtos

Handlers HTTP, event handlers e callbacks devem ser fáceis de ler do início ao fim.

Um handler deve idealmente:

1. receber dados já validados;
2. chamar uma operação da aplicação;
3. traduzir o resultado para o protocolo externo.

Se um handler possui muitas decisões de domínio, parsing, normalização ou tratamento de resultados, extraia essas responsabilidades.

## Não esconda lógica importante em expressões

Evite:

* ternários aninhados;
* cadeias extensas de `&&` e `||`;
* callbacks muito grandes;
* condições com múltiplas responsabilidades;
* transformações complexas dentro de argumentos;
* `await` aninhado em construções difíceis de ler.

Crie variáveis com nomes que expressem intenção.

Prefira:

```ts
const normalizedName = normalizeChannelName(body.name);

if (!isValidChannelName(normalizedName)) {
  return invalidChannelName();
}
```

em vez de colocar normalização e validação em uma única condição.

## Funções devem ter responsabilidade clara

Uma função deve fazer uma coisa conceitual.

Extraia funções quando isso:

* dá nome a uma regra;
* elimina repetição relevante;
* reduz complexidade de um handler;
* permite teste isolado;
* torna uma condição mais legível.

Não extraia funções triviais apenas para diminuir número de linhas.

## Tamanho de arquivos

Não existe limite rígido universal, mas arquivos grandes devem ser tratados como sinal de possível mistura de responsabilidades.

Ao criar ou modificar um arquivo:

* acima de aproximadamente 250 linhas, considere ativamente divisão;
* acima de aproximadamente 400 linhas, justifique por que o arquivo ainda representa uma única responsabilidade;
* evite arquivos de rotas que concentrem muitos domínios diferentes.

Não divida arquivos apenas para satisfazer contagem de linhas.

Divida por coesão.

## Rotas

Não concentre toda uma área do produto em uma longa cadeia de chamadas Elysia.

Prefira agrupar rotas por responsabilidade.

Exemplo:

```text
routes/
├── servers.ts
├── server-members.ts
├── server-invites.ts
└── channels.ts
```

se essas responsabilidades já forem suficientemente distintas no código.

Não crie fragmentação excessiva quando poucas rotas simples pertencem naturalmente juntas.

## Imports

Imports devem ser fáceis de examinar.

Não compacte longas listas de símbolos em uma única linha apenas para economizar espaço.

Prefira:

```ts
import {
  createChannel,
  createInvite,
  createServer,
  joinServer,
  leaveServer,
  listServers,
} from "../../../infra/database/server-repository";
```

Mantenha agrupamento consistente entre:

1. dependências externas;
2. módulos internos;
3. tipos, quando a convenção do projeto exigir.

## Comentários

Não comente o que o código já diz.

Comente:

* decisões não óbvias;
* invariantes;
* restrições externas;
* motivos para soluções incomuns;
* riscos de segurança.

Evite comentários narrando linha por linha.

## Nomes

Prefira nomes que expressem intenção e domínio.

Evite nomes genéricos como:

* `data`;
* `thing`;
* `obj`;
* `res`;
* `tmp`;
* `handler2`.

Para booleanos, prefira nomes que possam ser lidos como pergunta:

```ts
isServerMember
canManageMembers
hasActiveSession
```

## Early returns

Use early returns para reduzir nesting.

Prefira:

```ts
if (!member) {
  return notFound();
}

if (!canManageMember) {
  return forbidden();
}

return updateMember();
```

em vez de múltiplos níveis de `if`.

## Repetição vs abstração

Não aplique DRY de forma mecânica.

Alguma repetição local pode ser melhor do que uma abstração genérica difícil de entender.

Extraia uma abstração quando houver um conceito compartilhado, não apenas linhas parecidas.

## Antes de finalizar

Revise todo código criado ou alterado perguntando:

* Um desenvolvedor novo consegue entender isso rapidamente?
* Existem expressões excessivamente densas?
* Existem ternários aninhados?
* Algum handler está fazendo trabalho demais?
* Algum arquivo ganhou responsabilidades demais?
* Existem nomes que escondem intenção?
* Extraí abstrações úteis ou apenas criei indireção?
* O código é fácil de auditar para segurança?
* Uma futura mudança simples exigiria editar muitos lugares?

Se a resposta indicar baixa legibilidade, refatore antes de concluir.
