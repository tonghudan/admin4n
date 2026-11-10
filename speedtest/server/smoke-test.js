/**
 * 轻量冒烟：启动后对本地 API 做基本校验（不依赖外网全部可达）
 */
const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:4177';

async function check(path) {
  const res = await fetch(`${BASE}${path}`);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* ignore */
  }
  return { path, status: res.status, ok: res.ok, json };
}

async function main() {
  const paths = ['/api/health', '/api/targets', '/api/dns/presets', '/api/dns/resolvers'];
  const results = [];
  for (const p of paths) {
    try {
      results.push(await check(p));
    } catch (err) {
      results.push({ path: p, ok: false, error: err.message });
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(JSON.stringify({ base: BASE, results, failed: failed.length }, null, 2));
  if (failed.length) process.exit(1);
}

main();
