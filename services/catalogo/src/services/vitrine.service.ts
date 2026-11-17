import { promises as fs } from "fs";
import path from "path";
import { DataTypes, Model, Op } from "sequelize";
import sequelize from "@agnus/comum/config/database";
import { HttpError } from "@agnus/comum/types/http_error";
import logger from "@agnus/comum/utils/logger";
import { saveProdutoFotoBits } from "../utils/produtoFotoStorage";

export class VitrineBanners extends Model {
  declare id_banner: number;
  declare titulo: string;
  declare subtitulo: string | null;
  declare sobretitulo: string | null;
  declare texto_botao: string | null;
  declare link: string | null;
  declare imagem_url: string;
  declare imagem_mobile_url: string | null;
  declare alinhamento: "esquerda" | "centro" | "direita";
  declare foco: "topo" | "centro" | "base";
  declare ordem: number;
  declare ativo: boolean;
  declare inicio: Date | null;
  declare fim: Date | null;
}

VitrineBanners.init(
  {
    id_banner: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    titulo: { type: DataTypes.STRING(80), allowNull: false },
    subtitulo: { type: DataTypes.STRING(180), allowNull: true },
    sobretitulo: { type: DataTypes.STRING(40), allowNull: true },
    texto_botao: { type: DataTypes.STRING(40), allowNull: true },
    link: { type: DataTypes.STRING(255), allowNull: true },
    imagem_url: { type: DataTypes.STRING(255), allowNull: false },
    imagem_mobile_url: { type: DataTypes.STRING(255), allowNull: true },
    alinhamento: { type: DataTypes.ENUM("esquerda", "centro", "direita"), allowNull: false, defaultValue: "esquerda" },
    foco: { type: DataTypes.ENUM("topo", "centro", "base"), allowNull: false, defaultValue: "centro" },
    ordem: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    ativo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    inicio: { type: DataTypes.DATE, allowNull: true },
    fim: { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, tableName: "vitrine_banners", timestamps: false },
);

export const MAX_BANNERS_ATIVOS = 6;

type Arquivo = { fieldname: string; buffer: Buffer; mimetype: string; originalname: string };

const texto = (valor: unknown, campo: string, max: number, obrigatorio = false) => {
  const t = typeof valor === "string" ? valor.trim() : "";
  if (!t) {
    if (obrigatorio) throw new HttpError(400, `Preencha ${campo}.`);
    return null;
  }
  if (t.length > max) throw new HttpError(400, `${campo} pode ter no máximo ${max} caracteres.`);
  return t;
};

// Só caminhos da própria loja ("/catalogo", "/produto/4"): o banner nunca leva o cliente para fora.
export const linkInterno = (valor: unknown) => {
  const link = texto(valor, "o link", 255);
  if (!link) return null;
  if (!/^\/(?!\/)[\w\-./?=&%#]*$/.test(link) || link.includes("\\")) {
    throw new HttpError(400, 'O link precisa ser uma página da loja, começando com "/" (ex.: /catalogo).');
  }
  return link;
};

const data = (valor: unknown, campo: string) => {
  if (valor === undefined || valor === null || valor === "") return null;
  const d = new Date(String(valor));
  if (Number.isNaN(d.getTime())) throw new HttpError(400, `Data de ${campo} inválida.`);
  return d;
};

const umDe = <T extends string>(valor: unknown, opcoes: readonly T[], padrao: T): T =>
  opcoes.includes(valor as T) ? (valor as T) : padrao;

const booleano = (valor: unknown, padrao: boolean) => {
  if (valor === undefined || valor === null || valor === "") return padrao;
  return valor === true || valor === "true" || valor === "1" || valor === 1;
};

const PASTA_FOTOS = path.resolve(process.cwd(), "produto_fotos");

// Apaga do disco uma imagem que deixou de ser usada (só arquivos da pasta de fotos, pelo nome exato).
const apagarImagem = async (caminho: string | null | undefined) => {
  if (!caminho?.startsWith("produto_fotos/")) return;
  const nome = path.basename(caminho);
  await fs.unlink(path.join(PASTA_FOTOS, nome)).catch(() => undefined);
};

const salvarArquivo = async (arquivo: Arquivo | undefined) => {
  if (!arquivo) return null;
  const caminho = await saveProdutoFotoBits(arquivo);
  if (!caminho) throw new HttpError(400, "A imagem enviada não é válida (use JPG, PNG ou WEBP de até 20 MB).");
  return caminho;
};

export const publico = (b: VitrineBanners) => ({
  id_banner: b.id_banner,
  titulo: b.titulo,
  subtitulo: b.subtitulo,
  sobretitulo: b.sobretitulo,
  texto_botao: b.texto_botao,
  link: b.link,
  imagem_url: b.imagem_url,
  imagem_mobile_url: b.imagem_mobile_url,
  alinhamento: b.alinhamento,
  foco: b.foco,
  // Fim da campanha: a loja mostra a contagem regressiva quando faltam poucos dias.
  fim: b.fim ?? null,
});

export default class VitrineService {
  // Para a loja: ativos e dentro do período, na ordem definida pela equipe.
  static async ativos(agora = new Date()) {
    const banners = await VitrineBanners.findAll({
      where: {
        ativo: true,
        [Op.and]: [
          { [Op.or]: [{ inicio: null }, { inicio: { [Op.lte]: agora } }] },
          { [Op.or]: [{ fim: null }, { fim: { [Op.gt]: agora } }] },
        ],
      },
      order: [["ordem", "ASC"], ["id_banner", "DESC"]],
      limit: MAX_BANNERS_ATIVOS,
    });
    return banners.map(publico);
  }

  static async todos() {
    const banners = await VitrineBanners.findAll({ order: [["ordem", "ASC"], ["id_banner", "DESC"]] });
    const agora = Date.now();
    return banners.map((b) => ({
      ...publico(b),
      ordem: b.ordem,
      ativo: b.ativo,
      inicio: b.inicio,
      fim: b.fim,
      no_ar: Boolean(b.ativo && (!b.inicio || b.inicio.getTime() <= agora) && (!b.fim || b.fim.getTime() > agora)),
    }));
  }

  private static dados(corpo: Record<string, unknown>, atual?: VitrineBanners) {
    const inicio = corpo.inicio !== undefined ? data(corpo.inicio, "início") : atual?.inicio ?? null;
    const fim = corpo.fim !== undefined ? data(corpo.fim, "fim") : atual?.fim ?? null;
    if (inicio && fim && fim <= inicio) throw new HttpError(400, "O fim precisa ser depois do início.");

    const textoBotao = texto(corpo.texto_botao, "o texto do botão", 40);
    const link = linkInterno(corpo.link);
    if (textoBotao && !link) throw new HttpError(400, "Informe o link do botão.");

    const ordem = Number(corpo.ordem ?? atual?.ordem ?? 0);
    if (!Number.isInteger(ordem) || ordem < 0 || ordem > 999) throw new HttpError(400, "Ordem inválida (0 a 999).");

    return {
      titulo: texto(corpo.titulo, "o título", 80, true) as string,
      subtitulo: texto(corpo.subtitulo, "o texto", 180),
      sobretitulo: texto(corpo.sobretitulo, "o texto pequeno acima do título", 40),
      texto_botao: textoBotao,
      link,
      alinhamento: umDe(corpo.alinhamento, ["esquerda", "centro", "direita"] as const, atual?.alinhamento ?? "esquerda"),
      foco: umDe(corpo.foco, ["topo", "centro", "base"] as const, atual?.foco ?? "centro"),
      ordem,
      ativo: booleano(corpo.ativo, atual?.ativo ?? true),
      inicio,
      fim,
    };
  }

  static async criar(corpo: Record<string, unknown>, arquivos: Arquivo[] = []) {
    const dados = VitrineService.dados(corpo);
    const imagem = arquivos.find((a) => a.fieldname === "imagem");
    if (!imagem) throw new HttpError(400, "Envie a foto do banner.");

    const imagem_url = (await salvarArquivo(imagem)) as string;
    const imagem_mobile_url = await salvarArquivo(arquivos.find((a) => a.fieldname === "imagem_mobile"));
    const banner = await VitrineBanners.create({ ...dados, imagem_url, imagem_mobile_url });
    logger.info("vitrine.banner_criado", { id_banner: banner.id_banner });
    return banner;
  }

  static async atualizar(id: number, corpo: Record<string, unknown>, arquivos: Arquivo[] = []) {
    const banner = await VitrineBanners.findByPk(id);
    if (!banner) throw new HttpError(404, "Banner não encontrado.");

    const dados = VitrineService.dados(corpo, banner);
    const antigas: (string | null)[] = [];

    const nova = await salvarArquivo(arquivos.find((a) => a.fieldname === "imagem"));
    if (nova) {
      antigas.push(banner.imagem_url);
      Object.assign(dados, { imagem_url: nova });
    }
    const novaMobile = await salvarArquivo(arquivos.find((a) => a.fieldname === "imagem_mobile"));
    if (novaMobile) {
      antigas.push(banner.imagem_mobile_url);
      Object.assign(dados, { imagem_mobile_url: novaMobile });
    } else if (booleano(corpo.remover_imagem_mobile, false)) {
      antigas.push(banner.imagem_mobile_url);
      Object.assign(dados, { imagem_mobile_url: null });
    }

    await banner.update(dados);
    await Promise.all(antigas.map(apagarImagem));
    return banner;
  }

  static async remover(id: number) {
    const banner = await VitrineBanners.findByPk(id);
    if (!banner) throw new HttpError(404, "Banner não encontrado.");
    await banner.destroy();
    await Promise.all([apagarImagem(banner.imagem_url), apagarImagem(banner.imagem_mobile_url)]);
  }
}

// "Compre por categoria": categorias com produto ativo e uma foto para o bloco. Prefere a peça mais
// vendida, mas pula imagens pequenas demais (placeholders) quando a categoria tem foto melhor.
const FOTO_MINIMA_BYTES = 30 * 1024;

const tamanhoDaFoto = async (caminho: string) => {
  if (!caminho.startsWith("produto_fotos/")) return 0;
  return fs.stat(path.join(PASTA_FOTOS, path.basename(caminho))).then((s) => s.size).catch(() => 0);
};

export class VitrineCategorias extends Model {
  declare id_categoria: number;
  declare imagem_url: string;
}

VitrineCategorias.init(
  {
    id_categoria: { type: DataTypes.INTEGER, primaryKey: true },
    imagem_url: { type: DataTypes.STRING(255), allowNull: false },
  },
  { sequelize, tableName: "vitrine_categorias", timestamps: false },
);

// Troca (ou volta para automática, sem arquivo e com remover=true) a foto do bloco de uma categoria.
export async function definirFotoDaCategoria(idCategoria: number, arquivo: Arquivo | undefined, remover: boolean) {
  const [existe] = await sequelize.query("SELECT 1 FROM categorias WHERE id_categoria = :id", { replacements: { id: idCategoria } });
  if (!(existe as unknown[]).length) throw new HttpError(404, "Categoria não encontrada.");

  const atual = await VitrineCategorias.findByPk(idCategoria);
  if (remover) {
    if (atual) {
      await atual.destroy();
      await apagarImagem(atual.imagem_url);
    }
    return null;
  }
  if (!arquivo) throw new HttpError(400, "Envie a foto da categoria.");
  const caminho = (await salvarArquivo(arquivo)) as string;
  await VitrineCategorias.upsert({ id_categoria: idCategoria, imagem_url: caminho });
  if (atual) await apagarImagem(atual.imagem_url);
  return caminho;
}

export async function categoriasDaVitrine() {
  const escolhidas = new Map((await VitrineCategorias.findAll()).map((v) => [v.id_categoria, v.imagem_url]));
  const [linhas] = await sequelize.query(`
    SELECT c.id_categoria, c.nome, p.id_produto, f.caminho_url,
      COALESCE(v.quantidade_vendida, 0) AS vendidos
      FROM categorias c
      INNER JOIN produtos p ON p.id_categoria = c.id_categoria AND p.ativo = 1
      LEFT JOIN produto_fotos f ON f.id_produto = p.id_produto
      LEFT JOIN produto_vendas v ON v.id_produto = p.id_produto
     ORDER BY c.id_categoria, vendidos DESC, p.id_produto ASC, f.id_produto_foto ASC`);

  const porCategoria = new Map<number, { id_categoria: number; nome: string; produtos: Set<number>; fotos: string[] }>();
  for (const l of linhas as { id_categoria: number; nome: string; id_produto: number; caminho_url: string | null }[]) {
    const id = Number(l.id_categoria);
    const atual = porCategoria.get(id) ?? { id_categoria: id, nome: l.nome, produtos: new Set<number>(), fotos: [] };
    atual.produtos.add(Number(l.id_produto));
    if (l.caminho_url && !atual.fotos.includes(l.caminho_url)) atual.fotos.push(l.caminho_url);
    porCategoria.set(id, atual);
  }

  const resultado = [];
  for (const c of porCategoria.values()) {
    const escolhida = escolhidas.get(c.id_categoria);
    let imagem: string | null = escolhida ?? c.fotos[0] ?? null;
    for (const foto of escolhida ? [] : c.fotos.slice(0, 12)) {
      if ((await tamanhoDaFoto(foto)) >= FOTO_MINIMA_BYTES) {
        imagem = foto;
        break;
      }
    }
    resultado.push({ id_categoria: c.id_categoria, nome: c.nome, total: c.produtos.size, imagem_url: imagem, foto_escolhida: Boolean(escolhida) });
  }
  return resultado.sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));
}
