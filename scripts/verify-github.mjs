#!/usr/bin/env node
/**
 * 检查 GitHub 是否已发布，raw 安装脚本是否可访问。
 */
import { readRepoConfig, getGithubUrls } from "./github-source.mjs";

const config = readRepoConfig();
const urls = getGithubUrls(config);

const checks = [
  { name: "install.sh (raw)", url: urls.installShUrl },
  { name: "install.ps1 (raw)", url: urls.installPs1Url },
  { name: "source archive", url: urls.archiveTarUrl },
];

let allOk = true;

console.log(`检查仓库: https://github.com/${urls.github} (${urls.branch})\n`);

for (const check of checks) {
  try {
    const res = await fetch(check.url, { method: "HEAD", redirect: "follow" });
    const ok = res.ok;
    console.log(`${ok ? "✓" : "✗"} ${check.name}: ${res.status} ${check.url}`);
    if (!ok) allOk = false;
  } catch (error) {
    allOk = false;
    console.log(`✗ ${check.name}: ${error instanceof Error ? error.message : error}`);
    console.log(`  ${check.url}`);
  }
}

console.log("");
if (allOk) {
  console.log("GitHub 已就绪，同事可使用网络一键安装：");
  console.log(`  curl -fsSL ${urls.installShUrl} | bash`);
  process.exit(0);
}

console.log("GitHub 尚未发布或分支/仓库名不正确。");
console.log("请先 push 到 GitHub，并确认 repo.config.json 中 github/branch 正确。");
console.log(`  git remote add origin https://github.com/${urls.github}.git`);
console.log("  git push -u origin main");
console.log("");
console.log("本地可先验证安装逻辑：npm run test:install");
process.exit(1);
