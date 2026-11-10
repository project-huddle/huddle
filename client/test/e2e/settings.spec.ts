import { expect, test } from "@playwright/test";
import { account, signIn, apiOrigin } from "./helpers/private-chat";

test("persists profile and server names through the organized settings menus", async ({
	page,
	request,
}) => {
	const owner = await account(request, "Settings Owner");
	const response = await request.post(`${apiOrigin}/servers`, {
		headers: { Authorization: `Bearer ${owner.session.token}` },
		data: { name: "Settings Community" },
	});
	expect(response.status()).toBe(201);
	await signIn(page, owner);
	await page
		.getByRole("button", { name: "Configurações de perfil", exact: true })
		.click();
	const profile = page.getByRole("dialog", {
		name: "Configurações",
		exact: true,
	});
	await profile.getByLabel("Nome de usuário").fill("");
	await profile
		.getByLabel("Nome de usuário")
		.pressSequentially("Renamed Owner", { delay: 20 });
	await expect(profile.getByLabel("Nome de usuário")).toBeFocused();
	await profile
		.getByRole("button", { name: "Salvar perfil", exact: true })
		.click();
	await expect(
		profile.getByText("Perfil atualizado.", { exact: true }),
	).toBeVisible();
	await profile
		.getByRole("button", { name: "Segurança e sessão", exact: true })
		.click();
	await expect(
		profile.getByRole("heading", { name: "Senha e sessão", exact: true }),
	).toBeVisible();
	await profile.getByRole("button", { name: "Fechar", exact: true }).click();
	await page
		.getByRole("button", { name: "Voltar ao servidor", exact: true })
		.click();
	await page
		.getByRole("button", { name: "Configurações do servidor", exact: true })
		.click();
	const server = page.getByRole("dialog", {
		name: /Configurações de /,
	});
	await server.getByLabel("Nome do servidor").fill("Renamed Community");
	await server.getByLabel("Nome do servidor").press("Enter");
	await expect(
		server.getByText("Configurações do servidor salvas com sucesso.", {
			exact: true,
		}),
	).toBeVisible();
	await server.getByRole("button", { name: "Fechar", exact: true }).click();
	await page.reload();
	await expect(
		page.getByText("Renamed Community", { exact: true }).first(),
	).toBeVisible();
	await expect(
		page.getByText("Renamed Owner", { exact: true }).first(),
	).toBeVisible();
});

test("keeps contacts, conversations and settings within the mobile viewport", async ({
	page,
	request,
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	const owner = await account(request, "Mobile Private Owner");
	const friend = await account(request, "Mobile Private Friend");
	await request.post(`${apiOrigin}/friends`, {
		headers: { Authorization: `Bearer ${owner.session.token}` },
		data: { identifier: friend.user.id },
	});
	await request.patch(`${apiOrigin}/friends/${owner.user.id}`, {
		headers: { Authorization: `Bearer ${friend.session.token}` },
	});
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
	}, owner);
	await page.goto("/");
	await page
		.getByRole("button", { name: "Abrir navegação", exact: true })
		.click();
	await page
		.getByRole("button", {
			name: "Amigos e mensagens privadas",
			exact: true,
		})
		.first()
		.click();
	await page
		.getByRole("button", { name: "Mobile Private Friend", exact: true })
		.click();
	await expect(
		page.getByLabel("Mensagem para Mobile Private Friend"),
	).toBeVisible();
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= window.innerWidth,
		),
	).toBe(true);
	await page
		.getByRole("button", { name: "Voltar aos contatos", exact: true })
		.click();
	await page
		.getByRole("button", { name: "Configurações de perfil", exact: true })
		.click();
	const dialog = page.getByRole("dialog", {
		name: "Configurações",
		exact: true,
	});
	await expect(dialog.getByLabel("Nome de usuário")).toBeVisible();
	await dialog
		.getByRole("button", { name: "Segurança e sessão", exact: true })
		.click();
	expect(
		await dialog.evaluate(
			(element) => element.scrollWidth <= element.clientWidth,
		),
	).toBe(true);
});
