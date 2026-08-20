import { isAdult } from "../../core/identity/cpf";

export type AgeVerificationResult = {
  ageGroup: "adult" | "minor";
  provider: "serpro";
};

/** Sends CPF only to the configured Serpro gateway and never returns it. */
export async function verifyAgeWithSerpro(
  cpf: string,
  birthDate: Date,
): Promise<AgeVerificationResult> {
  const endpoint = process.env.SERPRO_AGE_VERIFICATION_URL?.trim();
  const token = process.env.SERPRO_AGE_VERIFICATION_TOKEN?.trim();
  if (!endpoint || !token)
    throw new Error("Serpro age verification is not configured");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      cpf,
      birthDate: birthDate.toISOString().slice(0, 10),
      purpose: "age_verification",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok)
    throw new Error(
      `Serpro age verification failed with status ${response.status}`,
    );
  const payload = (await response.json()) as { matched?: unknown };
  if (payload.matched !== true)
    throw new Error("CPF and birth date could not be verified");
  return {
    ageGroup: isAdult(birthDate) ? "adult" : "minor",
    provider: "serpro",
  };
}
