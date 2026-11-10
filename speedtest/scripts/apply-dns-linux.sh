#!/usr/bin/env bash
# 测网速 — Linux DNS 应用脚本（需 root）
# 用法:
#   sudo ./apply-dns-linux.sh aliyun
#   sudo ./apply-dns-linux.sh cloudflare
#   sudo ./apply-dns-linux.sh show
#   sudo ./apply-dns-linux.sh restore
#
# 不会在未确认时静默改配置：首次会打印当前 resolv.conf 并要求输入 yes。

set -euo pipefail

PRESET="${1:-}"
BACKUP_DIR="${HOME}/.cewangsu-dns-backup"
BACKUP_FILE="${BACKUP_DIR}/resolv.conf.bak"
STAMP="$(date +%Y%m%d-%H%M%S)"

resolve_preset() {
  case "$1" in
    aliyun) echo "223.5.5.5 223.6.6.6" ;;
    dnspod|tencent) echo "119.29.29.29 182.254.116.116" ;;
    114) echo "114.114.114.114 114.114.115.115" ;;
    baidu) echo "180.76.76.76 180.76.76.76" ;;
    cloudflare|cf) echo "1.1.1.1 1.0.0.1" ;;
    google) echo "8.8.8.8 8.8.4.4" ;;
    *) return 1 ;;
  esac
}

need_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    echo "请使用 sudo 运行此脚本（修改系统 DNS 需要管理员权限）。"
    exit 1
  fi
}

show_current() {
  echo "=== 当前 /etc/resolv.conf ==="
  if [[ -f /etc/resolv.conf ]]; then
    cat /etc/resolv.conf
  else
    echo "(文件不存在)"
  fi
  echo
  echo "=== 默认网关 ==="
  ip route show default 2>/dev/null || true
}

if [[ -z "$PRESET" ]]; then
  echo "用法: sudo $0 <aliyun|dnspod|114|baidu|cloudflare|google|show|restore>"
  exit 1
fi

if [[ "$PRESET" == "show" ]]; then
  show_current
  exit 0
fi

need_root
mkdir -p "$BACKUP_DIR"

if [[ "$PRESET" == "restore" ]]; then
  if [[ ! -f "$BACKUP_FILE" ]]; then
    echo "找不到备份: $BACKUP_FILE"
    exit 1
  fi
  echo "将从备份恢复 DNS:"
  cat "$BACKUP_FILE"
  read -r -p "确认恢复？输入 yes: " CONFIRM
  [[ "$CONFIRM" == "yes" ]] || { echo "已取消"; exit 0; }
  cp "$BACKUP_FILE" /etc/resolv.conf
  echo "已恢复。"
  show_current
  exit 0
fi

DNS_PAIR="$(resolve_preset "$PRESET" || true)"
if [[ -z "$DNS_PAIR" ]]; then
  echo "未知预设: $PRESET"
  exit 1
fi
read -r DNS1 DNS2 <<<"$DNS_PAIR"

echo ">>> 修改前状态"
show_current

echo "即将写入 nameserver $DNS1 / $DNS2 （预设: $PRESET）"
echo "注意: 若系统使用 systemd-resolved / NetworkManager，改 /etc/resolv.conf 可能被覆盖；"
echo "      那时请在桌面网络设置或 nmcli/resolvectl 中持久化。"
read -r -p "确认继续？输入 yes: " CONFIRM
[[ "$CONFIRM" == "yes" ]] || { echo "已取消，未做任何修改。"; exit 0; }

cp /etc/resolv.conf "${BACKUP_DIR}/resolv.conf.${STAMP}"
cp /etc/resolv.conf "$BACKUP_FILE"

{
  echo "# Managed by 测网速 apply-dns-linux.sh ($PRESET) at $STAMP"
  echo "# Backup: $BACKUP_FILE"
  echo "nameserver $DNS1"
  echo "nameserver $DNS2"
} > /etc/resolv.conf

echo ">>> 修改后状态"
show_current
echo "备份已写入: $BACKUP_FILE 与 ${BACKUP_DIR}/resolv.conf.${STAMP}"
