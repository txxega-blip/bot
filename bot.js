// index.js
import "dotenv/config";
import qrcode from "qrcode";
import pkg from "whatsapp-web.js";
import OpenAI from "openai";
import { getWindow } from "./main.js";
import fs from "fs";
import path from "path";

const { Client, LocalAuth, MessageMedia } = pkg;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Archivos
const clientesFile = path.join(process.cwd(), "clientes.json");
const pagosFile = path.join(process.cwd(), "pagos.json");

// Crear archivos si no existen
if (!fs.existsSync(clientesFile)) fs.writeFileSync(clientesFile, JSON.stringify({}, null, 2));
if (!fs.existsSync(pagosFile)) fs.writeFileSync(pagosFile, JSON.stringify([], null, 2));

// Cargar clientes
let clientesData = {};
try {
  clientesData = JSON.parse(fs.readFileSync(clientesFile, "utf-8"));
  console.log("📂 clientes.json cargado.");
} catch {
  clientesData = {};
}

// Guardar clientes
function guardarClientes() {
  fs.writeFileSync(clientesFile, JSON.stringify(clientesData, null, 2));
}

// Registrar pago
function registrarPago(chatId, servicio) {
  let pagos = [];
  try {
    pagos = JSON.parse(fs.readFileSync(pagosFile, "utf-8"));
  } catch {
    pagos = [];
  }
  pagos.push({ cliente: chatId, servicio, fecha: new Date().toISOString() });
  fs.writeFileSync(pagosFile, JSON.stringify(pagos, null, 2));
  console.log(`💵 Pago registrado: ${chatId} -> ${servicio}`);
}

// Datos de contacto
const contacto = {
  telefonoContacto: "+51 926 516 926",
  yape: "901239985",
  cuentaBCP: "39004006342082",
  cciBCP: "00239010400634208237",
  qrYape: path.join(process.cwd(), "assets", "yape.png"),
};

// Cliente WhatsApp
const client = new Client({ authStrategy: new LocalAuth() });

// Números ignorados
const numerosIgnorados = [
  "51901239985@c.us",
  "51926516926@c.us",
  "51925457816@c.us",
  "51937367072@c.us",
  "584125225490@c.us",
  "51944989717@c.us",
  "51943464335@c.us",
];

console.log("🚀 index.js iniciado...");

// Utils
function esSaludo(texto) {
  if (!texto) return false;
  const saludos = ["hola", "buenas", "buenos días", "buenos dias", "buenas tardes", "buenas noches", "hi", "hey"];
  const t = texto.trim().toLowerCase();
  return saludos.some((s) => t === s || t.startsWith(s + " "));
}

function contienePalabra(texto, lista) {
  if (!texto) return false;
  const t = texto.toLowerCase();
  return lista.some((k) => t.includes(k));
}

// QR
client.on("qr", async (qr) => {
  try {
    const qrDataUrl = await qrcode.toDataURL(qr);
    const win = getWindow();
    if (win) win.webContents.send("qr", qrDataUrl);
  } catch (err) {
    console.error("❌ Error al generar QR:", err);
  }
});

client.on("ready", () => {
  console.log("✅ Bot conectado a WhatsApp");
  const win = getWindow();
  if (win) win.webContents.send("listo");
});

