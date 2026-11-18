// Rastreio do pedido na YouDraw (quem produz e envia as peças).
//
// A loja tem UMA página pública de rastreio: https://app.youdraw.com.br/rastrear/<token-da-loja>.
// Ela busca o pedido pelo número do pedido na YouDraw, pelo CPF ou pelo e-mail da compra, e aceita a
// busca pronta na URL (?pedido=<busca>), então o site abre o rastreio já pesquisado, sem o cliente digitar.
//
// O token vem de YOUDRAW_LOJA_TOKEN (o UUID no fim do link da loja). Por pedido, a equipe pode
// informar o número do pedido na YouDraw (codigo_rastreio); sem ele, a busca usa o e-mail do cliente.
export const BASE_RASTREIO_YOUDRAW = "https://app.youdraw.com.br/rastrear/";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Número/referência do pedido na YouDraw: curto, sem espaços nem caracteres de URL.
const REFERENCIA = /^[A-Za-z0-9._-]{1,36}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Só a partir do pagamento o pedido existe na YouDraw; antes disso não há o que rastrear.
const STATUS_COM_RASTREIO = new Set(["pago", "enviado", "entregue"]);

export const tokenDaLoja = () => {
  const token = process.env.YOUDRAW_LOJA_TOKEN?.trim() ?? "";
  return UUID.test(token) ? token.toLowerCase() : null;
};

export class RastreioInvalido extends Error {}

// Aceita o número do pedido na YouDraw ("1234" ou "#1234") ou um link da YouDraw com ?pedido=<número>.
// Devolve a referência, null para "sem número" (vazio) ou lança RastreioInvalido com o motivo.
export const extrairCodigoRastreio = (valor: unknown): string | null => {
  if (valor === null || valor === undefined) {
    return null;
  }

  if (typeof valor !== "string") {
    throw new RastreioInvalido("Informe o número do pedido na YouDraw.");
  }

  const texto = valor.trim();

  if (!texto) {
    return null;
  }

  if (/youdraw\.com\.br/i.test(texto)) {
    let url: URL;

    try {
      url = new URL(/^https?:\/\//i.test(texto) ? texto : `https://${texto}`);
    } catch {
      throw new RastreioInvalido("Link da YouDraw inválido.");
    }

    const busca = (url.searchParams.get("pedido") ?? url.searchParams.get("id") ?? "").trim().replace(/^#/, "");

    if (url.hostname !== "app.youdraw.com.br" || !url.pathname.startsWith("/rastrear/")) {
      throw new RastreioInvalido("Link da YouDraw inválido.");
    }

    if (!busca) {
      throw new RastreioInvalido(
        "Esse é o link geral de rastreio da loja, não de um pedido. Informe o número do pedido na YouDraw (ou deixe vazio para buscar pelo e-mail do cliente).",
      );
    }

    if (!REFERENCIA.test(busca)) {
      throw new RastreioInvalido("Número do pedido na YouDraw inválido.");
    }

    return busca;
  }

  const referencia = texto.replace(/^#/, "");

  if (!REFERENCIA.test(referencia)) {
    throw new RastreioInvalido("Número do pedido na YouDraw inválido. Use só o número (ex.: 1234).");
  }

  return referencia;
};

type PedidoRastreavel = { status: string; codigo_rastreio?: string | null };

// URL da página de rastreio já pesquisada. emailDoCliente só deve ser passado quando quem pede é o
// dono do pedido (é o e-mail dele que vai na busca).
export const urlRastreio = (pedido: PedidoRastreavel, emailDoCliente?: string | null) => {
  const token = tokenDaLoja();

  if (!token || !STATUS_COM_RASTREIO.has(pedido.status)) {
    return null;
  }

  // O token da própria loja não é número de pedido (sobra da versão em que se colava o link da loja).
  const codigo = pedido.codigo_rastreio && pedido.codigo_rastreio.toLowerCase() !== token ? pedido.codigo_rastreio : null;
  const busca =
    codigo && REFERENCIA.test(codigo)
      ? codigo
      : emailDoCliente && EMAIL.test(emailDoCliente)
        ? emailDoCliente.trim()
        : null;

  return busca ? `${BASE_RASTREIO_YOUDRAW}${token}?pedido=${encodeURIComponent(busca)}` : null;
};
