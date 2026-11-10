describe('Notificações, avaliação no pedido e sacola', () => {
    const produto = { id_produto: 1, nome: 'Camiseta Ecce Agnus', preco_base: 120, ativo: true };
    const item = {
        id_pedido_item: 5,
        quantidade: 1,
        subtotal: 120,
        produto,
        cor: { nome: 'Azul' },
        grade: { nome: 'M' },
    };
    const pedido = { id_pedido: 12, id_usuario: 1, status: 'entregue', valor_total: 120, data_criacao: '2026-11-01T12:00:00Z' };
    const notificacao = {
        id_notificacao: 3,
        id_pedido: 12,
        titulo: 'Pedido entregue',
        mensagem: 'O pedido #12 foi entregue. Conte como foram as peças.',
        lida: false,
        data_criacao: '2026-11-02T12:00:00Z',
    };
    const minhaAvaliacao = { id_avaliacao_produto: 8, id_produto: 1, id_usuario: 1, nota: 4, titulo: 'Bruno', comentario: 'Gostei' };

    function mockPedidos(avaliacoes = []) {
        cy.intercept('GET', '**/orders/me*', { body: [pedido] }).as('pedidos');
        cy.intercept('GET', '**/order-items/12', { body: [{ ...item, foto_produto: '/produto_fotos/a.jpg' }] });
        cy.intercept('GET', '**/product-reviews/1', { body: avaliacoes }).as('reviews');
        cy.intercept('GET', '**/product-review-photos/*', { body: [] });
    }

    function mockProduto(avaliacoes = []) {
        cy.intercept('GET', '**/products/catalog*', { body: { data: [] } });
        cy.intercept('GET', '**/products/1', { body: produto }).as('produto');
        cy.intercept('GET', '**/product-colors/1', { body: [{ id_produto_cor: 2, nome: 'Azul', codigo_rgb: '#223355', acrescimo: 0 }] });
        cy.intercept('GET', '**/product-grades/1', { body: [{ id_produto_grade: 3, nome: 'M', acrescimo: 0 }] });
        cy.intercept('GET', '**/product-photos/1', { body: [] });
        cy.intercept('GET', '**/product-reviews/1', { body: avaliacoes }).as('reviews');
        cy.intercept('GET', '**/product-review-photos/*', { body: [] });
        cy.intercept('GET', '**/orders/me*', { body: [pedido] });
        cy.intercept('GET', '**/order-items/12', { body: [{ id_produto_cor: 2, id_produto_grade: 3 }] });
    }

    beforeEach(() => {
        localStorage.setItem('auth_token', 'fake');
        localStorage.setItem('auth', JSON.stringify({ id_usuario: 1, nome: 'Bruno', tipo: 'cliente' }));
        cy.intercept('GET', '**/notifications/me', { body: { data: [notificacao], naoLidas: 1 } }).as('notificacoes');
    });

    it('mostra o aviso de status e abre o pedido ao clicar', () => {
        mockPedidos();
        cy.intercept('PATCH', '**/notifications/3/read', { statusCode: 204 }).as('lida');
        cy.visit('/');
        cy.wait('@notificacoes');
        cy.get('[data-cy="notificacoes-contador"]').should('contain', '1');
        cy.get('[data-cy="abrir-notificacoes"]').click();
        cy.get('[data-cy="painel-notificacoes"]').should('contain', 'Pedido entregue');
        // O sino recarrega ao receber foco: depois de lida, o servidor já não a devolve.
        cy.intercept('GET', '**/notifications/me', { body: { data: [], naoLidas: 0 } });
        cy.get('[data-cy="notificacao"]').click();
        cy.wait('@lida');
        cy.location('search').should('eq', '?pedido=12');
        cy.get('[data-cy="item-produto"]').should('contain', 'Camiseta Ecce Agnus');
        cy.get('[data-cy="notificacoes-contador"]').should('not.exist');
        cy.get('[data-cy="abrir-notificacoes"]').click();
        cy.get('[data-cy="notificacao"]').should('not.exist');
        cy.get('[data-cy="painel-notificacoes"]').should('contain', 'Nenhuma notificação no momento');
    });

    it('mostra a foto da peça à esquerda, na tela de pedidos', () => {
        mockPedidos();
        cy.visit('/cliente/pedidos');
        cy.get('[data-cy="ver-pecas"]').click();
        cy.get('[data-cy="item-foto"]').should('have.attr', 'src').and('include', '/produto_fotos/a.jpg');
        cy.get('[data-cy="item-foto"]').then(($foto) => {
            cy.get('[data-cy="item-produto"]').then(($nome) => {
                expect($foto[0].getBoundingClientRect().right).to.be.at.most($nome[0].getBoundingClientRect().left);
            });
        });
    });

    it('alinha notificações curtas e longas à esquerda, com ícone', () => {
        const curta = { ...notificacao, id_notificacao: 4, titulo: 'Pedido enviado', mensagem: 'Saiu.' };
        cy.intercept('GET', '**/notifications/me', { body: { data: [notificacao, curta], naoLidas: 2 } });
        cy.visit('/');
        cy.get('[data-cy="abrir-notificacoes"]').click();
        cy.get('.notificacao-icone svg').should('have.length', 2);
        cy.get('.notificacao-texto').then(($textos) => {
            expect($textos[0].getBoundingClientRect().left).to.eq($textos[1].getBoundingClientRect().left);
        });
    });

    it('aceita meia estrela na nota', () => {
        mockPedidos();
        cy.intercept('POST', '**/product-reviews', { statusCode: 201, body: minhaAvaliacao }).as('avaliar');
        cy.visit('/cliente/pedidos');
        cy.get('[data-cy="ver-pecas"]').click();
        cy.get('[data-cy="avaliar-peca"]').click();
        cy.get('[data-cy="estrela-3.5"]').click();
        cy.get('[data-cy="comentario-avaliacao"]').type('Gostei');
        cy.get('[data-cy="enviar-avaliacao"]').click();
        cy.wait('@avaliar').its('request.body').should('include', { nota: 3.5 });
    });

    it('a área de clique das estrelas fica sobre o desenho, na tela de pedidos', () => {
        mockPedidos();
        cy.visit('/cliente/pedidos');
        cy.get('[data-cy="ver-pecas"]').click();
        cy.get('[data-cy="avaliar-peca"]').click();
        cy.get('.avaliacao-form .estrela').should('have.length', 5).eq(3).then(($estrela) => {
            const caixa = $estrela[0].getBoundingClientRect();
            const y = caixa.top + caixa.height / 2;
            const noPonto = (x) => $estrela[0].ownerDocument.elementFromPoint(x, y).getAttribute('data-cy');
            expect(caixa.width).to.be.at.least(32);
            expect(noPonto(caixa.left + caixa.width * 0.25)).to.eq('estrela-3.5');
            expect(noPonto(caixa.left + caixa.width * 0.75)).to.eq('estrela-4');
        });
    });

    it('não diz que faltam peças enquanto o catálogo ainda carrega', () => {
        cy.intercept('GET', '**/products/catalog*', (req) => {
            req.reply({ delay: 800, body: { data: [], pagination: { totalPages: 1 } } });
        }).as('catalogo');
        cy.visit('/catalogo');
        cy.get('[data-cy="esqueleto-cartao"]').should('exist');
        cy.contains('Nenhuma peça encontrada').should('not.exist');
        cy.wait('@catalogo');
        cy.contains('Nenhuma peça encontrada').should('exist');
        cy.get('[data-cy="esqueleto-cartao"]').should('not.exist');
    });

    it('espera parar de digitar para buscar', () => {
        cy.intercept('GET', '**/products/catalog*search=*', { body: { data: [], pagination: { totalPages: 1 } } }).as('busca');
        cy.visit('/catalogo');
        cy.get('[data-cy="buscar-produto"]').type('camisa', { delay: 10 });
        cy.wait('@busca').its('request.url').should('include', 'search=camisa');
        cy.get('@busca.all').should('have.length', 1);
    });

    it('a lupa abre o catálogo com a busca pronta para digitar', () => {
        cy.visit('/');
        cy.get('[aria-label="Buscar peças"]').click();
        cy.location('pathname').should('eq', '/catalogo');
        cy.focused().should('have.attr', 'data-cy', 'buscar-produto');
    });

    it('volta ao topo ao ir da página inicial para o catálogo', () => {
        cy.visit('/');
        cy.scrollTo('bottom');
        cy.get('main a[href="/catalogo"]').last().click({ force: true });
        cy.location('pathname').should('eq', '/catalogo');
        cy.window().its('scrollY').should('eq', 0);
    });

    it('não mostra a sacola para administrador', () => {
        localStorage.setItem('auth', JSON.stringify({ id_usuario: 1, tipo: 'administrador' }));
        cy.visit('/');
        cy.get('[aria-label="Minha conta"]').should('exist');
        cy.get('.sacola-link').should('not.exist');
    });

    it('deixa avaliar a peça de um pedido entregue só com as estrelas', () => {
        mockPedidos();
        cy.intercept('POST', '**/product-reviews', { statusCode: 201, body: minhaAvaliacao }).as('avaliar');
        cy.visit('/cliente/pedidos');
        cy.get('[data-cy="ver-pecas"]').should('contain', 'Ver peças (1)').click();
        cy.get('[data-cy="avaliar-peca"]').should('contain', 'Avaliar peça').click();
        cy.get('input[type="number"]').should('not.exist');
        cy.get('[data-cy="estrela-4"]').click();
        cy.get('[data-cy="comentario-avaliacao"]').type('Gostei');
        cy.get('[data-cy="enviar-avaliacao"]').click();
        cy.wait('@avaliar').its('request.body').should('include', { nota: 4, id_produto: 1 });
    });

    it('oferece alterar, e não avaliar de novo, quando a peça já foi avaliada', () => {
        mockPedidos([minhaAvaliacao]);
        cy.intercept('PUT', '**/product-reviews/8', { statusCode: 200, body: minhaAvaliacao }).as('alterar');
        cy.visit('/cliente/pedidos');
        cy.get('[data-cy="ver-pecas"]').click();
        cy.get('[data-cy="avaliar-peca"]').should('contain', 'Alterar avaliação').click();
        cy.get('[data-cy="comentario-avaliacao"]').should('have.value', 'Gostei');
        cy.get('[data-cy="estrela-5"]').click();
        cy.get('[data-cy="enviar-avaliacao"]').should('contain', 'Salvar alteração').click();
        cy.wait('@alterar').its('request.body').should('include', { nota: 5 });
    });

    it('na página da peça mostra só a opção de alterar a própria avaliação', () => {
        mockProduto([minhaAvaliacao]);
        cy.visit('/produto/1');
        cy.wait('@reviews');
        cy.get('[data-cy="escrever-avaliacao"]').should('contain', 'Alterar sua avaliação');
    });

    it('abre o pop-up ao colocar a peça na sacola', () => {
        mockProduto();
        cy.intercept('GET', '**/carts?id_usuario=1', { body: [{ id_carrinho: 1 }] });
        cy.intercept('GET', '**/cart-items/1', { body: [] });
        cy.intercept('POST', '**/cart-items', { statusCode: 201, body: {} }).as('adicionar');
        cy.visit('/produto/1');
        cy.wait('@produto');
        cy.get('[data-cy="adicionar-carrinho"]', { timeout: 10000 }).should('not.be.disabled').click();
        cy.wait('@adicionar');
        cy.get('[data-cy="peca-adicionada"]').should('be.visible').and('contain', 'Peça adicionada à sacola').and('contain', 'Camiseta Ecce Agnus');
        cy.get('[data-cy="ir-para-sacola"]').should('have.attr', 'href', '/carrinho');
        cy.get('[data-cy="continuar-escolhendo"]').click();
        cy.get('[data-cy="peca-adicionada"]').should('not.exist');
        cy.get('[data-cy="adicionar-carrinho"]').should('be.visible');
    });
});
