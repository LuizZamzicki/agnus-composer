import { randomInt } from "crypto";

// Regras comerciais da loja (as mesmas do site em agnus-front/src/conteudo/loja.js).
export const DESCONTO_PRIMEIRA_COMPRA = 10;
// % a menos para quem paga no Pix (a taxa do Pix é bem menor que a do cartão). Soma com o cupom.
export const DESCONTO_PIX = 5;

export const STATUS_DE_COMPRA = ["pago", "enviado", "entregue"];
export const EMAIL_VALIDO = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
// Sem 0/O e 1/I/L: o cliente digita o código sem confundir letras.
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const dinheiro = (valor: number) => Math.round(valor * 100) / 100;

export const normalizarEmail = (valor: unknown) => (typeof valor === "string" ? valor.trim().toLowerCase() : "");
export const normalizarCupom = (valor: unknown) => (typeof valor === "string" ? valor.trim().toUpperCase().replace(/\s+/g, "") : "");

export const gerarCupom = () =>
  `AGNUS10-${Array.from({ length: 6 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("")}`;

// Resumo do que o cliente paga: as peças com o desconto do cupom (a loja não cobra frete).
export const resumoDaCompra = (subtotal: number, percentualDesconto = 0) => {
  const desconto = dinheiro((subtotal * percentualDesconto) / 100);
  const pecas = dinheiro(subtotal - desconto);
  return { subtotal: dinheiro(subtotal), desconto, total: pecas };
};

// Quanto custa pagar no Pix: o total já com o cupom, menos o desconto do Pix.
export const valorNoPix = (total: number) => dinheiro(total - dinheiro((total * DESCONTO_PIX) / 100));
