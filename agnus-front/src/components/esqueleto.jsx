import "../css/esqueleto.css";

// Lugares reservados enquanto os dados chegam: a página não "pula" quando o conteúdo aparece.

export function EsqueletoLinhas({ rotulo = "Carregando…", linhas = 3 }) {
    return (
        <div className="esqueleto-grupo" role="status">
            <span className="sr-only">{rotulo}</span>
            {Array.from({ length: linhas }, (_, i) => (
                <div key={i} className="esqueleto esqueleto-bloco" aria-hidden="true" />
            ))}
        </div>
    );
}

// Devolve filhos diretos da grade de peças, para ocuparem as mesmas colunas dos cartões.
export function EsqueletoCartoes({ quantidade = 8 }) {
    return (
        <>
            <span className="sr-only" role="status">Carregando peças…</span>
            {Array.from({ length: quantidade }, (_, i) => (
                <div key={i} data-cy="esqueleto-cartao" className="esqueleto-cartao" aria-hidden="true">
                    <div className="esqueleto esqueleto-foto" />
                    <div className="esqueleto esqueleto-linha" />
                    <div className="esqueleto esqueleto-linha curta" />
                </div>
            ))}
        </>
    );
}

export function EsqueletoProduto() {
    return (
        <div className="produto-page">
            <div className="produto-container" role="status">
                <span className="sr-only">Carregando produto…</span>
                <div className="esqueleto-grupo" aria-hidden="true">
                    <div className="esqueleto esqueleto-foto" />
                </div>
                <div className="esqueleto-grupo" aria-hidden="true">
                    <div className="esqueleto esqueleto-titulo" />
                    <div className="esqueleto esqueleto-linha curta" />
                    <div className="esqueleto esqueleto-bloco" />
                    <div className="esqueleto esqueleto-bloco" />
                </div>
            </div>
        </div>
    );
}
