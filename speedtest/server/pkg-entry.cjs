/**
 * pkg / 部分打包工具用的 CJS 入口。
 * 直接双击更推荐仓库里的「启动测网速.bat」。
 */
const path = require('path');
const { pathToFileURL } = require('url');

async function main() {
  const entry = path.join(__dirname, 'index.js');
  await import(pathToFileURL(entry).href);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
