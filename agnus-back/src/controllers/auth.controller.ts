import { Request, Response } from "express";
import { AuthenticatedResponseLocals } from "../middlewares/auth.middleware";
import Usuarios from "../models/Usuarios";
import AuthService from "../services/auth.service";
import type { ErrorLike } from "../types/errors.types";
import { isValidEmail } from "../utils/userValidation";

type AuthResponse = Response<object, AuthenticatedResponseLocals>;

class AuthController {
  private static getFrontendUrl() {
    return process.env.FRONTEND_URL || "http://localhost:3001";
  }

  /**
   * Esquemas de retorno aceitos pro app mobile. O `state` carrega um JWT
   * assinado, mas o token de sessão vai na query da URL de retorno — sem
   * allowlist isso seria open redirect com vazamento de token.
   */
  private static readonly APP_REDIRECT_ALLOWLIST = [
    "exp://",
    "exp+",
    "agnusapp://",
    "http://localhost",
    "http://127.0.0.1",
  ];

  private static sanitizeAppRedirect(raw: unknown): string | undefined {
    if (typeof raw !== "string" || !raw) {
      return undefined;
    }

    return AuthController.APP_REDIRECT_ALLOWLIST.some((prefix) => raw.startsWith(prefix))
      ? raw
      : undefined;
  }

  private static redirectBase(appRedirect?: string) {
    const base = appRedirect ?? `${AuthController.getFrontendUrl()}/login`;
    return `${base}${base.includes("?") ? "&" : "?"}`;
  }

  private static buildLoginSuccessRedirect(token: string, tipo: string, appRedirect?: string) {
    const params = new URLSearchParams({ token, tipo, success: "1" });
    return `${AuthController.redirectBase(appRedirect)}${params.toString()}`;
  }

  private static buildLoginErrorRedirect(message: string, appRedirect?: string) {
    return `${AuthController.redirectBase(appRedirect)}error=${encodeURIComponent(message)}`;
  }

  private static getGoogleErrorRedirect(query: Request["query"]) {
    if (!query.error) {
      return null;
    }

    const appRedirect = AuthController.sanitizeAppRedirect(
      AuthService.peekGoogleStateRedirect(String(query.state ?? "")),
    );

    return AuthController.buildLoginErrorRedirect(
      `Google OAuth retornou erro: ${String(query.error)}`,
      appRedirect,
    );
  }

  private static getGoogleCallbackParams(query: Request["query"]) {
    const { code, state } = query;

    return typeof code === "string" && typeof state === "string"
      ? { code, state }
      : null;
  }

  private static getErrorMessage(error: ErrorLike, fallback: string) {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === "string") {
      return error;
    }

    if (
      error &&
      typeof error === "object" &&
      "message" in error &&
      typeof error.message === "string"
    ) {
      return error.message;
    }

    return fallback;
  }

  private static async buildGoogleSuccessRedirect(code: string, state: string) {
    const authResult = await AuthService.authenticateWithGoogle(code, state);

    return AuthController.buildLoginSuccessRedirect(
      authResult.token,
      authResult.user.tipo,
      AuthController.sanitizeAppRedirect(authResult.redirect),
    );
  }

  static async login(req: Request, res: Response) {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ message: "Email e senha sao obrigatorios." });
    }

    if (!isValidEmail(String(email))) {
      return res.status(400).json({ message: "email invalido." });
    }

    const authResult = await AuthService.authenticate(email, senha);

    if (authResult) {
      return res.status(200).json(authResult);
    }

    return res.status(401).json({
      message: "Credenciais invalidas.",
    });
  }

  static async me(req: Request, res: AuthResponse) {
    const authUser = res.locals.authUser;

    if (!authUser) {
      return res.status(401).json({ message: "Nao autenticado." });
    }

    const user = await Usuarios.findByPk(authUser.id_usuario);

    if (!user) {
      return res.status(404).json({ message: "Usuario nao encontrado." });
    }

    return res.status(200).json({ user: AuthService.sanitizeUser(user) });
  }

  static async googleStart(req: Request, res: Response) {
    try {
      const appRedirect = AuthController.sanitizeAppRedirect(req.query.redirect);
      return res.redirect(AuthService.buildGoogleAuthorizationUrl(appRedirect));
    } catch (error) {
      return res.status(500).json({
        message: AuthController.getErrorMessage(
          error as ErrorLike,
          "Falha ao iniciar login com Google.",
        ),
      });
    }
  }

  static async googleCallback(req: Request, res: Response) {
    const errorRedirect = AuthController.getGoogleErrorRedirect(req.query);
    const params = AuthController.getGoogleCallbackParams(req.query);

    if (errorRedirect) {
      return res.redirect(errorRedirect);
    }

    if (!params) {
      return res.redirect(AuthController.buildLoginErrorRedirect("Parametros OAuth invalidos."));
    }

    try {
      return res.redirect(
        await AuthController.buildGoogleSuccessRedirect(params.code, params.state),
      );
    } catch (error) {
      return res.redirect(
        AuthController.buildLoginErrorRedirect(
          AuthController.getErrorMessage(
            error as ErrorLike,
            "Falha no callback do Google OAuth.",
          ),
          AuthController.sanitizeAppRedirect(AuthService.peekGoogleStateRedirect(params.state)),
        ),
      );
    }
  }
}

export default AuthController;
