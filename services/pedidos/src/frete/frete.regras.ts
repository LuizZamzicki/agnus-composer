// Regras puras do frete (sem banco nem rede): CEP → estado → distância da origem → preço e prazo.
//
// A cotação de verdade vem do Melhor Envio (melhorEnvio.ts) quando MELHOR_ENVIO_TOKEN existe. Sem
// o token, ou se o Melhor Envio não responder, vale a tabela da loja abaixo, para o cliente sempre
// ver um valor e conseguir comprar.

export type Regiao = "N" | "NE" | "CO" | "SE" | "S";
export type Zona = "local" | "regional" | "proxima" | "distante";

export type OpcaoFrete = {
  id: string;
  nome: string;
  empresa: string;
  // Valor que o cliente paga (já com o frete grátis aplicado) e o valor da transportadora.
  preco: number;
  preco_cheio: number;
  prazo_dias: number;
  gratis: boolean;
};

export const CEP_VALIDO = /^\d{8}$/;
export const normalizarCep = (valor: unknown) => (typeof valor === "string" || typeof valor === "number" ? String(valor).replace(/\D/g, "") : "");

// Faixas dos Correios pelos 5 primeiros dígitos do CEP.
const FAIXAS: [number, number, string][] = [
  [1000, 19999, "SP"], [20000, 28999, "RJ"], [29000, 29999, "ES"], [30000, 39999, "MG"],
  [40000, 48999, "BA"], [49000, 49999, "SE"], [50000, 56999, "PE"], [57000, 57999, "AL"],
  [58000, 58999, "PB"], [59000, 59999, "RN"], [60000, 63999, "CE"], [64000, 64999, "PI"],
  [65000, 65999, "MA"], [66000, 68899, "PA"], [68900, 68999, "AP"], [69000, 69299, "AM"],
  [69300, 69399, "RR"], [69400, 69899, "AM"], [69900, 69999, "AC"], [70000, 72799, "DF"],
  [72800, 72999, "GO"], [73000, 73699, "DF"], [73700, 76799, "GO"], [76800, 76999, "RO"],
  [77000, 77999, "TO"], [78000, 78899, "MT"], [78900, 78999, "RO"], [79000, 79999, "MS"],
  [80000, 87999, "PR"], [88000, 89999, "SC"], [90000, 99999, "RS"],
];

const REGIOES: Record<Regiao, string[]> = {
  N: ["AC", "AP", "AM", "PA", "RO", "RR", "TO"],
  NE: ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"],
  CO: ["DF", "GO", "MT", "MS"],
  SE: ["ES", "MG", "RJ", "SP"],
  S: ["PR", "RS", "SC"],
};

// Regiões que fazem divisa (frete de distância média). O resto é "distante".
const VIZINHAS = new Set(["S-SE", "SE-CO", "SE-NE", "CO-N", "CO-S", "CO-NE", "N-NE"]);

export const ufDoCep = (cep: string) => {
  const prefixo = Number(cep.slice(0, 5));
  return CEP_VALIDO.test(cep) ? FAIXAS.find(([de, ate]) => prefixo >= de && prefixo <= ate)?.[2] ?? null : null;
};

export const regiaoDaUf = (uf: string) => (Object.keys(REGIOES) as Regiao[]).find((r) => REGIOES[r].includes(uf)) ?? null;

export const zonaEntre = (ufOrigem: string, ufDestino: string): Zona => {
  if (ufOrigem === ufDestino) return "local";
  const a = regiaoDaUf(ufOrigem), b = regiaoDaUf(ufDestino);
  if (!a || !b) return "distante";
  if (a === b) return "regional";
  return VIZINHAS.has(`${a}-${b}`) || VIZINHAS.has(`${b}-${a}`) ? "proxima" : "distante";
};

// Tabela da loja (base até 1 kg + valor por kg a mais), próxima dos preços de balcão dos Correios.
type Linha = { base: number; porKg: number; prazo: number };
export const TABELA: Record<"pac" | "sedex", Record<Zona, Linha>> = {
  pac: {
    local: { base: 19.9, porKg: 3.5, prazo: 4 },
    regional: { base: 24.9, porKg: 4.5, prazo: 6 },
    proxima: { base: 29.9, porKg: 6, prazo: 8 },
    distante: { base: 39.9, porKg: 8, prazo: 12 },
  },
  sedex: {
    local: { base: 29.9, porKg: 6, prazo: 2 },
    regional: { base: 39.9, porKg: 8, prazo: 3 },
    proxima: { base: 54.9, porKg: 11, prazo: 4 },
    distante: { base: 79.9, porKg: 15, prazo: 6 },
  },
};

const dinheiro = (valor: number) => Math.round(valor * 100) / 100;

export const pesoDoPacote = (pecas: number, pesoPorPeca: number) => Math.max(0.3, dinheiro(pecas * pesoPorPeca));

export const cotarPelaTabela = (ufOrigem: string, ufDestino: string, pesoKg: number) => {
  const zona = zonaEntre(ufOrigem, ufDestino);
  const kgAMais = Math.max(0, Math.ceil(pesoKg - 1));

  return (["pac", "sedex"] as const).map((servico) => {
    const linha = TABELA[servico][zona];
    const preco = dinheiro(linha.base + kgAMais * linha.porKg);
    return { id: servico, nome: servico === "pac" ? "PAC" : "SEDEX", empresa: "Correios", preco_cheio: preco, prazo_dias: linha.prazo };
  });
};

// Prazo final = dias de transporte + dias de produção da peça (FRETE_DIAS_PRODUCAO).
// Frete grátis: a opção mais barata sai de graça e as outras custam só a diferença.
export const montarOpcoes = (
  cotacoes: { id: string; nome: string; empresa: string; preco_cheio: number; prazo_dias: number }[],
  { freteGratis, diasProducao }: { freteGratis: boolean; diasProducao: number },
): OpcaoFrete[] => {
  const ordenadas = [...cotacoes].filter((c) => c.preco_cheio >= 0).sort((a, b) => a.preco_cheio - b.preco_cheio || a.prazo_dias - b.prazo_dias);
  const menor = ordenadas[0]?.preco_cheio ?? 0;

  return ordenadas.map((c) => {
    const preco = freteGratis ? dinheiro(Math.max(0, c.preco_cheio - menor)) : dinheiro(c.preco_cheio);
    return { ...c, preco_cheio: dinheiro(c.preco_cheio), preco, prazo_dias: c.prazo_dias + diasProducao, gratis: preco === 0 };
  });
};
