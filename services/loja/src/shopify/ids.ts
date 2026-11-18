import { HttpError } from "@agnus/comum/types/http_error";

// Ids do Shopify são URIs ("gid://shopify/Cart/abc?key=xyz"). Em base64url eles cabem num
// segmento de URL sem que o gateway decodifique barras ou corte o "?key=" da sacola.
type Tipo = "Cart" | "CartLine" | "ProductVariant";

const MAX_TAMANHO = 512;

export const codificarId = (gid: string) => Buffer.from(gid, "utf8").toString("base64url");

export const decodificarId = (valor: unknown, tipo: Tipo): string => {
  if (typeof valor !== "string" || !valor || valor.length > MAX_TAMANHO) {
    throw new HttpError(400, "Identificador inválido.");
  }

  // Variantes também chegam no formato original, vindas da página da peça.
  const gid = valor.startsWith("gid://") ? valor : Buffer.from(valor, "base64url").toString("utf8");

  if (!gid.startsWith(`gid://shopify/${tipo}/`)) {
    throw new HttpError(400, "Identificador inválido.");
  }

  return gid;
};

// "gid://shopify/Product/8907384062234" -> "8907384062234": chave das avaliações da peça.
export const idNumerico = (gid: string) => gid.match(/\/(\d+)(?:\?|$)/)?.[1] ?? "";
