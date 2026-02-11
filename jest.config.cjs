// @ts-nocheck

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  roots: ['<rootDir>/src'],

  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts',
  ],

  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/server.ts',
    '!src/types/**',
  ],

  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  globalSetup: '<rootDir>/src/__tests__/globalSetup.ts',
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],

  testTimeout: 10000,
  verbose: true,

  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
      },
    }],
  },

  moduleFileExtensions: ['ts', 'js', 'json'],

  transformIgnorePatterns: ["node_modules"],
};
