import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const apiOrigin = "http://127.0.0.1:3000";

async function account(request: APIRequestContext, name: string) {
	const response = await request.post(`${apiOrigin}/auth/register`, {
		data: { email: `${name}-${crypto.randomUUID()}@example.com`, displayName: name, password: "secure-password" },
	});
	expect(response.status()).toBe(201);
	return response.json() as Promise<{ user: { id: string; displayName: string }; session: { token: string } }>;
}

async function signIn(page: Page, session: Awaited<ReturnType<typeof account>>) {
	await page.addInitScript((value) => {
		localStorage.setItem("auth-session", JSON.stringify({ state: { ...value, token: value.session.token, isAuthenticated: true }, version: 1 }));
	}, session);
	await page.goto("/");
	await page.getByRole("button", { name: "Amigos e mensagens privadas", exact: true }).click();
}

test("opens private conversations from Huddle and receives messages live", async ({ page, browser, request }) => {
	const alice = await account(request, "Private Alice");
	const bob = await account(request, "Private Bob");
	await request.post(`${apiOrigin}/friends`, { headers: { Authorization: `Bearer ${alice.session.token}` }, data: { identifier: bob.user.id } });
	await request.patch(`${apiOrigin}/friends/${alice.user.id}`, { headers: { Authorization: `Bearer ${bob.session.token}` } });
	const bobContext = await browser.newContext();
	const bobPage = await bobContext.newPage();
	try {
		await signIn(page, alice);
		await signIn(bobPage, bob);
		await page.getByRole("button", { name: "Private Bob", exact: true }).click();
		await bobPage.getByRole("button", { name: "Private Alice", exact: true }).click();
		await page.getByLabel("Mensagem para Private Bob").fill("Olá no privado");
		await page.getByRole("button", { name: "Enviar mensagem privada" }).click();
		await expect(bobPage.getByText("Olá no privado", { exact: true })).toBeVisible();
		await bobPage.getByLabel("Mensagem para Private Alice").fill("Recebi sua mensagem");
		await bobPage.getByRole("button", { name: "Enviar mensagem privada" }).click();
		await expect(page.getByText("Recebi sua mensagem", { exact: true })).toBeVisible();
		await expect(page.getByRole("dialog")).toHaveCount(0);
	} finally {
		await bobContext.close();
	}
});
