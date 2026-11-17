import { useEffect, useState } from "react";
import { apiUrl } from "./api";
import { DIAS_NOVIDADE } from "../conteudo/loja";

// Dados da vitrine pedidos uma vez por página (banners e mais pedidos) e reaproveitados por
// todos os componentes que precisam deles (banner, faixa do topo, etiquetas dos cards).
const cache = new Map();

const buscarLista = (chave, caminho) => {
    if (!cache.has(chave)) {
        cache.set(
            chave,
            fetch(apiUrl(caminho))
                .then((r) => (r.ok ? r.json() : { data: [] }))
                .then((j) => (Array.isArray(j?.data) ? j.data : []))
                .catch(() => {
                    cache.delete(chave);
                    return [];
                })
        );
    }
    return cache.get(chave);
};

const useLista = (chave, caminho) => {
    const [lista, setLista] = useState([]);

    useEffect(() => {
        let ativo = true;
        buscarLista(chave, caminho).then((dados) => ativo && setLista(dados));
        return () => {
            ativo = false;
        };
    }, [chave, caminho]);

    return lista;
};

export const useBanners = () => useLista("banners", "vitrine/banners");

// As 3 peças mais vendidas ganham a etiqueta "Mais pedida".
export const useMaisPedidos = () => {
    const lista = useLista("mais-pedidos", "products/best-sellers?page=1&limit=3");
    return new Set(lista.map((p) => p.id_produto));
};

export const DIAS_PARA_CONTAGEM = 14;
const DIA_MS = 24 * 60 * 60 * 1000;

// Campanha com fim marcado para os próximos dias: é ela que ganha a contagem regressiva.
export const campanhaTerminando = (banners, agora = Date.now()) =>
    banners.find((b) => {
        const fim = b.fim ? new Date(b.fim).getTime() : NaN;
        return fim > agora && fim - agora <= DIAS_PARA_CONTAGEM * DIA_MS;
    }) || null;

export const etiquetasDoProduto = (produto, maisPedidos, agora = Date.now()) => {
    const etiquetas = [];
    if (maisPedidos?.has(produto.id_produto)) etiquetas.push({ tipo: "mais", texto: "Mais pedida" });
    const criado = produto.data_criacao ? new Date(produto.data_criacao).getTime() : NaN;
    if (agora - criado <= DIAS_NOVIDADE * DIA_MS) etiquetas.push({ tipo: "nova", texto: "Novidade" });
    return etiquetas;
};
