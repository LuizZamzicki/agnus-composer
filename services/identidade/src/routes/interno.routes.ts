import { Request, Response, Router } from "express";
import { marcaDeSessao } from "@agnus/comum/utils/token";
import UsuarioContatos from "../models/UsuarioContatos";
import UsuarioEnderecos from "../models/UsuarioEnderecos";
import Usuarios from "../models/Usuarios";

const router = Router();

router.get("/usuarios/:id", async (req: Request, res: Response) => {
  const usuario = await Usuarios.findByPk(Number(req.params.id));

  return usuario
    ? res.status(200).json({
        id_usuario: usuario.id_usuario,
        nome: usuario.nome,
        email: usuario.email,
        tipo: usuario.tipo,
        // Os outros serviços comparam com a marca do token: troca de senha derruba a sessão em todos.
        sessao: marcaDeSessao(usuario.senha),
        // Só o login com Google comprova o e-mail; o cadastro com senha não confirma.
        email_verificado: Boolean(usuario.google_id),
      })
    : res.status(404).json({ message: "Usuário não encontrado." });
});

router.get("/enderecos/:id", async (req: Request, res: Response) => {
  const endereco = await UsuarioEnderecos.findByPk(Number(req.params.id));

  return endereco
    ? res.status(200).json({ id_usuario_endereco: endereco.id_usuario_endereco, id_usuario: endereco.id_usuario, cep: endereco.cep })
    : res.status(404).json({ message: "Endereço não encontrado." });
});

// Dados para o fornecedor (YouDraw) produzir e entregar: destinatário e endereço completos do pedido.
// Só rota interna (o gateway não publica /internal); quem chama é o serviço de pedidos.
router.get("/entrega/:idEndereco", async (req: Request, res: Response) => {
  const endereco = await UsuarioEnderecos.findByPk(Number(req.params.idEndereco));
  const usuario = endereco ? await Usuarios.findByPk(endereco.id_usuario) : null;

  if (!endereco || !usuario) {
    return res.status(404).json({ message: "Endereço não encontrado." });
  }

  // Telefone: celular principal, senão qualquer celular/telefone.
  const contatos = await UsuarioContatos.findAll({ where: { id_usuario: usuario.id_usuario } });
  const telefones = contatos.filter((c) => c.tipo === "celular" || c.tipo === "telefone");
  const telefone = (telefones.find((c) => c.principal && c.tipo === "celular") ?? telefones.find((c) => c.tipo === "celular") ?? telefones[0])?.valor ?? null;

  return res.status(200).json({
    id_usuario: usuario.id_usuario,
    nome: usuario.nome,
    cpf: usuario.cpf,
    email: usuario.email,
    telefone,
    endereco: {
      cep: endereco.cep,
      logradouro: endereco.logradouro,
      numero: endereco.numero,
      complemento: endereco.complemento,
      bairro: endereco.bairro,
      cidade: endereco.cidade,
      estado: endereco.estado,
    },
  });
});

export default router;
