const $ = (sel) => document.querySelector(sel);

const state = {
  targets: [],
  rows: new Map(),
  lastDnsReport: null,
  busy: false,
};

function setStatus(text) {
  const el = $('#status-line');
  if (el) el.textContent = text || '';
}

function fmtMs(v) {
  if (v == null || Number.isNaN(v)) return '—';
  return `${Math.round(v)} ms`;
}

function fmtMbps(v) {
  if (v == null || Number.isNaN(v)) return '—';
  if (v < 0.1) return `${(v * 1000).toFixed(0)} kbps`;
  return `${v.toFixed(2)} Mbps`;
}

function average(nums) {
  const list = nums.filter((n) => typeof n === 'number' && !Number.isNaN(n));
  if (!list.length) return null;
  return list.reduce((a, b) => a + b, 0) / list.length;
}

function ensureSummaryVisible() {
  const s = $('#summary');
  if (s) s.hidden = false;
}

function renderTables() {
  const domestic = $('#tbody-domestic');
  const intl = $('#tbody-intl');
  domestic.innerHTML = '';
  intl.innerHTML = '';

  for (const t of state.targets) {
    const row = state.rows.get(t.id) || {};
    const tr = document.createElement('tr');
    const statusClass = row.error
      ? 'pill--bad'
      : row.latencyMs != null
        ? 'pill--ok'
        : 'pill--wait';
    const statusText = row.error
      ? '失败'
      : row.latencyMs != null
        ? 'OK'
        : '等待';

    tr.innerHTML = `
      <td>${escapeHtml(t.name)}</td>
      <td>${fmtMs(row.latencyMs)}</td>
      <td>${row.downloadMbps != null ? fmtMbps(row.downloadMbps) : '—'}</td>
      <td><span class="pill ${statusClass}" title="${escapeHtml(row.error || '')}">${statusText}</span></td>
    `;
    (t.region === 'domestic' ? domestic : intl).appendChild(tr);
  }
}

function escapeHtml(s) {
  return String(s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function updateSummary() {
  const domestic = [];
  const intl = [];
  for (const t of state.targets) {
    const row = state.rows.get(t.id);
    if (!row || row.latencyMs == null || row.error) continue;
    (t.region === 'domestic' ? domestic : intl).push(row.latencyMs);
  }
  const dAvg = average(domestic);
  const iAvg = average(intl);
  $('#sum-domestic').textContent = dAvg == null ? '—' : fmtMs(dAvg);
  $('#sum-intl').textContent = iAvg == null ? '—' : fmtMs(iAvg);
}

async function loadTargets() {
  const res = await fetch('/api/targets');
  const data = await res.json();
  state.targets = data.targets || [];
  for (const t of state.targets) {
    if (!state.rows.has(t.id)) state.rows.set(t.id, {});
  }
  renderTables();
}

async function runLatency() {
  setStatus('正在测量延迟（服务端出站）…');
  const res = await fetch('/api/latency');
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '延迟测量失败');

  for (const r of data.results || []) {
    const prev = state.rows.get(r.id) || {};
    state.rows.set(r.id, {
      ...prev,
      latencyMs: r.ok ? r.latencyMs : null,
      error: r.ok ? null : r.error || `HTTP ${r.status}`,
    });
  }
  renderTables();
  updateSummary();
  setStatus(`延迟完成 · ${new Date(data.measuredAt || Date.now()).toLocaleTimeString()}`);
}

async function runLocalThroughput() {
  setStatus('正在测量本机下载…');
  // 下载 8MB
  const size = 8 * 1024 * 1024;
  const t0 = performance.now();
  const res = await fetch(`/api/local/download?size=${size}&_=${Date.now()}`, {
    cache: 'no-store',
  });
  const buf = await res.arrayBuffer();
  const t1 = performance.now();
  const downMbps = (buf.byteLength * 8) / ((t1 - t0) / 1000) / 1_000_000;
  $('#sum-down').textContent = fmtMbps(downMbps);

  setStatus('正在测量本机上传…');
  const payload = new Uint8Array(4 * 1024 * 1024);
  crypto.getRandomValues(payload.subarray(0, 65536));
  const start = Date.now();
  const upRes = await fetch('/api/local/upload-raw', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Client-Start': String(start),
    },
    body: payload,
  });
  const upData = await upRes.json();
  if (!upRes.ok) throw new Error(upData.error || '上传失败');
  $('#sum-up').textContent = fmtMbps(upData.mbps);
  setStatus(
    `本机吞吐完成 · 下行 ${fmtMbps(downMbps)} · 上行 ${fmtMbps(upData.mbps)}`
  );
}

