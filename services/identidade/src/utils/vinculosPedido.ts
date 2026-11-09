import { chamarServico } from "@agnus/comum/utils/clienteInterno";

// Antes havia uma chave estrangeira; agora o dono dos pedidos responde se o dado ainda está em uso.
export const contarPedidosVinculados = async (filtro: { id_usuario?: number; id_usuario_endereco?: number }) => {
  const parametros = new URLSearchParams(Object.entries(filtro).map(([chave, valor]) => [chave, String(valor)]));
  const { data } = await chamarServico<{ total: number }>("pedidos", `/vinculos?${parametros}`);

  return data.total;
};