// Mensajes
client.on("message", async (msg) => {
  const chatId = msg.from;
  const rawBody = (msg.body || "").toString();
  const texto = rawBody.toLowerCase().trim();

  if (chatId.includes("@g.us")) return;
  if (chatId === "status@broadcast") return;
  if (numerosIgnorados.includes(chatId)) return;

  // Inicializar cliente
  if (!clientesData[chatId]) {
    clientesData[chatId] = { frecuente: false, bloqueadoHasta: 0, estado: "nuevo", ultimaInteraccion: Date.now() };
    guardarClientes();
  }

  // Control de frecuencia
  const ahora = Date.now();
  const ultima = clientesData[chatId].ultimaInteraccion || 0;
  const horasPasadas = (ahora - ultima) / (1000 * 60 * 60);
  clientesData[chatId].ultimaInteraccion = ahora;
  guardarClientes();

  if (clientesData[chatId].bloqueadoHasta && Date.now() < clientesData[chatId].bloqueadoHasta) return;

  // Nombre
  let nombreCliente = "";
  try {
    const chat = await msg.getChat();
    nombreCliente = msg._data?.notifyName || chat.name || "";
    if (!nombreCliente || /^\d+$/.test(nombreCliente)) nombreCliente = "";
  } catch {}

  // Saludo inicial o reingreso
  let saludo = "";
  if (!clientesData[chatId].frecuente) {
    clientesData[chatId].frecuente = true;
    guardarClientes();
    saludo = nombreCliente
      ? `🎉 Hola *${nombreCliente}*, bienvenido a *Tx Publicidad*! 🚀`
      : `🎉 Bienvenido a *Tx Publicidad*! 🚀`;
  } else if (horasPasadas >= 5) {
    saludo = nombreCliente
      ? `👋 Bienvenido de nuevo *${nombreCliente}*!`
      : `👋 Bienvenido de nuevo a *Tx Publicidad*!`;
  }

  const win = getWindow();

  // 👉 Mostrar mensaje del cliente en interfaz
  if (win) {
    win.webContents.send("mensaje-bot", {
      id: chatId,
      tipo: "cliente",
      texto: rawBody,
      nombre: nombreCliente || chatId,
      hora: new Date().toLocaleTimeString(),
    });
  }

  if (clientesData[chatId].estado === "cerrado") {
    if (win) win.webContents.send("estado-cliente", { id: chatId, estado: "cerrado" });
    return;
  }

  // Esperando pago
  if (clientesData[chatId].estado === "esperando_pago") {
    if (msg.hasMedia || /comprobante|voucher|ticket|pago|transferencia/.test(texto)) {
      registrarPago(chatId, "flyer");
      const respuesta = "✅ Hemos recibido tu comprobante. Un asesor se comunicará contigo pronto 🙌.";
      await msg.reply(respuesta);

      clientesData[chatId].estado = "cerrado";
      clientesData[chatId].bloqueadoHasta = Date.now() + 2 * 60 * 60 * 1000;
      guardarClientes();

      if (win) {
        win.webContents.send("mensaje-bot", { id: chatId, tipo: "bot", texto: respuesta, nombre: "Tx Bot", hora: new Date().toLocaleTimeString() });
        win.webContents.send("estado-cliente", { id: chatId, estado: "cerrado" });
      }
      return;
    }
  }

  // --- flyer ---
  if (texto.includes("flyer")) {
    const respuesta = `${saludo}\n\n✨ El diseño de un *flyer publicitario* cuesta *30 soles*.\n⏳ Entrega: 1h - 1.5h.\n\nMétodos de pago:\n📲 *Yape*: ${contacto.yape}\n🏦 *BCP*: ${contacto.cuentaBCP}\n💳 *CCI*: ${contacto.cciBCP}\n\n¿Deseas que te envíe el QR de Yape ahora? 😊`;
    await msg.reply(respuesta);

    if (fs.existsSync(contacto.qrYape)) {
      const media = MessageMedia.fromFilePath(contacto.qrYape);
      await client.sendMessage(chatId, media, { caption: "📲 Escanea este QR para pagar con Yape." });
    }

    clientesData[chatId].estado = "esperando_pago";
    guardarClientes();

    if (win) {
      win.webContents.send("mensaje-bot", { id: chatId, tipo: "bot", texto: respuesta, nombre: "Tx Bot", hora: new Date().toLocaleTimeString() });
      win.webContents.send("estado-cliente", { id: chatId, estado: "esperando_pago" });
    }
    return;
  }

  // --- asesor ---
  const advisorKeywords = ["filmacion", "filmación", "video", "videos", "drone", "fotografia", "fotografía", "boda", "bodas", "evento", "eventos"];
  if (contienePalabra(texto, advisorKeywords)) {
    const ahora2 = Date.now();

    // Primer contacto con asesor
    if (!clientesData[chatId].asesorInicio || ahora2 > clientesData[chatId].asesorFin) {
      const aviso = "📹 Gracias por tu interés 🙌. Te comunicaremos con un *asesor especializado* en breve. Por favor espera un momento ⏳.";
      await msg.reply(aviso);

      clientesData[chatId].estado = "esperando_asesor";
      clientesData[chatId].asesorInicio = ahora2;
      clientesData[chatId].asesorFin = ahora2 + 60 * 60 * 1000;
      clientesData[chatId].bloqueadoHasta = clientesData[chatId].asesorFin;
      guardarClientes();

      if (win) {
        win.webContents.send("mensaje-bot", { id: chatId, tipo: "bot", texto: aviso, nombre: "Tx Bot", hora: new Date().toLocaleTimeString() });
        win.webContents.send("estado-cliente", { id: chatId, estado: "esperando_asesor" });
      }
      return;
    }

    // Cliente insiste
    if (clientesData[chatId].estado === "esperando_asesor" && ahora2 <= clientesData[chatId].asesorFin) {
      const calma = "🙏 Por favor mantén la calma, en breve un asesor se comunicará contigo ⏳.";
      await msg.reply(calma);

      clientesData[chatId].estado = "cerrado";
      clientesData[chatId].bloqueadoHasta = ahora2 + 2 * 60 * 60 * 1000;
      guardarClientes();

      if (win) {
        win.webContents.send("mensaje-bot", { id: chatId, tipo: "bot", texto: calma, nombre: "Tx Bot", hora: new Date().toLocaleTimeString() });
        win.webContents.send("estado-cliente", { id: chatId, estado: "cerrado" });
      }
      return;
    }
  }

  // --- saludo ---
  if (esSaludo(texto)) {
    const menu = `${saludo}\n\n👉 Podemos ayudarte con:\n- ✨ *Flyer* (S/30)\n- 📹 *Filmación / Fotografía / Drone* (asesor especializado)\n\nEscribe la opción que prefieras y te damos más detalles.`;
    await msg.reply(menu);

    if (win) {
      win.webContents.send("mensaje-bot", { id: chatId, tipo: "bot", texto: menu, nombre: "Tx Bot", hora: new Date().toLocaleTimeString() });
      win.webContents.send("estado-cliente", { id: chatId, estado: "activo" });
    }
    return;
  }

  // --- fallback OpenAI ---
  try {
    const prompt = `
Eres el asistente vendedor de Tx Publicidad.
Responde breve, natural, amistoso y con emojis.
- Solo da precio de flyers (S/30).
- Si mencionan filmación, video, drone, fotografía o bodas → di que un asesor especializado se comunicará pronto.
- Para respuestas cortas del cliente como "ok", "vale", "gracias", "bien", responde con algo humano y cordial (ej: "¡Perfecto! 🙌", "Genial 👍", "Con gusto 😉").
- No inventes precios ni servicios.
- Sé humano, fluido y vendedor natural.

Cliente: ${rawBody}
Asistente:
    `;
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });
    const respuesta = completion.choices?.[0]?.message?.content?.trim() || "👌";
    await msg.reply(respuesta);

    if (win) {
      win.webContents.send("mensaje-bot", { id: chatId, tipo: "bot", texto: respuesta, nombre: "Tx Bot", hora: new Date().toLocaleTimeString() });
      win.webContents.send("estado-cliente", { id: chatId, estado: "activo" });
    }
  } catch (err) {
    console.error("❌ Error OpenAI:", err);
    await msg.reply("⚠️ Hubo un problema procesando tu mensaje. Intenta más tarde 🙏.");
  }
});

client.initialize();
