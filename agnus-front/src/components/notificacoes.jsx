import { Bell } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiUrl, authHeaders } from "../utils/api";

const INTERVALO_MS = 60 * 1000;

function dataCurta(data) {
    return data ? new Date(data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "";
}

function Notificacoes() {
    const navigate = useNavigate();
    const caixa = useRef(null);
    const [lista, setLista] = useState([]);
    const [naoLidas, setNaoLidas] = useState(0);
    const [aberto, setAberto] = useState(false);

    const carregar = useCallback(async () => {
        try {
            const res = await fetch(apiUrl("notifications/me"), { headers: authHeaders() });

            if (res.ok) {
                const dados = await res.json();
                setLista(dados.data || []);
                setNaoLidas(dados.naoLidas || 0);
            }
        } catch {
            // Sem conexão agora: a próxima atualização tenta de novo.
        }
    }, []);

    useEffect(() => {
        carregar();

        const intervalo = setInterval(carregar, INTERVALO_MS);
        window.addEventListener("focus", carregar);

        return () => {
            clearInterval(intervalo);
            window.removeEventListener("focus", carregar);
        };
    }, [carregar]);

    useEffect(() => {
        if (!aberto) return undefined;

        const fecharFora = (event) => {
            if (!caixa.current?.contains(event.target)) setAberto(false);
        };
        const fecharEsc = (event) => {
            if (event.key === "Escape") setAberto(false);
        };

        document.addEventListener("mousedown", fecharFora);
        document.addEventListener("keydown", fecharEsc);

        return () => {
            document.removeEventListener("mousedown", fecharFora);
            document.removeEventListener("keydown", fecharEsc);
        };
    }, [aberto]);

    function abrirNotificacao(notificacao) {
        setLista((atuais) => atuais.filter((n) => n.id_notificacao !== notificacao.id_notificacao));
        setNaoLidas((total) => Math.max(0, total - 1));
        fetch(apiUrl(`notifications/${notificacao.id_notificacao}/read`), {
            method: "PATCH",
            headers: authHeaders(),
        }).catch(() => {});

        setAberto(false);
        navigate(`/cliente/pedidos?pedido=${notificacao.id_pedido}`);
    }

    function marcarTodas() {
        setLista([]);
        setNaoLidas(0);
        fetch(apiUrl("notifications/read-all"), { method: "PATCH", headers: authHeaders() }).catch(() => {});
    }

    return (
        <div className="notificacoes" ref={caixa}>
            <button
                type="button"
                data-cy="abrir-notificacoes"
                className="notificacoes-sino"
                aria-label={naoLidas ? `Notificações, ${naoLidas} não lidas` : "Notificações"}
                aria-expanded={aberto}
                onClick={() => setAberto(!aberto)}
            >
                <Bell size={20} strokeWidth={1.5} />
                {naoLidas > 0 && <span key={naoLidas} data-cy="notificacoes-contador" className="sacola-contador">{naoLidas > 99 ? "99+" : naoLidas}</span>}
            </button>

            {aberto && (
                <div className="notificacoes-painel" data-cy="painel-notificacoes">
                    <div className="notificacoes-topo">
                        <strong>Notificações</strong>
                        {naoLidas > 0 && (
                            <button type="button" data-cy="marcar-todas" onClick={marcarTodas}>Marcar todas como lidas</button>
                        )}
                    </div>

                    {lista.length === 0 ? (
                        <p className="notificacoes-vazio">Nenhuma notificação no momento</p>
                    ) : (
                        <ul>
                            {lista.map((n) => (
                                <li key={n.id_notificacao}>
                                    <button
                                        type="button"
                                        data-cy="notificacao"
                                        onClick={() => abrirNotificacao(n)}
                                    >
                                        <strong>{n.titulo}</strong>
                                        <span>{n.mensagem}</span>
                                        <small>{dataCurta(n.data_criacao)}</small>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}

export default Notificacoes;
