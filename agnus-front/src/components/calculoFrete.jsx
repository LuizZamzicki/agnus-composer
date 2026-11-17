import { useEffect, useId, useState } from "react";
import { Truck } from "lucide-react";
import { formatarReal } from "../utils/sacola";
import {
    cotarFrete,
    formatarCep,
    guardarCep,
    guardarServicoEscolhido,
    lerCepGuardado,
    lerServicoEscolhido,
    somenteDigitos,
    textoPrazo,
} from "../utils/frete";
import "../css/cliente/conversao.css";

// Frete e prazo pelo CEP. Na sacola e na peça o cliente digita o CEP; no checkout o CEP vem do
// endereço escolhido (cepFixo). Com onEscolher, as opções viram uma escolha (PAC, SEDEX...).
export default function CalculoFrete({ pecas, valorPecas, cepFixo = null, escolhido = null, onEscolher = null, titulo = "Frete e prazo" }) {
    const fixo = cepFixo != null;
    const nomeGrupo = useId();
    const [digitado, setDigitado] = useState(() => (fixo ? "" : lerCepGuardado()));
    const [cepManual, setCepManual] = useState(() => (fixo ? "" : lerCepGuardado()));
    const [cotacao, setCotacao] = useState(null);
    const [erro, setErro] = useState("");
    const [carregando, setCarregando] = useState(false);

    const cep = fixo ? somenteDigitos(cepFixo) : cepManual;
    const qtd = Math.max(1, Number(pecas) || 1);
    const valor = Math.round(Number(valorPecas || 0) * 100) / 100;

    useEffect(() => {
        if (cep.length !== 8) {
            setCotacao(null);
            setErro("");
            return undefined;
        }

        let ativo = true;
        setCarregando(true);
        setErro("");
        const espera = setTimeout(() => {
            cotarFrete(cep, qtd, valor)
                .then((dados) => ativo && setCotacao(dados))
                .catch((e) => {
                    if (!ativo) return;
                    setCotacao(null);
                    setErro(e.message);
                })
                .finally(() => ativo && setCarregando(false));
        }, 250);

        return () => {
            ativo = false;
            clearTimeout(espera);
        };
    }, [cep, qtd, valor]);

    // Mantém a escolha válida: prefere a opção que o cliente já tinha escolhido; senão, a mais barata.
    useEffect(() => {
        if (!onEscolher) return;
        if (!cotacao) {
            if (escolhido) onEscolher(null);
            return;
        }
        const preferida = escolhido?.id ?? lerServicoEscolhido();
        const opcao = cotacao.opcoes.find((o) => o.id === preferida) ?? cotacao.opcoes[0];
        if (!escolhido || opcao.id !== escolhido.id || opcao.preco !== escolhido.preco || opcao.prazo_dias !== escolhido.prazo_dias) {
            onEscolher(opcao);
        }
    }, [cotacao, escolhido, onEscolher]);

    function calcular(e) {
        e.preventDefault();
        const digitos = somenteDigitos(digitado);
        if (digitos.length !== 8) {
            setErro("Digite os 8 números do CEP.");
            return;
        }
        guardarCep(digitos);
        setCepManual(digitos);
    }

    function escolher(opcao) {
        guardarServicoEscolhido(opcao.id);
        onEscolher(opcao);
    }

    const preco = (o) => (o.gratis ? "Grátis" : formatarReal(o.preco));

    return (
        <section className="calculo-frete" data-cy="calculo-frete" aria-label={titulo}>
            <h3>
                <Truck size={18} strokeWidth={1.5} aria-hidden="true" /> {titulo}
                {fixo && cep.length === 8 && <small>CEP {formatarCep(cep)}</small>}
            </h3>

            {!fixo && (
                <form className="calculo-frete-form" onSubmit={calcular}>
                    <label className="sr-only" htmlFor={`${nomeGrupo}-cep`}>CEP</label>
                    <input
                        id={`${nomeGrupo}-cep`}
                        data-cy="frete-cep"
                        value={formatarCep(digitado)}
                        onChange={(e) => setDigitado(somenteDigitos(e.target.value))}
                        inputMode="numeric"
                        autoComplete="postal-code"
                        placeholder="Seu CEP"
                        maxLength={9}
                    />
                    <button type="submit" data-cy="frete-calcular" className="btn-agnus-ghost">Calcular</button>
                    <a
                        className="calculo-frete-link"
                        href="https://buscacepinter.correios.com.br/app/endereco/index.php"
                        target="_blank"
                        rel="noreferrer"
                    >
                        Não sei meu CEP
                    </a>
                </form>
            )}

            <div aria-live="polite">
                {carregando && <p className="calculo-frete-status">Calculando o frete…</p>}
                {!carregando && erro && <p className="calculo-frete-erro" role="alert" data-cy="frete-erro">{erro}</p>}
                {!carregando && cotacao && (
                    <ul className="calculo-frete-opcoes" data-cy="frete-opcoes">
                        {cotacao.opcoes.map((o) => {
                            const ativo = escolhido?.id === o.id;
                            const conteudo = (
                                <>
                                    <span className="calculo-frete-nome">
                                        {o.nome}
                                        <small>{[o.empresa !== o.nome ? o.empresa : null, textoPrazo(o.prazo_dias)].filter(Boolean).join(" · ")}</small>
                                    </span>
                                    <strong className={o.gratis ? "is-gratis" : ""}>{preco(o)}</strong>
                                </>
                            );
                            return (
                                <li key={o.id} data-cy="frete-opcao" data-id={o.id}>
                                    {onEscolher ? (
                                        <label className={ativo ? "is-ativo" : ""}>
                                            <input type="radio" name={nomeGrupo} checked={ativo} onChange={() => escolher(o)} />
                                            {conteudo}
                                        </label>
                                    ) : (
                                        <div>{conteudo}</div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
                {!carregando && cotacao && <p className="calculo-frete-nota">Prazo contado a partir da confirmação do pagamento.</p>}
            </div>
        </section>
    );
}
