import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  nitro: true,
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    server: {
      warmup: {
        clientFiles: [
          "./src/lib/api/explorer.functions.ts",
          "./src/lib/api/example.functions.ts",
        ],
      },
    },
  },
});
