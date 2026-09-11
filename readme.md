# Projeto Agnus

As pastas do front e back devem ficar exatamente assim:

- agnus-back
- agnus-front

Se precisar regerar certificados, use a sequencia de comandos abaixo

- choco install mkcert
- mkcert agnus
- mkcert -install

coloque os arquivos agnus-key.pem e agnus.pem dentro de uma pasta chamada "certs"

## Docker

Comandos para subir e derrubar containers:

- docker compose down
- docker compose up -d --build
  

Documentação Agnus
Diagrama Entidade Relacionamento:
<img width="1201" height="881" alt="image" src="https://github.com/user-attachments/assets/deb27ce2-020d-4a7e-afa4-34cc931bd0f7" />

Requisitos funcionais:
1) Autenticação e Usuários
RF01: O sistema deve permitir o cadastro de novos usuários com nome, e-mail, CPF, telefone e senha, garantindo que o e-mail seja único.
RF02: O sistema deve permitir que o usuário realize login utilizando e-mail e senha.
RF03: O sistema deve manter a sessão do usuário autenticado ao retornar ao site.
RF04: O sistema deve permitir que o usuário realize logout.
RF05: O sistema deve permitir a visualização dos dados da própria conta.
RF06: O sistema deve permitir a edição dos dados da própria conta.
RF07: O sistema deve suportar diferentes cargos de usuário, incluindo cliente, vendas, atendimento, auditor e administrador.
RF08: O sistema deve associar permissões aos cargos de usuário por meio de controle de acesso baseado em funções (RBAC).
RF09: O sistema deve restringir o acesso às funcionalidades e rotas administrativas conforme as permissões do usuário autenticado.
RF10: O sistema deve permitir a listagem de clientes cadastrados para usuários com permissão.
RF11: O sistema deve permitir a visualização dos detalhes de um usuário específico no painel administrativo.
2) Produtos
RF12: O sistema deve permitir o cadastro de produtos com nome, descrição, preço, estoque, imagem, marca, categoria, ativo e destaque.
RF13: O sistema deve permitir a edição dos dados de produtos existentes.
RF14: O sistema deve permitir a exclusão ou inativação de produtos.
RF15: O sistema deve permitir a listagem paginada de produtos.
RF16: O sistema deve permitir a visualização dos detalhes de um produto específico.
RF17: O sistema deve permitir o envio de uma imagem para cada produto.
RF18: O sistema deve permitir a edição e substituição da imagem de um produto.
RF19: O sistema deve permitir a remoção da imagem associada a um produto.
RF20: O sistema deve exibir a imagem dos produtos na listagem do catálogo.
RF21: O sistema deve exibir a imagem do produto em sua página de detalhes.
RF22: O sistema deve permitir marcar produtos como ativos ou inativos.
RF23: O sistema deve permitir marcar produtos como destaque.
RF24: O sistema deve permitir controlar o estoque disponível de cada produto.
RF25: O sistema deve atualizar o estoque dos produtos após a finalização de um pedido.
RF26: O sistema deve impedir a compra de produtos quando a quantidade solicitada for superior ao estoque disponível.
RF27: O sistema deve exibir produtos em destaque e novidades na página inicial.
RF28: O sistema deve exibir os produtos mais vendidos no painel administrativo.
3) Categorias e Marcas
RF29: O sistema deve permitir o cadastro de categorias de produtos.
RF30: O sistema deve permitir a listagem de categorias cadastradas.
RF31: O sistema deve permitir a edição de categorias existentes.
RF32: O sistema deve permitir a exclusão de categorias.
RF33: O sistema deve permitir o cadastro de marcas de produtos.
RF34: O sistema deve permitir a listagem de marcas cadastradas.
RF35: O sistema deve permitir a edição de marcas existentes.
RF36: O sistema deve permitir a exclusão de marcas.
RF37: O sistema deve exibir as categorias disponíveis na página inicial.
RF38: O sistema deve permitir a navegação dos produtos por categoria.
RF39: O sistema deve permitir a busca e filtragem de produtos por categoria.
RF40: O sistema deve permitir a busca e filtragem de produtos por marca.
4) Catálogo e Busca de Produtos
RF41: O sistema deve disponibilizar um catálogo de produtos para os usuários.
RF42: O sistema deve permitir a consulta dos produtos disponíveis no catálogo.
RF43: O sistema deve permitir a pesquisa de produtos pelo nome ou informações relacionadas ao produto.
RF44: O sistema deve permitir a aplicação de filtros na consulta de produtos.
RF45: O sistema deve permitir a combinação de critérios de busca e filtros para localização dos produtos.
RF46: O sistema deve apresentar informações básicas do produto no catálogo, incluindo nome, imagem e preço.
RF47: O sistema deve permitir que o usuário acesse a página de detalhes de um produto a partir do catálogo.
RF48: O sistema deve apresentar a descrição e demais informações cadastradas do produto em sua página de detalhes.
5) Carrinho de Compras
RF49: O sistema deve permitir adicionar produtos ao carrinho de compras.
RF50: O sistema deve permitir alterar a quantidade de produtos adicionados ao carrinho.
RF51: O sistema deve permitir remover produtos do carrinho.
RF52: O sistema deve permitir visualizar os produtos adicionados ao carrinho.
RF53: O sistema deve calcular automaticamente o subtotal dos itens do carrinho.
RF54: O sistema deve calcular automaticamente o valor total do carrinho.
RF55: O sistema deve validar a disponibilidade dos produtos antes da confirmação da compra.
RF56: O sistema deve validar a quantidade disponível em estoque para cada item do carrinho.
RF57: O sistema deve impedir a inclusão de quantidade superior ao estoque disponível.
RF58: O sistema deve impedir a criação de um pedido quando o carrinho não possuir itens.
RF59: O sistema deve impedir a criação de um pedido quando o carrinho não for encontrado.
6) Pedidos
RF60: O sistema deve permitir a criação de um pedido a partir dos itens do carrinho.
RF61: O sistema deve vincular os produtos e respectivas quantidades ao pedido.
RF62: O sistema deve vincular o usuário responsável ao pedido.
RF63: O sistema deve vincular um endereço de entrega ao pedido.
RF64: O sistema deve registrar o valor total do pedido.
RF65: O sistema deve permitir ao usuário consultar seu histórico de pedidos.
RF66: O sistema deve permitir ao usuário visualizar os detalhes de seus próprios pedidos.
RF67: O sistema deve permitir que usuários com permissão visualizem todos os pedidos cadastrados.
RF68: O sistema deve restringir a visualização de pedidos ao seu proprietário ou a usuários autorizados.
RF69: O sistema deve permitir a atualização do status de um pedido por usuários autorizados.
RF70: O sistema deve trabalhar com os seguintes status de pedido: AGUARDANDO PAGAMENTO, PAGO, ENVIADO, ENTREGUE e CANCELADO.
RF71: O sistema deve permitir o cancelamento de pedidos mediante permissão.
RF72: O sistema deve permitir a exclusão de pedidos mediante permissão.
RF73: O sistema deve permitir a paginação da listagem de pedidos.
RF74: O sistema deve permitir o filtro de pedidos por status.
RF75: O sistema deve exibir a quantidade de novos pedidos no painel administrativo.
RF76: O sistema deve exibir a quantidade total de pedidos no painel administrativo.
7) Endereços
RF77: O sistema deve permitir que o usuário cadastre múltiplos endereços de entrega.
RF78: O sistema deve permitir a visualização dos endereços cadastrados pelo usuário.
RF79: O sistema deve permitir a edição de endereços existentes.
RF80: O sistema deve permitir a exclusão de endereços.
RF81: O sistema deve permitir a seleção de um endereço durante a finalização da compra.
RF82: O sistema deve obrigar a seleção de um endereço de entrega antes da criação do pedido.
RF83: O sistema deve vincular o endereço selecionado ao pedido realizado.
8) Finalização da Compra
RF89: O sistema deve permitir que o usuário inicie a finalização da compra a partir do carrinho.
RF90: O sistema deve validar se o carrinho possui itens antes da finalização.
RF91: O sistema deve validar a disponibilidade dos produtos antes da criação do pedido.
RF92: O sistema deve permitir a seleção do endereço de entrega.
RF93: O sistema deve permitir a seleção da forma de pagamento.
RF94: O sistema deve apresentar ao usuário o resumo da compra antes da confirmação.
RF95: O sistema deve permitir a confirmação do pedido após a validação das informações da compra.
RF96: O sistema deve criar o pedido após a confirmação da compra.
RF97: O sistema deve atualizar o estoque dos produtos após a confirmação do pedido.

