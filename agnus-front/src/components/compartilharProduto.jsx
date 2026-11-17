import { useState } from "react";
import { Check, Link2, MessageCircle, Share2 } from "lucide-react";

// Compartilhar a peça: WhatsApp, copiar link e, no celular, o menu de compartilhar do aparelho.
export default function CompartilharProduto({ nome }) {
    const [copiado, setCopiado] = useState(false);
    const url = typeof window === "undefined" ? "" : window.location.href.split("#")[0];
    const texto = `Olha essa peça da Agnus: ${nome}`;
    const podeCompartilhar = typeof navigator !== "undefined" && typeof navigator.share === "function";

    async function copiar() {
        try {
            await navigator.clipboard.writeText(url);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
        } catch {
            window.prompt("Copie o link:", url);
        }
    }

    return (
        <div className="compartilhar" data-cy="compartilhar">
            <span>Compartilhar</span>
            <a
                href={`https://wa.me/?text=${encodeURIComponent(`${texto} ${url}`)}`}
                target="_blank"
                rel="noreferrer"
                aria-label="Compartilhar no WhatsApp"
                data-cy="compartilhar-whatsapp"
            >
                <MessageCircle size={18} strokeWidth={1.5} aria-hidden="true" />
            </a>
            <button type="button" onClick={copiar} aria-label={copiado ? "Link copiado" : "Copiar link"} data-cy="copiar-link">
                {copiado ? <Check size={18} strokeWidth={1.5} aria-hidden="true" /> : <Link2 size={18} strokeWidth={1.5} aria-hidden="true" />}
            </button>
            {podeCompartilhar && (
                <button type="button" aria-label="Mais opções de compartilhar" onClick={() => navigator.share({ title: nome, text: texto, url }).catch(() => undefined)}>
                    <Share2 size={18} strokeWidth={1.5} aria-hidden="true" />
                </button>
            )}
            <span className="compartilhar-aviso" role="status">{copiado ? "Link copiado" : ""}</span>
        </div>
    );
}
