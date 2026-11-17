import { randomInt } from "crypto";

// Regras comerciais da loja (as mesmas do site em agnus-front/src/conteudo/loja.js).
export const FRETE_GRATIS_ACIMA = 250;
export const DESCONTO_PRIMEIRA_COMPRA = 10;

export const STATUS_DE_COMPRA = ["pago", "enviado", "entregue"];
export const EMAIL_VALIDO = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
// Sem 0/O e 1/I/L: o cliente digita o código sem confundir letras.
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const dinheiro = (valor: number) => Math.round(valor * 100) / 100;

export const normalizarEmail = (valor: unknown) => (typeof valor === "string" ? valor.trim().toLowerCase() : "");
export const normalizarCupom = (valor: unknown) => (typeof valor === "string" ? valor.trim().toUpperCase().replace(/\s+/g, "") : "");

export const gerarCupom = () =>
  `AGNUS10-${Array.from({ length: 6 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("")}`;

// Resumo do que o cliente paga: desconto sobre as peças e frete grátis quando as peças (já com
// desconto) chegam a R$ 250. Abaixo disso o frete continua combinado depois da compra.
export const resumoDaCompra = (subtotal: number, percentualDesconto = 0) => {
  const desconto = dinheiro((subtotal * percentualDesconto) / 100);
  const pecas = dinheiro(subtotal - desconto);
  return { subtotal: dinheiro(subtotal), desconto, total: pecas, frete_gratis: pecas >= FRETE_GRATIS_ACIMA };
};
