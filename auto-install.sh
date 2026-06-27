#!/usr/bin/env bash
# 兼容旧链接，等同于 install.sh
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/install.sh" "$@"
