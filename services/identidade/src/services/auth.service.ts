import argon2 from "argon2";
import crypto from "crypto";
import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
import Usuarios from "../models/Usuarios";
import type { AuthResult, AuthUserPayload } from "@agnus/comum/types/auth.types";
import type { GoogleTokenResponse, GoogleUserInfo } from "../types/google-oauth.types";
import type { UsuarioPublicData } from "@agnus/comum/types/user.types";

class AuthService {
  private static getJwtSecret() {
    return process.env.JWT_SECRET!;
  }

  private static getJwtExpiresIn() {
    return process.env.JWT_EXPIRES_IN!;
  }

  private static getOAuthStateSecret() {
    return process.env.GOOGLE_STATE_SECRET!;
  }

  private static getGoogleClientId() {
    return process.env.GOOGLE_CLIENT_ID!;
  }

  private static getGoogleClientSecret() {
    return process.env.GOOGLE_CLIENT_SECRET!;
  }

  /**
   * O app mobile precisa de um callback público (ngrok); o site volta pelo nginx local,
   * evitando a página de aviso do ngrok. Sem GOOGLE_REDIRECT_URI_WEB, usa o mesmo para os dois.
   */
  private static getGoogleRedirectUri(appRedirect?: string) {
    if (appRedirect) {
      return process.env.GOOGLE_REDIRECT_URI!;
    }

    return process.env.GOOGLE_REDIRECT_URI_WEB || process.env.GOOGLE_REDIRECT_URI!;
  }

  private static getGoogleScopes() {
    return process.env.GOOGLE_OAUTH_SCOPES!;
  }

  private static ensureGoogleOAuthConfig() {
    if (!AuthService.getGoogleClientId() || !AuthService.getGoogleClientSecret()) {
      throw new Error("Google OAuth não configurado. Defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET.");
    }
  }

  static sanitizeUser(user: Usuarios): UsuarioPublicData {
    return {
      id_usuario: user.id_usuario,
      nome: user.nome,
      cpf: user.cpf,
      email: user.email,
      google_id: user.google_id,
      tipo: user.tipo,
      data_criacao: user.data_criacao,
      data_alteracao: user.data_alteracao,
    };
  }

  private static buildAuthPayload(user: Usuarios): AuthUserPayload {
    return {
      id_usuario: user.id_usuario,
      email: user.email,
      tipo: user.tipo,
    };
  }

  private static buildAuthResponse(user: Usuarios): AuthResult {
    const payload = AuthService.buildAuthPayload(user);

    return {
      user: AuthService.sanitizeUser(user),
      token: AuthService.signToken(payload),
    };
  }

  static signToken(payload: AuthUserPayload) {
    const options: SignOptions = {
      expiresIn: AuthService.getJwtExpiresIn() as SignOptions["expiresIn"],
    };

    return jwt.sign(payload, AuthService.getJwtSecret(), options);
  }

  static verifyToken(token: string): AuthUserPayload | null {
    try {
      const decoded = jwt.verify(token, AuthService.getJwtSecret()) as JwtPayload & AuthUserPayload;

      return decoded.id_usuario && decoded.email && decoded.tipo
        ? {
            id_usuario: decoded.id_usuario,
            email: decoded.email,
            tipo: decoded.tipo,
          }
        : null;
    } catch {
      return null;
    }
  }

  private static async isValidPassword(user: Usuarios, password: string) {
    return argon2.verify(user.senha, password);
  }

  static async authenticate(email: string, password: string) {
    const user = await Usuarios.findOne({ where: { email } });

    if (!user || !(await AuthService.isValidPassword(user, password))) {
      return null;
    }

    return AuthService.buildAuthResponse(user);
  }

  private static buildGoogleState(redirect?: string, clientNonce?: string) {
    return jwt.sign(
      {
        nonce: crypto.randomBytes(16).toString("hex"),
        provider: "google",
        ...(redirect ? { redirect } : {}),
        ...(clientNonce ? { clientNonce } : {}),
      },
      AuthService.getOAuthStateSecret(),
      { expiresIn: "10m" },
    );
  }

