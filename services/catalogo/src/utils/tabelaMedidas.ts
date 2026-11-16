import { HttpError } from "@agnus/comum/types/http_error";

// Tabela de medidas da peça. Medidas da PEÇA esticada sobre a mesa, em cm (não do corpo).
export type ColunaMedida = { chave: string; rotulo: string; descricao: string };
export type LinhaMedida = { tamanho: string; valores: Record<string, number> };
export type TabelaMedidas = {
  modelo: string;
  colunas: ColunaMedida[];
  linhas: LinhaMedida[];
  observacao: string | null;
};

// Modelos de peça que a página sabe desenhar (o desenho mostra onde fica cada medida).
export const MODELOS = ["camiseta", "babylook", "oversized", "regata", "short"] as const;

const LIMITES = { colunas: 6, linhas: 12, rotulo: 40, descricao: 200, observacao: 300, tamanho: 10, maxCm: 300 };

const texto = (valor: unknown, max: number) => (typeof valor === "string" ? valor.trim().slice(0, max) : "");

const erro = (mensagem: string) => new HttpError(400, `Tabela de medidas: ${mensagem}`);

// null, "" ou {} = remover a tabela. Qualquer outra coisa precisa estar completa e coerente.
export const normalizarTabelaMedidas = (valor: unknown): TabelaMedidas | null => {
  if (valor === null || valor === undefined || valor === "") return null;

  let bruto = valor;
  if (typeof valor === "string") {
    try {
      bruto = JSON.parse(valor);
    } catch {
      throw erro("JSON inválido.");
    }
  }

  if (typeof bruto !== "object" || Array.isArray(bruto) || bruto === null) throw erro("formato inválido.");
  const tabela = bruto as Record<string, unknown>;
  if (Object.keys(tabela).length === 0) return null;

  const modelo = texto(tabela.modelo, 20);
  if (!(MODELOS as readonly string[]).includes(modelo)) throw erro(`modelo deve ser um de: ${MODELOS.join(", ")}.`);

  if (!Array.isArray(tabela.colunas) || tabela.colunas.length === 0 || tabela.colunas.length > LIMITES.colunas) {
    throw erro(`informe de 1 a ${LIMITES.colunas} medidas (colunas).`);
  }

  const colunas = tabela.colunas.map((c: Record<string, unknown>) => {
    const chave = texto(c?.chave, 20);
    const rotulo = texto(c?.rotulo, LIMITES.rotulo);
    if (!/^[a-z_]{1,20}$/.test(chave) || !rotulo) throw erro("cada medida precisa de chave (letras minúsculas) e nome.");
    return { chave, rotulo, descricao: texto(c?.descricao, LIMITES.descricao) };
  });

  if (new Set(colunas.map((c) => c.chave)).size !== colunas.length) throw erro("há medidas repetidas.");

  if (!Array.isArray(tabela.linhas) || tabela.linhas.length === 0 || tabela.linhas.length > LIMITES.linhas) {
    throw erro(`informe de 1 a ${LIMITES.linhas} tamanhos.`);
  }

  const linhas = tabela.linhas.map((l: Record<string, unknown>) => {
    const tamanho = texto(l?.tamanho, LIMITES.tamanho);
    if (!tamanho) throw erro("cada linha precisa do tamanho (ex.: P, M, G).");

    const valores: Record<string, number> = {};
    const brutos = (l?.valores ?? {}) as Record<string, unknown>;
    for (const coluna of colunas) {
      const numero = Number(String(brutos[coluna.chave] ?? "").replace(",", "."));
      if (!Number.isFinite(numero) || numero <= 0 || numero > LIMITES.maxCm) {
        throw erro(`preencha "${coluna.rotulo}" do tamanho ${tamanho} (em cm, entre 1 e ${LIMITES.maxCm}).`);
      }
      valores[coluna.chave] = Math.round(numero * 10) / 10;
    }
    return { tamanho, valores };
  });

  if (new Set(linhas.map((l) => l.tamanho.toUpperCase())).size !== linhas.length) throw erro("há tamanhos repetidos.");

  return { modelo, colunas, linhas, observacao: texto(tabela.observacao, LIMITES.observacao) || null };
};
