import type { Config } from "jest";

const config: Config = {
  rootDir: ".",
  testEnvironment: "node",
  moduleFileExtensions: ["js", "json", "ts"],
  testMatch: ["<rootDir>/src/**/*.spec.ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.spec.json"
      }
    ]
  },
  moduleNameMapper: {
    "^@stealth-trails-bank/config/api$":
      "<rootDir>/../../packages/config/api.ts"
  },
  clearMocks: true,
  modulePathIgnorePatterns: ["<rootDir>/dist"]
};

export default config;
