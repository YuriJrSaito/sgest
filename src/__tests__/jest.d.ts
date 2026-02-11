// src/__tests__/jest.d.ts
/// <reference types="jest" />

declare global {
  namespace jest {
    interface Matchers<R> {
      // Adicione custom matchers aqui se necessário
    }
  }
}

export {};