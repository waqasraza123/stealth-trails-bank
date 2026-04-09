import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 4174
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: [
        "src/components/LanguageSwitcher.tsx",
        "src/i18n/**/*.ts",
        "src/i18n/**/*.tsx",
        "src/lib/format.ts"
      ],
      exclude: [
        "**/*.config.*",
        "src/test/**",
        "src/**/*.spec.ts",
        "src/**/*.spec.tsx",
        "src/main.tsx",
        "src/App.tsx",
        "src/lib/api.ts"
      ],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70
      }
    }
  }
});
