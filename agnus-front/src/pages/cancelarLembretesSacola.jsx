import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiUrl } from "../utils/api";
import { useTituloPagina } from "../utils/tituloPagina";
import "../css/cliente/institucional.css";

// Link "Não quero receber lembretes da sacola" do e-mail de sacola esquecida.
export default function CancelarLembretesSacola() {
    useTituloPagina("Lembretes da sacola");
    const [params] = useSearchParams();
    const token = params.get("token") || "";
    const [estado, setEstado] = useState({ tipo: token ? "enviando" : "erro", texto: token ? "" : "Link de cancelamento inválido." });

    useEffect(() => {
        if (!token) return undefined;
        let ativo = true;
        fetch(apiUrl("carts/lembretes/cancelar"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
        })
            .then(async (res) => {
                const dados = await res.json().catch(() => ({}));
                if (!ativo) return;
                setEstado(res.ok ? { tipo: "ok" } : { tipo: "erro", texto: dados.message || "Não foi possível cancelar." });
            })
            .catch(() => ativo && setEstado({ tipo: "erro", texto: "Sem conexão com o servidor. Tente de novo." }));
        return () => {
            ativo = false;
        };
    }, [token]);

    return (
        <main className="institucional" data-cy="cancelar-lembretes-sacola">
            <header className="institucional-topo">
                <p className="institucional-sobretitulo">Lembretes da sacola</p>
                <h1>{estado.tipo === "ok" ? "Lembretes desligados" : estado.tipo === "enviando" ? "Cancelando…" : "Algo deu errado"}</h1>
                {estado.tipo === "ok" && (
                    <p className="institucional-lede">
                        Você não vai mais receber e-mails sobre peças esquecidas na sacola. Os avisos dos seus pedidos continuam chegando normalmente.
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
