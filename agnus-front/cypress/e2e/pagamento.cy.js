// Checkout próprio com o Mercado Pago (Payment Brick). O SDK real é trocado por um falso que desenha
// botões "pagar com cartão" e "pagar com PIX" e chama o onSubmit como o Brick faria.
const SDK_FALSO = `
window.MercadoPago = function (publicKey) {
  window.__chavePublicaMP = publicKey;
  return {
    bricks: function () {
      return {
        create: function (tipo, idDoContainer, opcoes) {
          window.__opcoesDoBrick = opcoes;
          var alvo = document.getElementById(idDoContainer);
          function botao(rotulo, dataCy, formData) {
            var b = document.createElement("button");
            b.type = "button";
            b.textContent = rotulo;
            b.setAttribute("data-cy", dataCy);
            b.onclick = function () {
              opcoes.callbacks.onSubmit({ selectedPaymentMethod: formData.payment_method_id, formData: formData }).catch(function () {});
            };
            alvo.appendChild(b);
          }
          botao("Pagar com cartão", "brick-cartao", { payment_method_id: "visa", token: "tok_teste_123456", installments: 2, issuer_id: "25", transaction_amount: 1, payer: { email: "cliente@agnus.fit" } });
          botao("Pagar com PIX", "brick-pix", { payment_method_id: "pix", transaction_amount: 1, payer: { email: "cliente@agnus.fit" } });
          opcoes.callbacks.onReady();
          return Promise.resolve({ unmount: function () { alvo.innerHTML = ""; } });
        }
      };
    }
  };
};`;

