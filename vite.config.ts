import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: true,
    port: 4173,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.svg"],
      manifest: {
        name: "農藥殘留容許量查詢",
        short_name: "農藥容許量",
        description: "查詢台灣衛福部食藥署農藥殘留容許量標準",
        lang: "zh-Hant",
        theme_color: "#1b5e3b",
        background_color: "#f4f1ea",
        display: "standalone",
        start_url: "./",
        scope: "./",
        icons: [
          {
            src: "favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "apple-touch-icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,ico,woff2}"],
        navigateFallback: "index.html",
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /data\/mrl\.json$/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "mrl-data",
              networkTimeoutSeconds: 8,
              expiration: {
                maxEntries: 1,
                maxAgeSeconds: 60 * 60 * 24 * 40,
              },
            },
          },
        ],
      },
    }),
  ],
});
