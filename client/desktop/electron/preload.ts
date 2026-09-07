import { contextBridge } from "electron";

// Add named, narrowly scoped methods here when native features need them.
contextBridge.exposeInMainWorld("huddleDesktop", { platform: process.platform });
