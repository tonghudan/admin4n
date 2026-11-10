#!/usr/bin/env bash
# 测网速 — macOS DNS 应用脚本（需管理员密码）
# 用法:
#   sudo ./apply-dns-macos.sh aliyun
#   sudo ./apply-dns-macos.sh show
#   sudo ./apply-dns-macos.sh restore
#
# 通过 networksetup 修改「当前活动」网络服务的 DNS。

set -euo pipefail

PRESET="${1:-}"
BACKUP_DIR="${HOME}/.cewangsu-dns-backup"
BACKUP_FILE="${BACKUP_DIR}/macos-dns.txt"

resolve_preset() {
  case "$1" in
    aliyun) echo "223.5.5.5 223.6.6.6" ;;
    dnspod|tencent) echo "119.29.29.29 182.254.116.116" ;;
    114) echo "114.114.114.114 114.114.115.115" ;;
    baidu) echo "180.76.76.76" ;;
    cloudflare|cf) echo "1.1.1.1 1.0.0.1" ;;
    google) echo "8.8.8.8 8.8.4.4" ;;
    *) return 1 ;;
  esac
}

active_service() {
  # 取第一个状态为 Hardware Port 且有 IP 的服务；回退 Wi-Fi
  local svc
  while IFS= read -r svc; do
    if networksetup -getinfo "$svc" 2>/dev/null | grep -q "IP address:"; then
      echo "$svc"
      return 0
    fi
  done < <(networksetup -listallnetworkservices | tail -n +2)
  echo "Wi-Fi"
}

show_current() {
  local svc
  svc="$(active_service)"
  echo "=== 网络服务: $svc ==="
  echo "DNS:"
  networksetup -getdnsservers "$svc" || true
  echo "网关/信息:"
  networksetup -getinfo "$svc" || true
}

if [[ -z "$PRESET" ]]; then
  echo "用法: sudo $0 <aliyun|dnspod|114|baidu|cloudflare|google|show|restore>"
  exit 1
fi

if [[ "$PRESET" == "show" ]]; then
  show_current
  exit 0
fi

if [[ "${EUID}" -ne 0 ]]; then
  echo "请使用 sudo 运行（networksetup 改 DNS 需要管理员权限）。"
  exit 1
fi

mkdir -p "$BACKUP_DIR"
SERVICE="$(active_service)"

if [[ "$PRESET" == "restore" ]]; then
  if [[ ! -f "$BACKUP_FILE" ]]; then
    echo "找不到备份 $BACKUP_FILE"
    exit 1
  fi
  # 备份格式: SERVICE|dns1 dns2...
  IFS='|' read -r BAK_SVC BAK_DNS < "$BACKUP_FILE"
  echo "将恢复服务 [$BAK_SVC] DNS -> $BAK_DNS"
  read -r -p "确认？输入 yes: " CONFIRM
  [[ "$CONFIRM" == "yes" ]] || { echo "已取消"; exit 0; }
  if [[ "$BAK_DNS" == "Empty" || -z "$BAK_DNS" ]]; then
    networksetup -setdnsservers "$BAK_SVC" Empty
  else
    # shellcheck disable=SC2086
    networksetup -setdnsservers "$BAK_SVC" $BAK_DNS
  fi
  show_current
  exit 0
fi

DNS_PAIR="$(resolve_preset "$PRESET" || true)"
if [[ -z "$DNS_PAIR" ]]; then
  echo "未知预设: $PRESET"
  exit 1
fi

echo ">>> 修改前"
show_current
CUR="$(networksetup -getdnsservers "$SERVICE" | tr '\n' ' ' | sed 's/[[:space:]]*$//')"
echo "${SERVICE}|${CUR}" > "$BACKUP_FILE"

echo "即将设置 [$SERVICE] DNS = $DNS_PAIR （预设 $PRESET）"
read -r -p "确认？输入 yes: " CONFIRM
[[ "$CONFIRM" == "yes" ]] || { echo "已取消"; exit 0; }

# shellcheck disable=SC2086
networksetup -setdnsservers "$SERVICE" $DNS_PAIR

echo ">>> 修改后"
show_current
echo "备份: $BACKUP_FILE"
