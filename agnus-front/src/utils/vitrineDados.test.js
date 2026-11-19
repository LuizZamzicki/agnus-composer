import { campanhaTerminando, etiquetasDoProduto } from "./vitrineDados";
import { sugerirParaOLook } from "../components/completeOLook";
import { textoQueFalta } from "../components/contagemRegressiva";

const DIA = 24 * 60 * 60 * 1000;
const agora = new Date("2026-11-20T12:00:00Z").getTime();

describe("etiquetas dos cards", () => {
    it("Mais pedida para as mais vendidas e Novidade para cadastro recente", () => {
        const mais = new Set([4]);
        expect(etiquetasDoProduto({ id_produto: 4, data_criacao: "2026-06-01" }, mais, agora)).toEqual([{ tipo: "mais", texto: "Mais pedida" }]);
        expect(etiquetasDoProduto({ id_produto: 9, data_criacao: new Date(agora - 5 * DIA).toISOString() }, mais, agora)).toEqual([{ tipo: "nova", texto: "Novidade" }]);
        expect(etiquetasDoProduto({ id_produto: 9 }, new Set(), agora)).toEqual([]);
    });
});

describe("contagem regressiva", () => {
    it("só a campanha que termina nos próximos 14 dias ganha contagem", () => {
        const longe = { id_banner: 1, fim: new Date(agora + 40 * DIA).toISOString() };
        const perto = { id_banner: 2, fim: new Date(agora + 3 * DIA).toISOString() };
        const passou = { id_banner: 3, fim: new Date(agora - DIA).toISOString() };
        expect(campanhaTerminando([{ id_banner: 0, fim: null }, longe, passou, perto], agora)).toBe(perto);
        expect(campanhaTerminando([longe], agora)).toBeNull();
    });

    it("texto curto da faixa do topo", () => {
        expect(textoQueFalta(2 * DIA + 5 * 3600 * 1000 + 9 * 60 * 1000)).toBe("2d 05h 09min");
        expect(textoQueFalta(3 * 3600 * 1000 + 30 * 60 * 1000)).toBe("03h 30min");
    });
});

describe("Complete o look", () => {
    it("prefere categorias que ainda não estão na sacola e nunca repete peça", () => {
        const catalogo = [
            { id_produto: 1, id_categoria: 22 },
            { id_produto: 2, id_categoria: 22 },
            { id_produto: 4, id_categoria: 23 },
            { id_produto: 12, id_categoria: 24 },
        ];
        expect(sugerirParaOLook(catalogo, [1]).map((p) => p.id_produto)).toEqual([4, 12, 2]);
        expect(sugerirParaOLook(catalogo, [1, 2, 4, 12])).toEqual([]);
    });
});
