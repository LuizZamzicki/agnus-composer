import { Mail, MessageCircle } from "lucide-react";
import { EMAIL, WHATSAPP, linkWhatsApp } from "../conteudo/loja";
import "../css/cliente/institucional.css";

export default function FaleConosco({ titulo = "Fale com a gente" }) {
    return (
        <section className="fale-conosco" data-cy="fale-conosco" aria-labelledby="fale-conosco-titulo">
            <h2 id="fale-conosco-titulo">{titulo}</h2>
            <p>Respondemos pelo WhatsApp e por e-mail.</p>
            <div className="fale-conosco-acoes">
                {WHATSAPP.map((w) => (
                    <a key={w.numero} className="btn-agnus" href={linkWhatsApp(w.numero)} target="_blank" rel="noreferrer">
                        <MessageCircle size={18} strokeWidth={1.5} aria-hidden="true" /> WhatsApp {w.rotulo}
                    </a>
                ))}
                <a className="btn-agnus-ghost" href={`mailto:${EMAIL}`}>
                    <Mail size={18} strokeWidth={1.5} aria-hidden="true" /> {EMAIL}
                </a>
            </div>
        </section>
    );
}
