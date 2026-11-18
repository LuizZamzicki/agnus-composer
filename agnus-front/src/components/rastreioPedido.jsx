import { ExternalLink } from "lucide-react";

const BASE_YOUDRAW = "https://app.youdraw.com.br/rastrear/";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Só embute a página de rastreio da loja na YouDraw (/rastrear/<token>?pedido=<busca>); qualquer
// outra URL é ignorada.
export function urlRastreioSegura(url) {
    if (typeof url !== "string" || !url.startsWith(BASE_YOUDRAW)) return null;

    try {
        const { origin, pathname } = new URL(url);
        const token = pathname.slice("/rastrear/".length);
        return origin === "https://app.youdraw.com.br" && UUID.test(token) ? url : null;
    } catch {
        return null;
    }
}

// Acompanhamento da entrega: a página pública de rastreio da YouDraw (quem produz e envia as peças),
// embutida no site e já pesquisada pelo pedido (ou pelo e-mail do cliente). Se a busca automática
// não achar, o cliente pode pesquisar ali mesmo pelo CPF ou número do pedido.
export default function RastreioPedido({ idPedido, url }) {
    const segura = urlRastreioSegura(url);
    if (!segura) return null;

    return (
        <section className="pedido-rastreio" data-cy="pedido-rastreio" aria-label={`Rastreio do pedido ${idPedido}`}>
            <div className="pedido-rastreio-topo">
                <strong>Acompanhamento da entrega</strong>
                <a href={segura} target="_blank" rel="noopener noreferrer" data-cy="rastreio-nova-aba">
                    Abrir em outra aba <ExternalLink size={14} strokeWidth={1.5} aria-hidden="true" />
                </a>
            </div>
            <iframe
                src={segura}
                title={`Rastrear pedido ${idPedido}`}
                className="pedido-rastreio-frame"
                loading="lazy"
                referrerPolicy="no-referrer"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            />
        </section>
    );
}
