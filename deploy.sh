#!/usr/bin/env bash
# 日课 (Rikou) 一键部署到 GitHub Pages
# 用法（在仓库目录里运行）：
#   方式 A · 用 Token（推荐，非交互）：
#     GITHUB_TOKEN=ghp_xxx GH_USER=你的用户名 bash deploy.sh
#   方式 B · 用 gh（先执行 gh auth login）：
#     bash deploy.sh
# 脚本会：创建公开仓库 -> 推送 master -> 开启 Pages（master / root）
set -euo pipefail

REPO="${REPO_NAME:-rikou}"
TOKEN="${GITHUB_TOKEN:-}"
GH_USER="${GH_USER:-}"

cd "$(dirname "$0")"

# 确保有提交
if [ -z "$(git log -1 --oneline 2>/dev/null)" ]; then
  echo "⚠️ 没有提交，先 git add -A && git commit -m 'init'"; exit 1
fi

enable_pages() {
  local user="$1"
  echo "→ 开启 GitHub Pages（master / root，约 30s 后生效）..."
  curl -s -X POST "https://api.github.com/repos/$user/$REPO/pages" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Accept: application/vnd.github+json" \
    -d '{"source":{"branch":"master","path":"/"},"build_type":"legacy"}' \
    || echo "（Pages 可能需到仓库 Settings → Pages 手动开启，不影响代码推送）"
  echo "✅ 上线地址：https://$user.github.io/$REPO/"
}

if [ -n "$TOKEN" ] && [ -n "$GH_USER" ]; then
  echo "→ 用 Token 创建仓库 $GH_USER/$REPO ..."
  curl -s -X POST "https://api.github.com/user/repos" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Accept: application/vnd.github+json" \
    -d "{\"name\":\"$REPO\",\"private\":false,\"auto_init\":false}" >/dev/null || true
  git remote remove origin 2>/dev/null || true
  git remote add origin "https://$GH_USER:$TOKEN@github.com/$GH_USER/$REPO.git"
  git push -u origin master
  enable_pages "$GH_USER"

elif command -v gh >/dev/null 2>&1; then
  echo "→ 用 gh 创建并推送仓库 $REPO ..."
  USER=$(gh api user -q .login)
  gh repo create "$REPO" --public --source=. --remote=origin --push || git push -u origin master
  echo "→ 开启 GitHub Pages ..."
  gh api -X POST "repos/$USER/$REPO/pages" \
    -f "source[branch]=master" -f "source[path]=/" >/dev/null 2>&1 \
    || echo "（请到仓库 Settings → Pages 选 master / root 后保存）"
  echo "✅ 上线地址：https://$USER.github.io/$REPO/"

else
  echo "❌ 需要 gh 或 GITHUB_TOKEN+GH_USER。"
  echo "   本地方式：先 'gh auth login'，再 'bash deploy.sh'"
  echo "   或设置环境变量：GITHUB_TOKEN=xxx GH_USER=你的用户名 bash deploy.sh"
  exit 1
fi
