// worker.ts
var worker_default = { async scheduled(_controller, env, ctx) {
  ctx.waitUntil((async () => {
    const response = await fetch(new URL("/api/service/run", env.SITE_URL), { method: "POST", headers: { Authorization: `Bearer ${env.SERVICE_SECRET}`, "OAI-Sites-Authorization": `Bearer ${env.SITE_ACCESS_TOKEN}` } });
    if (!response.ok) throw new Error(`Quest Island scheduled check failed: ${response.status}`);
    const result = await response.json();
    if (result.results.some((r) => r.error)) throw new Error("Quest Island background check reported a failure. Check the site connection health.");
  })());
} };
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
