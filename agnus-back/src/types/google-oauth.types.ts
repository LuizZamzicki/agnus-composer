export type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
};

export type GoogleUserInfo = {
  sub: string;
  name: string;
  email: string;
  email_verified: boolean;
  picture?: string;
};

/**
 * Resposta do endpoint `tokeninfo` do Google ao validar um `id_token`
 * (login mobile). Campos booleanos/numericos chegam como string.
 */
export type GoogleIdTokenInfo = {
  iss: string;
  aud: string;
  sub: string;
  email: string;
  email_verified: boolean | string;
  name?: string;
  exp: string;
};
