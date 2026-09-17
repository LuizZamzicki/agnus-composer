import type { UserRole } from "../types/user.types";

export const PERMISSIONS = {
  USUARIO_LISTAR: "usuarios:listar",
  USUARIO_EXCLUIR: "usuarios:excluir",

  CATEGORIA_CRIAR: "categorias:criar",
  CATEGORIA_EDITAR: "categorias:editar",
  CATEGORIA_EXCLUIR: "categorias:excluir",

  PRODUTO_CRIAR: "produtos:criar",
  PRODUTO_EDITAR: "produtos:editar",
  PRODUTO_EXCLUIR: "produtos:excluir",

  PRODUTO_COR_CRIAR: "produto-cores:criar",
  PRODUTO_COR_EDITAR: "produto-cores:editar",
  PRODUTO_COR_EXCLUIR: "produto-cores:excluir",

  PRODUTO_FOTO_CRIAR: "produto-fotos:criar",
  PRODUTO_FOTO_EDITAR: "produto-fotos:editar",
  PRODUTO_FOTO_EXCLUIR: "produto-fotos:excluir",

  PRODUTO_GRADE_CRIAR: "produto-grades:criar",
  PRODUTO_GRADE_EDITAR: "produto-grades:editar",
  PRODUTO_GRADE_EXCLUIR: "produto-grades:excluir",

  PEDIDO_LISTAR: "pedidos:listar",
  PEDIDO_ATUALIZAR: "pedidos:atualizar",
  PEDIDO_EXCLUIR: "pedidos:excluir",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  administrador: ALL_PERMISSIONS,
  cliente: [],
};

export const getPermissionsForRole = (role: UserRole): readonly Permission[] => {
  return ROLE_PERMISSIONS[role] ?? [];
};
