import logger from "@agnus/comum/utils/logger";

// Cliente da cotação do Melhor Envio (https://docs.melhorenvio.com.br/): Correios, Jadlog, Loggi
// etc. numa chamada só. Único ponto do sistema que conhece a API deles.
//
// Sem MELHOR_ENVIO_TOKEN fica desligado e o frete sai pela tabela da loja (frete.regras.ts).
// MELHOR_ENVIO_SANDBOX=true usa o ambiente de testes deles.

const TIMEOUT_MS = 8000;

export type CotacaoTransportadora = { id: string; nome: string; empresa: string; preco_cheio: number; prazo_dias: number };

type RespostaServico = {
  id: number;
  name: string;
  price?: string | number;
  custom_price?: string | number;
  delivery_time?: number;
  custom_delivery_time?: number;
  company?: { name?: string };
  error?: string;
};

export const configuracaoMelhorEnvio = (env: NodeJS.ProcessEnv = process.env) => {
  const token = (env.MELHOR_ENVIO_TOKEN ?? "").trim();
  if (!token) return null;
  const sandbox = (env.MELHOR_ENVIO_SANDBOX ?? "").trim().toLowerCase() === "true";
  return {
    token,
    url: sandbox ? "https://sandbox.melhorenvio.com.br" : "https://melhorenvio.com.br",
    // Eles pedem um User-Agent com nome da aplicação e um contato técnico.
    agente: (env.MELHOR_ENVIO_CONTATO ?? "").trim() || "Agnus Loja",
  };
};

export type Pacote = { cepOrigem: string; cepDestino: string; pecas: number; pesoPorPecaKg: number; valorPecas: number };

// Devolve as opções válidas para o CEP. Lança erro se o serviço não responder (quem chama cai na tabela).
export const cotarMelhorEnvio = async (pacote: Pacote): Promise<CotacaoTransportadora[]> => {
  const config = configuracaoMelhorEnvio();
  if (!config) throw new Error("Melhor Envio não configurado.");

  const resposta = await fetch(`${config.url}/api/v2/me/shipment/calculate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": config.agente,
    },
    body: JSON.stringify({
      from: { postal_code: pacote.cepOrigem },
      to: { postal_code: pacote.cepDestino },
      // Camiseta dobrada: 30 x 25 x 3 cm por peça; o Melhor Envio monta a caixa.
      products: [
        {
          id: "pecas",
          width: 25,
          height: 3,
          length: 30,
          weight: pacote.pesoPorPecaKg,
          insurance_value: Math.round((pacote.valorPecas / Math.max(1, pacote.pecas)) * 100) / 100,
          quantity: pacote.pecas,
        },
      ],
      options: { receipt: false, own_hand: false },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!resposta.ok) {
    logger.warn("frete.melhor_envio_erro", { status: resposta.status });
    throw new Error(`Melhor Envio respondeu ${resposta.status}.`);
  }

  const servicos = (await resposta.json()) as RespostaServico[];
  return (Array.isArray(servicos) ? servicos : [])
    .filter((s) => !s.error && Number(s.custom_price ?? s.price) > 0)
    .map((s) => ({
      id: `me-${s.id}`,
      nome: s.name,
      empresa: s.company?.name ?? "",
      preco_cheio: Number(s.custom_price ?? s.price),
      prazo_dias: Number(s.custom_delivery_time ?? s.delivery_time ?? 0),
    }));
};
