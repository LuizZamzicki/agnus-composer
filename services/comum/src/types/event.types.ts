export type AgnusEventType =
  | "produto.criado"
  | "produto.atualizado"
  | "produto.removido"
  | "categoria.criada"
  | "categoria.atualizada"
  | "categoria.removida"
  | "pedido.criado"
  | "pedido.atualizado"
  | "pedido.removido"
  | "usuario.removido"
  | "vendas.atualizadas";

export type AgnusEventPayload = Record<string, boolean | number | string | number[] | null | undefined>;

export type AgnusEvent = {
  id: string;
  type: AgnusEventType;
  occurredAt: string;
  source: string;
  requestId?: string;
  payload: AgnusEventPayload;
};

export type AgnusEventHandler = (event: AgnusEvent) => Promise<void> | void;
