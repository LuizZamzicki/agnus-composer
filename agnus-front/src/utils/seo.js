import { useEffect } from "react";

// Dados da peça para o Google (que roda o JavaScript do site): descrição, link canônico e o bloco
// Product (schema.org) com preço, fotos e disponibilidade. Os robôs de rede social, que não rodam
// JavaScript, recebem o mesmo pelo gateway (services/catalogo/src/services/seo.service.ts).
const DESCRICAO_PADRAO = "Roupas de treino com identidade católica, feitas sob encomenda.";
const ID_DO_BLOCO = "dados-da-peca";

const absoluta = (url) => {
    try {
        return new URL(url, window.location.origin).href;
    } catch {
        return null;
    }
};

function definirDescricao(texto) {
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", "description");
        document.head.appendChild(meta);
    }
    meta.setAttribute("content", texto);
}

function definirCanonico(url) {
    let link = document.querySelector('link[rel="canonical"]');
    if (!url) {
        link?.remove();
        return;
    }
    if (!link) {
        link = document.createElement("link");
        link.setAttribute("rel", "canonical");
        document.head.appendChild(link);
    }
    link.setAttribute("href", url);
}

const resumo = (texto) => String(texto || "").replace(/\s+/g, " ").trim().slice(0, 160);

export function dadosDaPeca(produto, imagens, origem = window.location.origin) {
    const url = `${origem}/produto/${produto.id_produto}`;
    return {
        "@context": "https://schema.org",
        "@type": "Product",
        name: produto.nome,
        description: resumo(produto.descricao) || produto.nome,
        image: (imagens || []).map(absoluta).filter(Boolean).slice(0, 5),
        sku: String(produto.id_produto),
        brand: { "@type": "Brand", name: "Agnus" },
        offers: {
            "@type": "Offer",
            url,
            priceCurrency: "BRL",
            price: Number(produto.preco_base || 0).toFixed(2),
            availability: "https://schema.org/InStock",
            itemCondition: "https://schema.org/NewCondition",
        },
    };
}

export function useDadosDaPeca(produto, imagens) {
    useEffect(() => {
        if (!produto?.id_produto) return undefined;

        definirDescricao(resumo(produto.descricao) || `${produto.nome}: ${DESCRICAO_PADRAO}`);
        definirCanonico(`${window.location.origin}/produto/${produto.id_produto}`);

        const bloco = document.createElement("script");
        bloco.type = "application/ld+json";
        bloco.id = ID_DO_BLOCO;
        bloco.textContent = JSON.stringify(dadosDaPeca(produto, imagens));
        document.getElementById(ID_DO_BLOCO)?.remove();
        document.head.appendChild(bloco);

        return () => {
            bloco.remove();
            definirDescricao(DESCRICAO_PADRAO);
            definirCanonico(null);
        };
    }, [produto, imagens]);
}
