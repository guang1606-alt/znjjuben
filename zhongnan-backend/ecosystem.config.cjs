/* 终南集 v2.78.0 生产守护配置（pm2）
 * 用法：
 *   pm2 start ecosystem.config.cjs
 *   pm2 reload ecosystem.config.cjs        # 零停机重启（先部署新 dist 再执行）
 *   pm2 logs zhongnan-api
 *   pm2 save && pm2 startup               # 开机自启
 * 说明：
 * - 应用读 PostgreSQL（无内存会话粘性），可多实例 cluster；SSE 为短连接流式响应，Nginx 需关 buffering。
 * - 托管放款（每小时）与自主进化调度在各实例均会触发，全部幂等，可安全多实例重复执行。
 * - NODE_ENV=production 下 JWT 密钥强制 env 提供，否则进程拒绝启动（见 src/lib/auth.ts）。
 */
module.exports = {
  apps: [
    {
      name: 'zhongnan-api',
      script: 'dist/index.js',
      cwd: __dirname,
      instances: process.env.PM2_INSTANCES || 2,
      exec_mode: 'cluster',
      max_memory_restart: '600M',
      kill_timeout: 8000,            // 等待在途 SSE/请求收尾
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 8080,
      },
      error_file: 'logs/err.log',
      out_file: 'logs/out.log',
      merge_logs: true,
      time: true,
      max_restarts: 10,
      restart_delay: 3000,
    },
  ],
};
