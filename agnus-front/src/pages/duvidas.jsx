import { Link } from "react-router-dom";
import DuvidasLista from "../components/duvidasLista";
import FaleConosco from "../components/faleConosco";
import { DUVIDAS } from "../conteudo/loja";
import "../css/cliente/institucional.css";
import { useTituloPagina } from "../utils/tituloPagina";

const ancora = (assunto) => assunto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");

export default function Duvidas() {
    useTituloPagina("Perguntas frequentes");
    return (
        <main className="institucional" data-cy="pagina-duvidas">
            <header className="institucional-topo">
                <p className="institucional-sobretitulo">Atendimento</p>
                <h1>Perguntas frequentes</h1>
                <p className="institucional-lede">As respostas para o que mais perguntam sobre pedidos, tamanhos, pagamento e devoluções.</p>
            </header>

            <nav className="duvidas-assuntos" aria-label="Assuntos">
                {DUVIDAS.map((g) => (
                    <a key={g.assunto} href={`#${ancora(g.assunto)}`}>{g.assunto}</a>
                ))}
            </nav>

            {DUVIDAS.map((g, gi) => (
                <section key={g.assunto} id={ancora(g.assunto)} className="duvidas-grupo" aria-labelledby={`assunto-${gi}`}>
                    <h2 id={`assunto-${gi}`}>{g.assunto}</h2>
                    <DuvidasLista perguntas={g.perguntas} prefixo={`duvida-${gi}`} />
                </section>
            ))}

            <FaleConosco titulo="Não achou sua resposta?" />

            <p className="institucional-rodape">
                Veja também <Link to="/trocas-e-devolucoes">Trocas e devoluções</Link> e <Link to="/entrega">Entrega e prazos</Link>.
            </p>
        </main>
    );
}
