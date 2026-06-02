import { readFileSync } from 'node:fs';
import type { CapacitorConfig } from '@capacitor/cli';

/** 读取 .env 中的 CAPACITOR_SERVER_URL（cap CLI 不会自动加载 Vite 的 .env） */
function loadCapacitorServerUrlFromDotenv() {
  if (process.env.CAPACITOR_SERVER_URL) return;
  try {
    const env = readFileSync('.env', 'utf8');
    for (const line of env.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      if (key !== 'CAPACITOR_SERVER_URL') continue;
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env.CAPACITOR_SERVER_URL = value;
      break;
    }
  } catch {
    // .env 不存在时忽略
  }
}

loadCapacitorServerUrlFromDotenv();

/**
 * 方案一：原生 APK 壳 + WebView 打开线上站点（推荐）
 *
 * 1. 在 .env 中设置（不要提交真实生产域名到公开仓库时可只用本地 .env）：
 *    CAPACITOR_SERVER_URL=https://你的项目.vercel.app
 * 2. npm run cap:sync
 * 3. npm run cap:open:android → Android Studio → Build APK
 *
 * 未设置 CAPACITOR_SERVER_URL 时仅同步静态资源（无 index.html，仅供 cap 校验目录）。
 */
const serverUrl = process.env.CAPACITOR_SERVER_URL?.replace(/\/$/, '');

const config: CapacitorConfig = {
  appId: 'com.yourcompany.ticketbuddy',
  appName: 'Ticket Buddy',
  webDir: '.vercel/output/static',
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext: serverUrl.startsWith('http://'),
        },
      }
    : {}),
};

export default config;
