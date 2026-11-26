import { expect, test, type APIRequestContext } from "@playwright/test";
import { account, apiOrigin, signIn } from "./helpers/private-chat";

type Account = Awaited<ReturnType<typeof account>>;

async function befriend(
	request: APIRequestContext,
	alice: Account,
	bob: Account,
) {
	const requested = await request.post(`${apiOrigin}/friends`, {
		headers: { Authorization: `Bearer ${alice.session.token}` },
		data: { identifier: bob.user.id },
	});
	expect(requested.ok()).toBe(true);
	const accepted = await request.patch(
		`${apiOrigin}/friends/${alice.user.id}`,
		{
			headers: { Authorization: `Bearer ${bob.session.token}` },
		},
	);
	expect(accepted.ok()).toBe(true);
}

test("loads older private messages without duplicates or moving the reading position during realtime delivery", async ({
	page,
	request,
}) => {
	const alice = await account(request, "History Alice");
	const bob = await account(request, "History Bob");
	await befriend(request, alice, bob);
	const headers = { Authorization: `Bearer ${bob.session.token}` };
	for (let index = 0; index < 105; index++) {
		const response = await request.post(`${apiOrigin}/direct-messages`, {
			headers,
			data: {
				recipientId: alice.user.id,
				content: `History message ${index}`,
			},
		});
		expect(response.status()).toBe(201);
	}
	await signIn(page, alice);
	await page
		.getByRole("button", { name: "History Bob", exact: true })
		.click();
	await expect(page.locator("article")).toHaveCount(100);
	const scroller = page.getByLabel("Histórico da conversa");
	await scroller.evaluate((element) => {
		element.scrollTop = 0;
	});
	const anchor = page.locator("article").first();
	const anchorId = await anchor.getAttribute("id");
	const initialTop = (await anchor.boundingBox())!.y;
	let releasePage: () => void = () => {};
	const pendingPage = new Promise<void>((resolve) => {
		releasePage = resolve;
	});
	let requestedPage: () => void = () => {};
	const pageRequested = new Promise<void>((resolve) => {
		requestedPage = resolve;
	});
	await page.route("**/direct-messages?*", async (route) => {
		if (!new URL(route.request().url()).searchParams.has("cursor"))
			return route.continue();
		const response = await route.fetch();
		requestedPage();
		await pendingPage;
		await route.fulfill({ response });
	});
	await page
		.getByRole("button", {
			name: "Carregar mensagens anteriores",
			exact: true,
		})
		.click();
	await pageRequested;
	const live = await request.post(`${apiOrigin}/direct-messages`, {
		headers,
		data: {
			recipientId: alice.user.id,
			content: "Live message while reading history",
		},
	});
	expect(live.status()).toBe(201);
	await expect(page.locator("article")).toHaveCount(101);
	releasePage();
	await expect(page.locator("article")).toHaveCount(106);
	await expect(
		page.getByRole("button", {
			name: "Carregar mensagens anteriores",
			exact: true,
		}),
	).toHaveCount(0);
	const finalTop = (await page.locator(`[id="${anchorId}"]`).boundingBox())!
		.y;
	expect(Math.abs(finalTop - initialTop)).toBeLessThan(2);
	const ids = await page
		.locator("article")
		.evaluateAll((articles) => articles.map(({ id }) => id));
	expect(new Set(ids).size).toBe(106);
	await expect(
		page.getByText("Live message while reading history", { exact: true }),
	).toHaveCount(1);
});

test("ignores an older response after switching away and reopening the same private conversation", async ({
	page,
	request,
}) => {
	const alice = await account(request, "Race Alice");
	const bob = await account(request, "Race Bob");
	const carol = await account(request, "Race Carol");
	await befriend(request, alice, bob);
	await befriend(request, alice, carol);
	let releaseOldResponse: () => void = () => {};
	const oldResponse = new Promise<void>((resolve) => {
		releaseOldResponse = resolve;
	});
	let startOldRequest: () => void = () => {};
	const oldRequestStarted = new Promise<void>((resolve) => {
		startOldRequest = resolve;
	});
	let bobRequests = 0;
	await page.route("**/direct-messages?*", async (route) => {
		const peerId = new URL(route.request().url()).searchParams.get(
			"userId",
		);
		const isBob = peerId === bob.user.id;
		const stale = isBob && ++bobRequests === 1;
		if (stale) {
			startOldRequest();
			await oldResponse;
		}
		let content = isBob ? "Current Bob history" : "Current Carol history";
		if (stale) content = "Stale response";
		await route.fulfill({
			json: {
				messages: [
					{
						id: crypto.randomUUID(),
						senderId: peerId,
						recipientId: alice.user.id,
						content,
						createdAt: "2026-11-12T00:00:00.000Z",
						media: null,
					},
				],
				nextCursor: null,
			},
		});
	});
	await signIn(page, alice);
	await page.getByRole("button", { name: "Race Bob", exact: true }).click();
	await oldRequestStarted;
	await page.getByRole("button", { name: "Race Carol", exact: true }).click();
	await expect(
		page.getByText("Current Carol history", { exact: true }),
	).toHaveCount(1);
	await page.getByRole("button", { name: "Race Bob", exact: true }).click();
	await expect(
		page.getByText("Current Bob history", { exact: true }),
	).toHaveCount(1);
	const staleResponse = page.waitForResponse((response) =>
		response.url().includes(`/direct-messages?userId=${bob.user.id}`),
	);
	releaseOldResponse();
	await (await staleResponse).finished();
	await page.evaluate(
		() =>
			new Promise<void>((resolve) => {
				requestAnimationFrame(() =>
					requestAnimationFrame(() => resolve()),
				);
			}),
	);
	await expect(page.getByText("Stale response", { exact: true })).toHaveCount(
		0,
	);
	await expect(
		page.getByText("Current Carol history", { exact: true }),
	).toHaveCount(0);
	await expect(page.locator("article")).toHaveCount(1);
});
