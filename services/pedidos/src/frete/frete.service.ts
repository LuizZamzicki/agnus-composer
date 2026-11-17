import { HttpError } from "@agnus/comum/types/http_error";
import logger from "@agnus/comum/utils/logger";
import { FRETE_GRATIS_ACIMA } from "../services/ofertas.regras";
import { cotarPelaTabela, CEP_VALIDO, montarOpcoes, normalizarCep, pesoDoPacote, ufDoCep, type OpcaoFrete } from "./frete.regras";
import { configuracaoMelhorEnvio, cotarMelhorEnvio, type CotacaoTransportadora } from "./melhorEnvio";

// Cotação do frete pelo CEP: a mesma conta aparece no carrinho, na página da peça e no checkout,
// e o checkout refaz a cotação no servidor (o preço nunca vem do navegador).

const CACHE_MS = 10 * 60 * 1000;
const CACHE_MAX = 500;
const MAX_PECAS = 50;

export type Cotacao = {
  cep: string;
  uf: string;
  frete_gratis: boolean;
  frete_gratis_acima: number;
  origem: "melhor_envio" | "tabela";
  opcoes: OpcaoFrete[];
};

const config = (env: NodeJS.ProcessEnv = process.env) => {
  const cepOrigem = normalizarCep(env.FRETE_CEP_ORIGEM ?? "") || "87010000";
  const peso = Number(env.FRETE_PESO_PECA_KG);
  const dias = Number(env.FRETE_DIAS_PRODUCAO);
  return {
    cepOrigem,
    ufOrigem: ufDoCep(cepOrigem) ?? "PR",
    pesoPorPecaKg: Number.isFinite(peso) && peso > 0 ? peso : 0.3,
    diasProducao: Number.isInteger(dias) && dias >= 0 ? dias : 0,
  };
};

const cache = new Map<string, { em: number; cotacoes: CotacaoTransportadora[]; origem: Cotacao["origem"] }>();

const transportadoras = async (cepDestino: string, ufDestino: string, pecas: number, valorPecas: number) => {
  const c = config();
  const chave = `${cepDestino}|${pecas}|${Math.round(valorPecas)}`;
  const guardada = cache.get(chave);
  if (guardada && Date.now() - guardada.em < CACHE_MS) return guardada;

  let resultado: { cotacoes: CotacaoTransportadora[]; origem: Cotacao["origem"] } | null = null;

  if (configuracaoMelhorEnvio()) {
    try {
      const cotacoes = await cotarMelhorEnvio({ cepOrigem: c.cepOrigem, cepDestino, pecas, pesoPorPecaKg: c.pesoPorPecaKg, valorPecas });
      if (cotacoes.length > 0) resultado = { cotacoes, origem: "melhor_envio" };
    } catch (error) {
      logger.warn("frete.melhor_envio_indisponivel", { error: error instanceof Error ? error.message : String(error) });
    }
  }

  resultado ??= { cotacoes: cotarPelaTabela(c.ufOrigem, ufDestino, pesoDoPacote(pecas, c.pesoPorPecaKg)), origem: "tabela" };

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(chave, { em: Date.now(), ...resultado });
  return resultado;
};

class FreteService {
  static async cotar(cepInformado: unknown, pecasInformadas: unknown, valorInformado: unknown): Promise<Cotacao> {
    const cep = normalizarCep(cepInformado);
    const uf = CEP_VALIDO.test(cep) ? ufDoCep(cep) : null;
    if (!uf) throw new HttpError(400, "CEP inválido. Confira os 8 números.");

    const pecas = Math.min(MAX_PECAS, Math.max(1, Math.floor(Number(pecasInformadas) || 1)));
    const valorPecas = Math.max(0, Number(valorInformado) || 0);
    const freteGratis = valorPecas >= FRETE_GRATIS_ACIMA;

    const { cotacoes, origem } = await transportadoras(cep, uf, pecas, valorPecas);
    return {
      cep,
      uf,
      frete_gratis: freteGratis,
      frete_gratis_acima: FRETE_GRATIS_ACIMA,
      origem,
      opcoes: montarOpcoes(cotacoes, { freteGratis, diasProducao: config().diasProducao }).slice(0, 4),
    };
  }

  // Usado no checkout: escolhe a opção pedida (ou a mais barata) numa cotação feita agora.
  static async escolher(cep: unknown, pecas: number, valorPecas: number, idOpcao: unknown) {
    const cotacao = await FreteService.cotar(cep, pecas, valorPecas);
    const pedida = typeof idOpcao === "string" && idOpcao.trim() ? idOpcao.trim() : null;
    const opcao = pedida ? cotacao.opcoes.find((o) => o.id === pedida) : cotacao.opcoes[0];
    if (!opcao) throw new HttpError(409, "Essa opção de frete não está mais disponível. Escolha o frete de novo.");
    return { cotacao, opcao };
  }

  static limparCache() {
    cache.clear();
  }
}

export default FreteService;
