// Configuração do programa de afiliados (variáveis AFILIADOS_* no services/.env).
const numero = (valor: string | undefined, padrao: number, min: number, max: number) => {
  const n = Number(valor);
  return Number.isFinite(n) && n >= min && n <= max ? n : padrao;
};

export const config = {
  // Segredo do serviço: assina o cookie do clique, cifra os segredos da API e "salga" o hash do IP.
  segredo: () => process.env.AFILIADOS_SEGREDO ?? "",
  // Janela de atribuição: a compra conta para o afiliado do último clique feito até N dias antes.
  janelaDias: () => numero(process.env.AFILIADOS_JANELA_DIAS, 7, 1, 90),
  // Depois da entrega, a comissão fica pendente por N dias (prazo de arrependimento do CDC) e só então é aprovada.
  prazoAprovacaoDias: () => numero(process.env.AFILIADOS_PRAZO_APROVACAO_DIAS, 7, 0, 90),
  // Taxa usada quando o admin ainda não cadastrou a regra "padrao".
  taxaPadrao: () => numero(process.env.AFILIADOS_TAXA_PADRAO, 10, 0, 90),
  // Limite da API aberta por AppID (requisições por hora), como o limite da Open API da Shopee.
  limitePorHora: () => numero(process.env.AFILIADOS_LIMITE_HORA, 2000, 10, 100000),
  urlDoSite: () => (process.env.FRONTEND_URL || "https://localhost").replace(/\/+$/, ""),
};

export const validarConfiguracao = () => {
  if (config.segredo().length < 32) {
    throw new Error("Configure AFILIADOS_SEGREDO (pelo menos 32 caracteres) no services/.env.");
  }
};
