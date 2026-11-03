import { useEffect, useState } from "react";
import { Check, Instagram, Mail } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import "../../css/cliente/finalizar.css";
import { apiUrl, authHeaders } from "../../utils/api";
import { formatarReal } from "../../utils/sacola";

function PedidoConfirmado() {
    const { id } = useParams();
    const [pedido, setPedido] = useState(null);

    useEffect(() => {
        async function carregar() {
            try {
                const res = await fetch(apiUrl(`orders/${id}`), { headers: authHeaders() });

                if (res.ok) {
                    setPedido(await res.json());
                }
            } catch {
                // O número do pedido vem da URL; a página segue útil sem o total.
            }
        }

        carregar();
    }, [id]);

    const assunto = encodeURIComponent(`Pedido nº ${id}`);

    return (
        <div className="fin-page fin-confirmado">
            <span className="fin-selo"><Check size={32} strokeWidth={1.5} aria-hidden="true" /></span>

            <h1 data-cy="pedido-confirmado">Pedido nº&nbsp;{id} recebido</h1>

            {pedido && <p className="fin-valor">Total das peças: {formatarReal(pedido.valor_total)}</p>}

            <div className="fin-proximo">
                <h2>Falta só combinar o pagamento</h2>
                <p>
                    O pagamento pelo site ainda não está disponível. Fale com a gente informando
                    o número do pedido para combinarmos o pagamento e o frete.
                </p>

                <div className="fin-contatos">
                    <a className="btn-agnus" href="https://www.instagram.com/agnus.fit/" target="_blank" rel="noreferrer">
                        <Instagram size={18} strokeWidth={1.5} aria-hidden="true" /> Instagram
                    </a>
                    <a className="btn-agnus-ghost" href={`mailto:contato@agnus.fit?subject=${assunto}`}>
                        <Mail size={18} strokeWidth={1.5} aria-hidden="true" /> E-mail
                    </a>
                </div>
            </div>

            <Link to="/cliente/pedidos" className="fin-link">Ver meus pedidos</Link>
            <Link to="/catalogo" className="fin-link">Continuar na loja</Link>
        </div>
    );
}

export default PedidoConfirmado;
