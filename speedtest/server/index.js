import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  listTargets,
  measureLatency,
  measureDownload,
  measureAllLatency,
  createDownloadBuffer,
} from './measure.js';
import { fullDnsReport, readSystemResolvers } from './dns-detect.js';
import { DNS_PRESETS } from './targets.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const PORT = Number(process.env.PORT) || 4177;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '60mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'cewangsu', port: PORT });
});

app.get('/api/targets', (_req, res) => {
  res.json({ targets: listTargets() });
});

app.get('/api/dns/presets', (_req, res) => {
  res.json({ presets: DNS_PRESETS });
});

app.get('/api/dns/report', async (_req, res) => {
  try {
    const report = await fullDnsReport();
    res.json(report);
  } catch (err) {
    console.error('[dns/report]', err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.get('/api/dns/resolvers', async (_req, res) => {
  try {
    res.json(await readSystemResolvers());
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.get('/api/latency/:id', async (req, res) => {
  try {
    const result = await measureLatency(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || String(err) });
  }
});

app.get('/api/download-probe/:id', async (req, res) => {
  try {
    const result = await measureDownload(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || String(err) });
  }
});

app.get('/api/latency', async (req, res) => {
  try {
    const region = req.query.region ? String(req.query.region) : undefined;
    const results = await measureAllLatency({ region, concurrency: 4 });
    res.json({ results, measuredAt: new Date().toISOString() });
  } catch (err) {
    console.error('[latency]', err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

/**
 * 本机可控下行：浏览器直接拉取此流测下载速度
 * ?size= 字节数，默认 5MB，最大 50MB
 */
app.get('/api/local/download', (req, res) => {
  const size = Number(req.query.size) || 5 * 1024 * 1024;
  const buf = createDownloadBuffer(size);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', String(buf.length));
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Test-Bytes', String(buf.length));
  res.send(buf);
});

// 原始二进制上传（本机上行测速）
app.post(
  '/api/local/upload-raw',
  express.raw({ type: '*/*', limit: '60mb' }),
  (req, res) => {
    const startedHeader = Number(req.headers['x-client-start']);
    const bytes = req.body?.length || 0;
    const elapsedMs = startedHeader
      ? Math.max(1, Date.now() - startedHeader)
      : 1;
    const mbps = (bytes * 8) / (elapsedMs / 1000) / 1_000_000;
    res.json({
      ok: true,
      bytes,
      elapsedMs,
      mbps: Number(mbps.toFixed(3)),
    });
  }
);

app.use(express.static(publicDir));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.use((err, _req, res, _next) => {
  console.error('[unhandled]', err);
  res.status(500).json({ error: err.message || '服务器错误' });
});

const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`测网速 已启动`);
  console.log(`  本机访问: http://127.0.0.1:${PORT}`);
  console.log(`  本机访问: http://localhost:${PORT}`);
  console.log('API: /api/latency  /api/local/download  /api/dns/report');
  console.log('关掉本窗口即停止服务。');
});
