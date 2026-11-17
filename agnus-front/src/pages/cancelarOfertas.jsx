import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiUrl } from "../utils/api";
import { useTituloPagina } from "../utils/tituloPagina";
import "../css/cliente/institucional.css";

// Link "Não quero mais receber" dos e-mails de ofertas.
export default function CancelarOfertas() {
    useTituloPagina("Cancelar ofertas por e-mail");
    const [params] = useSearchParams();
    const token = params.get("token") || "";
    const [estado, setEstado] = useState({ tipo: token ? "enviando" : "erro", texto: token ? "" : "Link de cancelamento inválido." });

    useEffect(() => {
        if (!token) return undefined;
        let ativo = true;
        fetch(apiUrl("ofertas/cancelar"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
        })
            .then(async (res) => {
                const dados = await res.json().catch(() => ({}));
                if (!ativo) return;
                setEstado(res.ok ? { tipo: "ok", texto: dados.email } : { tipo: "erro", texto: dados.message || "Não foi possível cancelar." });
            })
            .catch(() => ativo && setEstado({ tipo: "erro", texto: "Sem conexão com o servidor. Tente de novo." }));
        return () => {
            ativo = false;
        };
    }, [token]);

    return (
        <main className="institucional" data-cy="cancelar-ofertas">
            <header className="institucional-topo">
                <p className="institucional-sobretitulo">Ofertas por e-mail</p>
                <h1>{estado.tipo === "ok" ? "Inscrição cancelada" : estado.tipo === "enviando" ? "Cancelando…" : "Algo deu errado"}</h1>
                {estado.tipo === "ok" && (
                    <p className="institucional-lede">
                        {estado.texto ? `${estado.texto} não vai mais receber nossas ofertas.` : "Você não vai mais receber nossas ofertas."} Se mudar de ideia, é só se cadastrar de novo na página inicial.
                    </p>
                )}
                {estado.tipo === "erro" && <p className="institucional-lede" role="alert">{estado.texto}</p>}
            </header>
            <p style={{ textAlign: "center" }}>
                <Link className="btn-agnus-ghost" to="/">Voltar para a loja</Link>
            </p>
        </main>
    );
}