  /**
   * @param redirect URL de retorno do app (mobile). Vai embutida no `state` e o
   *   callback redireciona pra ela com `?token=`. Sem isso, fluxo web normal.
   * @param clientNonce Gerado pelo site antes de ir ao Google e devolvido no
   *   retorno, para o navegador só aceitar um login que ele mesmo começou.
   */
  static buildGoogleAuthorizationUrl(redirect?: string, clientNonce?: string) {
    AuthService.ensureGoogleOAuthConfig();
    const params = new URLSearchParams({
      client_id: AuthService.getGoogleClientId(),
      redirect_uri: AuthService.getGoogleRedirectUri(redirect),
      response_type: "code",
      scope: AuthService.getGoogleScopes(),
      access_type: "offline",
      prompt: "consent",
      state: AuthService.buildGoogleState(redirect, clientNonce),
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  private static verifyGoogleState(state: string) {
    try {
      const decoded = jwt.verify(state, AuthService.getOAuthStateSecret()) as JwtPayload;
      return decoded.provider === "google";
    } catch {
      return false;
    }
  }

  /** Redirect do app embutido no `state`, se o token for válido. Não lança. */
  static peekGoogleStateRedirect(state: string): string | undefined {
    try {
      const decoded = jwt.verify(state, AuthService.getOAuthStateSecret()) as JwtPayload;
      return typeof decoded.redirect === "string" ? decoded.redirect : undefined;
    } catch {
      return undefined;
    }
  }

  private static peekGoogleStateClientNonce(state: string): string | undefined {
    try {
      const decoded = jwt.verify(state, AuthService.getOAuthStateSecret()) as JwtPayload;
      return typeof decoded.clientNonce === "string" ? decoded.clientNonce : undefined;
    } catch {
      return undefined;
    }
  }

  private static ensureValidGoogleState(state: string) {
    if (!AuthService.verifyGoogleState(state)) {
      throw new Error("Estado OAuth inválido ou expirado.");
    }
  }

  private static async fetchJson<T>(url: string, init: RequestInit, errorPrefix: string) {
    const response = await fetch(url, init);

    if (response.ok) {
      return (await response.json()) as T;
    }

    throw new Error(`${errorPrefix}: ${response.status} ${await response.text()}`);
  }

  private static async exchangeGoogleCodeForToken(code: string, appRedirect?: string) {
    const body = new URLSearchParams({
      code,
      client_id: AuthService.getGoogleClientId(),
      client_secret: AuthService.getGoogleClientSecret(),
      redirect_uri: AuthService.getGoogleRedirectUri(appRedirect),
      grant_type: "authorization_code",
    });

    return AuthService.fetchJson<GoogleTokenResponse>(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      },
      "Falha ao obter token Google",
    );
  }

  private static async fetchGoogleUserInfo(accessToken: string) {
    return AuthService.fetchJson<GoogleUserInfo>(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      "Falha ao obter perfil Google",
    );
  }

  private static ensureVerifiedGoogleEmail(googleUser: GoogleUserInfo) {
    if (!googleUser.email || !googleUser.email_verified) {
      throw new Error("Conta Google sem email verificado.");
    }
  }

  private static async fetchVerifiedGoogleUser(code: string, appRedirect?: string) {
    const tokenResponse = await AuthService.exchangeGoogleCodeForToken(code, appRedirect);
    const googleUser = await AuthService.fetchGoogleUserInfo(tokenResponse.access_token);
    AuthService.ensureVerifiedGoogleEmail(googleUser);
    return googleUser;
  }

  private static async findGoogleUser(googleUser: GoogleUserInfo) {
    const userByGoogle = await Usuarios.findOne({ where: { google_id: googleUser.sub } });
    return userByGoogle || Usuarios.findOne({ where: { email: googleUser.email } });
  }

  private static async createGoogleUser(googleUser: GoogleUserInfo) {
    const randomPassword = crypto.randomBytes(32).toString("hex");
    const hashedPassword = await argon2.hash(randomPassword, { type: argon2.argon2id });

    return Usuarios.create({
      nome: googleUser.name,
      email: googleUser.email,
      senha: hashedPassword,
      tipo: "cliente",
      google_id: googleUser.sub,
    });
  }

  // O cadastro local nao comprova o e-mail: quem criou a conta antes pode nao ser o dono dele.
  // Por isso a primeira vinculacao descarta a senha existente, e so o Google continua dando acesso.
  private static async linkGoogleAccount(user: Usuarios, googleId: string) {
    await user.update({
      google_id: googleId,
      senha: await argon2.hash(crypto.randomBytes(32).toString("hex"), { type: argon2.argon2id }),
    });

    return user;
  }

  private static async syncGoogleId(user: Usuarios, googleId: string) {
    if (!user.google_id) {
      return AuthService.linkGoogleAccount(user, googleId);
    }

    if (user.google_id !== googleId) {
      await user.update({ google_id: googleId });
    }

    return user;
  }

  private static async findOrCreateGoogleUser(googleUser: GoogleUserInfo) {
    const user = await AuthService.findGoogleUser(googleUser);

    if (!user) {
      return AuthService.createGoogleUser(googleUser);
    }

    return AuthService.syncGoogleId(user, googleUser.sub);
  }

  static async authenticateWithGoogle(code: string, state: string) {
    AuthService.ensureGoogleOAuthConfig();
    AuthService.ensureValidGoogleState(state);
    // O Google exige na troca do código o mesmo redirect_uri da autorização; o state assinado diz qual foi.
    const appRedirect = AuthService.peekGoogleStateRedirect(state);
    const googleUser = await AuthService.fetchVerifiedGoogleUser(code, appRedirect);
    const user = await AuthService.findOrCreateGoogleUser(googleUser);
    return {
      ...AuthService.buildAuthResponse(user),
      redirect: appRedirect,
      clientNonce: AuthService.peekGoogleStateClientNonce(state),
    };
  }
}

export default AuthService;
