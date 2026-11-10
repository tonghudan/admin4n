# 测网速

本地可运行的 **网络测速 + DNS/网关修复辅助** 工具。与仓库根目录的 NodeCRM 管理后台相互独立，互不影响。

## 功能

1. **连通与延迟**：探测国内主流站点（百度、淘宝/阿里 CDN、QQ、Bilibili、网易等）与国际站点（Cloudflare、Google、GitHub、YouTube、1.1.1.1 等）
2. **速率**：本机可控的下载 / 上传测速；可选外站下载抽样
3. **修复面板**：读取本机 DNS / 网关线索，探测可疑劫持，推荐国内与国际公共 DNS；通过平台脚本在你确认后应用（绝不静默修改）

## 快速开始

```bash
cd speedtest
npm install
npm start
```

浏览器打开：http://127.0.0.1:4177

开发时可用：

```bash
npm run dev          # 改服务器代码自动重载
npm run test:smoke   # 需先启动服务，做 API 冒烟检查
```

环境变量：`PORT`（默认 `4177`）

## 界面怎么用

1. 点 **开始测速**：测全部目标延迟 + 本机上下行  
2. **外站下载抽样**：对带下载 URL 的目标做辅助测速（跨境站点可能失败）  
3. **排查 DNS**：查看当前解析器、劫持线索、推荐 DNS，并复制对应系统的提权命令  

## 修复脚本（需管理员权限）

脚本目录：`scripts/`

| 平台 | 脚本 | 示例 |
|------|------|------|
| Linux | `apply-dns-linux.sh` | `sudo ./apply-dns-linux.sh aliyun` |
| macOS | `apply-dns-macos.sh` | `sudo ./apply-dns-macos.sh aliyun` |
| Windows | `apply-dns-windows.ps1` | 管理员 PowerShell：`.\apply-dns-windows.ps1 -Preset aliyun` |

预设：`aliyun` / `dnspod` / `114` / `baidu` / `cloudflare` / `google`  
另有：`show`（只查看）、`restore`（从备份恢复）

- 修改前会打印当前状态，并要求输入 **yes** 才继续  
- 备份目录：`~/.cewangsu-dns-backup/`（Windows 为用户目录下同名文件夹）  
- 网关 / 路由器 / hosts 提示见 `scripts/gateway-hints.md`

## API 一览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/targets` | 目标列表 |
| GET | `/api/latency` | 批量延迟（`?region=domestic\|international`） |
| GET | `/api/latency/:id` | 单目标延迟 |
| GET | `/api/download-probe/:id` | 外站下载抽样 |
| GET | `/api/local/download?size=` | 本机下行测试流 |
| POST | `/api/local/upload-raw` | 本机上行（原始二进制） |
| GET | `/api/dns/report` | DNS / 劫持完整报告 |
| GET | `/api/dns/presets` | DNS 推荐预设 |

## 限制（请知悉）

- **浏览器无法改系统 DNS / 网关**，必须走本机脚本并提权  
- **国际站点**在部分中国大陆网络会超时或被阻断，结果会显示失败——这常是线路问题，不等于本机坏了  
- **外站下载**受目标站限流、体积变化、证书与防火墙影响，仅作参考；精确上下行请看「本机下载/上传」  
- **延迟**由本机 Node 服务出站测量，反映「你的出口到目标」的连通，不是纯 ICMP ping  
- Linux 上若使用 NetworkManager / systemd-resolved，直接改 `/etc/resolv.conf` 可能被覆盖，需在系统网络设置里持久化  
- 容器 / Cloud Agent 环境里读到的 DNS 可能是容器 DNS，与你家里电脑不同——请在自己的电脑上跑修复脚本  

## 目录结构

```
speedtest/
  server/          # Express API：测速与 DNS 检测
  public/          # Web 看板
  scripts/         # 各平台 DNS 应用与网关提示
  README.md
  package.json
```

## 改进想法

- 增加运营商（电信/联通/移动）更细的 DNS 推荐与测速节点  
- 可选安装本地小助手（托盘应用）以便安全提权改 DNS  
- 历史测速曲线与导出报告  
