import type { Sequelize } from "sequelize";
import { executarMigracoes, type Migracao } from "../../src/utils/migracoes";

const criarBanco = (jaFeitas: string[], trava = 1) => {
  const query = jest.fn(async (sql: string) => {
    if (sql.includes("GET_LOCK")) return [{ ok: trava }];
    if (sql.startsWith("SELECT nome")) return jaFeitas.map((nome) => ({ nome }));
    return [];
  });
  const banco = { query, transaction: jest.fn((trabalho: (t: object) => Promise<unknown>) => trabalho({})) };
  return { banco: banco as unknown as Sequelize, query };
};

const migracao = (nome: string): Migracao & { up: jest.Mock } => ({ nome, up: jest.fn(async () => undefined) });

describe("executarMigracoes", () => {
  it("aplica só as que faltam, na ordem, e registra cada uma", async () => {
    const { banco, query } = criarBanco(["0001"]);
    const lista = [migracao("0001"), migracao("0002"), migracao("0003")];

    await expect(executarMigracoes(banco, lista)).resolves.toEqual(["0002", "0003"]);
    expect(lista[0].up).not.toHaveBeenCalled();
    expect(lista[1].up.mock.invocationCallOrder[0]).toBeLessThan(lista[2].up.mock.invocationCallOrder[0]);
    expect(query.mock.calls.filter(([sql]) => sql.startsWith("INSERT"))).toHaveLength(2);
    expect(query.mock.calls.at(-1)?.[0]).toContain("RELEASE_LOCK");
  });

  it("não roda nada sem a trava", async () => {
    const { banco } = criarBanco([], 0);
    const lista = [migracao("0001")];

    await expect(executarMigracoes(banco, lista)).rejects.toThrow("trava");
    expect(lista[0].up).not.toHaveBeenCalled();
  });

  it("libera a trava e não registra a migration que falhou", async () => {
    const { banco, query } = criarBanco([]);
    const quebrada = migracao("0001");
    quebrada.up.mockRejectedValueOnce(new Error("sql inválido"));

    await expect(executarMigracoes(banco, [quebrada])).rejects.toThrow("sql inválido");
    expect(query.mock.calls.some(([sql]) => sql.startsWith("INSERT"))).toBe(false);
    expect(query.mock.calls.at(-1)?.[0]).toContain("RELEASE_LOCK");
  });
});
