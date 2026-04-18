import type { Config } from "jest";

const config: Config = {
  preset: "jest-expo",
  rootDir: ".",
  testMatch: ["<rootDir>/src/**/*.spec.ts", "<rootDir>/src/**/*.spec.tsx"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^react-native-vector-icons$": "@expo/vector-icons",
    "^react-native-vector-icons/(.*)$": "@expo/vector-icons/$1",
    "^@stealth-trails-bank/config/mobile$":
      "<rootDir>/../../packages/config/src/mobile-runtime-config.ts",
    "^@stealth-trails-bank/i18n$": "<rootDir>/../../packages/i18n/src/index.ts",
    "^@stealth-trails-bank/ui-foundation$":
      "<rootDir>/../../packages/ui-foundation/src/index.ts",
    "^@stealth-trails-bank/types$": "<rootDir>/../../packages/types/src/index.ts"
  },
  clearMocks: true
};

export default config;
