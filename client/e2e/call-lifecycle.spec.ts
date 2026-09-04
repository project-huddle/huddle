import {
	expect,
	test,
	type APIRequestContext,
	type Page,
} from "@playwright/test";

const apiOrigin = "http://127.0.0.1:3000";

type Account = {
	email: string;
	displayName: string;
	password: string;
};

async function register(
	request: APIRequestContext,
	prefix: string,
): Promise<Account> {
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

async function loginAndCreateServer(page: Page, account: Account) {
	await page.goto("/");
	await page.getByLabel("E-mail").fill(account.email);
	await page.locator('input[autocomplete="current-password"]').fill(account.password);
	await page.getByRole("button", { name: "entrar" }).click();
	await expect(page.getByText("huddle").first()).toBeVisible();

	await page.getByRole("button", { name: "Criar servidor" }).first().click();
	const dialog = page.getByRole("dialog", { name: "Criar servidor" });
	await dialog.getByLabel("Nome").fill("Servidor de chamadas");
	await dialog.getByRole("button", { name: "Criar", exact: true }).click();
	await expect(page.getByText(/Servidor de chamadas · #/)).toBeVisible();
}

async function enterCall(page: Page) {
	await page.getByRole("button", { name: "entrar na chamada" }).click();
	await expect(
		page.getByRole("button", { name: "Sair da chamada" }).first(),
	).toBeVisible();
}

test.use({
	launchOptions: {
		args: [
			"--use-fake-device-for-media-stream",
			"--use-fake-ui-for-media-stream",
		],
	},
});

test.describe("call lifecycle", () => {
	test("entra, sai e entra novamente mantendo a mídia local", async ({
		page,
		request,
	}) => {
		const account = await register(request, "call-happy");
		await loginAndCreateServer(page, account);

		await enterCall(page);
		await expect(page.getByRole("dialog", { name: "Chamada da sala" })).toBeVisible();
		await expect(page.locator("video").first()).toBeVisible();

		await page.getByRole("button", { name: "Sair da chamada" }).first().click();
		await expect(page.getByRole("dialog", { name: "Chamada da sala" })).toBeHidden();
		await expect(page.getByRole("button", { name: "entrar na chamada" })).toBeVisible();

		await enterCall(page);
		await expect(page.getByRole("dialog", { name: "Chamada da sala" })).toBeVisible();
		await expect(page.locator("video").first()).toBeVisible();
	});

	test("exibe erro e permanece fora da chamada quando o microfone é negado", async ({
		page,
		request,
	}) => {
		await page.addInitScript(() => {
			Object.defineProperty(navigator, "mediaDevices", {
				configurable: true,
				value: {
					getUserMedia: async () => {
						throw new DOMException("Permission denied", "NotAllowedError");
					},
				},
			});
		});

		const account = await register(request, "call-negative");
		await loginAndCreateServer(page, account);
		await page.getByRole("button", { name: "entrar na chamada" }).click();

		await expect(
			page.getByText("O acesso ao microfone foi negado. Libere a permissão do site no navegador."),
		).toBeVisible();
		await expect(page.getByRole("button", { name: "entrar na chamada" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Sair da chamada" })).toHaveCount(0);
	});
});
