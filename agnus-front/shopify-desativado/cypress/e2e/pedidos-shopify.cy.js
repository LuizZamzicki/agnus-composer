// "Meus pedidos" com as compras feitas no checkout do Shopify (serviço loja, Admin API).
describe('Meus pedidos - compras da loja online', () => {
    const pedidoShopify = {
        id: 'gid://shopify/Order/1',
        numero: '#1001',
        data: '2026-11-11T20:00:00Z',
        status: 'enviado',
        total: 15,
        frete: 10,
        moeda: 'BRL',
        acompanhar: 'https://agnusfit.myshopify.com/orders/abc',
        rastreio: { codigo: 'BR123', url: 'https://rastreio.exemplo/BR123', empresa: 'Correios' },
        itens: [{
            id: 'gid://shopify/LineItem/1',
            nome: 'Camiseta Dry Fit – Sarça Ardente',
            opcoes: 'Black / Regular',
            quantidade: 1,
            total: 5,
            imagem: null,
            handle: 'camiseta-dryfit-exodo-3-2',
        }],
    };

    beforeEach(() => {
        localStorage.setItem('auth_token', 'fake-token');
        localStorage.setItem('auth', JSON.stringify({ id_usuario: 1, tipo: 'cliente' }));
        cy.intercept('GET', '**/notifications/me', { body: { data: [], naoLidas: 0 } });
        cy.intercept('GET', '**/loja/sacolas/minha', { statusCode: 404, body: {} });
    });

    it('mostra a compra do Shopify com status, peças, rastreio e link de acompanhamento', () => {
        cy.intercept('GET', '**/orders/me', { body: [] }).as('antigos');
        cy.intercept('GET', '**/loja/pedidos', { body: [pedidoShopify] }).as('loja');

        cy.visit('/cliente/pedidos');
        cy.wait(['@antigos', '@loja']);

        cy.get('[data-cy="pedido-card"]').should('have.length', 1).within(() => {
            cy.contains('Pedido #1001').should('exist');
            cy.contains('Enviado').should('exist');
            cy.contains('15,00').should('exist');
            cy.get('[data-cy="ver-pecas"]').should('contain', 'Ver peças (1)').click();
            cy.get('[data-cy="item-produto"] a').should('have.attr', 'href', '/produto/camiseta-dryfit-exodo-3-2');
            cy.contains('Black / Regular').should('exist');
            cy.get('[data-cy="pedido-rastreio"]').should('contain', 'BR123').and('contain', 'Correios');
            cy.get('[data-cy="acompanhar-pedido"]').should('have.attr', 'href', pedidoShopify.acompanhar);
            cy.get('[data-cy="avaliar-peca"]').should('not.exist');
        });
    });

    it('não vira link quando o endereço de rastreio não é http(s)', () => {
        cy.intercept('GET', '**/orders/me', { body: [] });
        cy.intercept('GET', '**/loja/pedidos', {
            body: [{ ...pedidoShopify, acompanhar: 'javascript:alert(1)', rastreio: { ...pedidoShopify.rastreio, url: 'data:text/html,x' } }],
        });

        cy.visit('/cliente/pedidos');

        cy.get('[data-cy="ver-pecas"]').click();
        cy.get('[data-cy="pedido-rastreio"]').should('contain', 'BR123').find('a').should('not.exist');
        cy.get('[data-cy="acompanhar-pedido"]').should('not.exist');
    });

    it('junta com os pedidos antigos, do mais novo para o mais antigo', () => {
        cy.intercept('GET', '**/orders/me', {
            body: [{ id_pedido: 12, id_usuario: 1, status: 'entregue', valor_total: 120, data_criacao: '2026-11-01T12:00:00Z' }],
        });
        cy.intercept('GET', '**/order-items/12', { body: [] });
        cy.intercept('GET', '**/loja/pedidos', { body: [pedidoShopify] });

        cy.visit('/cliente/pedidos');

        cy.get('[data-cy="pedido-card"]').should('have.length', 2);
        cy.get('[data-cy="pedido-card"]').first().should('contain', 'Pedido #1001');
        cy.get('[data-cy="pedido-card"]').last().should('contain', 'Pedido #12');
    });

    it('com a loja online fora do ar, avisa e mostra os pedidos antigos', () => {
        cy.intercept('GET', '**/orders/me', {
            body: [{ id_pedido: 12, id_usuario: 1, status: 'pago', valor_total: 120, data_criacao: '2026-11-01T12:00:00Z' }],
        });
        cy.intercept('GET', '**/order-items/12', { body: [] });
        cy.intercept('GET', '**/loja/pedidos', { statusCode: 503, body: { message: 'Os pedidos da loja estão temporariamente indisponíveis.' } });

        cy.visit('/cliente/pedidos');

        cy.get('[data-cy="erro-pedidos"]').should('contain', 'compras da loja online');
        cy.get('[data-cy="pedido-card"]').should('have.length', 1).and('contain', 'Pedido #12');
    });
});
