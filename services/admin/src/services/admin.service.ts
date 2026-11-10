import type { NomeServico } from "@agnus/comum/utils/clienteInterno";
import logger from "@agnus/comum/utils/logger";

export const SERVICOS_COM_METRICAS: (NomeServico | "admin")[] = [
  "identidade", "catalogo", "busca", "avaliacoes", "carrinho", "pedidos", "notificacoes",
];

const TIMEOUT_MS = 5000;

const urlDo = (servico: string) => process.env[`SERVICO_${servico.toUpperCase()}_URL`] ?? `http://${servico}:3000`;

const consultar = async (servico: string, caminho: string, autorizacao: string) => {
  try {
    const resposta = await fetch(`${urlDo(servico)}${caminho}`, {
      headers: { authorization: autorizacao },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!resposta.ok) {
      throw new Error(`status ${resposta.status}`);
    }

    return await resposta.json();
  } catch (error) {
    logger.warn("admin.fonte_indisponivel", { servico, caminho, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
};

const lista = (resposta: unknown): Record<string, unknown>[] => {
  if (Array.isArray(resposta)) {
    return resposta;
  }

  const dados = (resposta as { data?: unknown } | null)?.data;
  return Array.isArray(dados) ? dados : [];
};

const totalDe = (resposta: unknown) => {
  const total = (resposta as { pagination?: { total?: number } } | null)?.pagination?.total;
  return total ?? lista(resposta).length;
};

class AdminService {
  // BFF: uma chamada do painel vira várias aos serviços, com o token de quem está logado.
  // Uma fonte fora do ar não derruba o painel: ela aparece em "indisponiveis".
  static async dashboard(autorizacao: string) {
    const [usuarios, produtos, categorias, pedidos] = await Promise.all([
      consultar("identidade", "/users?page=1&limit=10", autorizacao),
      consultar("catalogo", "/products?page=1&limit=10", autorizacao),
      consultar("catalogo", "/categories?page=1&limit=10", autorizacao),
      consultar("pedidos", "/orders", autorizacao),
    ]);
    const fontes = { usuarios, produtos, categorias, pedidos };
    const listaPedidos = lista(pedidos);

    return {
      totais: {
        usuarios: totalDe(usuarios),
        produtos: totalDe(produtos),
        categorias: totalDe(categorias),
        pedidos: listaPedidos.length,
      },
      usuarios: lista(usuarios),
      produtos: lista(produtos),
      categorias: lista(categorias),
      pedidos: listaPedidos,
      indisponiveis: Object.entries(fontes).filter(([, valor]) => valor === null).map(([nome]) => nome),
    };
  }

  static async metricas(autorizacao: string) {
    const coletas = await Promise.all(
      SERVICOS_COM_METRICAS.map(async (servico) => [servico, await consultar(servico, "/metrics", autorizacao)] as const),
    );

    return { servicos: Object.fromEntries(coletas) };
  }
}

export default AdminService;
