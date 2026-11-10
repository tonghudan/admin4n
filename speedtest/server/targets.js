/**
 * 测速目标列表。
 * latency：用 HTTP GET/HEAD 计时（服务端出站，避开浏览器 CORS）
 * download：尽量用带已知/可测体积的公开资源
 *
 * 限制说明见 README：部分国际站点在国内可能被阻断或极慢；
 * CDN 体积会随时间变化，下载测速以实测字节为准。
 */

/** @typedef {'domestic' | 'international'} Region */

/**
 * @typedef {object} Target
 * @property {string} id
 * @property {string} name
 * @property {Region} region
 * @property {string} latencyUrl
 * @property {string} [downloadUrl]
 * @property {number} [expectedBytes] 可选期望体积，仅作参考
 */

/** @type {Target[]} */
export const TARGETS = [
  // —— 国内 ——
  {
    id: 'baidu',
    name: '百度',
    region: 'domestic',
    latencyUrl: 'https://www.baidu.com/',
    downloadUrl: 'https://www.baidu.com/img/flexible/logo/pc/result.png',
  },
  {
    id: 'taobao-cdn',
    name: '淘宝 CDN',
    region: 'domestic',
    latencyUrl: 'https://www.taobao.com/',
    downloadUrl: 'https://img.alicdn.com/tfs/TB1_.IdGQPoK1RjSZKbXXX1IXXa-40-32.png',
  },
  {
    id: 'qq',
    name: '腾讯 QQ',
    region: 'domestic',
    latencyUrl: 'https://www.qq.com/',
  },
  {
    id: 'bilibili',
    name: '哔哩哔哩',
    region: 'domestic',
    latencyUrl: 'https://www.bilibili.com/',
    downloadUrl: 'https://i0.hdslb.com/bfs/archive/67bc7423401290378faba18eb1e72e7054dde1aa.png',
  },
  {
    id: '163',
    name: '网易',
    region: 'domestic',
    latencyUrl: 'https://www.163.com/',
  },
  {
    id: 'aliyun-oss',
    name: '阿里云静态',
    region: 'domestic',
    latencyUrl: 'https://www.aliyun.com/',
    // 公开小图；大文件测速走本机 /api/download 生成流
    downloadUrl: 'https://img.alicdn.com/imgextra/i4/O1CN01Z5paLz1O0zuCC7osS_!!6000000001644-55-tps-83-82.svg',
  },

  // —— 国际 ——
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    region: 'international',
    latencyUrl: 'https://www.cloudflare.com/',
    downloadUrl: 'https://speed.cloudflare.com/__down?bytes=1000000',
    expectedBytes: 1_000_000,
  },
  {
    id: 'google',
    name: 'Google',
    region: 'international',
    latencyUrl: 'https://www.google.com/generate_204',
  },
  {
    id: 'github',
    name: 'GitHub',
    region: 'international',
    latencyUrl: 'https://github.com/',
    downloadUrl: 'https://raw.githubusercontent.com/github/gitignore/main/Node.gitignore',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    region: 'international',
    latencyUrl: 'https://www.youtube.com/generate_204',
  },
  {
    id: 'cf-dns',
    name: '1.1.1.1',
    region: 'international',
    latencyUrl: 'https://1.1.1.1/',
  },
];

export function getTarget(id) {
  return TARGETS.find((t) => t.id === id) || null;
}

/**
 * 推荐 DNS（按地区/场景）。浏览器无法改系统 DNS，需配合 scripts/ 提权脚本。
 */
export const DNS_PRESETS = [
  {
    id: 'aliyun',
    name: '阿里 DNS',
    region: 'china',
    ispHint: '通用 / 阿里生态友好',
    primary: '223.5.5.5',
    secondary: '223.6.6.6',
    note: '国内解析快，适合日常上网',
  },
  {
    id: 'dnsPod',
    name: '腾讯 DNSPod',
    region: 'china',
    ispHint: '通用 / 腾讯生态友好',
    primary: '119.29.29.29',
    secondary: '182.254.116.116',
    note: '国内常用公共 DNS',
  },
  {
    id: '114',
    name: '114 DNS',
    region: 'china',
    ispHint: '电信/联通常见备选',
    primary: '114.114.114.114',
    secondary: '114.114.115.115',
    note: '老牌国内公共 DNS',
  },
  {
    id: 'baidu',
    name: '百度 DNS',
    region: 'china',
    ispHint: '通用',
    primary: '180.76.76.76',
    secondary: '180.76.76.76',
    note: '百度公共 DNS',
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    region: 'international',
    ispHint: '跨境 / 国际线路',
    primary: '1.1.1.1',
    secondary: '1.0.0.1',
    note: '国际常用；国内部分网络可能不稳定',
  },
  {
    id: 'google',
    name: 'Google Public DNS',
    region: 'international',
    ispHint: '跨境 / 国际线路',
    primary: '8.8.8.8',
    secondary: '8.8.4.4',
    note: '国际常用；国内部分网络可能被干扰',
  },
];
