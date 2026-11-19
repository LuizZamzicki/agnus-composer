import { useLocation } from "react-router-dom";
import { WHATSAPP, linkWhatsApp } from "../conteudo/loja";
import "../css/cliente/conversao.css";

// Telas de pagamento e login ficam sem o botão (não distrair de terminar o que começou).
const ESCONDER_EM = [/^\/login/, /^\/finalizar/, /^\/pagamento\//, /^\/pedido-confirmado\//, /^\/admin/];

// Botão do WhatsApp fixo no canto. Na página de uma peça, a mensagem já leva o link dela.
export default function WhatsAppFlutuante() {
    const { pathname } = useLocation();
    if (ESCONDER_EM.some((padrao) => padrao.test(pathname))) return null;

    const naPeca = pathname.startsWith("/produto/");
    const texto = naPeca
        ? `Olá! Tenho uma dúvida sobre esta peça: ${window.location.origin}${pathname}`
        : "Olá! Vim pelo site da Agnus e tenho uma dúvida.";

    return (
        <a
            className={`whatsapp-flutuante${naPeca ? " is-produto" : ""}`}
            data-cy="whatsapp-flutuante"
            href={linkWhatsApp(WHATSAPP[0].numero, texto)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Falar com a Agnus no WhatsApp"
        >
            <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true" focusable="false">
                <path
                    fill="currentColor"
                    d="M16.04 3C8.86 3 3.03 8.82 3.03 16c0 2.3.6 4.53 1.74 6.5L3 29l6.68-1.75A12.95 12.95 0 0 0 16.04 29C23.2 29 29 23.18 29 16S23.2 3 16.04 3Zm0 23.7c-2.03 0-4-.55-5.73-1.58l-.41-.24-3.97 1.04 1.06-3.86-.27-.4A10.66 10.66 0 0 1 5.37 16c0-5.89 4.79-10.68 10.67-10.68 5.88 0 10.66 4.79 10.66 10.68 0 5.89-4.78 10.7-10.66 10.7Zm5.85-8c-.32-.16-1.89-.93-2.18-1.04-.3-.11-.51-.16-.72.16-.21.32-.83 1.04-1.02 1.25-.19.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.59-.95-.85-1.59-1.9-1.78-2.22-.19-.32-.02-.49.14-.65.14-.14.32-.37.48-.56.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.72-1.74-.99-2.38-.26-.62-.52-.54-.72-.55h-.61c-.21 0-.56.08-.85.4-.29.32-1.12 1.09-1.12 2.66 0 1.57 1.14 3.09 1.3 3.3.16.21 2.25 3.43 5.45 4.81.76.33 1.36.53 1.82.67.77.24 1.46.21 2.01.13.61-.09 1.89-.77 2.16-1.52.27-.75.27-1.39.19-1.52-.08-.13-.29-.21-.61-.37Z"
                />
            </svg>
            <span className="whatsapp-flutuante-texto">Dúvidas? Fale com a gente</span>
        </a>
    );
}
