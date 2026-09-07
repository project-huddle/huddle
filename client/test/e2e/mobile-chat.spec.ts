import {
	expect,
	test,
	type APIRequestContext,
	type Page,
} from "@playwright/test";

const apiOrigin = "http://127.0.0.1:3000";

async function register(request: APIRequestContext, prefix: string) {
	const account = {
		email: `${prefix}-${Date.now()}@example.com`,
		displayName: prefix,
		password: "secure-password",
	};
	const response = await request.post(`${apiOrigin}/auth/register`, {
		data: account,
	});
	expect(response.status()).toBe(201);
	return account;
}

async function login(page: Page, account: { email: string; password: string }) {
	await page.goto("/");
	await page.getByLabel("E-mail").fill(account.email);
	await page
		.locator('input[autocomplete="current-password"]')
		.fill(account.password);
	await page.getByRole("button", { name: "entrar" }).click();
	await expect(page.getByText("huddle").first()).toBeVisible();
	await page.getByRole("button", { name: "Abrir navegação" }).click();
	await page.getByRole("button", { name: "Adicionar servidor" }).first().click();
	const addServerDialog = page.getByRole("dialog", {
		name: "Adicionar servidor",
	});
	await expect(
		addServerDialog.getByRole("button", { name: "Entrar com código" }),
	).toBeVisible();
	await addServerDialog.getByRole("button", { name: "Criar servidor" }).click();
	const dialog = page.getByRole("dialog", { name: "Criar servidor" });
	await dialog.getByLabel("Nome").fill("Servidor E2E");
	await dialog.getByRole("button", { name: "Criar", exact: true }).click();
	await expect(page.getByText(/Servidor E2E · #/)).toBeVisible();
}

test.describe("mobile chat", () => {
	test.use({ viewport: { width: 390, height: 844 }, isMobile: true });
	test("opens navigation drawer and changes channel", async ({
		page,
		request,
	}) => {
		const account = await register(request, "mobile-user");
		await login(page, account);
		await expect(page.getByText(/Minha comunidade · #/)).toBeVisible();

		await page.getByRole("button", { name: "Abrir navegação" }).click();
		await expect(
			page.getByRole("dialog", { name: "Navegação do servidor" }),
		).toBeVisible();
		await expect(page.getByText("Canais", { exact: true })).toBeVisible();
		await page.getByRole("button", { name: "geral" }).click();
		await expect(page.getByRole("dialog")).toBeHidden();
		await expect(page.locator("textarea")).toBeEnabled();
	});

	test("sends, edits and reacts to a message", async ({ page, request }) => {
		const account = await register(request, "chat-user");
		await login(page, account);
		const composer = page.locator("textarea");
		await composer.fill("mensagem E2E");
		await composer.press("Enter");
		const message = page.getByText("mensagem E2E");
		await expect(message).toBeVisible();

		const article = message.locator("xpath=ancestor::article");
		await article.hover();
		await article.getByTitle("Editar").click();
		const editDialog = page.getByRole("dialog", {
			name: "Editar mensagem",
		});
		await editDialog.getByRole("textbox").fill("mensagem editada");
		await editDialog.getByRole("button", { name: "Salvar" }).click();
		await expect(page.getByText(/mensagem editada/)).toBeVisible();
		const editedArticle = page
			.getByText(/mensagem editada/)
			.locator("xpath=ancestor::article");
		await editedArticle.hover();
		await editedArticle.getByText("👍").click();
		await expect(editedArticle.getByText(/👍 1/)).toBeVisible();
	});
});
