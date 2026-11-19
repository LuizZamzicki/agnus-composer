import {
  configuracaoDeRastreamento,
  generoDaPeca,
  montarFeed,
  montarPrevia,
  montarRobots,
  montarSitemap,
  type ProdutoPublico,
} from "../../src/services/seo.service";

jest.mock("../../src/models/Produtos", () => ({ __esModule: true, default: {} }));
jest.mock("../../src/models/Categorias", () => ({ __esModule: true, default: {} }));
jest.mock("../../src/models/ProdutoCores", () => ({ __esModule: true, default: {} }));
jest.mock("../../src/models/ProdutoGrades", () => ({ __esModule: true, default: {} }));
jest.mock("../../src/models/ProdutoFotos", () => ({ __esModule: true, default: {} }));

const produto = (extra: Partial<ProdutoPublico> = {}): ProdutoPublico => ({
  id_produto: 7,
  nome: "Camiseta DryFit Feminina",
  descricao: "Tecido leve <b>e</b> secagem rápida.",
  categoria: "Camisetas",
  preco_base: 89.9,
  preco_original: 119.9,
  data_alteracao: new Date("2026-11-10T12:00:00Z"),
  cores: [
    { id_produto_cor: 3, nome: "Preta", acrescimo: 0 },
    { id_produto_cor: 4, nome: "Branca", acrescimo: "5.00" },
  ],
  grades: [
    { id_produto_grade: 10, nome: "P", acrescimo: 0 },
    { id_produto_grade: 11, nome: "GG", acrescimo: "10.00" },
  ],
  fotos: [
    { id_produto_cor: 3, caminho_url: "produto_fotos/preta.jpg" },
    { id_produto_cor: 4, caminho_url: "produto_fotos/branca.jpg" },
  ],
  ...extra,
});

beforeEach(() => {
  process.env.FRONTEND_URL = "https://agnusfit.com/";
});

describe("catálogo para Google e Meta", () => {
  it("um item por cor e tamanho, com preço de promoção, foto da cor, frete grátis e o grupo do produto", () => {
    const xml = montarFeed([produto()]);

    expect(xml.match(/<item>/g)).toHaveLength(4);
    expect(xml).toContain("<g:id>7-3-10</g:id>");
    expect(xml).toContain("<g:item_group_id>7</g:item_group_id>");
    expect(xml).toContain("<g:title>Camiseta DryFit Feminina Preta P</g:title>");
    expect(xml).toContain("<g:price>119.90 BRL</g:price><g:sale_price>89.90 BRL</g:sale_price>");
    // Branca (+5) no GG (+10)
    expect(xml).toContain("<g:price>134.90 BRL</g:price><g:sale_price>104.90 BRL</g:sale_price>");
    expect(xml).toContain("<g:image_link>https://agnusfit.com/api/produto_fotos/branca.jpg</g:image_link>");
    expect(xml).toContain("<g:link>https://agnusfit.com/produto/7</g:link>");
    expect(xml).toContain("<g:description>Tecido leve e secagem rápida.</g:description>");
    expect(xml).toContain("<g:gender>female</g:gender>");
    expect(xml).toContain("<g:shipping><g:country>BR</g:country><g:price>0.00 BRL</g:price></g:shipping>");
  });

  it("sem promoção, só o preço; peça sem foto fica de fora", () => {
    expect(montarFeed([produto({ preco_original: null })])).not.toContain("sale_price");
    expect(montarFeed([produto({ fotos: [] })])).not.toContain("<item>");
  });

  it("escapa o texto do cadastro", () => {
    expect(montarFeed([produto({ nome: "Regata & <Fé>" })])).toContain("Regata &amp; &lt;Fé&gt;");
  });

  it("gênero pelo nome ou pela categoria", () => {
    expect(generoDaPeca("Regata Masculina")).toBe("male");
    expect(generoDaPeca("Camiseta", "Feminino")).toBe("female");
    expect(generoDaPeca("Camiseta Básica")).toBe("unisex");
  });
});

describe("sitemap e robots", () => {
  it("sitemap com as páginas da loja e cada peça com data e fotos", () => {
    const xml = montarSitemap([produto()]);
    expect(xml).toContain("<loc>https://agnusfit.com/</loc>");
    expect(xml).toContain("<loc>https://agnusfit.com/catalogo</loc>");
    expect(xml).toContain("<loc>https://agnusfit.com/produto/7</loc><lastmod>2026-11-10</lastmod>");
    expect(xml).toContain("<image:loc>https://agnusfit.com/api/produto_fotos/preta.jpg</image:loc>");
  });

  it("robots esconde a área do cliente e aponta o sitemap, sem bloquear a API", () => {
    const robots = montarRobots();
    expect(robots).toContain("Disallow: /cliente");
    expect(robots).toContain("Sitemap: https://agnusfit.com/sitemap.xml");
    expect(robots).not.toContain("/api");
  });
});

describe("prévia de link", () => {
  it("peça: título, descrição, foto, preço e dados estruturados", () => {
    const html = montarPrevia("/produto/7?utm_source=whatsapp", [produto()]);
    expect(html).toContain('<meta property="og:title" content="Camiseta DryFit Feminina · Agnus">');
    expect(html).toContain('<meta property="og:image" content="https://agnusfit.com/api/produto_fotos/preta.jpg">');
    expect(html).toContain('<meta property="og:url" content="https://agnusfit.com/produto/7">');
    expect(html).toContain('<meta property="product:price:amount" content="89.90">');
    expect(html).toContain('"@type":"Product"');
  });

  it("outras páginas e caminhos estranhos usam os dados da loja", () => {
    expect(montarPrevia("/catalogo", [])).toContain("Coleção · Agnus");
    const estranho = montarPrevia('/"><script>alert(1)</script>', []);
    expect(estranho).not.toContain("<script>alert");
    expect(estranho).toContain('content="https://agnusfit.com/"');
  });
});

describe("IDs de rastreamento", () => {
  it("só devolve IDs no formato de cada serviço", () => {
    expect(configuracaoDeRastreamento({ META_PIXEL_ID: "123456789012345", GA4_ID: "G-ABC123XYZ", TIKTOK_PIXEL_ID: "CABCDEFGHIJ123456789" })).toEqual({
      meta_pixel: "123456789012345",
      ga4: "G-ABC123XYZ",
      tiktok_pixel: "CABCDEFGHIJ123456789",
    });
    expect(configuracaoDeRastreamento({ META_PIXEL_ID: "x'); alert(1)//", GA4_ID: "", TIKTOK_PIXEL_ID: undefined })).toEqual({
      meta_pixel: null,
      ga4: null,
      tiktok_pixel: null,
    });
  });
});
