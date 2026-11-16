import { refDoCookie } from "../../src/services/afiliacao.service";

describe("refDoCookie", () => {
  it("pega o cookie de afiliado entre os outros cookies", () => {
    expect(refDoCookie("tema=escuro; agnus_afiliado=12.1800000000.abc_DEF-123; outro=1")).toBe("12.1800000000.abc_DEF-123");
  });

  it("ignora quando não existe ou tem caracteres estranhos", () => {
    expect(refDoCookie(undefined)).toBeNull();
    expect(refDoCookie("tema=escuro")).toBeNull();
    expect(refDoCookie("agnus_afiliado=<script>")).toBeNull();
  });
});
