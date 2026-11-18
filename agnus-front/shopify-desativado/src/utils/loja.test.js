import {
    adicionarNaSacola,
    contarPecas,
    guardarPecaPendente,
    obterSacola,
    retomarPecaPendente,
    varianteEscolhida,
} from "./loja";
import { CHAVE_DONO_SACOLA, CHAVE_SACOLA } from "./sacola";

const token = () => `x.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 600 }))}.y`;

const sacola = (id, quantidade = 1) => ({ id, quantidade, linhas: [], subtotal: 0, total: 0 });

// Responde cada chamada pela rota (método + caminho depois de /loja/).
function simularLoja(rotas) {
    global.fetch = jest.fn(async (url, init = {}) => {
        const caminho = String(url).replace(/^.*\/loja\//, "");
        const chave = `${init.method || "GET"} ${caminho}`;
        const resposta = rotas[chave];

        if (!resposta) {
            return { ok: false, status: 599, json: async () => ({ message: `sem rota: ${chave}` }) };
        }

        const [status, corpo] = resposta;
        return { ok: status < 400, status, json: async () => corpo };
    });

    return global.fetch;
}

function entrarComo(id) {
    localStorage.setItem("auth_token", token());
    localStorage.setItem("auth", JSON.stringify({ user: { id_usuario: id, tipo: "cliente" } }));
}

beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
});

describe("variante escolhida", () => {
    const produto = {
        opcoes: [{ nome: "Tamanho" }, { nome: "Cor" }],
        variantes: [
            { id: "v1", opcoes: { Tamanho: "M", Cor: "Preto" } },
            { id: "v2", opcoes: { Tamanho: "G", Cor: "Preto" } },
        ],
    };

    it("encontra a variante das opções escolhidas", () => {
        expect(varianteEscolhida(produto, { Tamanho: "G", Cor: "Preto" })?.id).toBe("v2");
    });

    it("não escolhe nada com opção faltando", () => {
        expect(varianteEscolhida(produto, { Tamanho: "G" })).toBeNull();
    });
});

describe("colocar peça na sacola", () => {
    it("visitante precisa entrar antes: nada vai ao Shopify", async () => {
        const fetch = simularLoja({});

        await expect(adicionarNaSacola("v")).rejects.toMatchObject({ status: 401 });
        expect(fetch).not.toHaveBeenCalled();
    });

    it("cria a sacola na primeira peça, com o token, e guarda o id", async () => {
        entrarComo(7);
        const fetch = simularLoja({
            "GET sacolas/minha": [404, { message: "Nenhuma sacola guardada." }],
            "POST sacolas": [201, sacola("s1")],
        });

        await adicionarNaSacola("gid://shopify/ProductVariant/1");

        const [, init] = fetch.mock.calls.find(([url, i]) => i?.method === "POST" && String(url).endsWith("/loja/sacolas"));
        expect(localStorage.getItem(CHAVE_SACOLA)).toBe("s1");
        expect(init.headers.Authorization).toMatch(/^Bearer /);
        expect(JSON.parse(init.body)).toEqual({ linhas: [{ variante: "gid://shopify/ProductVariant/1", quantidade: 1 }] });
    });

    it("soma na sacola que a conta já tem", async () => {
        entrarComo(7);
        localStorage.setItem(CHAVE_SACOLA, "s1");
        localStorage.setItem(CHAVE_DONO_SACOLA, "7");
        simularLoja({ "GET sacolas/s1": [200, sacola("s1")], "POST sacolas/s1/linhas": [200, sacola("s1", 2)] });

        await expect(adicionarNaSacola("v")).resolves.toMatchObject({ quantidade: 2 });
    });

    it("guarda a peça escolhida antes do login e devolve uma vez só, na mesma peça", () => {
        guardarPecaPendente({ handle: "regata", varianteId: "v1" });

        expect(retomarPecaPendente("outra")).toBeNull();
        expect(retomarPecaPendente("regata")).toEqual({ handle: "regata", varianteId: "v1" });
        expect(retomarPecaPendente("regata")).toBeNull();
    });
});

describe("sacola guardada no navegador", () => {
    it("começa outra quando a anterior já foi paga", async () => {
        localStorage.setItem(CHAVE_SACOLA, "paga");
        simularLoja({ "GET sacolas/paga": [404, { message: "Sacola não encontrada." }] });

        await expect(obterSacola()).resolves.toBeNull();
        expect(localStorage.getItem(CHAVE_SACOLA)).toBeNull();
    });

    it("o contador não quebra sem conexão", async () => {
        localStorage.setItem(CHAVE_SACOLA, "s1");
        global.fetch = jest.fn().mockRejectedValue(new Error("offline"));

        await expect(contarPecas()).resolves.toBe(0);
    });
});

describe("sacola ao entrar na conta", () => {
    it("liga a sacola de visitante à conta uma vez só", async () => {
        localStorage.setItem(CHAVE_SACOLA, "s1");
        entrarComo(7);
        const fetch = simularLoja({ "POST sacolas/s1/vincular": [200, sacola("s1", 3)] });

        const [a, b] = await Promise.all([obterSacola(), obterSacola()]);

        expect(a.quantidade).toBe(3);
        expect(b.quantidade).toBe(3);
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch.mock.calls[0][1].headers.Authorization).toMatch(/^Bearer /);
        expect(localStorage.getItem(CHAVE_DONO_SACOLA)).toBe("7");
    });

    it("recupera a sacola guardada na conta em outro aparelho", async () => {
        entrarComo(7);
        simularLoja({ "GET sacolas/minha": [200, sacola("guardada", 2)] });

        await expect(obterSacola()).resolves.toMatchObject({ id: "guardada" });
        expect(localStorage.getItem(CHAVE_SACOLA)).toBe("guardada");
    });

    it("token recusado não encerra a sessão: lê a sacola como visitante", async () => {
        localStorage.setItem(CHAVE_SACOLA, "s1");
        entrarComo(7);
        simularLoja({
            "POST sacolas/s1/vincular": [401, { message: "Token inválido ou expirado." }],
            "GET sacolas/s1": [200, sacola("s1", 1)],
        });

        await expect(obterSacola()).resolves.toMatchObject({ id: "s1" });
        expect(localStorage.getItem("auth_token")).not.toBeNull();
        expect(localStorage.getItem(CHAVE_DONO_SACOLA)).toBeNull();
    });

    it("esquece a sacola de outra conta", async () => {
        localStorage.setItem(CHAVE_SACOLA, "de-outro");
        localStorage.setItem(CHAVE_DONO_SACOLA, "9");
        entrarComo(7);
        simularLoja({ "GET sacolas/minha": [404, { message: "Nenhuma sacola guardada." }] });

        await expect(obterSacola()).resolves.toBeNull();
        expect(localStorage.getItem(CHAVE_SACOLA)).toBeNull();
        expect(localStorage.getItem(CHAVE_DONO_SACOLA)).toBe("7");
    });
});
