import { app, BrowserWindow } from "electron";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let win; // referencia global de la ventana

function createWindow() {
  win = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: true,   // permite require/import en el render
      contextIsolation: false, // necesario si usas ipcRenderer en index.html
    },
  });

  // ✅ Carga la interfaz (index.html)
  win.loadFile(path.join(__dirname, "index.html"));

  win.on("closed", () => {
    win = null;
  });
}

// ✅ Exportamos getWindow para que el bot pueda usarlo
export function getWindow() {
  return win;
}

app.whenReady().then(() => {
  console.log("🚀 Tx Publicidad Bot iniciado...");
  createWindow();

  // ✅ Importar SOLO el bot (no el mismo index.js de frontend)
  import("./bot.js")
    .then(() => console.log("✅ Bot cargado"))
    .catch((err) => console.error("❌ Error cargando bot.js:", err));
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (win === null) {
    createWindow();
  }
});
