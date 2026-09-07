A migração foi implementada. Antes de considerar esse trabalho concluído, faça uma revisão completa do código que você criou ou modificou.

Leia e aplique obrigatoriamente:

* `AGENTS.md`
* `server/AGENTS.md`
* `.codex/skills/readable-code/SKILL.md`
* `.codex/skills/typescript-quality/SKILL.md`
* `.codex/skills/backend-architecture/SKILL.md`
* `.codex/skills/code-review/SKILL.md`

Não implemente novas funcionalidades.

O objetivo agora é exclusivamente melhorar:

* legibilidade;
* auditabilidade;
* coesão;
* separação de responsabilidades;
* tipagem;
* manutenção.

Revise todo o diff da migração, não apenas os últimos arquivos.

Dê atenção especial aos arquivos em `server/src/interfaces/http/routes`.

Procure ativamente por:

* route files excessivamente grandes;
* longas chains do Elysia;
* handlers inline complexos;
* ternários aninhados;
* múltiplos ternários na mesma expressão;
* validação manual que deveria estar no schema;
* uso excessivo de `t.Unknown()`;
* `currentUser!` repetido;
* parsing e normalização inline;
* chamadas diretas a muitos repositories no mesmo handler;
* regra de negócio dentro da camada HTTP;
* código duplicado;
* funções com múltiplas responsabilidades;
* imports excessivamente densos;
* strings mágicas;
* resultados de operações difíceis de interpretar.

### Exemplo de problema

Código semelhante a:

```ts
return result === "ok"
  ? success()
  : error(
      result === "forbidden" ? 403 : 404,
      result === "forbidden" ? "FORBIDDEN" : "NOT_FOUND",
      result === "forbidden" ? "..." : "...",
    );
```

deve ser reescrito com branches explícitos.

Código semelhante a:

```ts
const name =
  typeof body.name === "string"
    ? body.name.trim().toLowerCase().replace(/\s+/g, "-")
    : "";
```

deve ser revisto para separar:

* validação estrutural;
* normalização;
* regra de negócio.

### Route modules

Se um arquivo como `servers.ts` estiver tratando simultaneamente:

* criação/listagem de servers;
* members;
* roles;
* invites;
* leave;
* channels;

avalie dividir em módulos coesos, por exemplo:

```text
routes/
├── servers.ts
├── server-members.ts
├── server-invites.ts
└── channels.ts
```

Use os nomes que melhor representarem o código real.

Não fragmente artificialmente arquivos pequenos.

### Preserve comportamento

Esta revisão não deve alterar:

* endpoints;
* payloads;
* status HTTP;
* regras de autorização;
* comportamento público;
* schema do banco;
* protocolo WebSocket.

Se encontrar um bug funcional ou de segurança que exija mudança de comportamento, registre-o separadamente em vez de corrigir silenciosamente.

### Depois da refatoração

Execute:

* testes do backend;
* typecheck;
* lint relevante;
* build relevante.

Compare o comportamento com os testes anteriores.

Na resposta final, informe:

1. quais arquivos foram divididos;
2. quais handlers foram simplificados;
3. quais validações foram movidas para schemas;
4. quais problemas de tipagem foram eliminados;
5. quaisquer pontos que ainda estejam difíceis de manter;
6. comandos executados e seus resultados.
