import { expect, test, type Page } from "@playwright/test";
import { account, signIn, apiOrigin } from "./helpers/private-chat";

async function imageFile(page: Page) {
	const data = await page.evaluate(() => {
		const canvas = document.createElement("canvas");
		canvas.width = 800;
		canvas.height = 400;
		const drawing = canvas.getContext("2d");
		if (!drawing) throw new Error("Canvas unavailable");
		drawing.fillStyle = "#ff0000";
		drawing.fillRect(0, 0, 400, 400);
		drawing.fillStyle = "#0000ff";
		drawing.fillRect(400, 0, 400, 400);
		return canvas.toDataURL("image/png").split(",")[1];
	});
	return {
		name: "two-colors.png",
		mimeType: "image/png",
		buffer: Buffer.from(data, "base64"),
	};
}

test("private chats reuse image, emoji and GIF tools and retain media after reload", async ({
	page,
	request,
}) => {
	const alice = await account(request, "Rich Alice");
	const bob = await account(request, "Rich Bob");
	await request.post(`${apiOrigin}/friends`, {
		headers: { Authorization: `Bearer ${alice.session.token}` },
		data: { identifier: bob.user.id },
	});
	await request.patch(`${apiOrigin}/friends/${alice.user.id}`, {
		headers: { Authorization: `Bearer ${bob.session.token}` },
	});
	await page.route("https://api.giphy.com/v1/gifs/search?*", (route) =>
		route.fulfill({
			json: {
				data: [
					{
						id: "test-gif",
						title: "Test celebration GIF",
						images: {
							original: {
								url: "https://media.giphy.com/media/test/giphy.gif",
							},
							fixed_width_small: {
								url: "https://media.giphy.com/media/test/preview.gif",
							},
						},
					},
				],
			},
		}),
	);
	await signIn(page, alice);
	await page.getByRole("button", { name: "Rich Bob", exact: true }).click();
	await page
		.getByRole("button", { name: "Adicionar emoji", exact: true })
		.click();
	await expect(
		page.getByText("Escolha um emoji", { exact: true }),
	).toBeVisible();
	await expect(page.locator("em-emoji-picker")).toBeVisible();
	await page
		.locator("em-emoji-picker")
		.getByRole("button", { name: "😀", exact: true })
		.first()
		.click();
	await expect(page.getByLabel("Mensagem para Rich Bob")).not.toHaveValue("");
	await page.getByRole("button", { name: "Enviar mensagem privada" }).click();
	await page
		.locator('input[type="file"]')
		.setInputFiles(await imageFile(page));
	await expect(page.getByAltText("two-colors.png")).toBeVisible();
	await page.getByRole("button", { name: "Enviar mensagem privada" }).click();
	await expect(page.locator("article img")).toHaveCount(1);
	await page.getByRole("button", { name: "GIF", exact: true }).click();
	await page.getByPlaceholder("reação, festa, café...").fill("celebration");
	await page.getByRole("button", { name: "buscar", exact: true }).click();
	await page.getByAltText("Test celebration GIF").click();
	await page.getByRole("button", { name: "Enviar mensagem privada" }).click();
	await expect(page.locator("article img")).toHaveCount(2);
	await page.reload();
	await page
		.getByRole("button", {
			name: "Amigos e mensagens privadas",
			exact: true,
		})
		.click();
	await page.getByRole("button", { name: "Rich Bob", exact: true }).click();
	await expect(page.locator("article img")).toHaveCount(2);
});

test("previews and crops profile and server images before uploading", async ({
	page,
	request,
}) => {
	const owner = await account(request, "Crop Owner");
	await request.post(`${apiOrigin}/servers`, {
		headers: { Authorization: `Bearer ${owner.session.token}` },
		data: { name: "Crop Community" },
	});
	await signIn(page, owner);
	await page
		.getByRole("button", {
			name: "Abrir configurações do perfil",
			exact: true,
		})
		.click();
	const profile = page.getByRole("dialog", {
		name: "Configurações",
		exact: true,
	});
	let uploads = 0;
	page.on("request", (request) => {
		if (request.url().endsWith("/uploads") && request.method() === "POST")
			uploads++;
	});
	await profile
		.locator('input[type="file"]')
		.setInputFiles(await imageFile(page));
	const crop = page.getByRole("dialog", {
		name: "Ajustar imagem",
		exact: true,
	});
	await expect(crop.getByAltText("Prévia do recorte")).toBeVisible();
	expect(uploads).toBe(0);
	await crop.getByLabel("Zoom da imagem").fill("1.5");
	await crop.getByLabel("Posição horizontal").fill("-1");
	await crop
		.getByRole("button", { name: "Usar imagem", exact: true })
		.click();
	await expect(crop).toHaveCount(0);
	expect(uploads).toBe(1);
	await profile
		.getByRole("button", { name: "Salvar perfil", exact: true })
		.click();
	await expect(profile.getByText("Perfil atualizado.")).toBeVisible();
	await profile.getByRole("button", { name: "Fechar", exact: true }).click();
	await page.getByRole("button", { name: "Voltar ao servidor" }).click();
	await page
		.getByRole("button", { name: "Configurações do servidor", exact: true })
		.click();
	const server = page.getByRole("dialog", {
		name: "Configurações de Crop Community",
	});
	await server
		.getByLabel("Ícone", { exact: true })
		.setInputFiles(await imageFile(page));
	await crop
		.getByRole("button", { name: "Usar imagem", exact: true })
		.click();
	await expect(crop).toHaveCount(0);
	await server.getByRole("button", { name: "Salvar servidor" }).click();
	await expect(
		server.getByText("Configurações do servidor salvas com sucesso."),
	).toBeVisible();
	await server.getByRole("button", { name: "Fechar", exact: true }).click();
	const icon = page.getByAltText("Ícone de Crop Community");
	await expect(icon).toBeVisible();
	await expect
		.poll(() =>
			icon.evaluate((image: HTMLImageElement) => image.naturalWidth),
		)
		.toBe(512);
});

test("adding friends and logout stay accessible with a long contact list", async ({
	page,
	request,
}) => {
	const owner = await account(request, "Many Friends Owner");
	const friend = await account(request, "Unique Friend");
	const username = `friend_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
	await request.patch(`${apiOrigin}/profile`, {
		headers: { Authorization: `Bearer ${friend.session.token}` },
		data: { username },
	});
	await page.route(`${apiOrigin}/friends`, async (route) => {
		if (route.request().method() !== "GET") return route.continue();
		await route.fulfill({
			json: {
				friendships: Array.from({ length: 100 }, (_, index) => ({
					status: "accepted",
					direction: "outgoing",
					user: {
						...friend.user,
						id: crypto.randomUUID(),
						displayName: `Contact ${index}`,
						username: `contact_${index}`,
						avatarUrl: null,
					},
				})),
			},
		});
	});
	await signIn(page, owner);
	await expect(
		page.getByRole("button", { name: "Adicionar amigos", exact: true }),
	).toBeInViewport();
	await expect(
		page.getByRole("button", { name: "Sair da conta", exact: true }),
	).toBeInViewport();
	await page
		.getByRole("button", { name: "Adicionar amigos", exact: true })
		.click();
	const friends = page.getByRole("dialog", { name: "Amigos", exact: true });
	await friends
		.getByLabel("Nome de usuário ou link de amizade")
		.fill(`@${username}`);
	await friends
		.getByRole("button", { name: "Adicionar amigo", exact: true })
		.click();
	await expect(friends.getByText("Solicitação enviada.")).toBeVisible();
	await friends.getByRole("button", { name: "Fechar", exact: true }).click();
	await page
		.getByRole("button", { name: "Sair da conta", exact: true })
		.click();
	await expect(page.getByLabel("E-mail", { exact: true })).toBeVisible();
});

test("keeps crop preview open when the image upload fails", async ({
	page,
	request,
}) => {
	const owner = await account(request, "Crop Failure");
	await signIn(page, owner);
	await page
		.getByRole("button", {
			name: "Abrir configurações do perfil",
			exact: true,
		})
		.click();
	const profile = page.getByRole("dialog", {
		name: "Configurações",
		exact: true,
	});
	await profile
		.locator('input[type="file"]')
		.setInputFiles(await imageFile(page));
	await page.route(`${apiOrigin}/uploads`, (route) =>
		route.fulfill({
			status: 500,
			json: { error: { message: "Upload indisponível" } },
		}),
	);
	const crop = page.getByRole("dialog", {
		name: "Ajustar imagem",
		exact: true,
	});
	await crop
		.getByRole("button", { name: "Usar imagem", exact: true })
		.click();
	await expect(crop.getByRole("alert")).toHaveText("Upload indisponível");
	await expect(crop).toBeVisible();
	await page.unroute(`${apiOrigin}/uploads`);
	await crop
		.getByRole("button", { name: "Usar imagem", exact: true })
		.click();
	await expect(crop).toHaveCount(0);
});

test("Escape closes only the crop and the same image can be selected again", async ({
	page,
	request,
}) => {
	const owner = await account(request, "Crop Escape");
	await signIn(page, owner);
	await page
		.getByRole("button", {
			name: "Abrir configurações do perfil",
			exact: true,
		})
		.click();
	const profile = page.getByRole("dialog", {
		name: "Configurações",
		exact: true,
	});
	await profile
		.getByLabel("Nome de exibição", { exact: true })
		.fill("Unsaved name");
	const file = await imageFile(page);
	await profile.locator('input[type="file"]').setInputFiles(file);
	const crop = page.getByRole("dialog", {
		name: "Ajustar imagem",
		exact: true,
	});
	await expect(crop).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(crop).toHaveCount(0);
	await expect(profile).toBeVisible();
	await expect(
		profile.getByLabel("Nome de exibição", { exact: true }),
	).toHaveValue("Unsaved name");
	await profile.locator('input[type="file"]').setInputFiles(file);
	await expect(crop).toBeVisible();
});
