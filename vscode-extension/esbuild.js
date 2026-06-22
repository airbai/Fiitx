/**
 * esbuild.js — Deepsix VS Code Extension 构建脚本
 *
 * 使用 esbuild 将 TypeScript 源码编译为单个 dist/extension.js。
 * 支持 --watch 模式用于开发。
 *
 * 用法:
 *   node esbuild.js           # 生产构建
 *   node esbuild.js --watch   # 监听模式
 */

const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const isWatch = process.argv.includes('--watch');
const isProduction = process.argv.includes('--production') || !isWatch;

/** 确保输出目录存在 */
function ensureDist() {
  const distDir = path.resolve(__dirname, 'dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
}

/** 构建选项 */
function getBuildOptions() {
  return {
    entryPoints: [path.resolve(__dirname, 'src/extension.ts')],
    bundle: true,
    outfile: path.resolve(__dirname, 'dist/extension.js'),
    external: ['vscode'],
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    sourcemap: isWatch ? 'inline' : false,
    minify: isProduction,
    keepNames: true,
    treeShaking: true,
    legalComments: 'none',
    logLevel: 'info',
    define: {
      'process.env.NODE_ENV': isProduction ? '"production"' : '"development"',
    },
  };
}

async function main() {
  ensureDist();
  const options = getBuildOptions();

  if (isWatch) {
    // 监听模式
    const ctx = await esbuild.context(options);
    await ctx.watch();
    console.log('[esbuild] 监听中... 按 Ctrl+C 停止');
  } else {
    // 单次构建
    const result = await esbuild.build(options);
    const stats = fs.statSync(options.outfile);
    console.log(`[esbuild] ✓ 构建完成: ${options.outfile}`);
    console.log(`[esbuild]   大小: ${(stats.size / 1024).toFixed(1)} KB`);
    console.log(`[esbuild]   模式: ${isProduction ? 'production' : 'development'}`);

    if (result.errors.length > 0) {
      console.error('[esbuild] 构建错误:', result.errors);
      process.exit(1);
    }
    if (result.warnings.length > 0) {
      console.warn('[esbuild] 构建警告:', result.warnings);
    }
  }
}

main().catch((error) => {
  console.error('[esbuild] 构建失败:', error);
  process.exit(1);
});
