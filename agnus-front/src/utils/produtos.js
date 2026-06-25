import { assetUrl } from "./api";

function parseJsonSeguro(valor, fallback = []) {
  if (Array.isArray(valor)) return valor;
  if (typeof valor !== "string") return fallback;
  try {
    const parsed = JSON.parse(valor);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function numeroSeguro(valor, fallback = 0) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : fallback;
}

function normalizarUrlImagem(url) {
  if (typeof url !== "string") return "";

  const valor = url.trim();
  if (!valor) return "";

  if (/^(?:https?:|data:|blob:)/i.test(valor)) {
    return valor;
  }

  return assetUrl(valor);
}

function extrairUrlsDeFotos(entrada) {
  const fotos = Array.isArray(entrada) ? entrada : parseJsonSeguro(entrada, []);
  return fotos
    .map((foto) => {
      if (typeof foto === "string") return normalizarUrlImagem(foto);
      if (!foto || typeof foto !== "object") return "";
      return normalizarUrlImagem(
        foto.url ||
        foto.src ||
        foto.path ||
        foto.caminho ||
        foto.foto ||
        foto.imagem ||
        foto.foto_url ||
        foto.caminho_url ||
        foto.image_url ||
        foto.imagem_url ||
        foto.arquivo_url ||
        foto.caminho_arquivo ||
        ""
      );
    })
    .filter(Boolean);
}

function deduplicar(lista) {
  return [...new Set(lista.filter(Boolean))];
}

function normalizarValorCor(valor) {
  if (typeof valor !== "string") return "";
  const cor = valor.trim();
  if (!cor) return "";

  const ehHex = /^#([\da-f]{3}|[\da-f]{6})$/i.test(cor);
  const ehRgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(?:\d*\.\d+|\d+))?\s*\)$/i.test(cor);
  const ehHsl = /^hsla?\(\s*\d{1,3}(?:deg)?\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%(?:\s*,\s*(?:\d*\.\d+|\d+))?\s*\)$/i.test(cor);

  return ehHex || ehRgb || ehHsl ? cor : "";
}

function extrairTonalidadeCor(cor) {
  const candidatas = [
    cor?.tonalidade,
    cor?.rgb,
    cor?.rgb_cor,
    cor?.cor_rgb,
    cor?.color_rgb,
    cor?.tonalidade_rgb,
    cor?.codigo_rgb,
    cor?.hex,
    cor?.codigo_hex,
    cor?.hex_color,
    cor?.cor_hex,
    cor?.color,
    cor?.colour,
  ];

  for (const valor of candidatas) {
    const normalizada = normalizarValorCor(valor);
    if (normalizada) return normalizada;
  }

  return "#1f1f1f";
}

export function formatarMoeda(valor) {
  const numero = numeroSeguro(valor, 0);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numero);
}

export function normalizarProduto(item) {
  const preco = numeroSeguro(item?.preco_base ?? item?.preco ?? item?.precoVenda, 0);
  const id = item?.id ?? item?.id_produto ?? item?.idProduto ?? null;

  const gradesOriginais = parseJsonSeguro(item?.grades ?? item?.tamanhos ?? item?.sizes, []);
  const coresOriginais = parseJsonSeguro(item?.cores ?? item?.colors ?? item?.variacoes_cores, []);

  const grades = gradesOriginais
    .map((grade, index) => ({
      id: grade?.id ?? grade?.id_grade ?? `${id}-grade-${index}`,
      nome: (grade?.nome ?? grade?.label ?? "").toString().trim() || `Opcao ${index + 1}`,
      acrescimo: numeroSeguro(grade?.acrescimo, 0),
    }))
    .filter((grade) => grade.nome);

  const cores = coresOriginais
    .map((cor, index) => ({
      id: cor?.id ?? cor?.id_cor ?? `${id}-cor-${index}`,
      nome: (cor?.nome ?? cor?.label ?? "").toString().trim() || `Cor ${index + 1}`,
      tonalidade: extrairTonalidadeCor(cor),
      acrescimo: numeroSeguro(cor?.acrescimo, 0),
      fotos: extrairUrlsDeFotos(cor?.fotos ?? cor?.imagens ?? cor?.images),
    }))
    .filter((cor) => cor.nome);

  const fotosDiretas = deduplicar([
    ...(item?.foto ? [normalizarUrlImagem(item.foto)] : []),
    ...(item?.imagem ? [normalizarUrlImagem(item.imagem)] : []),
    ...(item?.foto_url ? [normalizarUrlImagem(item.foto_url)] : []),
    ...extrairUrlsDeFotos(item?.fotos),
    ...extrairUrlsDeFotos(item?.imagens),
    ...cores.flatMap((cor) => cor.fotos),
  ]);

  return {
    id: id ?? Date.now(),
    nome: item?.nome ?? "Produto sem nome",
    descricao: item?.descricao ?? "",
    preco,
    categoriaId: item?.id_categoria ?? item?.categoria_id ?? null,
    categoriaNome: item?.categoria_nome ?? item?.categoria ?? "",
    fotos: fotosDiretas,
    grades,
    cores,
    mediaAvaliacao: numeroSeguro(item?.media_avaliacao, 0),
    totalAvaliacoes: numeroSeguro(item?.total_avaliacoes, 0),
    dataCriacao: item?.data_criacao ?? item?.created_at ?? null,
  };
}

export function obterInicial(nome = "") {
  return nome.trim().charAt(0).toUpperCase() || "?";
}




