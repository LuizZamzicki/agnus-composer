import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../css/avisoCookies.css";
import { EVENTO_CONSENTIMENTO, definirConsentimento, lerConsentimento } from "../utils/rastreamento";

// Pergunta uma vez se o visitante aceita os cookies de medição e anúncios (LGPD). Recusar não muda
// nada na compra: só deixa o Pixel da Meta, o Google Analytics e o TikTok desligados.
export default function AvisoCookies() {
    const [decidido, setDecidido] = useState(() => lerConsentimento() !== null);

    useEffect(() => {
        const atualizar = () => setDecidido(lerConsentimento() !== null);
        window.addEventListener(EVENTO_CONSENTIMENTO, atualizar);
        return () => window.removeEventListener(EVENTO_CONSENTIMENTO, atualizar);
    }, []);

    if (decidido) return null;

    return (
        <section className="aviso-cookies" role="region" aria-label="Aviso de cookies" data-cy="aviso-cookies">
            <p>
                Usamos cookies para medir as visitas e mostrar anúncios da Agnus para quem já conhece a loja.{" "}
                <Link to="/privacidade">Saiba mais</Link>.
            </p>
            <div className="aviso-cookies-botoes">
                <button type="button" className="btn-agnus-ghost" onClick={() => definirConsentimento("recusado")} data-cy="cookies-recusar">
                    Recusar
                </button>
                <button type="button" className="btn-agnus" onClick={() => definirConsentimento("aceito")} data-cy="cookies-aceitar">
                    Aceitar
                </button>
            </div>
        </section>
    );
}
