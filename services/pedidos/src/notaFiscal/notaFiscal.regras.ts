// Regras puras da NF-e (sem banco nem disco): chave de acesso e leitura do XML autorizado.

// Chave de acesso: 44 dígitos, o último é o dígito verificador (módulo 11, pesos 2 a 9 da direita).
export const digitoDaChave = (primeiros43: string) => {
  let soma = 0;
  let peso = 2;
  for (let i = primeiros43.length - 1; i >= 0; i -= 1) {
    soma += Number(primeiros43[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
};

export const normalizarChave = (valor: unknown) => (typeof valor === "string" ? valor.replace(/\D/g, "") : "");

export const chaveValida = (chave: string) => /^\d{44}$/.test(chave) && digitoDaChave(chave.slice(0, 43)) === Number(chave[43]);

// Mostra a chave em blocos de 4, como no DANFE.
export const formatarChave = (chave: string) => chave.replace(/(\d{4})(?=\d)/g, "$1 ");

export type DadosDoXml = { chave: string | null; numero: string | null; serie: string | null; data_emissao: Date | null; valor: number | null };

const tag = (xml: string, nome: string) => new RegExp(`<(?:\\w+:)?${nome}>([^<]{1,80})</(?:\\w+:)?${nome}>`).exec(xml)?.[1]?.trim() ?? null;

// Lê o que interessa do XML (nfeProc/NFe) com expressões simples: nada de parser com entidades
// externas. A chave vem de <chNFe> (protocolo) ou do Id="NFe..." da nota.
export const lerXmlDaNota = (xml: string): DadosDoXml => {
  const chave = tag(xml, "chNFe") ?? /Id="NFe(\d{44})"/.exec(xml)?.[1] ?? null;
  const emissao = tag(xml, "dhEmi") ?? tag(xml, "dEmi");
  const data = emissao ? new Date(emissao) : null;
  const valor = Number(tag(xml, "vNF"));
  return {
    chave: chave && /^\d{44}$/.test(chave) ? chave : null,
    numero: tag(xml, "nNF"),
    serie: tag(xml, "serie"),
    data_emissao: data && !Number.isNaN(data.getTime()) ? data : null,
    valor: Number.isFinite(valor) && valor > 0 ? valor : null,
  };
};

export const pareceXmlDeNota = (texto: string) => /<(?:\w+:)?(nfeProc|NFe)[\s>]/.test(texto);
export const pareceSerPdf = (bytes: Buffer) => bytes.subarray(0, 5).toString("latin1") === "%PDF-";