async function runRemoteDownloads() {
  setStatus('正在对外站做下载抽样（可能因封锁失败）…');
  const withDl = state.targets.filter((t) => t.hasDownload);
  for (const t of withDl) {
    try {
      const res = await fetch(`/api/download-probe/${t.id}`);
      const data = await res.json();
      const prev = state.rows.get(t.id) || {};
      state.rows.set(t.id, {
        ...prev,
        downloadMbps: data.ok ? data.mbps : null,
        error: data.ok ? prev.error : prev.error || data.error,
      });
      renderTables();
    } catch (err) {
      const prev = state.rows.get(t.id) || {};
      state.rows.set(t.id, { ...prev, downloadMbps: null });
    }
  }
  setStatus('外站下载抽样完成（失败项多为跨境阻断或 CORS/网络限制，属预期）');
}

async function runAll() {
  if (state.busy) return;
  state.busy = true;
  setBusy(true);
  ensureSummaryVisible();
  try {
    await runLatency();
    await runLocalThroughput();
  } catch (err) {
    setStatus(`出错：${err.message}`);
  } finally {
    state.busy = false;
    setBusy(false);
    $('#btn-latency').disabled = false;
    $('#btn-throughput').disabled = false;
    $('#btn-remote-dl').disabled = false;
  }
}

function setBusy(busy) {
  const btn = $('#btn-run-all');
  btn.disabled = busy;
  btn.classList.toggle('is-busy', busy);
  $('#btn-latency').disabled = busy;
  $('#btn-throughput').disabled = busy;
  $('#btn-remote-dl').disabled = busy;
  $('#btn-dns-scan').disabled = busy;
}

function platformCommand(report) {
  const os = report?.system?.platform || 'linux';
  if (os === 'win32') {
    return 'cd speedtest/scripts; .\\apply-dns-windows.ps1 -Preset aliyun';
  }
  if (os === 'darwin') {
    return 'cd speedtest/scripts && sudo ./apply-dns-macos.sh aliyun';
  }
  return 'cd speedtest/scripts && sudo ./apply-dns-linux.sh aliyun';
}

