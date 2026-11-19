import assert from "node:assert/strict";
import test from "node:test";

test("protege tokens da descoberta e recusa o uso por outra empresa ou após 10 minutos", async (t) => {
  process.env.JWT_SECRET = "test-jwt";
  process.env.JWT_REFRESH_SECRET = "test-refresh";
  process.env.META_APP_ID = "test-app";
  process.env.META_APP_SECRET = "test-secret";
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
  const { ChannelsService } = await import("./channels.service");
  const service = new ChannelsService();
  const requests = t.mock.method(globalThis, "fetch", async (url: URL) => {
    if (url.pathname.endsWith("/oauth/access_token")) {
      return Response.json({ access_token: "user-token" });
    }
    assert.ok(url.pathname.endsWith("/me/accounts"));
    return Response.json({
      data: [
        { id: "1", name: "Página", access_token: "page-token" },
        {
          id: "2",
          name: "Loja",
          access_token: "store-token",
          instagram_business_account: { id: "3", username: "loja" },
        },
      ],
    });
  });

  const clock = t.mock.method(Date, "now", () => 1000);
  const { discoveryId, pages } = await service.discoverPages("empresa-a", "code");
  assert.match(discoveryId, /^[0-9a-f-]{36}$/);
  assert.deepEqual(pages, [
    { id: "1", name: "Página", instagram: null },
    { id: "2", name: "Loja", instagram: { id: "3", username: "loja" } },
  ]);

  const selection = { discoveryId, pageId: "1", channels: ["INSTAGRAM" as const] };
  await assert.rejects(service.connectPages("empresa-b", selection), { statusCode: 404 });
  await assert.rejects(service.connectPages("empresa-a", selection), { statusCode: 422 });
  clock.mock.mockImplementation(() => 1000 + 10 * 60 * 1000);
  await assert.rejects(service.connectPages("empresa-a", selection), { statusCode: 404 });
  assert.equal(requests.mock.callCount(), 3);
});
