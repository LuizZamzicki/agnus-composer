// Pedidos do Shopify (Admin API) no formato da tela "Meus pedidos".

// Atributo oculto (o "_" esconde do cliente no checkout) com o id da conta Agnus que pagou.
export const ATRIBUTO_CLIENTE = "_agnus_id_usuario";

const DINHEIRO = "shopMoney { amount currencyCode }";

export const PEDIDOS_DO_CLIENTE = `
query PedidosDoCliente($busca: String!) {
  orders(first: 50, query: $busca, sortKey: CREATED_AT, reverse: true) {
    nodes {
      id
      name
      email
      createdAt
      cancelledAt
      displayFinancialStatus
      displayFulfillmentStatus
      statusPageUrl
      currentTotalPriceSet { ${DINHEIRO} }
      totalShippingPriceSet { ${DINHEIRO} }
      customAttributes { key value }
      fulfillments(first: 10) {
        displayStatus
        trackingInfo(first: 1) { number url company }
      }
      lineItems(first: 50) {
        nodes {
          id
          title
          variantTitle
          quantity
          image { url }
          discountedTotalSet { ${DINHEIRO} }
          product { handle }
        }
      }
    }
  }
}`;

type Dinheiro = { shopMoney: { amount: string; currencyCode: string } } | null;

export type PedidoShopify = {
  id: string;
  name: string;
  email: string | null;
  createdAt: string;
  cancelledAt: string | null;
  displayFinancialStatus: string | null;
  displayFulfillmentStatus: string;
  statusPageUrl: string;
  currentTotalPriceSet: Dinheiro;
  totalShippingPriceSet: Dinheiro;
  customAttributes: { key: string; value: string | null }[];
  fulfillments: { displayStatus: string | null; trackingInfo: { number: string | null; url: string | null; company: string | null }[] }[];
  lineItems: {
    nodes: {
      id: string;
      title: string;
      variantTitle: string | null;
      quantity: number;
      image: { url: string } | null;
      discountedTotalSet: Dinheiro;
      product: { handle: string } | null;
    }[];
  };
};

const valor = (dinheiro: Dinheiro) => {
  const numero = Number(dinheiro?.shopMoney.amount);
  return Number.isFinite(numero) ? numero : 0;
};

const PAGAMENTO_PENDENTE = new Set(["PENDING", "AUTHORIZED", "PARTIALLY_PAID", "EXPIRED"]);
const PAGAMENTO_DESFEITO = new Set(["REFUNDED", "VOIDED"]);
const ENVIADO = new Set(["FULFILLED", "PARTIALLY_FULFILLED", "IN_PROGRESS"]);

// Mesmos status da tela (pedidos antigos): aguardando_pagamento, pago, enviado, entregue, cancelado.
export const statusDoPedido = (pedido: PedidoShopify) => {
  if (pedido.cancelledAt || PAGAMENTO_DESFEITO.has(pedido.displayFinancialStatus ?? "")) return "cancelado";
  if (PAGAMENTO_PENDENTE.has(pedido.displayFinancialStatus ?? "")) return "aguardando_pagamento";
  if (pedido.fulfillments.length && pedido.fulfillments.every((f) => f.displayStatus === "DELIVERED")) return "entregue";
  if (ENVIADO.has(pedido.displayFulfillmentStatus) || pedido.fulfillments.length) return "enviado";
  return "pago";
};

export type DonoDaConta = { idUsuario: number; email: string; emailVerificado: boolean };

const mesmoEmail = (a: string | null | undefined, b: string) =>
  Boolean(a) && a!.trim().toLowerCase() === b.trim().toLowerCase();

// O pedido é desta conta se o checkout do site gravou o id dela. Pedido sem a marca (feito antes
// dela, ou direto na loja do Shopify) só vale com o e-mail idêntico E comprovado (login com Google):
// o cadastro com senha não confirma o e-mail, e a busca do Shopify por e-mail não é exata.
export const pedidoDoCliente = (pedido: PedidoShopify, dono: DonoDaConta) => {
  const atributo = pedido.customAttributes.find((a) => a.key === ATRIBUTO_CLIENTE)?.value;

  if (atributo) {
    return Number(atributo) === dono.idUsuario;
  }

  return dono.emailVerificado && mesmoEmail(pedido.email, dono.email);
};

export const normalizarPedido = (pedido: PedidoShopify) => {
  const rastreio = pedido.fulfillments.flatMap((f) => f.trackingInfo).find((t) => t.number || t.url) ?? null;

  return {
    id: pedido.id,
    numero: pedido.name,
    data: pedido.createdAt,
    status: statusDoPedido(pedido),
    total: valor(pedido.currentTotalPriceSet),
    frete: valor(pedido.totalShippingPriceSet),
    moeda: pedido.currentTotalPriceSet?.shopMoney.currencyCode ?? "BRL",
    acompanhar: pedido.statusPageUrl,
    rastreio: rastreio ? { codigo: rastreio.number, url: rastreio.url, empresa: rastreio.company } : null,
    itens: pedido.lineItems.nodes.map((item) => ({
      id: item.id,
      nome: item.title,
      // "Default Title" é a variante única do Shopify, não é escolha do cliente.
      opcoes: item.variantTitle && item.variantTitle !== "Default Title" ? item.variantTitle : null,
      quantidade: item.quantity,
      total: valor(item.discountedTotalSet),
      imagem: item.image?.url ?? null,
      handle: item.product?.handle ?? null,
    })),
  };
};

export type Pedido = ReturnType<typeof normalizarPedido>;
