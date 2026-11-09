#!/bin/sh
# Cria um banco e um usuario por servico e copia os dados do banco antigo (monolito).
# Pode rodar quantas vezes for preciso: tabela que ja existe no destino nao e tocada,
# e o banco de origem so e lido.
set -eu

export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"
ORIGEM="${MYSQL_DATABASE:-agnus}"
sql() { mysql -h mysql -uroot -N -B -e "$1"; }

preparar() {
  sql "CREATE DATABASE IF NOT EXISTS agnus_$1 CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
       CREATE USER IF NOT EXISTS 'svc_$1'@'%' IDENTIFIED BY '$2';
       ALTER USER 'svc_$1'@'%' IDENTIFIED BY '$2';
       GRANT ALL PRIVILEGES ON agnus_$1.* TO 'svc_$1'@'%';"
}

existe() {
  [ "$(sql "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$1' AND table_name='$2'")" = "1" ]
}

# CREATE TABLE ... LIKE nao copia chaves estrangeiras: as internas voltam no sync de cada servico.
copiar() {
  servico="$1"; shift
  for tabela in "$@"; do
    if existe "$ORIGEM" "$tabela" && ! existe "agnus_$servico" "$tabela"; then
      sql "CREATE TABLE agnus_$servico.$tabela LIKE $ORIGEM.$tabela;
           INSERT INTO agnus_$servico.$tabela SELECT * FROM $ORIGEM.$tabela;"
      echo "copiada: $ORIGEM.$tabela -> agnus_$servico"
    fi
  done
}

preparar identidade "$DB_SENHA_IDENTIDADE"
preparar catalogo "$DB_SENHA_CATALOGO"
preparar avaliacoes "$DB_SENHA_AVALIACOES"
preparar carrinho "$DB_SENHA_CARRINHO"
preparar pedidos "$DB_SENHA_PEDIDOS"
preparar notificacoes "$DB_SENHA_NOTIFICACOES"

copiar identidade usuarios usuario_senhas_historico usuario_enderecos usuario_contatos
copiar catalogo categorias produtos produto_cores produto_grades produto_fotos
copiar avaliacoes avaliacao_produtos avaliacao_fotos
copiar carrinho carrinhos carrinho_itens
copiar pedidos pedidos pedido_itens
copiar notificacoes notificacoes

echo "bancos prontos"
