export type PedidoStatus =
  | "aguardando_calculo_frete"
  | "aguardando_pagamento"
  | "pago"
  | "enviado"
  | "entregue"
  | "cancelado";

export type PedidoBody = {
  id_usuario?: number | string | null;
  id_usuario_endereco?: number | string | null;
  status?: PedidoStatus | string | null;
  valor_total?: number | string | null;
  valor_frete?: number | string | null;
  // Link de acompanhamento da YouDraw ou só o código; vazio/null remove.
  rastreio?: string | null;
  // Cupom de primeira compra informado no checkout (validado no servidor).
  cupom?: unknown;
  // Opção de frete escolhida no checkout (id da cotação de /frete/cotacao).
  frete_servico?: unknown;
};

export type PedidoRouteParams = {
  id?: string;
};

export type PedidoQuery = {
  id_usuario?: string;
  status?: string;
};

export type PedidoUpdateData = {
  id_usuario: number;
  id_usuario_endereco: number;
  status: PedidoStatus;
  valor_frete: number | string | null;
  codigo_rastreio: string | null;
  data_entrega: Date | null;
};
