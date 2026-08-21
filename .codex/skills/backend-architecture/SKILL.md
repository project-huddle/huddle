---

name: backend-architecture
description: Manter a arquitetura backend do Huddle modular, explícita e desacoplada de frameworks.
---------------------------------------------------------------------------------------------------

# Arquitetura backend do Huddle

O backend é um monólito modular.

Não introduza microservices ou infraestrutura distribuída sem necessidade explícita.

## Camadas

A estrutura conceitual é:

```text
interfaces
    ↓
   app
    ↓
   core

infra implementa necessidades externas da aplicação
```

### `core`

Contém conceitos e regras de domínio.

Não deve depender de:

* Elysia;
* Request/Response;
* Prisma;
* WebSocket;
* detalhes HTTP;
* detalhes de banco.

### `app`

Contém casos de uso e serviços de aplicação.

Não deve conter detalhes específicos do transporte HTTP.

### `infra`

Contém persistência e integrações externas.

Prisma pertence aqui.

Evite deixar regras de negócio importantes presas em repositories.

### `interfaces`

Contém adaptações para o mundo externo:

* Elysia;
* HTTP;
* WebSocket;
* parsing;
* schemas de transporte;
* transformação de erros para respostas.

## Rotas Elysia

Rotas devem ser adaptadores finos.

Um handler ideal deve se parecer conceitualmente com:

```ts
const result = await operation.execute(input);

return mapResultToHttp(result);
```

e não com:

```ts
// validar
// consultar banco diretamente várias vezes
// aplicar regra de domínio
// alterar socket
// montar resultado
// decidir status
// decidir error code
```

Quando necessário, extraia uma função ou use case.

## Repositories

Não transforme repositories em "god modules".

Se um repository acumular operações de várias entidades e conceitos, avalie separação por responsabilidade.

Prefira APIs explícitas.

Evite funções cujo retorno seja ambíguo.

Em vez de:

```ts
"ok" | "forbidden" | "not_found"
```

considere tipos discriminados quando a operação for complexa:

```ts
type RemoveMemberResult =
  | { type: "success" }
  | { type: "forbidden" }
  | { type: "not-found" };
```

Não aplique isso mecanicamente a operações triviais.

## Dependências entre módulos

Evite importar infraestrutura diretamente de todos os handlers caso exista uma camada de aplicação adequada.

Não crie novas dependências circulares.

Antes de adicionar um import entre camadas, confirme que a direção arquitetural continua válida.

## Realtime

Realtime deve permanecer separado do transporte HTTP comum.

Não faça handlers HTTP conhecerem detalhes internos do registry de sockets, exceto através de uma interface/serviço pequeno quando uma ação precisar invalidar acesso realtime.

## Framework

Elysia é um adaptador, não a arquitetura da aplicação.

Não permita que tipos de Elysia se propaguem para `core` ou `app`.

## Mudanças

Ao modificar backend:

1. identifique a camada correta;
2. preserve dependências existentes;
3. mantenha rotas finas;
4. mantenha regras testáveis fora do framework;
5. revise tamanho e responsabilidade dos arquivos;
6. execute testes e typecheck.
