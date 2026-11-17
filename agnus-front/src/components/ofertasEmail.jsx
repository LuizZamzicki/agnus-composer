import { useState } from "react";
import { Check, Copy, Mail } from "lucide-react";
import { apiUrl } from "../utils/api";
import { DESCONTO_PRIMEIRA_COMPRA } from "../conteudo/loja";
import { guardarCupom } from "../utils/cupomGuardado";
import "../css/cliente/conversao.css";

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Faixa da página inicial: e-mail para receber ofertas em troca de 10% na primeira compra.
// O cupom aparece na hora (e vai por e-mail); fica guardado para já vir preenchido no checkout.
export default function OfertasEmail() {
    const [email, setEmail] = useState("");
    const [estado, setEstado] = useState({ tipo: "" });
    const [copiado, setCopiado] = useState(false);

    async function enviar(evento) {
        evento.preventDefault();
        const valor = email.trim();

        if (!EMAIL_VALIDO.test(valor)) {
            setEstado({ tipo: "erro", texto: "Digite um e-mail válido." });
            return;
        }

        setEstado({ tipo: "enviando" });
        try {
            const res = await fetch(apiUrl("ofertas"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: valor }),
            });
            const dados = await res.json().catch(() => ({}));

            if (res.status === 429) {
                setEstado({ tipo: "erro", texto: "Muitas tentativas seguidas. Espere um minuto e tente de novo." });
                return;
            }
            if (!res.ok || !dados.cupom) {
                setEstado({ tipo: "erro", texto: dados.message || "Não foi possível concluir. Tente de novo." });
                return;
            }

            guardarCupom(dados.cupom);
            setEstado({ tipo: "ok", cupom: dados.cupom, jaInscrito: dados.ja_inscrito });
        } catch {
            setEstado({ tipo: "erro", texto: "Sem conexão com o servidor. Tente de novo." });
        }
    }

    async function copiar() {
        try {
            await navigator.clipboard.writeText(estado.cupom);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
        } catch {
            setCopiado(false);
        }
    }

    return (
        <section className="ofertas-email" data-cy="ofertas-email" aria-labelledby="ofertas-email-titulo">
            <div className="ofertas-email-texto">
                <p className="ofertas-email-sobretitulo">Para quem chega agora</p>
                <h2 id="ofertas-email-titulo">Ganhe {DESCONTO_PRIMEIRA_COMPRA}% na primeira compra</h2>
                <p>Cadastre seu e-mail e receba antes as campanhas, os lançamentos e as ofertas da Agnus.</p>
            </div>

            {estado.tipo === "ok" ? (
                <div className="ofertas-email-ok" data-cy="ofertas-email-ok" role="status">
                    <p>
                        <Check size={18} strokeWidth={2} aria-hidden="true" />
                        {estado.jaInscrito ? "Você já estava na lista. Seu cupom:" : "Pronto! Seu cupom também foi para o seu e-mail:"}
                    </p>
                    <div className="ofertas-email-cupom">
                        <strong data-cy="ofertas-cupom">{estado.cupom}</strong>
                        <button type="button" onClick={copiar} className="btn-agnus-ghost">
                            {copiado ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                            {copiado ? "Copiado" : "Copiar"}
                        </button>
                    </div>
                    <small>Ele já vem preenchido quando você finalizar o pedido.</small>
                </div>
            ) : (
                <form className="ofertas-email-form" onSubmit={enviar} noValidate>
                    <label htmlFor="ofertas-email-campo" className="sr-only">Seu e-mail</label>
                    <div className="ofertas-email-campo">
                        <Mail size={18} strokeWidth={1.5} aria-hidden="true" />
                        <input
                            id="ofertas-email-campo"
                            data-cy="ofertas-email-campo"
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            placeholder="seu@email.com"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                if (estado.tipo === "erro") setEstado({ tipo: "" });
                            }}
                            aria-invalid={estado.tipo === "erro"}
                            aria-describedby="ofertas-email-ajuda"
                        />
                    </div>
                    <button type="submit" className="btn-agnus" data-cy="ofertas-email-enviar" disabled={estado.tipo === "enviando"}>
                        {estado.tipo === "enviando" ? "Enviando…" : "Quero meu cupom"}
                    </button>
                    {estado.tipo === "erro" ? (
                        <small id="ofertas-email-ajuda" className="ofertas-email-erro" role="alert" data-cy="ofertas-email-erro">{estado.texto}</small>
                    ) : (
                        <small id="ofertas-email-ajuda">Só ofertas da Agnus, sem spam. Cancele quando quiser pelo link no e-mail.</small>
                    )}
                </form>
            )}
        </section>
    );
}
