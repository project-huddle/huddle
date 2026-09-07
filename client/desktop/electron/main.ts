import { app, BrowserWindow, desktopCapturer, dialog, net, protocol, session } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";

const applicationOrigin = "huddle://app";
protocol.registerSchemesAsPrivileged([
  { scheme: "huddle", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

function isTrustedPage(value: string, origin: string): boolean {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}` === origin;
  } catch {
    return false;
  }
}

async function createWindow() {
  const developmentUrl = !app.isPackaged && process.env.VITE_DEV_SERVER_URL;
  const pageUrl = developmentUrl || `${applicationOrigin}/index.html`;
  const origin = developmentUrl ? new URL(developmentUrl).origin : applicationOrigin;
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 720,
    minHeight: 540,
    title: "Huddle",
    webPreferences: {
      preload: path.join(import.meta.dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  session.defaultSession.setPermissionCheckHandler((contents, permission, requestingOrigin) =>
    contents === window.webContents && permission === "media" && isTrustedPage(requestingOrigin, origin),
  );
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    callback(contents === window.webContents && permission === "media" && isTrustedPage(details.requestingUrl, origin));
  });
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    if (!isTrustedPage(request.securityOrigin, origin) || request.frame !== window.webContents.mainFrame) {
      callback({});
      return;
    }
    try {
      const sources = await desktopCapturer.getSources({ types: ["screen", "window"] });
      const selection = await dialog.showMessageBox(window, {
        title: "Compartilhar tela",
        message: "Escolha a tela ou janela para compartilhar",
        buttons: ["Cancelar", ...sources.map((source) => source.name)],
        cancelId: 0,
        defaultId: 0,
      });
      const source = sources[selection.response - 1];
      callback(source ? { video: source } : {});
    } catch {
      callback({});
    }
  }, { useSystemPicker: true });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedPage(url, origin)) event.preventDefault();
  });
  window.webContents.on("will-redirect", (event, url) => {
    if (!isTrustedPage(url, origin)) event.preventDefault();
  });
  try {
    await window.loadURL(pageUrl);
  } catch {
    dialog.showErrorBox("Huddle", "Não foi possível carregar a interface do aplicativo. Reinicie o Huddle.");
  }
}

app.whenReady().then(async () => {
  const rendererDirectory = path.resolve(import.meta.dirname, "../dist");
  protocol.handle("huddle", (request) => {
    const url = new URL(request.url);
    if (url.host !== "app" || request.method !== "GET") return new Response(null, { status: 403 });
    let pathname: string;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return new Response(null, { status: 400 });
    }
    const filename = path.resolve(rendererDirectory, `.${pathname}`);
    const relative = path.relative(rendererDirectory, filename);
    if (relative.startsWith("..") || path.isAbsolute(relative)) return new Response(null, { status: 403 });
    return net.fetch(pathToFileURL(filename).toString());
  });
  await createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
}).catch((error: unknown) => {
  console.error("Unable to start Huddle", error);
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
