export type AgnusEventType =
  | "produto.criado"
  | "produto.atualizado"
  | "produto.removido"
  | "categoria.criada"
  | "categoria.atualizada"
  | "categoria.removida"
  | "pedido.criado"
  | "pedido.atualizado"
  | "pedido.removido";

export type AgnusEventPayload = Record<string, boolean | number | string | null | undefined>;

export type AgnusEvent = {
  id: string;
  type: AgnusEventType;
  occurredAt: string;
  source: string;
  requestId?: string;
  payload: AgnusEventPayload;
};

export type AgnusEventHandler = (event: AgnusEvent) => Promise<void> | void;
