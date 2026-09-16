import "dotenv/config";
import Categorias from "../src/models/Categorias";
import sequelize from "../src/config/database";
import ProdutoMutationService from "../src/services/produtoMutation.service";

const QUANTIDADE = Number(process.argv[2] || 20);

const NOMES = [
  "Camiseta Basica",
  "Camiseta Estampada",
  "Moletom Canguru",
  "Jaqueta Jeans",
  "Calca Cargo",
  "Bermuda Sarja",
  "Vestido Longo",
  "Saia Midi",
  "Blusa de Frio",
  "Regata Esportiva",
  "Boné Aba Curva",
  "Meia Cano Alto",
  "Tenis Casual",
  "Bolsa Transversal",
  "Cinto de Couro",
];

const CORES = [
  { nome: "Preto", codigo_rgb: "#000000" },
  { nome: "Branco", codigo_rgb: "#FFFFFF" },
  { nome: "Azul", codigo_rgb: "#1E3A8A" },
  { nome: "Vermelho", codigo_rgb: "#B91C1C" },
];

const GRADES = [
  { nome: "P", acrescimo: 0 },
  { nome: "M", acrescimo: 0 },
  { nome: "G", acrescimo: 5 },
  { nome: "GG", acrescimo: 10 },
];

function pick<T>(arr: T[], index: number): T {
  return arr[index % arr.length];
}

async function ensureCategoria(): Promise<number> {
  const [categoria] = await Categorias.findOrCreate({
    where: { nome: "Seed Dev" },
    defaults: { nome: "Seed Dev" },
  });

  return categoria.id_categoria;
}

async function seedProdutos() {
  await sequelize.authenticate();
  const idCategoria = await ensureCategoria();

  let criados = 0;
  let falhas = 0;

  for (let i = 0; i < QUANTIDADE; i += 1) {
    const nomeBase = pick(NOMES, i);
    const cor = pick(CORES, i);
    const precoBase = 49.9 + (i % 10) * 10;

    const resultado = await ProdutoMutationService.create({
      id_categoria: idCategoria,
      nome: `${nomeBase} ${i + 1}`,
      descricao: `Produto de teste gerado automaticamente (#${i + 1}).`,
      preco_base: precoBase,
      preco_custo: precoBase * 0.6,
      ativo: true,
      grades: GRADES,
      cores: [
        {
          nome: cor.nome,
          codigo_rgb: cor.codigo_rgb,
          acrescimo: 0,
          fotos: [`https://picsum.photos/seed/produto-${i + 1}/600/600`],
        },
      ],
    });

    if ("message" in resultado) {
      falhas += 1;
      console.error(`Falha ao criar produto #${i + 1}: ${resultado.message}`);
    } else {
      criados += 1;
      console.log(`Produto criado: ${resultado.data.produto.nome} (id ${resultado.data.produto.id_produto})`);
    }
  }

  console.log(`\nConcluido: ${criados} produtos criados, ${falhas} falhas.`);
  await sequelize.close();
}

seedProdutos().catch((error) => {
  console.error("Erro ao rodar o seed de produtos:", error);
  process.exit(1);
});
