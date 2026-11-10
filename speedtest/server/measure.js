import { getTarget, TARGETS } from './targets.js';

const DEFAULT_TIMEOUT_MS = 12_000;
const DOWNLOAD_CAP_BYTES = 2_000_000; // 外站下载上限，避免拖垮测速

/**
 * @param {string} url
 * @param {number} timeoutMs
 * @param {'latency' | 'download'} mode
 * @param {number} [maxBytes]
 */
async function fetchTimed(url, timeoutMs, mode, maxBytes = DOWNLOAD_CAP_BYTES) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();

  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'CeWangSu-SpeedTest/1.0 (+local; measurement only)',
        Accept: '*/*',
        'Cache-Control': 'no-cache',
      },
    });

    const ttfb = performance.now() - started;

    if (mode === 'latency') {
      // 读一小段即可，避免大页面拖慢延迟测量
      try {
        const reader = res.body?.getReader();
        if (reader) {
          await reader.read();
          reader.cancel().catch(() => {});
        }
      } catch {
        /* ignore */
      }
      return {
        ok: res.ok || res.status === 204 || res.status === 301 || res.status === 302,
        status: res.status,
        latencyMs: Math.round(ttfb),
        bytes: 0,
        mbps: null,
        error: null,
      };
    }

    let bytes = 0;
    const reader = res.body?.getReader();
    if (!reader) {
      const buf = Buffer.from(await res.arrayBuffer());
      bytes = buf.length;
    } else {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes >= maxBytes) {
          reader.cancel().catch(() => {});
          break;
        }
      }
    }

    const elapsedMs = performance.now() - started;
    const mbps = elapsedMs > 0 ? (bytes * 8) / (elapsedMs / 1000) / 1_000_000 : 0;

    return {
      ok: res.ok || res.status === 204,
      status: res.status,
      latencyMs: Math.round(ttfb),
      bytes,
      downloadMs: Math.round(elapsedMs),
      mbps: Number(mbps.toFixed(3)),
      error: null,
    };
  } catch (err) {
    const elapsedMs = performance.now() - started;
    const name = err?.name || 'Error';
    const message = err?.message || String(err);
    return {
      ok: false,
      status: 0,
      latencyMs: Math.round(elapsedMs),
      bytes: 0,
      mbps: null,
      error: name === 'AbortError' ? `超时 (${timeoutMs}ms)` : message,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 单目标延迟
 * @param {string} id
 */
export async function measureLatency(id) {
  const target = getTarget(id);
  if (!target) throw Object.assign(new Error('未知目标'), { status: 404 });

  const result = await fetchTimed(target.latencyUrl, DEFAULT_TIMEOUT_MS, 'latency');
  return {
    id: target.id,
    name: target.name,
    region: target.region,
    url: target.latencyUrl,
    ...result,
  };
}

/**
 * 单目标下载（若无 downloadUrl 则回退到 latencyUrl 小流量探测）
 * @param {string} id
 */
export async function measureDownload(id) {
  const target = getTarget(id);
  if (!target) throw Object.assign(new Error('未知目标'), { status: 404 });

  const url = target.downloadUrl || target.latencyUrl;
  const maxBytes = target.expectedBytes
    ? Math.min(target.expectedBytes + 64_000, DOWNLOAD_CAP_BYTES)
    : DOWNLOAD_CAP_BYTES;

  const result = await fetchTimed(url, 20_000, 'download', maxBytes);
  return {
    id: target.id,
    name: target.name,
    region: target.region,
    url,
    expectedBytes: target.expectedBytes || null,
    ...result,
  };
}

/**
 * 批量延迟（串行偏稳；并发可控）
 * @param {{ region?: string, concurrency?: number }} opts
 */
export async function measureAllLatency(opts = {}) {
  const { region, concurrency = 4 } = opts;
  const list = region
    ? TARGETS.filter((t) => t.region === region)
    : TARGETS;

  const results = [];
  let i = 0;

  async function worker() {
    while (i < list.length) {
      const idx = i++;
      const t = list[idx];
      try {
        results[idx] = await measureLatency(t.id);
      } catch (err) {
        results[idx] = {
          id: t.id,
          name: t.name,
          region: t.region,
          ok: false,
          error: err.message,
        };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, list.length) }, () => worker())
  );
  return results;
}

/**
 * 生成本地可控大小的下载流（用于本机下行测速，不受外站限制）
 * @param {number} sizeBytes
 */
export function createDownloadBuffer(sizeBytes) {
  const size = Math.max(64 * 1024, Math.min(sizeBytes, 50 * 1024 * 1024));
  const buf = Buffer.alloc(size);
  // 填充伪随机避免过度压缩中间件影响（本服务不启用压缩）
  for (let i = 0; i < size; i += 4096) {
    buf[i] = (i * 31) & 0xff;
  }
  return buf;
}

export function listTargets() {
  return TARGETS.map(({ id, name, region, latencyUrl, downloadUrl }) => ({
    id,
    name,
    region,
    latencyUrl,
    hasDownload: Boolean(downloadUrl),
  }));
}
