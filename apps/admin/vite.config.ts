import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { nodeProjectApi } from "./plugins/node-project-api.ts"
import { termuxReadOnlyApi } from "./plugins/host-snapshot-api.ts"
import { observabilityApi } from "./plugins/observability-api.ts"
import { internetConnectivityApi } from "./plugins/internet-connectivity-api.ts"
import { dashboardTelemetryApi } from "./plugins/dashboard-telemetry-api.ts"
import { shizukuCompanionApi } from "./plugins/shizuku-companion-api.ts"
import { remoteShellApi } from "./plugins/remote-shell-api.ts"
import { androidActionApi } from "./plugins/android-action-api.ts"
import { termuxToolsApi } from "./plugins/termux-tools-api.ts"
import { ownedDemoApi } from "./plugins/owned-demo-api.ts"
import { ownedSiteFleetApi } from "./plugins/site-fleet-api.ts"
import { networkAccessApi } from "./plugins/network-access-api.ts"
import { termuxAdminApi } from "./plugins/termux-admin-api.ts"

export default defineConfig({
  plugins: [react(), tailwindcss(), termuxReadOnlyApi(), internetConnectivityApi(), dashboardTelemetryApi(), ownedDemoApi(), ownedSiteFleetApi(), nodeProjectApi(), observabilityApi(), shizukuCompanionApi(), remoteShellApi(),
    androidActionApi(), networkAccessApi(), termuxToolsApi(), termuxAdminApi()],
  server: {
    host: "127.0.0.1",
    port: 8787,
    strictPort: true,
    proxy: {
      // Keep /terminal as a React page; proxy only ttyd iframe/WebSocket subpaths.
      "/terminal/": { target: "http://127.0.0.1:18798", changeOrigin: true, ws: true },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  define: {
    'import.meta.env.VITE_BASENAME': JSON.stringify(process.env.VITE_BASENAME || ''),
  }
})