9) Painel Administrativo
RF98: O sistema deve disponibilizar um painel administrativo para usuários autorizados.
RF99: O sistema deve apresentar informações resumidas dos pedidos no painel administrativo.
RF100: O sistema deve apresentar a quantidade de novos pedidos no painel administrativo.
RF101: O sistema deve apresentar a quantidade total de pedidos no painel administrativo.
RF102: O sistema deve permitir a consulta dos produtos mais vendidos no painel administrativo.
RF103: O sistema deve permitir o gerenciamento de produtos pelo painel administrativo.
RF104: O sistema deve permitir o gerenciamento de categorias pelo painel administrativo.
RF105: O sistema deve permitir o gerenciamento de marcas pelo painel administrativo.
RF106: O sistema deve permitir o gerenciamento de usuários conforme as permissões do administrador.
RF107: O sistema deve permitir o gerenciamento e atualização dos pedidos por usuários autorizados.

10) Controle de Acesso e Permissões
RF108: O sistema deve identificar o cargo do usuário autenticado.
RF109: O sistema deve verificar as permissões do usuário antes de permitir acesso a funcionalidades administrativas.
RF110: O sistema deve impedir que usuários sem permissão acessem funcionalidades administrativas.
RF111: O sistema deve permitir diferentes níveis de acesso de acordo com o cargo do usuário.
RF112: O sistema deve garantir que clientes tenham acesso somente às funcionalidades permitidas para seu perfil.
RF113: O sistema deve garantir que operações administrativas sejam realizadas somente por usuários autorizados.
11) Página Inicial
RF114: O sistema deve disponibilizar uma página inicial para apresentação da loja AGNUS.
RF115: O sistema deve exibir categorias de produtos na página inicial.
RF116: O sistema deve exibir produtos em destaque na página inicial.
RF117: O sistema deve exibir produtos considerados novidades na página inicial.
RF118: O sistema deve permitir que o usuário acesse produtos e categorias diretamente pela página inicial.

