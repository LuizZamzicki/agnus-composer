import { HttpError } from "../types/http_error";
import logger, { getCurrentRequestId } from "./logger";
import { incrementMetric } from "./metrics";

export type NomeServico = "identidade" | "catalogo" | "busca" | "avaliacoes" | "carrinho" | "pedidos" | "notificacoes";

type OpcoesChamada = {
  method?: "GET" | "POST";
  body?: unknown;
  timeoutMs?: number;
  // Só operações repetíveis sem efeito colateral: nova tentativa em escrita duplicaria o efeito.
  repetivel?: boolean;
};

export type RespostaInterna<T> = { status: number; data: T };

const TIMEOUT_PADRAO_MS = 2000;
const LIMITE_FALHAS = 5;
const CIRCUITO_ABERTO_MS = 15000;
const ESPERA_RETRY_MS = 100;

const circuitos = new Map<NomeServico, { falhas: number; abertoAte: number }>();

const estadoDo = (servico: NomeServico) => {
  const atual = circuitos.get(servico) ?? { falhas: 0, abertoAte: 0 };
  circuitos.set(servico, atual);
  return atual;
};

export const reiniciarCircuitos = () => circuitos.clear();

const urlBase = (servico: NomeServico) =>
  process.env[`SERVICO_${servico.toUpperCase()}_URL`] ?? `http://${servico}:3000`;

const indisponivel = (servico: NomeServico) =>
  new HttpError(503, `O serviço de ${servico} está indisponível no momento. Tente novamente em instantes.`);

const registrarFalha = (servico: NomeServico, caminho: string, motivo: string) => {
  const estado = estadoDo(servico);

  estado.falhas += 1;
  incrementMetric("internal_call_failures_total");
  logger.warn("interno.falha", { servico, caminho, motivo, falhasSeguidas: estado.falhas });

  if (estado.falhas >= LIMITE_FALHAS) {
    estado.abertoAte = Date.now() + CIRCUITO_ABERTO_MS;
    estado.falhas = 0;
    logger.error("interno.circuito_aberto", { servico, reabreEmMs: CIRCUITO_ABERTO_MS });
  }
};

const tentar = async <T>(servico: NomeServico, caminho: string, opcoes: OpcoesChamada): Promise<RespostaInterna<T>> => {
  const requestId = getCurrentRequestId();
  const resposta = await fetch(`${urlBase(servico)}/internal${caminho}`, {
    method: opcoes.method ?? "GET",
    headers: {
      "content-type": "application/json",
      "x-internal-token": process.env.INTERNAL_API_TOKEN ?? "",
      ...(requestId ? { "x-request-id": requestId } : {}),
    },
    body: opcoes.body === undefined ? undefined : JSON.stringify(opcoes.body),
    signal: AbortSignal.timeout(opcoes.timeoutMs ?? TIMEOUT_PADRAO_MS),
  });

  if (resposta.status >= 500) {
    throw new Error(`status ${resposta.status}`);
  }

  const texto = await resposta.text();

  return { status: resposta.status, data: (texto ? JSON.parse(texto) : null) as T };
};

// Timeout, nova tentativa e circuit breaker ficam aqui para valer igual em toda chamada entre serviços.
export const chamarServico = async <T>(
  servico: NomeServico,
  caminho: string,
  opcoes: OpcoesChamada = {},
): Promise<RespostaInterna<T>> => {
  const estado = estadoDo(servico);

  if (Date.now() < estado.abertoAte) {
    throw indisponivel(servico);
  }

  const repetivel = opcoes.repetivel ?? (opcoes.method ?? "GET") === "GET";
  const tentativas = repetivel ? 2 : 1;
  let ultimoErro = "";

  for (let tentativa = 1; tentativa <= tentativas; tentativa += 1) {
    try {
      const resposta = await tentar<T>(servico, caminho, opcoes);
      estado.falhas = 0;
      incrementMetric("internal_calls_total");
      return resposta;
    } catch (error) {
      ultimoErro = error instanceof Error ? error.message : String(error);

      if (tentativa < tentativas) {
        await new Promise((resolve) => setTimeout(resolve, ESPERA_RETRY_MS));
      }
    }
  }

  registrarFalha(servico, caminho, ultimoErro);
  throw indisponivel(servico);
};

// Atalho para consultas em que 404 significa "não existe", e não erro.
export const consultarOuNull = async <T>(servico: NomeServico, caminho: string, opcoes: OpcoesChamada = {}) => {
  const { status, data } = await chamarServico<T>(servico, caminho, opcoes);
  return status === 404 ? null : data;
};