const pagamentoPix = {
    status: "pending",
    status_detalhe: "pending_waiting_transfer",
    metodo: "pix",
    valor: 149.9,
    parcelas: 1,
    pix: { copia_e_cola: "00020126580014br.gov.bcb.pix0136teste", qr_code_base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", expira_em: "2099-01-01T12:00:00Z" },
};

describe("Pagamento do pedido (Mercado Pago)", () => {
    beforeEach(() => {
        localStorage.setItem("auth_token", "fake-token");
        localStorage.setItem("auth", JSON.stringify({ id_usuario: 1, tipo: "cliente" }));
        cy.intercept("GET", "**/notifications/me", { body: { data: [], naoLidas: 0 } });
        cy.intercept("GET", "**/carts/user/**", { body: [] });
        cy.intercept("GET", "https://sdk.mercadopago.com/js/v2", { body: SDK_FALSO, headers: { "content-type": "application/javascript" } }).as("sdk");
        cy.intercept("GET", "**/pagamentos/config", { body: { ativo: true, publicKey: "TEST-pk-123" } });
        cy.intercept("GET", "**/orders/42", { body: { id_pedido: 42, status: "pago", valor_total: 149.9 } });
    });

    it("cartão aprovado leva à confirmação com o pagamento confirmado", () => {
        cy.intercept("GET", "**/orders/42/pagamento", { body: { id_pedido: 42, status_pedido: "aguardando_pagamento", total: 149.9, pagamento: null } });
        cy.intercept("POST", "**/orders/42/pagamento", {
            statusCode: 201,
            body: { id_pedido: 42, status_pedido: "pago", pagamento: { status: "approved", metodo: "visa", parcelas: 2, valor: 149.9, pix: null } },
        }).as("pagar");

        cy.visit("/pagamento/42");
        cy.get('[data-cy="pagamento-total"]').should("contain", "149,90");
        cy.wait("@sdk");
        cy.window().its("__chavePublicaMP").should("eq", "TEST-pk-123");
        cy.window().its("__opcoesDoBrick.initialization.amount").should("eq", 149.9);
        cy.window().its("__opcoesDoBrick.customization.paymentMethods.bankTransfer").should("deep.equal", ["pix"]);

        cy.get('[data-cy="brick-cartao"]').click();
        cy.wait("@pagar").its("request.body").should("include", { payment_method_id: "visa", token: "tok_teste_123456", installments: 2 });
        cy.location("pathname").should("eq", "/pedido-confirmado/42");
        cy.get('[data-cy="pedido-pago"]').should("exist");
    });

    it("cartão recusado mostra o motivo e deixa tentar de novo", () => {
        cy.intercept("GET", "**/orders/42/pagamento", { body: { id_pedido: 42, status_pedido: "aguardando_pagamento", total: 149.9, pagamento: null } });
        cy.intercept("POST", "**/orders/42/pagamento", {
            statusCode: 201,
            body: { id_pedido: 42, status_pedido: "aguardando_pagamento", pagamento: { status: "rejected", status_detalhe: "cc_rejected_insufficient_amount", metodo: "visa", pix: null } },
        });

        cy.visit("/pagamento/42");
        cy.get('[data-cy="brick-cartao"]').click();
        cy.get('[data-cy="pagamento-erro-msg"]').should("contain", "não tem limite suficiente");
        cy.location("pathname").should("eq", "/pagamento/42");
        cy.get('[data-cy="brick-pix"]').should("exist");
    });

    it("PIX mostra QR Code e copia e cola, e avisa sozinho quando o pagamento cai", () => {
        let consultas = 0;
        cy.intercept("GET", "**/orders/42/pagamento", (req) => {
            consultas += 1;
            req.reply({
                body: consultas < 3
                    ? { id_pedido: 42, status_pedido: "aguardando_pagamento", total: 149.9, pagamento: consultas === 1 ? null : pagamentoPix }
                    : { id_pedido: 42, status_pedido: "pago", total: 149.9, pagamento: { ...pagamentoPix, status: "approved" } },
            });
        });
        cy.intercept("POST", "**/orders/42/pagamento", { statusCode: 201, body: { id_pedido: 42, status_pedido: "aguardando_pagamento", pagamento: pagamentoPix } }).as("pix");

        cy.clock(Date.now(), ["setInterval", "clearInterval"]);
        cy.visit("/pagamento/42");
        cy.get('[data-cy="brick-pix"]').click();
        cy.wait("@pix").its("request.body").should("include", { payment_method_id: "pix" });

        cy.get('[data-cy="pix-qr"]').should("have.attr", "src").and("match", /^data:image\/png;base64,/);
        cy.get('[data-cy="pix-copia-e-cola"]').should("have.value", pagamentoPix.pix.copia_e_cola);
        cy.get('[data-cy="pagamento-formulario"]').should("not.exist");

        cy.tick(5000);
        cy.tick(5000);
        cy.location("pathname").should("eq", "/pedido-confirmado/42");
    });

    it("PIX já gerado reaparece ao voltar à página, sem gerar outro", () => {
        cy.intercept("GET", "**/orders/42/pagamento", { body: { id_pedido: 42, status_pedido: "aguardando_pagamento", total: 149.9, pagamento: pagamentoPix } });
        cy.visit("/pagamento/42");
        cy.get('[data-cy="pix-copia-e-cola"]').should("have.value", pagamentoPix.pix.copia_e_cola);
        cy.get('[data-cy="pagamento-formulario"]').should("not.exist");
    });

    it("sem Mercado Pago configurado, explica e não abre o formulário", () => {
        cy.intercept("GET", "**/pagamentos/config", { body: { ativo: false, publicKey: null } });
        cy.intercept("GET", "**/orders/42/pagamento", { body: { id_pedido: 42, status_pedido: "aguardando_pagamento", total: 149.9, pagamento: null } });
        cy.visit("/pagamento/42");
        cy.get('[data-cy="pagamento-indisponivel"]').should("contain", "Pagamento pelo site indisponível");
    });

    it("pedido já pago vai direto para a confirmação", () => {
        cy.intercept("GET", "**/orders/42/pagamento", { body: { id_pedido: 42, status_pedido: "pago", total: 149.9, pagamento: null } });
        cy.visit("/pagamento/42");
        cy.location("pathname").should("eq", "/pedido-confirmado/42");
    });

    it("Meus pedidos mostra o botão Pagar nos pedidos aguardando pagamento", () => {
        cy.intercept("GET", "**/orders/me", {
            body: [
                { id_pedido: 42, id_usuario: 1, status: "aguardando_pagamento", valor_total: 149.9, data_criacao: "2026-11-13T12:00:00Z" },
                { id_pedido: 41, id_usuario: 1, status: "pago", valor_total: 89.9, data_criacao: "2026-11-12T12:00:00Z" },
            ],
        });
        cy.intercept("GET", "**/order-items/*", { body: [] });
        cy.visit("/cliente/pedidos");
        cy.get('[data-cy="pagar-pedido"]').should("have.length", 1).and("have.attr", "href", "/pagamento/42");
    });
});
