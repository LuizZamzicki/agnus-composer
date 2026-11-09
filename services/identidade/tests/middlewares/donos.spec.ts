import UsuarioContatos from "../../src/models/UsuarioContatos";
import UsuarioEnderecos from "../../src/models/UsuarioEnderecos";
import { OWNERS } from "../../src/middlewares/donos";

jest.mock("../../src/models/UsuarioContatos", () => ({ __esModule: true, default: { findByPk: jest.fn() } }));
jest.mock("../../src/models/UsuarioEnderecos", () => ({ __esModule: true, default: { findByPk: jest.fn() } }));

describe("OWNERS", () => {
  it("resolve o dono de endereço e contato", async () => {
    (UsuarioEnderecos.findByPk as jest.Mock).mockResolvedValueOnce({ id_usuario: 3 });
    (UsuarioContatos.findByPk as jest.Mock).mockResolvedValueOnce({ id_usuario: 4 });
    await expect(OWNERS.endereco(1)).resolves.toBe(3);
    await expect(OWNERS.contato(1)).resolves.toBe(4);
  });
});
