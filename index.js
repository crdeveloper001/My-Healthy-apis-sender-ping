import "dotenv/config";
import express from "express";
import axios from "axios";
import cron from "node-cron";

const app = express();
const PORT = process.env.PORT || 3000;

// 🔎 Detectar variables api_endpoint*
const services = Object.keys(process.env)
  .filter((key) => key.startsWith("api_endpoint"))
  .map((key) => ({
    name: key,
    url: process.env[key],
  }));

// Estado en memoria
const status = {};
let isRunning = false;

async function pingServices() {
  if (isRunning) {
    console.log("⚠️ Previous run still in progress. Skipping.");
    return;
  }

  isRunning = true;
  console.log("\n⏰ Pinging APIs...");

  try {
    await Promise.all(
      services.map(async (service) => {
        const start = Date.now();

        try {
          const res = await axios.get(service.url, { timeout: 8000 });
          const duration = Date.now() - start;

          status[service.name] = {
            state: "UP",
            code: res.status,
            responseTimeMs: duration,
            lastCheck: new Date().toISOString(),
          };

          console.log(`✅ ${service.name} → ${res.status} (${duration}ms)`);
        } catch (error) {
          status[service.name] = {
            state: "DOWN",
            lastCheck: new Date().toISOString(),
            error: error.code || error.message,
          };

          console.log(`❌ ${service.name} → DOWN (${error.message})`);
        }
      })
    );
  } finally {
    isRunning = false;
  }
}

// ⏱️ Ejecutar cada 5 minutos
cron.schedule("*/1 * * * *", pingServices);

// Ejecutar al iniciar
pingServices();

// 🌐 Health endpoint (for uptime monitors)
app.get("/health", (_req, res) => {
  res.status(200).send("OK");
});

// 🌐 Endpoint estado
app.get("/status", (_req, res) => {
  const up = Object.values(status).filter((s) => s.state === "UP").length;
  const down = Object.values(status).filter((s) => s.state === "DOWN").length;

  res.json({
    uptimeSeconds: process.uptime(),
    monitoredServices: services.length,
    summary: { up, down },
    services: status,
  });
});

// 🏠 raíz
app.get("/", (_req, res) => {
  res.send("Keep Alive Service running 🚀");
});

app.listen(PORT, () => {
  console.log(`🚀 Keep Alive Service running on port ${PORT}`);
});