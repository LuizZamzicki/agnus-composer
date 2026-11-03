import {
    aplicarTempoLiturgico,
    batismoDoSenhor,
    inicioAdvento,
    pascoa,
    tempoLiturgico,
} from "./liturgia";

const d = (ano, mes, dia) => new Date(ano, mes - 1, dia);

describe("calendário litúrgico", () => {
    it("calcula o domingo de Páscoa", () => {
        expect(pascoa(2025)).toEqual(d(2025, 4, 20));
        expect(pascoa(2026)).toEqual(d(2026, 4, 5));
        expect(pascoa(2027)).toEqual(d(2027, 3, 28));
    });

    it("calcula o primeiro domingo do Advento", () => {
        expect(inicioAdvento(2026)).toEqual(d(2026, 11, 29));
        expect(inicioAdvento(2027)).toEqual(d(2027, 11, 28));
        expect(inicioAdvento(2022)).toEqual(d(2022, 11, 27));
    });

    it("calcula o Batismo do Senhor", () => {
        expect(batismoDoSenhor(2026)).toEqual(d(2026, 1, 11));
        expect(batismoDoSenhor(2027)).toEqual(d(2027, 1, 10));
    });

    it.each([
        [d(2026, 1, 1), "natal"],
        [d(2026, 1, 11), "natal"],
        [d(2026, 1, 12), "comum"],
        [d(2026, 2, 17), "comum"],
        [d(2026, 2, 18), "quaresma"],
        [d(2026, 4, 4), "quaresma"],
        [d(2026, 4, 5), "pascoa"],
        [d(2026, 5, 23), "pascoa"],
        [d(2026, 5, 24), "pentecostes"],
        [d(2026, 5, 25), "comum"],
        [d(2026, 11, 2), "comum"],
        [d(2026, 11, 29), "advento"],
        [d(2026, 12, 24), "advento"],
        [d(2026, 12, 25), "natal"],
    ])("%s é %s", (data, chave) => {
        expect(tempoLiturgico(data).chave).toBe(chave);
    });

    it("devolve nome e cor de cada tempo", () => {
        expect(tempoLiturgico(d(2026, 11, 2))).toMatchObject({ nome: "Tempo Comum", cor: "#2f6a46" });
        expect(tempoLiturgico(d(2026, 12, 1))).toMatchObject({ nome: "Advento" });
    });

    it("aplica a cor como variável CSS no elemento raiz", () => {
        const root = document.createElement("div");
        const tempo = aplicarTempoLiturgico(d(2026, 3, 1), root);

        expect(tempo.chave).toBe("quaresma");
        expect(root.style.getPropertyValue("--lit")).toBe("#4e2f6e");
        expect(root.dataset.tempo).toBe("quaresma");
    });
});
