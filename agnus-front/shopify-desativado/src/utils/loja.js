import { apiUrl, authHeaders } from "./api";
import {
    CHAVE_DONO_SACOLA,
    CHAVE_SACOLA,
    avisarSacola,
    esquecerSacola,
    usuarioDaSessao,
} from "./sacola";

// Vitrine, sacola e checkout do Shopify (Storefront API), pelo serviço "loja" do gateway.

export class ErroLoja extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

async function pedir(caminho, { metodo = "GET", corpo, autenticar = false } = {}) {
    const headers = corpo === undefined ? {} : { "Content-Type": "application/json" };
    let res;

    try {
        res = await fetch(apiUrl(`loja/${caminho}`), {
            method: metodo,
            // Token vencido não vai junto: nas rotas abertas ele faria o pedido falhar à toa.
            headers: autenticar && usuarioDaSessao() ? authHeaders(headers) : headers,
            body: corpo === undefined ? undefined : JSON.stringify(corpo),
        });
    } catch {
        throw new ErroLoja(0, "Sem conexão com a loja. Tente de novo.");
    }

    const dados = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new ErroLoja(res.status, dados.message || "Não foi possível falar com a loja.");
    }

    return dados;
}

const consulta = (params) => {
    const busca = new URLSearchParams();

    Object.entries(params).forEach(([chave, valor]) => {
        if (valor !== undefined && valor !== null && valor !== "") busca.set(chave, valor);
    });

    const texto = busca.toString();
    return texto ? `?${texto}` : "";
};

// ---------- Vitrine ----------

export function listarProdutos({ busca, colecao, ordem, depois, antes, limite } = {}) {
    return pedir(`produtos${consulta({ busca, colecao, ordem, depois, antes, limite })}`);
}

export function buscarProduto(handle) {
    return pedir(`produtos/${encodeURIComponent(handle)}`);
}

export function listarRelacionados(handle) {
    return pedir(`produtos/${encodeURIComponent(handle)}/relacionados`);
}

export function listarColecoes() {
    return pedir("colecoes");
}

// Variante que corresponde às opções escolhidas (ex.: { Tamanho: "M", Cor: "Preto" }).
export function varianteEscolhida(produto, escolhas) {
    if (!produto) return null;

    return produto.variantes.find((variante) =>
        produto.opcoes.every((opcao) => variante.opcoes[opcao.nome] === escolhas[opcao.nome])
    ) || null;
}

// ---------- Sacola ----------

const lerId = () => localStorage.getItem(CHAVE_SACOLA);

function guardar(sacola, idUsuario = usuarioDaSessao()) {
    localStorage.setItem(CHAVE_SACOLA, sacola.id);

    if (idUsuario) {
        localStorage.setItem(CHAVE_DONO_SACOLA, String(idUsuario));
    }

    return sacola;
}

let vinculoEmAndamento = null;

// Na primeira leitura depois de entrar na conta: leva a sacola de visitante para a conta ou
// recupera a que a conta já tinha. Cabeçalho e sacola chamam ao mesmo tempo; o vínculo é um só.
function vincularAoEntrar(idUsuario) {
    vinculoEmAndamento ??= (async () => {
        const id = lerId();

        try {
            if (id) {
                try {
                    return guardar(await pedir(`sacolas/${id}/vincular`, { metodo: "POST", autenticar: true }), idUsuario);
                } catch (erro) {
                    if (erro.status === 401) throw erro;
                    // Sacola de visitante que expirou ou já foi paga: vale a da conta, se houver.
                    localStorage.removeItem(CHAVE_SACOLA);
                }
            }

            try {
                return guardar(await pedir("sacolas/minha", { autenticar: true }), idUsuario);
            } catch (erro) {
                if (erro.status !== 404) throw erro;
                localStorage.setItem(CHAVE_DONO_SACOLA, String(idUsuario));
                return null;
            }
        } catch (erro) {
            // A sacola não decide se a sessão acabou (o contador do cabeçalho passa por aqui em toda
            // página): sem autorização, segue como visitante e tenta ligar de novo na próxima leitura.
            if (erro.status === 401) {
                return lerComoVisitante();
            }

            throw erro;
        } finally {
            vinculoEmAndamento = null;
        }
    })();

    return vinculoEmAndamento;
}

