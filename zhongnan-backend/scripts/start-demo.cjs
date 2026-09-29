/* 跨平台本地演示启动器（Windows / macOS / Linux 通用）
 * 用法：先 npm install、npm run build，再 node scripts/start-demo.cjs
 * 或直接：npm run demo
 * 无需 Postgres：使用与自动化测试同源的内存数据桩，重启即清空，仅用于本机预览，严禁生产。
 */
process.env.DISABLE_AUTO_SCHEDULER = process.env.DISABLE_AUTO_SCHEDULER || '1';
process.env.PORT = process.env.PORT || '8099';
require('../dist/dev-server.js');
