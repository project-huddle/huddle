import { expect, test } from "@playwright/test";
import { account, signIn, apiOrigin } from "./helpers/private-chat";

test.use({
	launchOptions: {
		args: [
			"--use-fake-device-for-media-stream",
			"--use-fake-ui-for-media-stream",
		],
	},
});

test("keeps a server call connected while browsing private messages", async ({
	page,
	request,
}) => {
	const owner = await account(request, "Navigation Caller");
	const headers = { Authorization: `Bearer ${owner.session.token}` };
	const created = await request.post(`${apiOrigin}/servers`, {
		headers,
		data: { name: "Call Navigation" },
	});
	const { server } = (await created.json()) as { server: { id: string } };
	const channel = await request.post(
		`${apiOrigin}/servers/${server.id}/channels`,
		{ headers, data: { name: "voice-navigation", type: "voice" } },
	);
	expect(channel.status()).toBe(201);
	await signIn(page, owner);
	await page
		.getByRole("button", { name: "Voltar ao servidor", exact: true })
		.click();
	await page
		.getByRole("button", { name: "voice-navigation", exact: true })
		.click();
	await expect(
		page.getByText("1 pessoa conectada", { exact: true }),
	).toBeVisible();
	await page
		.getByRole("button", {
			name: "Amigos e mensagens privadas",
			exact: true,
		})
		.click();
	await expect(
		page.getByRole("heading", { name: "Mensagens privadas", exact: true }),
	).toBeVisible();
	await expect(
		page.getByText("Chamada ativa", { exact: true }),
	).toBeVisible();
	await page.getByRole("button", { name: /Chamada ativa/ }).click();
	await expect(
		page.getByRole("heading", { name: "Chamada do canal", exact: true }),
	).toBeVisible();
	await expect(
		page.getByText("1 pessoa conectada", { exact: true }),
	).toBeVisible();
	await page
		.getByRole("button", { name: "Sair da chamada", exact: true })
		.click();
	await expect(
		page.getByRole("heading", { name: "Chamada do canal", exact: true }),
	).toHaveCount(0);
});
