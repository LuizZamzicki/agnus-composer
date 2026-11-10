import { Request, Response, Router } from "express";
import UsuarioEnderecos from "../models/UsuarioEnderecos";
import Usuarios from "../models/Usuarios";

const router = Router();

router.get("/usuarios/:id", async (req: Request, res: Response) => {
  const usuario = await Usuarios.findByPk(Number(req.params.id));

  return usuario
    ? res.status(200).json({ id_usuario: usuario.id_usuario, email: usuario.email, tipo: usuario.tipo })
    : res.status(404).json({ message: "Usuário não encontrado." });
});

router.get("/enderecos/:id", async (req: Request, res: Response) => {
  const endereco = await UsuarioEnderecos.findByPk(Number(req.params.id));

  return endereco
    ? res.status(200).json({ id_usuario_endereco: endereco.id_usuario_endereco, id_usuario: endereco.id_usuario })
    : res.status(404).json({ message: "Endereço não encontrado." });
});

export default router;
