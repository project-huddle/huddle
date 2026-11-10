import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const apiOrigin = "http://127.0.0.1:3000";

export async function account(request: APIRequestContext, name: string) {
	const response = await request.post(`${apiOrigin}/auth/register`, {
		data: {
			email: `${name.toLowerCase().replaceAll(" ", "-")}-${crypto.randomUUID()}@example.com`,
			displayName: name,
			password: "secure-password",
		},
	});
	expect(response.status()).toBe(201);
	return response.json() as Promise<{
		user: { id: string; displayName: string };
		session: { token: string };
	}>;
}

export async function signIn(
	page: Page,
	session: Awaited<ReturnType<typeof account>>,
) {
	await page.addInitScript((value) => {
		localStorage.setItem(
			"auth-session",
			JSON.stringify({
				state: {
					...value,
					token: value.session.token,
					isAuthenticated: true,
				},
				version: 1,
			}),
		);
	}, session);
	await page.goto("/");
	await page
		.getByRole("button", {
			name: "Amigos e mensagens privadas",
			exact: true,
		})
		.click();
}