export async function obterSacola() {
    const idUsuario = usuarioDaSessao();

    // Sacola ligada a outra conta (ou à que saiu) não é deste cliente.
    const dono = localStorage.getItem(CHAVE_DONO_SACOLA);

    if (dono && Number(dono) !== idUsuario) {
        esquecerSacola();
    }

    if (idUsuario && Number(localStorage.getItem(CHAVE_DONO_SACOLA)) !== idUsuario) {
        return vincularAoEntrar(idUsuario);
    }

    return lerComoVisitante();
}

// Lê a sacola guardada neste navegador, sem tocar no vínculo com a conta.
async function lerComoVisitante() {
    const id = lerId();

    if (!id) return null;

    try {
        const sacola = await pedir(`sacolas/${id}`);
        localStorage.setItem(CHAVE_SACOLA, sacola.id);
        return sacola;
    } catch (erro) {
        // Paga no checkout ou expirada no Shopify: a próxima peça abre outra sacola.
        if (erro.status === 404 || erro.status === 400) {
            localStorage.removeItem(CHAVE_SACOLA);
            return null;
        }

        throw erro;
    }
}

// Peça escolhida por quem ainda não entrou: guardada só nesta aba até o login terminar.
const CHAVE_PECA_PENDENTE = "agnus_peca_pendente";

export function guardarPecaPendente(peca) {
    try {
        sessionStorage.setItem(CHAVE_PECA_PENDENTE, JSON.stringify(peca));
    } catch {
        // Sem sessionStorage o cliente só escolhe a peça de novo depois de entrar.
    }
}

// Devolve (e apaga) a peça pendente desta página, para ela entrar na sacola uma vez só.
export function retomarPecaPendente(handle) {
    try {
        const peca = JSON.parse(sessionStorage.getItem(CHAVE_PECA_PENDENTE) || "null");

        if (!peca || peca.handle !== handle) return null;

        sessionStorage.removeItem(CHAVE_PECA_PENDENTE);
        return peca;
    } catch {
        return null;
    }
}

export async function adicionarNaSacola(varianteId, quantidade = 1) {
    // A sacola é da conta: quem não entrou é levado ao login antes de escolher.
    if (!usuarioDaSessao()) {
        throw new ErroLoja(401, "Entre na sua conta para colocar a peça na sacola.");
    }

    const linhas = [{ variante: varianteId, quantidade }];
    const atual = await obterSacola();
    let sacola;

    try {
        sacola = atual
            ? await pedir(`sacolas/${atual.id}/linhas`, { metodo: "POST", corpo: { linhas }, autenticar: true })
            : await pedir("sacolas", { metodo: "POST", corpo: { linhas }, autenticar: true });
    } catch (erro) {
        if (!atual || erro.status !== 404) throw erro;
        // A sacola expirou entre a leitura e a escrita.
        localStorage.removeItem(CHAVE_SACOLA);
        sacola = await pedir("sacolas", { metodo: "POST", corpo: { linhas }, autenticar: true });
    }

    guardar(sacola);
    avisarSacola();
    return sacola;
}

export async function alterarQuantidade(linhaId, quantidade) {
    const sacola = await pedir(`sacolas/${lerId()}/linhas/${linhaId}`, { metodo: "PATCH", corpo: { quantidade }, autenticar: true });
    avisarSacola();
    return sacola;
}

export async function removerDaSacola(linhaId) {
    const sacola = await pedir(`sacolas/${lerId()}/linhas/${linhaId}`, { metodo: "DELETE", autenticar: true });
    avisarSacola();
    return sacola;
}

// O pagamento acontece no checkout do Shopify e exige conta: o cliente chega com o e-mail preenchido.
export async function enderecoDoCheckout() {
    const id = lerId();

    if (!usuarioDaSessao()) {
        throw new ErroLoja(401, "Entre na sua conta para finalizar.");
    }

    if (!id) {
        throw new ErroLoja(409, "A sacola está vazia.");
    }

    const { checkoutUrl } = await pedir(`sacolas/${id}/checkout`, { metodo: "POST", autenticar: true });
    return checkoutUrl;
}

// ---------- Pedidos ----------

// Compras feitas no checkout do Shopify por esta conta ("Meus pedidos").
export function listarMeusPedidos() {
    return pedir("pedidos", { autenticar: true });
}

// Só alimenta o contador do cabeçalho: falha aqui não pode atrapalhar a navegação.
export async function contarPecas() {
    try {
        return (await obterSacola())?.quantidade || 0;
    } catch {
        return 0;
    }
}
