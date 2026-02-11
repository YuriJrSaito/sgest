// src/__tests__/mocks/redisMock.ts
// Mock do Redis para testes - simula operações em memória

const store: Map<string, { value: string; expiresAt?: number }> = new Map();

const redisMock = {
  // Simula setex (set with expiration)
  setex: jest.fn(async (key: string, seconds: number, value: string) => {
    store.set(key, {
      value,
      expiresAt: Date.now() + seconds * 1000,
    });
    return 'OK';
  }),

  // Simula set
  set: jest.fn(async (key: string, value: string) => {
    store.set(key, { value });
    return 'OK';
  }),

  // Simula get
  get: jest.fn(async (key: string) => {
    const item = store.get(key);
    if (!item) return null;
    if (item.expiresAt && item.expiresAt < Date.now()) {
      store.delete(key);
      return null;
    }
    return item.value;
  }),

  // Simula exists
  exists: jest.fn(async (key: string) => {
    const item = store.get(key);
    if (!item) return 0;
    if (item.expiresAt && item.expiresAt < Date.now()) {
      store.delete(key);
      return 0;
    }
    return 1;
  }),

  // Simula del
  del: jest.fn(async (key: string) => {
    const existed = store.has(key);
    store.delete(key);
    return existed ? 1 : 0;
  }),

  // Simula ping
  ping: jest.fn(async () => 'PONG'),

  // Simula quit
  quit: jest.fn(async () => 'OK'),

  // Event handlers (no-op)
  on: jest.fn(),

  // Limpa o store (útil para beforeEach)
  __clear: () => {
    store.clear();
    jest.clearAllMocks();
  },
};

export default redisMock;
