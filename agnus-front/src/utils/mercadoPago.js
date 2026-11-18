// SDK do Mercado Pago (Bricks). Carregado só na tela de pagamento, uma vez por página.
// O formulário do cartão roda dentro de iframes do Mercado Pago: o número do cartão nunca
// passa pelo nosso site nem pelo nosso servidor, que só recebe um token de uso único.
export const URL_SDK_MERCADO_PAGO = "https://sdk.mercadopago.com/js/v2";

let carregando = null;

export function carregarSdkMercadoPago() {
    if (window.MercadoPago) {
        return Promise.resolve(window.MercadoPago);
    }

    if (!carregando) {
        carregando = new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = URL_SDK_MERCADO_PAGO;
            script.async = true;
            script.onload = () => (window.MercadoPago ? resolve(window.MercadoPago) : reject(new Error("SDK sem MercadoPago")));
            script.onerror = () => {
                carregando = null;
                script.remove();
                reject(new Error("Não foi possível carregar o Mercado Pago."));
            };
            document.head.appendChild(script);
        });
    }

    return carregando;
}

// Motivos de recusa mais comuns do cartão, em linguagem do cliente.
const MOTIVOS_DE_RECUSA = {
    cc_rejected_insufficient_amount: "O cartão não tem limite suficiente para esta compra.",
    cc_rejected_bad_filled_security_code: "O código de segurança do cartão está incorreto.",
    cc_rejected_bad_filled_date: "A data de validade do cartão está incorreta.",
    cc_rejected_bad_filled_card_number: "O número do cartão está incorreto.",
    cc_rejected_bad_filled_other: "Confira os dados do cartão e tente de novo.",
    cc_rejected_call_for_authorize: "O banco pediu para você autorizar o pagamento. Ligue para ele e tente de novo.",
    cc_rejected_card_disabled: "O cartão está desativado. Fale com o banco ou use outro cartão.",
    cc_rejected_duplicated_payment: "Você já fez um pagamento igual há pouco. Confira em Meus pedidos.",
    cc_rejected_high_risk: "O pagamento foi recusado por segurança. Tente outro cartão ou pague com PIX.",
    cc_rejected_max_attempts: "Você atingiu o limite de tentativas com este cartão. Use outro cartão ou o PIX.",
    cc_rejected_blacklist: "Não foi possível pagar com este cartão. Use outro cartão ou o PIX.",
};

export function motivoDaRecusa(statusDetalhe) {
    return MOTIVOS_DE_RECUSA[statusDetalhe] || "O pagamento foi recusado. Tente outro cartão ou pague com PIX.";
}
