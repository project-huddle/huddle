# Huddle Desktop

O Electron inclui a interface de `../shared` no instalador. Não depende do cliente
web para carregar a interface; precisa de uma API Huddle acessível para operar.

Na pasta `client`, execute `bun install --frozen-lockfile`. Depois, nesta pasta:

```bash
bun run dev
bun run build
bun run start
bun run package
```

`dev` abre o Electron e o Vite na porta 8081. `start` usa o build local.
`package` gera o instalador da plataforma atual em `release/`; `package:dir`
gera a aplicação sem instalador. Assinatura e notarização precisam de credenciais
de distribuição próprias.

Configure `VITE_API_URL` antes do build ou em `.env.local`, por exemplo:

```dotenv
VITE_API_URL=https://chat.example.com/api
```

O padrão `http://localhost:8080/api` conecta ao Compose local. Para acessar
uma API diretamente, use sua URL sem `/api`, por exemplo `http://localhost:3000`.
As variáveis `VITE_TURN_*` também são incorporadas ao build.

A interface empacotada usa a origem `huddle://app`, que deve constar em
`CORS_ORIGINS` do backend. No desenvolvimento inclua `http://localhost:8081`.
Os arquivos Compose já incluem essas origens nos ambientes correspondentes.
Não permita a origem `null` e não desative `webSecurity`.

O preload expõe apenas a plataforma, sem canais IPC arbitrários. Microfone e
câmera são permitidos somente para a interface do aplicativo; o sistema
operacional ainda pode pedir autorização. O compartilhamento de tela oferece
um seletor de fonte; áudio do sistema não é capturado. Links que abrem outras
janelas são bloqueados por enquanto.

Referência: [segurança do Electron](https://www.electronjs.org/docs/latest/tutorial/security).

Para testar o renderer embarcado e o isolamento: `bun run test:smoke`.
No Linux o teste requer uma sessão gráfica e as bibliotecas de sistema do Electron.

## Organização

- `electron/`: processo principal e preload.
- `src/main.tsx` e `index.html`: entrada da interface compartilhada.
- `tests/`: teste de abertura do Electron.
- `vite.config.ts` e `tsconfig*.json`: build e verificação de tipos.

Componentes e estilos são mantidos em `../shared/src`. A configuração do
shadcn fica em `../web/components.json`. Docker e testes de navegador ficam
em `../web`. `dist/`, `dist-electron/` e `release/` são gerados localmente.
