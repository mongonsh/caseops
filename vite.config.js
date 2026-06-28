import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiPort = Number(process.env.API_PORT || 4000);
const webPort = Number(process.env.WEB_PORT || 5173);

export default defineConfig({
  plugins: [react()],
  server: {
    port: webPort,
    proxy: {
      "/api": `http://localhost:${apiPort}`,
      "/health": `http://localhost:${apiPort}`
    }
  }
});
