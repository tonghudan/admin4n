import dns from 'node:dns/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { platform } from 'node:os';
import { DNS_PRESETS } from './targets.js';

const execFileAsync = promisify(execFile);

/** 用于劫持/异常解析探测的对照域名 */
const PROBE_HOSTS = [
  { host: 'www.baidu.com', expectKind: 'any' },
  { host: 'www.qq.com', expectKind: 'any' },
  { host: 'dns.google', expectKind: 'any' },
  // 故意解析一个不应存在的子域：若落到公共 IP，可能是劫持/搜索页劫持
  { host: `nxdomain-probe-${Date.now()}.invalid.example`, expectKind: 'nxdomain' },
];

/**
 * 读取系统当前 DNS 解析器（尽力而为；容器/受限环境可能拿不到真实网卡 DNS）
 */
export async function readSystemResolvers() {
  const os = platform();
  const result = {
    platform: os,
    resolvers: /** @type {string[]} */ ([]),
    gateway: null,
    source: null,
    raw: null,
    error: null,
  };

  try {
    if (os === 'linux') {
      const text = await readFile('/etc/resolv.conf', 'utf8');
      result.source = '/etc/resolv.conf';
      result.raw = text;
      result.resolvers = text
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('nameserver'))
        .map((l) => l.split(/\s+/)[1])
        .filter(Boolean);

      try {
        const { stdout } = await execFileAsync('ip', ['route', 'show', 'default'], {
          timeout: 3000,
        });
        const m = stdout.match(/default via (\S+)/);
        if (m) result.gateway = m[1];
      } catch {
        try {
          const { stdout } = await execFileAsync('ip', ['route'], { timeout: 3000 });
          const m = stdout.match(/default via (\S+)/);
          if (m) result.gateway = m[1];
        } catch {
          /* ignore */
        }
      }
    } else if (os === 'darwin') {
      result.source = 'scutil --dns / route get default';
      const { stdout } = await execFileAsync('scutil', ['--dns'], { timeout: 5000 });
      result.raw = stdout.slice(0, 4000);
      const names = [...stdout.matchAll(/nameserver\[\d+\]\s*:\s*(\S+)/g)].map((m) => m[1]);
      result.resolvers = [...new Set(names)];
      try {
        const { stdout: routeOut } = await execFileAsync('route', ['-n', 'get', 'default'], {
          timeout: 3000,
        });
        const m = routeOut.match(/gateway:\s*(\S+)/);
        if (m) result.gateway = m[1];
      } catch {
        /* ignore */
      }
    } else if (os === 'win32') {
      result.source = 'Get-DnsClientServerAddress / ipconfig';
      try {
        const { stdout } = await execFileAsync(
          'powershell.exe',
          [
            '-NoProfile',
            '-Command',
            "Get-DnsClientServerAddress -AddressFamily IPv4 | Where-Object { $_.ServerAddresses } | ForEach-Object { $_.ServerAddresses } | Select-Object -Unique",
          ],
          { timeout: 8000 }
        );
        result.raw = stdout;
        result.resolvers = stdout
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter((s) => /^\d+\.\d+\.\d+\.\d+$/.test(s));
      } catch {
        const { stdout } = await execFileAsync('ipconfig', ['/all'], { timeout: 8000 });
        result.raw = stdout.slice(0, 6000);
        result.resolvers = [
          ...new Set(
            [...stdout.matchAll(/DNS Servers[^:]*:\s*([\d.]+)/gi)].map((m) => m[1])
          ),
        ];
      }
      try {
        const { stdout } = await execFileAsync(
          'powershell.exe',
          [
            '-NoProfile',
            '-Command',
            "(Get-NetRoute -DestinationPrefix '0.0.0.0/0' | Sort-Object RouteMetric | Select-Object -First 1).NextHop",
          ],
          { timeout: 5000 }
        );
        const gw = stdout.trim();
        if (/^\d+\.\d+\.\d+\.\d+$/.test(gw)) result.gateway = gw;
      } catch {
        /* ignore */
      }
    } else {
      result.error = `暂不支持的平台: ${os}`;
    }
  } catch (err) {
    result.error = err.message || String(err);
  }

  // Node 自身看到的解析器（可能与系统文件不同，例如容器 DNS）
  try {
    result.nodeServers = dns.getServers();
  } catch {
    result.nodeServers = [];
  }

  return result;
}

/**
 * 探测可疑劫持：NXDOMAIN 被解析到 IP、解析极慢、解析失败等
 */
