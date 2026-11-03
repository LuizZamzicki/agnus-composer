import {
    adicionarVisitante,
    contarPecas,
    formatarReal,
    lerSacolaVisitante,
    usuarioDaSessao,
} from "./sacola";

const token = (exp) => `x.${btoa(JSON.stringify({ exp }))}.y`;
const emSegundos = (delta) => Math.floor(Date.now() / 1000) + delta;
const peca = { id_produto_cor: 1, id_produto_grade: 2, quantidade: 1, preco_unitario: 100 };

beforeEach(() => localStorage.clear());

describe("sessão", () => {
    it("reconhece o cliente com token válido", () => {
        localStorage.setItem("auth_token", token(emSegundos(600)));
        localStorage.setItem("auth", JSON.stringify({ user: { id_usuario: 7 } }));

        expect(usuarioDaSessao()).toBe(7);
    });

    it("trata token vencido como visitante", () => {
        localStorage.setItem("auth_token", token(emSegundos(-600)));
        localStorage.setItem("auth", JSON.stringify({ user: { id_usuario: 7 } }));

        expect(usuarioDaSessao()).toBe(0);
    });

    it("trata quem não tem token como visitante", () => {
        expect(usuarioDaSessao()).toBe(0);
    });
});

describe("sacola do visitante", () => {
    it("guarda a peça sem exigir conta", async () => {
        adicionarVisitante(peca);

        expect(lerSacolaVisitante()).toHaveLength(1);
        await expect(contarPecas()).resolves.toBe(1);
    });

    it("soma a quantidade da mesma cor e tamanho", async () => {
        adicionarVisitante(peca);
        adicionarVisitante(peca);

        expect(lerSacolaVisitante()).toHaveLength(1);
        await expect(contarPecas()).resolves.toBe(2);
    });

    it("mantém tamanhos diferentes separados", () => {
        adicionarVisitante(peca);
        adicionarVisitante({ ...peca, id_produto_grade: 3 });

        expect(lerSacolaVisitante()).toHaveLength(2);
    });

    it("não quebra com dado corrompido", () => {
        localStorage.setItem("agnus_sacola_visitante", "{quebrado");

        expect(lerSacolaVisitante()).toEqual([]);
    });
});

it("formata em reais", () => {
    expect(formatarReal(1499.9).replace(/\s/g, " ")).toBe("R$ 1.499,90");
});
