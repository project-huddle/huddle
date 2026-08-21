---

name: typescript-quality
description: Escrever TypeScript explícito, seguro e legível, evitando validações redundantes e tipos excessivamente permissivos.
---------------------------------------------------------------------------------------------------------------------------------

# TypeScript no Huddle

Use o sistema de tipos para tornar contratos claros.

## Evite `any`

Não use `any` sem necessidade concreta e documentada.

Prefira:

* tipos específicos;
* `unknown` em fronteiras externas;
* narrowing explícito;
* discriminated unions.

## Aproveite schemas

Quando Elysia já validou um body com schema específico, não repita validação manual baseada em `typeof` sem necessidade.

Evite padrões como:

```ts
body: t.Object({
  name: t.Optional(t.Unknown()),
})
```

seguido por:

```ts
const name =
  typeof body.name === "string"
    ? body.name.trim()
    : "";
```

se o contrato correto é simplesmente uma string.

Prefira declarar o contrato:

```ts
const createServerBody = t.Object({
  name: t.String({
    minLength: 2,
    maxLength: 40,
  }),
});
```

Depois faça apenas normalizações que pertencem à aplicação.

## Tipos fechados

Use unions/enums para valores conhecidos.

Prefira:

```ts
type MemberRole = "moderator" | "member";
```

em vez de strings genéricas quando o domínio possui conjunto fechado.

## Resultado de operações

Quando uma função pode terminar de várias formas importantes, prefira resultados explícitos e fáceis de pattern-match.

Evite contratos que dependam de combinações implícitas de `null`, `false`, string e exceptions.

## Non-null assertion

Evite `!` como solução padrão.

Se `currentUser` é garantido por um plugin autenticado, faça o tipo dessa garantia aparecer no contexto quando possível.

Não espalhe:

```ts
currentUser!.id
```

por todos os handlers apenas para silenciar o TypeScript.

## Schemas reutilizáveis

Schemas usados em várias rotas devem receber nomes semânticos.

Exemplo:

```ts
export const serverIdParams = ...
export const serverMemberParams = ...
```

Evite duplicar regex e constraints.

## Legibilidade

Não use inferência extrema se um tipo explícito torna a API interna mais compreensível.

Evite tipos genéricos complexos sem benefício claro.

Um tipo um pouco mais verboso é aceitável se melhora auditabilidade.
