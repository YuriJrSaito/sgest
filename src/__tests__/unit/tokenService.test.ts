import { TokenService } from "../../modules/auth/services/tokenService";

describe("TokenService - parseExpirationDate", () => {
  const baseTime = new Date("2026-01-15T12:00:00.000Z");
  let service: TokenService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(baseTime);
    service = new TokenService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("deve converter dias (d)", () => {
    const result = service.parseExpirationDate("30d");
    expect(result.getTime()).toBe(baseTime.getTime() + 30 * 24 * 60 * 60 * 1000);
  });

  it("deve converter horas (h)", () => {
    const result = service.parseExpirationDate("24h");
    expect(result.getTime()).toBe(baseTime.getTime() + 24 * 60 * 60 * 1000);
  });

  it("deve converter minutos (m)", () => {
    const result = service.parseExpirationDate("15m");
    expect(result.getTime()).toBe(baseTime.getTime() + 15 * 60 * 1000);
  });

  it("deve converter segundos (s)", () => {
    const result = service.parseExpirationDate("45s");
    expect(result.getTime()).toBe(baseTime.getTime() + 45 * 1000);
  });

  it("deve usar fallback de 30 dias para formato invalido", () => {
    const result = service.parseExpirationDate("invalid-format");
    expect(result.getTime()).toBe(baseTime.getTime() + 30 * 24 * 60 * 60 * 1000);
  });

  it("deve calcular expiracao de refresh usando a config", () => {
    const expected = service.parseExpirationDate(service.getRefreshTokenExpiration());
    const result = service.getRefreshTokenExpiresAt();
    expect(result.getTime()).toBe(expected.getTime());
  });
});
