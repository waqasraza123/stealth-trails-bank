import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 8080,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/react-router-dom/")
          ) {
            return "react-vendor";
          }

          if (
            id.includes("/@tanstack/react-query/") ||
            id.includes("/axios/") ||
            id.includes("/zod/")
          ) {
            return "data-vendor";
          }

          if (
            id.includes("/@radix-ui/") ||
            id.includes("/lucide-react/") ||
            id.includes("/class-variance-authority/") ||
            id.includes("/clsx/") ||
            id.includes("/tailwind-merge/")
          ) {
            return "ui-vendor";
          }

          return undefined;
        },
      },
    },
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
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
        "src/App.tsx",
        "src/components/Layout.tsx",
        "src/components/LanguageSwitcher.tsx",
        "src/components/auth/AuthShell.tsx",
        "src/components/auth/auth-content.ts",
        "src/components/dashboard/RecentTransactions.tsx",
        "src/components/dashboard/TransactionItem.tsx",
        "src/components/routing/ProtectedRoute.tsx",
        "src/components/staking/**/*.tsx",
        "src/components/transactions/TransactionFilter.tsx",
        "src/i18n/**/*.ts",
        "src/i18n/**/*.tsx",
        "src/lib/customer-account.ts",
        "src/lib/customer-finance.ts",
        "src/pages/Index.tsx",
        "src/pages/Profile.tsx",
        "src/pages/Staking.tsx",
        "src/pages/Transactions.tsx",
        "src/pages/Wallet.tsx",
        "src/pages/auth/*.tsx",
        "src/pages/wallet/*.tsx"
      ],
      exclude: [
        "**/*.config.*",
        "scripts/**",
        "src/test/**",
        "src/**/*.spec.ts",
        "src/**/*.spec.tsx",
        "src/main.tsx",
        "src/components/ui/**",
        "src/hooks/**",
        "src/stores/**"
      ],
      thresholds: {
        statements: 75,
        branches: 65,
        functions: 75,
        lines: 75
      }
    }
  },
}));
