import { alternarTema, aplicarTemaSalvo, temaAtual } from "./tema";

const sistema = (escuro) => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: escuro });
};

describe("tema", () => {
    beforeEach(() => {
        localStorage.clear();
        delete document.documentElement.dataset.theme;
    });

    it("segue o sistema quando não há escolha", () => {
        sistema(true);
        expect(temaAtual()).toBe("dark");
        sistema(false);
        expect(temaAtual()).toBe("light");
    });

    it("alterna, guarda a escolha e marca o <html>", () => {
        sistema(false);
        expect(alternarTema()).toBe("dark");
        expect(document.documentElement.dataset.theme).toBe("dark");
        expect(localStorage.getItem("agnus_tema")).toBe("dark");
        expect(alternarTema()).toBe("light");
    });

    it("a escolha guardada vence o sistema e é reaplicada ao abrir", () => {
        sistema(true);
        localStorage.setItem("agnus_tema", "light");
        aplicarTemaSalvo();
        expect(document.documentElement.dataset.theme).toBe("light");
        expect(temaAtual()).toBe("light");
    });

    it("sem escolha, não força tema no <html>", () => {
        document.documentElement.dataset.theme = "dark";
        aplicarTemaSalvo();
        expect(document.documentElement.dataset.theme).toBeUndefined();
    });
});
