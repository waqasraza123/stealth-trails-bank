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
  modulePathIgnorePatterns: ["<rootDir>/dist"],
  collectCoverageFrom: [
    "<rootDir>/src/transaction-intents/transaction-intents-worker.controller.ts",
    "<rootDir>/src/release-readiness/release-readiness.service.ts",
    "<rootDir>/src/release-readiness/release-readiness-proof-runner.ts",
    "!<rootDir>/src/**/*.spec.ts",
    "!<rootDir>/src/**/*.integration.spec.ts",
    "!<rootDir>/src/**/*.d.ts"
  ],
  coverageDirectory: "<rootDir>/coverage",
  coverageReporters: ["text", "lcov"],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 50,
      functions: 80,
      lines: 80
    }
  }
};

export default config;
