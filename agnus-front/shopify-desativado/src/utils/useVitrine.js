import { useEffect, useRef, useState } from "react";
import { apiUrl } from "./api";
import { listarProdutos } from "./loja";

// Página de peças do Shopify. A paginação é por cursor: o hook guarda o cursor de cada página
// visitada para o botão "anterior" voltar sem perguntar de novo ao Shopify onde estava.
export function useVitrine({ busca = "", colecao = "", ordem = "relevancia", limite = 12 } = {}) {
    const chave = JSON.stringify({ busca, colecao, ordem, limite });
    const [posicao, setPosicao] = useState({ chave, pagina: 0 });
    const [estado, setEstado] = useState({ produtos: [], temProxima: false, carregando: true, erro: "" });
    const cursores = useRef({ chave, lista: [null] });
    const ultimaConsulta = useRef(0);

    // Filtro novo volta para a primeira página já neste render, sem buscar a página antiga.
    if (posicao.chave !== chave) {
        setPosicao({ chave, pagina: 0 });
    }

    const pagina = posicao.chave === chave ? posicao.pagina : 0;

    useEffect(() => {
        if (cursores.current.chave !== chave) {
            cursores.current = { chave, lista: [null] };
        }

        const consulta = ++ultimaConsulta.current;
        const filtro = JSON.parse(chave);

        setEstado((atual) => ({ ...atual, carregando: true }));

        listarProdutos({ ...filtro, depois: cursores.current.lista[pagina] || undefined })
            .then(({ produtos, paginacao }) => {
                if (consulta !== ultimaConsulta.current) return;

                if (paginacao.temProxima) {
                    cursores.current.lista[pagina + 1] = paginacao.fim;
                }

                setEstado({ produtos, temProxima: paginacao.temProxima, carregando: false, erro: "" });
            })
            .catch((erro) => {
                if (consulta !== ultimaConsulta.current) return;
                setEstado((atual) => ({ ...atual, carregando: false, erro: erro.message }));
            });
    }, [chave, pagina]);

    return {
        ...estado,
        pagina: pagina + 1,
        temAnterior: pagina > 0,
        proxima: () => setPosicao({ chave, pagina: pagina + 1 }),
        anterior: () => setPosicao({ chave, pagina: Math.max(pagina - 1, 0) }),
    };
}

// Média das avaliações de cada peça (o serviço de avaliações usa o id numérico do Shopify).
export function useMediasDeAvaliacao(produtos) {
    const [medias, setMedias] = useState({});

    useEffect(() => {
        if (!produtos.length) return undefined;

        let ativo = true;

        Promise.all(
            produtos.map(async (produto) => {
                try {
                    const res = await fetch(apiUrl(`product-reviews/${produto.idNumerico}`));
                    const dados = await res.json();
                    const lista = Array.isArray(dados) ? dados : dados?.data || [];

                    return lista.length
                        ? [produto.idNumerico, lista.reduce((soma, av) => soma + Number(av.nota || 0), 0) / lista.length]
                        : null;
                } catch {
                    return null;
                }
            })
        ).then((pares) => {
            if (ativo) setMedias((atuais) => ({ ...atuais, ...Object.fromEntries(pares.filter(Boolean)) }));
        });

        return () => {
            ativo = false;
        };
    }, [produtos]);

    return medias;
}
