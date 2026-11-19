import Categorias from "../models/Categorias";
import ProdutoCores from "../models/ProdutoCores";
import ProdutoFotos from "../models/ProdutoFotos";
import ProdutoGrades from "../models/ProdutoGrades";
import Produtos from "../models/Produtos";

// Tudo o que a loja mostra para fora do site: o catálogo de produtos do Google Merchant Center e
// da Meta (Instagram e Facebook), o sitemap e o robots.txt para o Google, e a prévia de link que o
// WhatsApp, o Instagram e o Facebook leem (eles não rodam o JavaScript do site).

const MARCA = "Agnus";
const DESCRICAO_DA_LOJA = "Roupas de treino com identidade católica, feitas sob encomenda. Pix com desconto e 2x sem juros.";
const CACHE_MS = 10 * 60 * 1000;

export const urlDoSite = () => (process.env.FRONTEND_URL || "https://localhost").replace(/\/+$/, "");

const ENTIDADES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapar = (valor: unknown) => String(valor ?? "").replace(/[&<>"']/g, (c) => ENTIDADES[c]);

const dinheiro = (valor: unknown) => Math.round((Number(valor ?? 0) || 0) * 100) / 100;
const preco = (valor: number) => `${valor.toFixed(2)} BRL`;
const umaLinha = (valor: unknown, limite: number) => String(valor ?? "").replace(/\s+/g, " ").trim().slice(0, limite);
// A descrição pode ter marcação colada do editor; o nome não (um "<" no nome é texto).
const textoLimpo = (valor: unknown, limite: number) => umaLinha(String(valor ?? "").replace(/<[^>]*>/g, " "), limite);

const fotoAbsoluta = (caminho: string | null | undefined) =>
  caminho && /^produto_fotos\/[\w.-]+$/.test(caminho) ? `${urlDoSite()}/api/${caminho}` : null;

export const linkDoProduto = (idProduto: number) => `${urlDoSite()}/produto/${idProduto}`;

// Google pede o gênero da peça; o nome ou a categoria costuma dizer ("Feminina", "Masculino").
export const generoDaPeca = (...textos: (string | null | undefined)[]) => {
  const junto = textos.filter(Boolean).join(" ").toLowerCase();
  const feminino = /feminin/.test(junto);
  const masculino = /masculin/.test(junto);
  return feminino && !masculino ? "female" : masculino && !feminino ? "male" : "unisex";
};

type Cor = { id_produto_cor: number; nome: string; acrescimo: unknown };
type Grade = { id_produto_grade: number; nome: string; acrescimo: unknown };

export type ProdutoPublico = {
  id_produto: number;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  preco_base: number;
  preco_original: number | null;
  data_alteracao: Date | null;
  cores: Cor[];
  grades: Grade[];
  // Fotos por cor (0 = foto sem cor), na ordem de cadastro.
  fotos: { id_produto_cor: number | null; caminho_url: string }[];
};

let cache: { em: number; produtos: ProdutoPublico[] } | null = null;

export const limparCacheSeo = () => {
  cache = null;
};

export const produtosPublicos = async (): Promise<ProdutoPublico[]> => {
  if (cache && Date.now() - cache.em < CACHE_MS) return cache.produtos;

  const produtos = await Produtos.findAll({ where: { ativo: true }, order: [["id_produto", "ASC"]] });
  const ids = produtos.map((p) => p.id_produto);
  const [categorias, cores, grades, fotos] = ids.length
    ? await Promise.all([
        Categorias.findAll(),
        ProdutoCores.findAll({ where: { id_produto: ids }, order: [["id_produto_cor", "ASC"]] }),
        ProdutoGrades.findAll({ where: { id_produto: ids }, order: [["id_produto_grade", "ASC"]] }),
        ProdutoFotos.findAll({ where: { id_produto: ids }, order: [["id_produto_foto", "ASC"]] }),
      ])
    : [[], [], [], []];
  const nomeDaCategoria = new Map(categorias.map((c) => [c.id_categoria, c.nome]));

  const lista = produtos.map((p) => ({
    id_produto: p.id_produto,
    nome: p.nome,
    descricao: p.descricao,
    categoria: p.id_categoria ? nomeDaCategoria.get(p.id_categoria) ?? null : null,
    preco_base: dinheiro(p.preco_base),
    preco_original: p.preco_original == null ? null : dinheiro(p.preco_original),
    data_alteracao: p.data_alteracao ?? null,
    cores: cores.filter((c) => c.id_produto === p.id_produto),
    grades: grades.filter((g) => g.id_produto === p.id_produto),
    fotos: fotos
      .filter((f) => f.id_produto === p.id_produto)
      .map((f) => ({ id_produto_cor: f.id_produto_cor ?? null, caminho_url: f.caminho_url })),
  }));

  cache = { em: Date.now(), produtos: lista };
  return lista;
};

const fotosDaCor = (produto: ProdutoPublico, idCor: number | null) => {
  const daCor = produto.fotos.filter((f) => idCor != null && f.id_produto_cor === idCor);
  return (daCor.length ? daCor : produto.fotos).map((f) => fotoAbsoluta(f.caminho_url)).filter((u): u is string => Boolean(u));
};

// Preço cobrado e preço "De" (promoção) de uma cor + tamanho.
const precosDaVariacao = (produto: ProdutoPublico, cor?: Cor, grade?: Grade) => {
  const acrescimo = dinheiro(cor?.acrescimo) + dinheiro(grade?.acrescimo);
  const por = dinheiro(produto.preco_base + acrescimo);
  const de = produto.preco_original != null && produto.preco_original > produto.preco_base ? dinheiro(produto.preco_original + acrescimo) : null;
  return { por, de };
};

// ---- Catálogo para Google Merchant Center e Meta (RSS 2.0 com o namespace g:) ----
// Um item por cor + tamanho, agrupados pelo produto (item_group_id). O id do item é o mesmo que o
// Pixel da Meta recebe nos eventos de sacola e compra, para os anúncios mostrarem a peça certa.
export const idDaVariacao = (idProduto: number, idCor: number, idGrade: number) => `${idProduto}-${idCor}-${idGrade}`;

export const montarFeed = (produtos: ProdutoPublico[]) => {
  const site = urlDoSite();
  const itens: string[] = [];

  for (const produto of produtos) {
    const genero = generoDaPeca(produto.nome, produto.categoria);
    const descricao = textoLimpo(produto.descricao, 4900) || produto.nome;

    for (const cor of produto.cores) {
      const fotos = fotosDaCor(produto, cor.id_produto_cor);
      // Sem foto o Google recusa o item.
      if (!fotos.length) continue;

      for (const grade of produto.grades) {
        const { por, de } = precosDaVariacao(produto, cor, grade);
        if (!(por > 0)) continue;

        itens.push(
          [
            "<item>",
            `<g:id>${idDaVariacao(produto.id_produto, cor.id_produto_cor, grade.id_produto_grade)}</g:id>`,
            `<g:item_group_id>${produto.id_produto}</g:item_group_id>`,
            `<g:title>${escapar(umaLinha(`${produto.nome} ${cor.nome} ${grade.nome}`, 150))}</g:title>`,
            `<g:description>${escapar(descricao)}</g:description>`,
            `<g:link>${escapar(linkDoProduto(produto.id_produto))}</g:link>`,
            `<g:image_link>${escapar(fotos[0])}</g:image_link>`,
            ...fotos.slice(1, 10).map((foto) => `<g:additional_image_link>${escapar(foto)}</g:additional_image_link>`),
            // Feita sob encomenda: toda cor e tamanho cadastrados podem ser pedidos.
            "<g:availability>in_stock</g:availability>",
            de ? `<g:price>${preco(de)}</g:price><g:sale_price>${preco(por)}</g:sale_price>` : `<g:price>${preco(por)}</g:price>`,
            `<g:brand>${MARCA}</g:brand>`,
            "<g:condition>new</g:condition>",
            "<g:identifier_exists>no</g:identifier_exists>",
            "<g:google_product_category>1604</g:google_product_category>",
            produto.categoria ? `<g:product_type>${escapar(produto.categoria)}</g:product_type>` : "",
            `<g:color>${escapar(cor.nome)}</g:color>`,
            `<g:size>${escapar(grade.nome)}</g:size>`,
            `<g:gender>${genero}</g:gender>`,
            "<g:age_group>adult</g:age_group>",
            // A loja não cobra frete.
            "<g:shipping><g:country>BR</g:country><g:price>0.00 BRL</g:price></g:shipping>",
            "</item>",
          ]
            .filter(Boolean)
            .join(""),
        );
      }
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>${MARCA}</title>
<link>${escapar(site)}</link>
<description>${escapar(DESCRICAO_DA_LOJA)}</description>
${itens.join("\n")}
</channel>
</rss>
`;
};

// ---- Sitemap e robots.txt ----
export const PAGINAS_FIXAS: { caminho: string; titulo: string; descricao: string }[] = [
  { caminho: "/", titulo: `${MARCA} · Roupas de treino com identidade católica`, descricao: DESCRICAO_DA_LOJA },
  { caminho: "/catalogo", titulo: `Coleção · ${MARCA}`, descricao: "Camisetas, regatas e peças de treino com identidade católica, feitas sob encomenda." },
  { caminho: "/duvidas", titulo: `Dúvidas · ${MARCA}`, descricao: "Prazos, tamanhos, pagamento, entrega, trocas e devoluções." },
  { caminho: "/sobre", titulo: `Sobre · ${MARCA}`, descricao: DESCRICAO_DA_LOJA },
  { caminho: "/entrega", titulo: `Entrega · ${MARCA}`, descricao: "Como funciona a produção e a entrega das peças." },
  { caminho: "/trocas-e-devolucoes", titulo: `Trocas e devoluções · ${MARCA}`, descricao: "Prazos e como devolver uma peça pelo site." },
  { caminho: "/privacidade", titulo: `Privacidade · ${MARCA}`, descricao: "Como a Agnus trata os seus dados." },
  { caminho: "/afiliados/termos", titulo: `Afiliados · ${MARCA}`, descricao: "Termos do programa de afiliados da Agnus." },
];

const dataW3c = (data: Date | null) => (data && !Number.isNaN(new Date(data).getTime()) ? new Date(data).toISOString().slice(0, 10) : null);

export const montarSitemap = (produtos: ProdutoPublico[]) => {
  const site = urlDoSite();
  const fixas = PAGINAS_FIXAS.map((p) => `<url><loc>${escapar(`${site}${p.caminho === "/" ? "/" : p.caminho}`)}</loc></url>`);
  const pecas = produtos.map((produto) => {
    const lastmod = dataW3c(produto.data_alteracao);
    const fotos = fotosDaCor(produto, null).slice(0, 5);
    return [
      "<url>",
      `<loc>${escapar(linkDoProduto(produto.id_produto))}</loc>`,
      lastmod ? `<lastmod>${lastmod}</lastmod>` : "",
      ...fotos.map((foto) => `<image:image><image:loc>${escapar(foto)}</image:loc></image:image>`),
      "</url>",
    ].join("");
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${[...fixas, ...pecas].join("\n")}
</urlset>
`;
};

// A API fica liberada: o Google lê o site rodando o JavaScript, que busca os produtos nela.
export const montarRobots = () => `User-agent: *
Disallow: /cliente
Disallow: /carrinho
Disallow: /finalizar
Disallow: /pagamento/
Disallow: /pedido-confirmado/
Disallow: /login
Disallow: /admin
Disallow: /ofertas/cancelar
Disallow: /sacola/

Sitemap: ${urlDoSite()}/sitemap.xml
`;

// ---- Prévia de link (Open Graph) para WhatsApp, Instagram, Facebook e afins ----
const caminhoSeguro = (valor: unknown) => {
  const caminho = String(valor ?? "/").split(/[?#]/)[0];
  return /^\/[\w\-/.~%]*$/.test(caminho) && caminho.length <= 300 ? caminho : "/";
};

export const dadosEstruturados = (produto: ProdutoPublico) => {
  const { por } = precosDaVariacao(produto);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: produto.nome,
    description: textoLimpo(produto.descricao, 500) || produto.nome,
    image: fotosDaCor(produto, null).slice(0, 5),
    sku: String(produto.id_produto),
    brand: { "@type": "Brand", name: MARCA },
    offers: {
      "@type": "Offer",
      url: linkDoProduto(produto.id_produto),
      priceCurrency: "BRL",
      price: por.toFixed(2),
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };
};

export const montarPrevia = (caminhoInformado: unknown, produtos: ProdutoPublico[]) => {
  const site = urlDoSite();
  const caminho = caminhoSeguro(caminhoInformado);
  const idProduto = Number(caminho.match(/^\/produto\/(\d+)\/?$/)?.[1]);
  const produto = Number.isInteger(idProduto) ? produtos.find((p) => p.id_produto === idProduto) : undefined;
  const fixa = PAGINAS_FIXAS.find((p) => p.caminho === caminho.replace(/\/+$/, "") || (p.caminho === "/" && caminho === "/"));

  const titulo = produto ? `${produto.nome} · ${MARCA}` : fixa?.titulo ?? `${MARCA} · Roupas de treino com identidade católica`;
  const descricao = produto ? textoLimpo(produto.descricao, 200) || DESCRICAO_DA_LOJA : fixa?.descricao ?? DESCRICAO_DA_LOJA;
  const imagem = (produto && fotosDaCor(produto, null)[0]) || `${site}/logo512.png`;
  const url = produto ? linkDoProduto(produto.id_produto) : `${site}${caminho}`;
  const precos = produto ? precosDaVariacao(produto) : null;

  const metas = [
    ["og:site_name", MARCA],
    ["og:locale", "pt_BR"],
    ["og:type", produto ? "product" : "website"],
    ["og:title", titulo],
    ["og:description", descricao],
    ["og:url", url],
    ["og:image", imagem],
    ...(precos ? [["product:price:amount", precos.por.toFixed(2)], ["product:price:currency", "BRL"]] : []),
  ]
    .map(([propriedade, conteudo]) => `<meta property="${propriedade}" content="${escapar(conteudo)}">`)
    .join("\n");

  return `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8">
<title>${escapar(titulo)}</title>
<meta name="description" content="${escapar(descricao)}">
<link rel="canonical" href="${escapar(url)}">
${metas}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapar(titulo)}">
<meta name="twitter:description" content="${escapar(descricao)}">
<meta name="twitter:image" content="${escapar(imagem)}">
${produto ? `<script type="application/ld+json">${JSON.stringify(dadosEstruturados(produto)).replace(/</g, "\\u003c")}</script>` : ""}
</head><body>
<h1>${escapar(titulo)}</h1>
<p>${escapar(descricao)}</p>
<p><a href="${escapar(url)}">${escapar(url)}</a></p>
</body></html>
`;
};

// ---- IDs do Pixel da Meta, do Google Analytics 4 e do Pixel do TikTok (services/.env) ----
const idValido = (valor: string | undefined, formato: RegExp) => {
  const id = (valor ?? "").trim();
  return formato.test(id) ? id : null;
};

export const configuracaoDeRastreamento = (env: NodeJS.ProcessEnv = process.env) => ({
  meta_pixel: idValido(env.META_PIXEL_ID, /^\d{6,20}$/),
  ga4: idValido(env.GA4_ID, /^G-[A-Z0-9]{4,16}$/),
  tiktok_pixel: idValido(env.TIKTOK_PIXEL_ID, /^[A-Z0-9]{10,30}$/),
});