Requisitos não funcionais:
1) Segurança
RNF01: O sistema deve armazenar as senhas dos usuários de forma segura, utilizando algoritmo de hash e nunca armazenando senhas em texto puro.
RNF02: O sistema deve utilizar autenticação baseada em token JWT para identificar usuários autenticados.
RNF03: O sistema deve validar a autenticação e as permissões do usuário antes de permitir o acesso às rotas protegidas.
RNF04: O sistema deve implementar controle de acesso baseado em funções (RBAC), garantindo que cada usuário tenha acesso somente às funcionalidades permitidas para seu cargo.
RNF05: O sistema deve validar os dados recebidos nas requisições antes de realizar qualquer operação no banco de dados.
RNF06: O sistema deve impedir o acesso de usuários não autorizados às funcionalidades administrativas.
RNF07: O sistema deve restringir operações administrativas de acordo com as permissões associadas ao usuário autenticado.
RNF08: O sistema deve tratar erros de forma centralizada, retornando respostas HTTP padronizadas ao frontend.
RNF09: O sistema deve limitar o tamanho e os tipos de arquivos permitidos no upload de imagens de produtos.
RNF10: As credenciais, chaves, URLs e demais informações sensíveis não devem ser armazenadas diretamente no código-fonte.

2) Desempenho e Escalabilidade
RNF11: O sistema deve utilizar paginação nas listagens de produtos, pedidos, usuários e demais registros que possam possuir grande quantidade de dados.
RNF12: O sistema deve evitar o carregamento desnecessário de grandes quantidades de registros em uma única requisição.
RNF13: O backend deve processar as requisições de forma independente, permitindo que múltiplos usuários utilizem o sistema simultaneamente.
RNF14: O sistema deve utilizar o Meilisearch para auxiliar na pesquisa e recuperação de produtos, quando aplicável.
RNF15: O sistema deve ser executado em containers Docker, permitindo a reprodução do ambiente e facilitando futuras ampliações da infraestrutura.
RNF16: O banco de dados deve possuir mecanismo de healthcheck para verificar sua disponibilidade antes que o backend dependa dele.
________________________________________
3) Confiabilidade e Disponibilidade
RNF17: O backend deve disponibilizar um endpoint de healthcheck para verificar o estado de funcionamento da API.
RNF18: O sistema deve verificar a disponibilidade dos serviços necessários antes de iniciar as operações que dependem deles.
RNF19: Os serviços críticos do ambiente Docker devem possuir políticas de reinicialização automática em caso de falha.
RNF20: O sistema deve manter a integridade dos dados durante operações de cadastro, alteração, exclusão e finalização de pedidos.
RNF21: O sistema deve impedir a criação de pedidos inconsistentes, como pedidos sem itens ou sem as informações obrigatórias.
RNF22: O sistema deve retornar mensagens de erro adequadas quando ocorrerem falhas durante uma operação.
________________________________________
4) Manutenibilidade
RNF23: O código do frontend e backend deve ser desenvolvido utilizando TypeScript, proporcionando tipagem estática e maior segurança durante o desenvolvimento.
RNF24: O backend deve seguir uma arquitetura organizada em camadas, separando responsabilidades entre controllers, services, models, routes, validators e middlewares.
RNF25: O sistema deve utilizar ORM para abstração e padronização do acesso ao banco de dados.
RNF26: O código deve ser organizado de forma modular, permitindo a manutenção e evolução independente das funcionalidades.
RNF27: O projeto deve seguir um padrão consistente de nomenclatura para arquivos, funções, classes, componentes e variáveis.
RNF28: O projeto deve utilizar um padrão de commits para manter um histórico de versionamento organizado.
RNF29: O sistema deve possuir testes automatizados para validar as principais funcionalidades do backend e frontend.
RNF30: A configuração do sistema deve ser separada do código-fonte por meio de variáveis de ambiente.
________________________________________
5) Usabilidade
RNF31: O sistema deve apresentar mensagens claras ao usuário quando ocorrerem erros de validação ou falhas durante uma operação.
RNF32: O sistema deve fornecer feedback visual após operações como cadastro, alteração, exclusão, inclusão de produtos no carrinho e finalização de pedidos.
RNF33: A interface deve apresentar uma navegação consistente entre as diferentes páginas do sistema.
RNF34: O painel administrativo deve exibir somente as funcionalidades permitidas para o cargo do usuário autenticado.
RNF35: O sistema deve apresentar informações de produtos de forma clara, incluindo nome, preço, imagem, descrição e disponibilidade quando aplicável.
RNF36: O processo de compra deve apresentar ao usuário as informações necessárias antes da confirmação do pedido.
________________________________________
6) Portabilidade e Infraestrutura
RNF37: O sistema deve ser executado utilizando containers Docker isolados para os principais serviços da aplicação.
RNF38: O ambiente do sistema deve possuir containers independentes para frontend, backend, banco de dados, mecanismo de busca e proxy reverso, conforme a configuração do projeto.
RNF39: O sistema deve utilizar Nginx como proxy reverso para intermediar as requisições entre frontend e backend.
RNF40: O sistema deve utilizar variáveis de ambiente para configurar credenciais, URLs, chaves e demais parâmetros específicos do ambiente.
RNF41: O banco de dados MySQL deve ser executado em container Docker, permitindo a padronização do ambiente de desenvolvimento e implantação.
RNF42: O sistema deve permitir a execução do ambiente por meio da configuração definida no Docker Compose.
________________________________________
7) Compatibilidade
RNF43: O frontend Web deve ser desenvolvido utilizando Next.js e React, sendo compatível com navegadores modernos.
RNF44: O backend deve ser desenvolvido utilizando Node.js e Express.
RNF45: O backend deve ser compatível com o banco de dados MySQL utilizado pelo sistema.
RNF46: A API deve seguir o padrão RESTful para comunicação entre o frontend, aplicativo mobile e backend.
RNF47: A API deve permitir que diferentes clientes, como o sistema Web e o aplicativo Mobile, consumam os mesmos serviços do backend de forma independente.
RNF48: O aplicativo Mobile deve ser desenvolvido utilizando React Native e Expo.
RNF49: O aplicativo Mobile deve ser compatível com os sistemas operacionais Android e iOS.
RNF50: O aplicativo Mobile deve possuir interface responsiva e adaptada para diferentes tamanhos de tela.
RNF51: O aplicativo Mobile deve apresentar uma navegação adequada para dispositivos com interação por toque e gestos.
________________________________________
8) Comunicação e API
RNF52: A comunicação entre frontend, aplicativo Mobile e backend deve ser realizada por meio de uma API RESTful.
RNF53: A API deve utilizar métodos HTTP apropriados para cada operação, como GET, POST, PUT/PATCH e DELETE.
RNF54: A API deve retornar códigos de status HTTP compatíveis com o resultado das operações realizadas.
RNF55: As respostas da API devem possuir estrutura padronizada para facilitar o tratamento das informações pelos clientes.
RNF56: As rotas protegidas da API devem exigir autenticação válida por token JWT.
RNF57: O backend deve permitir a comunicação simultânea entre o frontend Web e o aplicativo Mobile sem dependência direta entre suas interfaces.
________________________________________
9) Banco de Dados e Persistência
RNF58: O sistema deve utilizar MySQL como sistema gerenciador de banco de dados.
RNF59: O acesso ao banco de dados deve ser realizado por meio da camada de persistência definida no backend.
RNF60: O sistema deve manter relacionamentos e restrições de integridade entre usuários, produtos, categorias, marcas, carrinho, pedidos, itens e endereços.
RNF61: O sistema deve garantir a persistência das informações dos pedidos e seus respectivos itens após a finalização da compra.
RNF62: O sistema deve utilizar mecanismos de controle de integridade para evitar registros inconsistentes no banco de dados.
________________________________________
10) Imagens e Arquivos
RNF63: O sistema deve permitir o armazenamento e gerenciamento das imagens associadas aos produtos.
RNF64: O sistema deve aceitar somente formatos de imagem previamente definidos para upload.
RNF65: O sistema deve limitar o tamanho máximo dos arquivos enviados.
RNF66: O sistema deve disponibilizar as imagens dos produtos de forma adequada para exibição no catálogo e na página de detalhes.
RNF67: O sistema deve permitir a substituição e remoção de imagens sem comprometer os demais dados do produto.

Diagramas de casos de uso:

