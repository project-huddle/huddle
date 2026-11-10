import {
	expect,
	test,
	type APIRequestContext,
	type Page,
} from "@playwright/test";

const apiOrigin = "http://127.0.0.1:3000";

async function account(request: APIRequestContext, name: string) {
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

async function signIn(
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

test.use({
	launchOptions: {
		args: [
			"--use-fake-device-for-media-stream",
			"--use-fake-ui-for-media-stream",
		],
	},
});

test("opens private conversations from Huddle and receives messages live", async ({
	page,
	browser,
	request,
}) => {
	const alice = await account(request, "Private Alice");
	const bob = await account(request, "Private Bob");
	await request.post(`${apiOrigin}/friends`, {
		headers: { Authorization: `Bearer ${alice.session.token}` },
		data: { identifier: bob.user.id },
	});
	await request.patch(`${apiOrigin}/friends/${alice.user.id}`, {
		headers: { Authorization: `Bearer ${bob.session.token}` },
	});
	const bobContext = await browser.newContext();
	const bobPage = await bobContext.newPage();
	try {
		await signIn(page, alice);
		await signIn(bobPage, bob);
		await page
			.getByRole("button", { name: "Private Bob", exact: true })
			.click();
		await bobPage
			.getByRole("button", { name: "Private Alice", exact: true })
			.click();
		await page
			.getByLabel("Mensagem para Private Bob")
			.fill("Olá no privado");
		await page
			.getByRole("button", { name: "Enviar mensagem privada" })
			.click();
		await expect(
			bobPage.getByText("Olá no privado", { exact: true }),
		).toBeVisible();
		await bobPage
			.getByLabel("Mensagem para Private Alice")
			.fill("Recebi sua mensagem");
		await bobPage
			.getByRole("button", { name: "Enviar mensagem privada" })
			.click();
		await expect(
			page.getByText("Recebi sua mensagem", { exact: true }),
		).toBeVisible();
		await expect(page.getByRole("dialog")).toHaveCount(0);
	} finally {
		await bobContext.close();
	}
});

test("accepts and ends private calls between friends", async ({
	page,
	browser,
	request,
}) => {
	const alice = await account(request, "Caller Alice");
	const bob = await account(request, "Callee Bob");
	await request.post(`${apiOrigin}/friends`, {
		headers: { Authorization: `Bearer ${alice.session.token}` },
		data: { identifier: bob.user.id },
	});
	await request.patch(`${apiOrigin}/friends/${alice.user.id}`, {
		headers: { Authorization: `Bearer ${bob.session.token}` },
	});
	const bobContext = await browser.newContext({
		permissions: ["microphone", "camera"],
	});
	const bobPage = await bobContext.newPage();
	try {
		await signIn(page, alice);
		await signIn(bobPage, bob);
		await page
			.getByRole("button", { name: "Callee Bob", exact: true })
			.click();
		await page
			.getByRole("button", { name: "Ligar para Callee Bob" })
			.click();
		await bobPage.getByRole("button", { name: "Recusar chamada" }).click();
		await expect(page.getByText("Chamando Callee Bob...")).toHaveCount(0);
		await page
			.getByRole("button", { name: "Ligar para Callee Bob" })
			.click();
		await bobPage.getByRole("button", { name: "Aceitar chamada" }).click();
		await expect(
			page.getByRole("heading", { name: "Chamada privada", exact: true }),
		).toBeVisible();
		await expect(
			bobPage.getByRole("heading", {
				name: "Chamada privada",
				exact: true,
			}),
		).toBeVisible();
		await expect(
			page.getByText("2 pessoas conectadas", { exact: true }),
		).toBeVisible();
		await expect(
			bobPage.getByText("2 pessoas conectadas", { exact: true }),
		).toBeVisible();
		await page
			.getByRole("button", { name: "Silenciar", exact: true })
			.click();
		await expect(
			page.getByRole("button", { name: "Ativar microfone", exact: true }),
		).toBeVisible();
		await page
			.getByRole("button", { name: "Sair da chamada", exact: true })
			.click();
		await expect(
			bobPage.getByRole("heading", {
				name: "Chamada privada",
				exact: true,
			}),
		).toHaveCount(0);
	} finally {
		await bobContext.close();
	}
});

async function simulateScreenWithAudio(page: Page) {
	await page.addInitScript(() => {
		Object.defineProperty(navigator.mediaDevices, "getDisplayMedia", {
			value: async () => {
				const canvas = document.createElement("canvas");
				canvas.width = 640;
				canvas.height = 360;
				const drawing = canvas.getContext("2d");
				if (!drawing) throw new Error("Canvas unavailable");
				drawing.fillStyle = "#00ff00";
				drawing.fillRect(0, 0, canvas.width, canvas.height);
				const video = canvas.captureStream(10);
				const audio = new AudioContext();
				const oscillator = audio.createOscillator();
				const destination = audio.createMediaStreamDestination();
				oscillator.connect(destination);
				oscillator.start();
				await audio.resume();
				return new MediaStream([
					...video.getVideoTracks(),
					...destination.stream.getAudioTracks(),
				]);
			},
		});
	});
}

test("transmits screen audio separately from the microphone and removes it when stopped", async ({
	page,
	browser,
	request,
}) => {
	const alice = await account(request, "Screen Alice");
	const bob = await account(request, "Screen Bob");
	await request.post(`${apiOrigin}/friends`, {
		headers: { Authorization: `Bearer ${alice.session.token}` },
		data: { identifier: bob.user.id },
	});
	await request.patch(`${apiOrigin}/friends/${alice.user.id}`, {
		headers: { Authorization: `Bearer ${bob.session.token}` },
	});
	const bobContext = await browser.newContext({
		permissions: ["microphone", "camera"],
	});
	const bobPage = await bobContext.newPage();
	try {
		await simulateScreenWithAudio(page);
		await signIn(page, alice);
		await signIn(bobPage, bob);
		await page
			.getByRole("button", { name: "Screen Bob", exact: true })
			.click();
		await page
			.getByRole("button", { name: "Ligar para Screen Bob" })
			.click();
		await bobPage.getByRole("button", { name: "Aceitar chamada" }).click();
		await expect(
			page.getByText("2 pessoas conectadas", { exact: true }),
		).toBeVisible();
		await page
			.getByRole("button", { name: "Compartilhar tela", exact: true })
			.click();
		await expect(
			bobPage.getByText("Tela de Screen Alice", { exact: true }),
		).toBeVisible();
		await expect(bobPage.getByLabel("Volume da transmissão")).toBeVisible();
		// Microphone and shared-screen audio must have independent playback elements.
		await expect
			.poll(() =>
				bobPage
					.locator("audio")
					.evaluateAll(
						(elements) =>
							elements.filter(
								(element) =>
									element.srcObject instanceof MediaStream &&
									element.srcObject.getAudioTracks().length >
										0,
							).length,
					),
			)
			.toBe(2);
		await bobPage
			.getByRole("button", { name: "Mutar tela", exact: true })
			.click();
		await expect(
			bobPage.getByRole("button", { name: "Ativar som", exact: true }),
		).toBeVisible();
		await page
			.getByRole("button", {
				name: "Parar compartilhamento",
				exact: true,
			})
			.click();
		await expect(
			bobPage.getByText("Tela de Screen Alice", { exact: true }),
		).toHaveCount(0);
		await expect
			.poll(() =>
				bobPage
					.locator("audio")
					.evaluateAll(
						(elements) =>
							elements.filter(
								(element) =>
									element.srcObject instanceof MediaStream &&
									element.srcObject.getAudioTracks().length >
										0,
							).length,
					),
			)
			.toBe(1);
		await page
			.getByRole("button", { name: "Sair da chamada", exact: true })
			.click();
	} finally {
		await bobContext.close();
	}
});