export async function probeDnsHealth() {
  const findings = [];
  const lookups = [];

  for (const probe of PROBE_HOSTS) {
    const started = performance.now();
    try {
      const addrs = await dns.lookup(probe.host, { all: true });
      const ms = Math.round(performance.now() - started);
      const ips = addrs.map((a) => a.address);
      lookups.push({ host: probe.host, ok: true, ips, ms, expectKind: probe.expectKind });

      if (probe.expectKind === 'nxdomain' && ips.length > 0) {
        findings.push({
          severity: 'high',
          code: 'NXDOMAIN_HIJACK',
          message: `本应不存在的域名 ${probe.host} 被解析到 ${ips.join(', ')}，疑似 DNS 劫持或运营商搜索页劫持`,
        });
      }
      if (ms > 2000) {
        findings.push({
          severity: 'medium',
          code: 'SLOW_RESOLVE',
          message: `${probe.host} 解析耗时 ${ms}ms，DNS 可能拥堵或被干扰`,
        });
      }
    } catch (err) {
      const ms = Math.round(performance.now() - started);
      lookups.push({
        host: probe.host,
        ok: false,
        error: err.code || err.message,
        ms,
        expectKind: probe.expectKind,
      });

      if (probe.expectKind === 'nxdomain') {
        // ENOTFOUND / ENODATA 是期望结果
        if (!['ENOTFOUND', 'ENODATA', 'EAI_AGAIN'].includes(err.code)) {
          findings.push({
            severity: 'low',
            code: 'UNEXPECTED_NX_ERROR',
            message: `探测域名返回异常错误: ${err.code || err.message}`,
          });
        }
      } else {
        findings.push({
          severity: 'high',
          code: 'RESOLVE_FAIL',
          message: `无法解析 ${probe.host}: ${err.code || err.message}`,
        });
      }
    }
  }

  return { lookups, findings };
}

/**
 * 对照已知公共 DNS，判断当前解析器是否「陌生」
 */
export function classifyResolvers(resolvers = []) {
  const known = new Map();
  for (const p of DNS_PRESETS) {
    known.set(p.primary, p);
    known.set(p.secondary, p);
  }
  // 常见路由器/内网
  const privateHints = [
    /^192\.168\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[0-1])\./,
    /^127\./,
  ];
  // 198.18.0.0/15 常见于代理/沙箱/基准测试网段，不一定是劫持
  const envProxyHints = [/^198\.1[89]\./];

  return resolvers.map((ip) => {
    const preset = known.get(ip);
    if (preset) {
      return { ip, kind: 'known-public', presetId: preset.id, label: preset.name };
    }
    if (envProxyHints.some((re) => re.test(ip))) {
      return {
        ip,
        kind: 'env-proxy',
        presetId: null,
        label: '环境/代理 DNS（容器、Clash 等常见，请在真实电脑上再核对）',
      };
    }
    if (privateHints.some((re) => re.test(ip))) {
      return {
        ip,
        kind: 'local-or-isp',
        presetId: null,
        label: '本机/路由器/运营商 DNS（常见）',
      };
    }
    return {
      ip,
      kind: 'unknown',
      presetId: null,
      label: '未识别的解析器（请人工核对是否被篡改）',
    };
  });
}

export async function fullDnsReport() {
  const system = await readSystemResolvers();
  const health = await probeDnsHealth();
  const classified = classifyResolvers(
    system.resolvers?.length ? system.resolvers : system.nodeServers || []
  );

  const unknown = classified.filter((c) => c.kind === 'unknown');
  if (unknown.length) {
    health.findings.push({
      severity: 'medium',
      code: 'UNKNOWN_RESOLVER',
      message: `发现未识别 DNS: ${unknown.map((u) => u.ip).join(', ')}。可能是运营商 DNS，也可能被恶意软件修改，请对照下方推荐列表核对。`,
    });
  }

  const recommendations = recommendByFindings(health.findings, system.platform);

  return {
    scannedAt: new Date().toISOString(),
    system,
    classified,
    health,
    recommendations,
    presets: DNS_PRESETS,
    applyHint:
      '浏览器无法直接修改系统 DNS。请在本机用管理员/root 运行 scripts/ 下对应平台脚本，并在修改前记录当前 DNS。本服务只会检测与建议，不会静默改配置。',
  };
}

function recommendByFindings(findings, osPlatform) {
  const hasHijack = findings.some((f) => f.code === 'NXDOMAIN_HIJACK');
  const hasFail = findings.some((f) => f.code === 'RESOLVE_FAIL');

  const chinaFirst = ['aliyun', 'dnsPod', '114'];
  const intl = ['cloudflare', 'google'];

  let primaryIds = chinaFirst;
  let reason = '默认推荐国内公共 DNS，解析稳定、适合中国大陆网络。';

  if (hasHijack) {
    primaryIds = ['aliyun', 'dnsPod', 'cloudflare'];
    reason =
      '疑似劫持：建议先改到可信公共 DNS（阿里/腾讯），必要时再试 Cloudflare，并检查路由器是否被改。';
  } else if (hasFail) {
    primaryIds = ['aliyun', '114', 'dnsPod'];
    reason = '存在解析失败：优先换国内可靠公共 DNS，并检查网关/网线/Wi‑Fi。';
  }

  return {
    reason,
    suggestedPresetIds: primaryIds,
    internationalFallbackIds: intl,
    platformScripts: {
      linux: 'scripts/apply-dns-linux.sh',
      darwin: 'scripts/apply-dns-macos.sh',
      win32: 'scripts/apply-dns-windows.ps1',
      current: osPlatform,
    },
  };
}