function renderDnsReport(report) {
  state.lastDnsReport = report;
  const resolvers = report.classified?.length
    ? report.classified.map((c) => `${c.ip}  ·  ${c.label}`).join('\n')
    : (report.system?.resolvers || []).join('\n') || '（未读到）';

  $('#dns-resolvers').textContent = resolvers;
  const gw = report.system?.gateway;
  $('#dns-gateway').textContent = gw
    ? `默认网关：${gw}（来源：${report.system.source || '未知'}）`
    : `平台：${report.system?.platform || '未知'} · ${report.system?.error || '未检测到网关'}`;

  const ul = $('#dns-findings');
  ul.innerHTML = '';
  const findings = report.health?.findings || [];
  if (!findings.length) {
    const li = document.createElement('li');
    li.className = 'sev-low';
    li.textContent = '未发现明显劫持迹象（仍建议核对解析器是否可信）。';
    ul.appendChild(li);
  } else {
    for (const f of findings) {
      const li = document.createElement('li');
      li.className = `sev-${f.severity || 'low'}`;
      li.textContent = f.message;
      ul.appendChild(li);
    }
  }

  const suggested = new Set(report.recommendations?.suggestedPresetIds || []);
  const box = $('#dns-presets');
  box.innerHTML = '';
  for (const p of report.presets || []) {
    const div = document.createElement('div');
    div.className = 'preset' + (suggested.has(p.id) ? ' is-suggested' : '');
    div.innerHTML = `
      <p class="preset__name">${escapeHtml(p.name)}</p>
      <p class="preset__dns">${escapeHtml(p.primary)} / ${escapeHtml(p.secondary)}</p>
      <p class="preset__note">${escapeHtml(p.note)} · ${escapeHtml(p.ispHint || '')}</p>
      <button type="button" class="btn btn--small" data-preset="${escapeHtml(p.id)}">复制应用命令</button>
    `;
    box.appendChild(div);
  }

  box.querySelectorAll('button[data-preset]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-preset');
      const os = report.system?.platform || 'linux';
      let cmd;
      if (os === 'win32') {
        cmd = `cd speedtest/scripts; .\\apply-dns-windows.ps1 -Preset ${id}`;
      } else if (os === 'darwin') {
        cmd = `cd speedtest/scripts && sudo ./apply-dns-macos.sh ${id}`;
      } else {
        cmd = `cd speedtest/scripts && sudo ./apply-dns-linux.sh ${id}`;
      }
      await navigator.clipboard.writeText(cmd);
      setStatus(`已复制命令：${cmd}`);
    });
  });
}

async function scanDns() {
  setStatus('正在检测 DNS / 劫持…');
  const res = await fetch('/api/dns/report');
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'DNS 检测失败');
  renderDnsReport(data);
  const n = data.health?.findings?.length || 0;
  setStatus(
    n
      ? `DNS 检测完成，发现 ${n} 条提示。${data.recommendations?.reason || ''}`
      : `DNS 检测完成。${data.recommendations?.reason || ''}`
  );
  ensureSummaryVisible();
}

function wire() {
  $('#btn-run-all').addEventListener('click', () => {
    document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' });
    runAll();
  });
  $('#btn-jump-repair').addEventListener('click', () => {
    document.getElementById('repair')?.scrollIntoView({ behavior: 'smooth' });
  });
  $('#btn-latency').addEventListener('click', async () => {
    ensureSummaryVisible();
    setBusy(true);
    try {
      await runLatency();
    } catch (e) {
      setStatus(e.message);
    } finally {
      setBusy(false);
    }
  });
  $('#btn-throughput').addEventListener('click', async () => {
    ensureSummaryVisible();
    setBusy(true);
    try {
      await runLocalThroughput();
    } catch (e) {
      setStatus(e.message);
    } finally {
      setBusy(false);
    }
  });
  $('#btn-remote-dl').addEventListener('click', async () => {
    setBusy(true);
    try {
      await runRemoteDownloads();
    } catch (e) {
      setStatus(e.message);
    } finally {
      setBusy(false);
    }
  });
  $('#btn-dns-scan').addEventListener('click', async () => {
    setBusy(true);
    try {
      await scanDns();
    } catch (e) {
      setStatus(e.message);
    } finally {
      setBusy(false);
    }
  });
  $('#btn-copy-cmd').addEventListener('click', async () => {
    const cmd = platformCommand(state.lastDnsReport || { system: { platform: 'linux' } });
    await navigator.clipboard.writeText(cmd);
    setStatus(`已复制：${cmd}`);
  });
}

async function boot() {
  wire();
  try {
    await loadTargets();
    // 预载推荐 DNS 卡片
    const res = await fetch('/api/dns/presets');
    const data = await res.json();
    renderDnsReport({
      presets: data.presets,
      classified: [],
      system: {},
      health: { findings: [] },
      recommendations: { suggestedPresetIds: ['aliyun', 'dnsPod', '114'] },
    });
  } catch (err) {
    setStatus(`初始化失败：${err.message}`);
  }
}

boot();
