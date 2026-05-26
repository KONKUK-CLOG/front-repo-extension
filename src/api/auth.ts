import { ClogApiClient } from "./client";
import { AuthResponse } from "./types";

export async function exchangeGithubToken(
  client: ClogApiClient,
  githubAccessToken: string,
): Promise<AuthResponse> {
  return client.request<AuthResponse>(
    "/api/auth/github/token",
    {
      method: "POST",
      body: JSON.stringify({ githubAccessToken }),
    },
    { auth: false },
  );
}
