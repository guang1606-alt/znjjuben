/**
 * v2.53 终南集·AGI编剧大师 · 全量 API 目录（功能 → API → 申请链接 唯一权威清单）
 * ------------------------------------------------------------------
 * 设计原则：
 *  1. 创作类（文本/图片大模型）与 model-catalog 的每个型号一一对应（catalogId），coverage 自检锁死不漏；
 *  2. 基础设施类（登录短信/支付/存储/审核/语音/存证）按功能列出首选与备选申请入口；
 *  3. C 端用户全程黑盒：本目录仅超管后台可见；所有密钥仅后台填写、加密存储；
 *  4. 链接为各厂商官方开放平台入口（2026-09 核实），如厂商改版以官网最新控制台为准；
 *     不写死任何密钥、不做第三方中转推荐（Midjourney 无官方 API，如实标注）。
 */

export type ApiLayer = 'llm_text' | 'llm_image' | 'infra';
export type Necessity = 'core' | 'optional' | 'alternative';

export interface ApiEntry {
  id: string;
  layer: ApiLayer;
  catalogId?: string;        // 对应 model-catalog TEXT_MODELS/IMAGE_MODELS 的 id（主）
  catalogIds?: string[];     // 同一申请入口覆盖的其他型号（如同厂商 Pro/Flash）
  vendor: string;
  product: string;
  region: 'domestic' | 'overseas' | 'either';
  usedBy: string[];          // 服务的岗位/功能
  consoleUrl: string;        // 注册/拿 key/充值 的官方入口
  docUrl?: string;           // 官方文档
  baseUrl?: string;          // OpenAI 兼容默认端点（创作类与 catalog 保持一致）
  necessity: Necessity;
  note: string;
}

export const API_DIRECTORY: ApiEntry[] = [
  /* ================= 一、文本大模型（10 岗位流水线，国内外最适 + 国产最强替补） ================= */
  {
    id: 'api_deepseek', layer: 'llm_text', catalogId: 'deepseek_v4flash', catalogIds: ['deepseek_v4pro'], vendor: '深度求索 DeepSeek', product: 'DeepSeek 开放平台（V4-Flash / V4-Pro 同入口）',
    region: 'domestic', usedBy: ['剧情架构师(首选/替补)', '观众代言官(首选)', '市场终评(首选)', '经济档逻辑岗'],
    consoleUrl: 'https://platform.deepseek.com/', docUrl: 'https://api-docs.deepseek.com/',
    baseUrl: 'https://api.deepseek.com/v1', necessity: 'core', note: '注册→充值→创建 API Key；推理/因果闭环国产第一，架构与挑漏主力',
  },
  {
    id: 'api_doubao', layer: 'llm_text', catalogId: 'doubao_seedflash', catalogIds: ['doubao_seed2pro'], vendor: '字节火山方舟', product: '豆包 Seed 2.0（Flash/Pro 同入口，方舟统一鉴权）',
    region: 'domestic', usedBy: ['单集撰写师(首选)', '细节润色师(首选)', '人设设计师(替补)', '经济档成稿'],
    consoleUrl: 'https://console.volcengine.com/ark', docUrl: 'https://www.volcengine.com/docs/82379',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', necessity: 'core', note: '开通模型推理→创建接入点(Endpoint)→拿 API Key；中文成稿“最像人”，去AI味主力',
  },
  {
    id: 'api_qwen', layer: 'llm_text', catalogId: 'qwen38max', vendor: '阿里云百炼', product: '通义千问 Qwen（百炼 Model Studio）',
    region: 'domestic', usedBy: ['合规审核师(旗舰首选)', '市场前置(国产最强替补)', '人设/架构替补'],
    consoleUrl: 'https://bailian.console.aliyun.com/', docUrl: 'https://help.aliyun.com/zh/model-studio/',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', necessity: 'core', note: '百炼控制台开通服务→创建 API-KEY；最均衡无短板，中文政策尺度稳',
  },
  {
    id: 'api_kimi', layer: 'llm_text', catalogId: 'kimi_k3', vendor: '月之暗面 Moonshot', product: 'Kimi 开放平台（K3）',
    region: 'domestic', usedBy: ['长上下文资料消化', '润色/观众岗替补', '合规第二替补'],
    consoleUrl: 'https://platform.moonshot.cn/console', docUrl: 'https://platform.moonshot.cn/docs',
    baseUrl: 'https://api.moonshot.cn/v1', necessity: 'core', note: '实名→充值→API Key 管理；超长上下文、高性价比',
  },
  {
    id: 'api_minimax', layer: 'llm_text', catalogId: 'minimax_m25', vendor: 'MiniMax 开放平台', product: 'MiniMax-M2.5（国内站）',
    region: 'domestic', usedBy: ['人设设计师(标准档首选)', '单集撰写替补', '旗舰档人设国产最强替补'],
    consoleUrl: 'https://platform.minimaxi.com/', docUrl: 'https://platform.minimaxi.com/docs',
    baseUrl: 'https://api.minimax.chat/v1', necessity: 'core', note: '账户管理→接口密钥→创建 Key 并充值；角色对白/声口差异化最强；国际站为 platform.minimax.io',
  },
  {
    id: 'api_openai', layer: 'llm_text', catalogId: 'gpt_5flag', vendor: 'OpenAI', product: 'GPT-5.x（旗舰档架构，海外）',
    region: 'overseas', usedBy: ['旗舰档剧情架构师首选'],
    consoleUrl: 'https://platform.openai.com/', docUrl: 'https://platform.openai.com/docs',
    baseUrl: 'https://api.openai.com/v1', necessity: 'alternative', note: '需海外主体/合规网络与外币结算；仅旗舰档使用，断供时自动切国产替补 DeepSeek-V4-Pro',
  },
  {
    id: 'api_anthropic', layer: 'llm_text', catalogId: 'claude_sonnet5', catalogIds: ['claude_opus5'], vendor: 'Anthropic', product: 'Claude Sonnet/Opus（旗舰档人设润色，海外）',
    region: 'overseas', usedBy: ['旗舰档人设设计师/细节润色师首选', '按本精修增值'],
    consoleUrl: 'https://console.anthropic.com/', docUrl: 'https://docs.anthropic.com/',
    baseUrl: 'https://api.anthropic.com/v1', necessity: 'alternative', note: '叙事去AI腔第一梯队；海外结算，断供自动切 MiniMax/豆包；Opus 仅按本精修、不进每集组合',
  },
  {
    id: 'api_gemini', layer: 'llm_text', catalogId: 'gemini_3pro', vendor: 'Google', product: 'Gemini 3.x Pro（AI Studio / Vertex，海外）',
    region: 'overseas', usedBy: ['旗舰档市场前置（海外榜单/多语资料消化）'],
    consoleUrl: 'https://aistudio.google.com/', docUrl: 'https://ai.google.dev/',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', necessity: 'alternative', note: '百万级上下文与多语；海外使用，国产替补为通义 Qwen',
  },

  /* ================= 二、图片大模型（剧本海报/分镜图，全部收费、无免费额度） ================= */
  {
    id: 'img_gptimage', layer: 'llm_image', catalogId: 'gpt_image', vendor: 'OpenAI', product: 'GPT-image-1（你指定的 image2 位，旗舰海报）',
    region: 'overseas', usedBy: ['剧本海报-旗舰档(199积分档)', '文字排版精准海报'],
    consoleUrl: 'https://platform.openai.com/', docUrl: 'https://platform.openai.com/docs/guides/image-generation',
    baseUrl: 'https://api.openai.com/v1', necessity: 'core', note: '用户指定必接；海外结算，国产替补为 Seedream',
  },
  {
    id: 'img_seedream', layer: 'llm_image', catalogId: 'seedream', vendor: '字节火山方舟', product: '即梦 Seedream 4.x（标准海报/分镜）',
    region: 'domestic', usedBy: ['剧本海报-标准档(39积分档)', '国风海报', 'AIGC 机器分镜图'],
    consoleUrl: 'https://console.volcengine.com/ark', docUrl: 'https://www.volcengine.com/docs/6791',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', necessity: 'core', note: '与豆包同一方舟入口开通图像模型；中文海报性价比主力',
  },
  {
    id: 'img_wanx', layer: 'llm_image', catalogId: 'wanx', vendor: '阿里云百炼', product: '通义万相（走量图）',
    region: 'domestic', usedBy: ['剧本海报-经济走量', '分享卡片底图'],
    consoleUrl: 'https://bailian.console.aliyun.com/', docUrl: 'https://help.aliyun.com/zh/model-studio/developer-reference/image-generate',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', necessity: 'alternative', note: '与通义千问同一百炼 Key，便宜稳定',
  },
  {
    id: 'img_kling', layer: 'llm_image', catalogId: 'kling_image', vendor: '快手可灵', product: '可灵图像（可图大模型）',
    region: 'domestic', usedBy: ['写实人像/电影感海报', '故事板分镜'],
    consoleUrl: 'https://app.klingai.com/cn/dev', docUrl: 'https://app.klingai.com/cn/dev/document-api/quickStart/productIntroduction/overview',
    baseUrl: 'https://api.klingai.com', necessity: 'alternative', note: 'Web 端右上角“API 调用”进入开发者后台，开通资源包后拿 AccessKey/SecretKey；也可经阿里云百炼调用',
  },
  {
    id: 'img_flux', layer: 'llm_image', catalogId: 'flux', vendor: 'Black Forest Labs', product: 'Flux 1.1 Pro（海外）',
    region: 'overseas', usedBy: ['质感细节海报备选'],
    consoleUrl: 'https://docs.bfl.ml/', docUrl: 'https://docs.bfl.ml/',
    baseUrl: 'https://api.bfl.ml/v1', necessity: 'alternative', note: '官网注册→Dashboard 建 Key；海外结算',
  },
  {
    id: 'img_sd3', layer: 'llm_image', catalogId: 'sd3', vendor: 'Stability AI', product: 'Stable Diffusion 3.x（海外）',
    region: 'overseas', usedBy: ['可控分镜/开源生态工作流'],
    consoleUrl: 'https://platform.stability.ai/', docUrl: 'https://platform.stability.ai/docs',
    baseUrl: 'https://api.stability.ai/v2beta', necessity: 'alternative', note: '注册→Account→API Keys；海外结算',
  },
  {
    id: 'img_recraft', layer: 'llm_image', catalogId: 'recraft', vendor: 'Recraft', product: 'Recraft V3（海外，海报文字排版）',
    region: 'overseas', usedBy: ['带大量美术字的海报备选'],
    consoleUrl: 'https://www.recraft.ai/', docUrl: 'https://www.recraft.ai/docs-api',
    baseUrl: 'https://external.api.recraft.ai/v1', necessity: 'alternative', note: '注册后在个人面板生成 API Key',
  },
  {
    id: 'img_mj', layer: 'llm_image', catalogId: 'midjourney_proxy', vendor: 'Midjourney', product: 'MJ（无官方 API，仅第三方兼容代理）',
    region: 'overseas', usedBy: ['风格化海报（可选，非必需）'],
    consoleUrl: '', docUrl: '',
    baseUrl: '', necessity: 'optional', note: 'Midjourney 官方不提供开放 API，只能接可信中转并自担稳定性/合规风险；默认不启用',
  },

  /* ================= 三、基础设施 API（平台运转必备，与创作模型解耦） ================= */
  {
    id: 'infra_sms', layer: 'infra', vendor: '阿里云短信服务（首选）/腾讯云短信（备选）', product: '手机号验证码登录/注册',
    region: 'domestic', usedBy: ['手机号注册登录', '风控通知'],
    consoleUrl: 'https://dysms.console.aliyun.com/', docUrl: 'https://help.aliyun.com/product/44282.html',
    necessity: 'core', note: '需签名+模板报备审核；备选 https://console.cloud.tencent.com/smsv2',
  },
  {
    id: 'infra_wechat_login', layer: 'infra', vendor: '微信开放平台', product: '微信一键登录 / 分享回流',
    region: 'domestic', usedBy: ['微信登录', '一键分享到微信'],
    consoleUrl: 'https://open.weixin.qq.com/', necessity: 'core', note: '创建网站应用→审核拿 AppID/AppSecret；分享另需微信 JSSDK 安全域名配置',
  },
  {
    id: 'infra_douyin_login', layer: 'infra', vendor: '抖音开放平台', product: '抖音一键登录 / 视频分享',
    region: 'domestic', usedBy: ['抖音登录', '作品分享抖音'],
    consoleUrl: 'https://developer.open-douyin.com/', necessity: 'core', note: '创建网页应用申请 user_info 等 scope，审核通过后接入 OAuth',
  },
  {
    id: 'infra_pay_wx', layer: 'infra', vendor: '微信支付', product: 'JSAPI/Native 支付（会员/积分/增值）',
    region: 'domestic', usedBy: ['会员充值', '积分购买', '增值服务', '交易广场担保支付'],
    consoleUrl: 'https://pay.weixin.qq.com/', necessity: 'core', note: '需营业执照、对公账户、商户号；支付回调必须服务端验签',
  },
  {
    id: 'infra_pay_ali', layer: 'infra', vendor: '支付宝开放平台', product: '电脑网站/手机网站支付（备选）',
    region: 'domestic', usedBy: ['会员/积分充值备选渠道'],
    consoleUrl: 'https://open.alipay.com/', necessity: 'alternative', note: '创建网页/移动应用，配置应用公钥与异步通知地址',
  },
  {
    id: 'infra_oss', layer: 'infra', vendor: '阿里云 OSS（首选）/腾讯云 COS（备选）', product: '对象存储（作品/上传/海报/有限存储空间）',
    region: 'domestic', usedBy: ['用户作品与附件存储', '海报导出', '存储空间计费扩容', 'docx/pdf 下载'],
    consoleUrl: 'https://oss.console.aliyun.com/', necessity: 'core', note: 'Bucket 私有读写+STS 临时签名直传；备选 https://console.cloud.tencent.com/cos；存储容量与用户扩容包挂钩核算',
  },
  {
    id: 'infra_moderation', layer: 'infra', vendor: '阿里云内容安全（首选）/火山内容审核（备选）', product: '文本/图片合规审核',
    region: 'domestic', usedBy: ['三级内容审核（生成前拦截/生成中校验/抽检）', '社区广场/交易/评论审核', 'X剧本分级前置'],
    consoleUrl: 'https://yundun.console.aliyun.com/', docUrl: 'https://help.aliyun.com/product/28415.html',
    necessity: 'core', note: '对接网络视听审核标准；本地敏感词库为第一道，云审核为第二道，人工抽检第三道',
  },
  {
    id: 'infra_tts_asr', layer: 'infra', vendor: '火山引擎语音（首选）/阿里云智能语音（备选）', product: 'TTS 听剧本 + ASR 语音输入',
    region: 'domestic', usedBy: ['高级会员“听剧本”(TTS)', '采访式创作全程语音口述转写(ASR)', '小南语音交互'],
    consoleUrl: 'https://console.volcengine.com/speech', necessity: 'core', note: '备选 https://nls-portal.console.aliyun.com/；按字符/时长计费，计入小南/听剧本积分成本分摊',
  },
  {
    id: 'infra_realname', layer: 'infra', vendor: '公安三所/阿里云实人认证', product: '实名认证（X剧本成年分级前置）',
    region: 'domestic', usedBy: ['X剧本开通前身份与成年核验'],
    consoleUrl: 'https://yundun.console.aliyun.com/?p=cfv', necessity: 'optional', note: 'X剧本问卷+免责之外再加实名成年校验，分级合规留痕；露骨淫秽内容任何法域硬禁，实名不豁免',
  },
  {
    id: 'infra_copyright', layer: 'infra', vendor: '至信链/蚂蚁链（区块链存证）', product: '剧本版权存证增值服务',
    region: 'domestic', usedBy: ['一键版权存证(收费增值)'],
    consoleUrl: 'https://antchain.antgroup.com/', necessity: 'optional', note: '按次存证计费，向用户收增值费；存证哈希+时间戳，不替代著作权登记',
  },
  {
    id: 'infra_email', layer: 'infra', vendor: '阿里邮件推送/腾讯企业邮箱 SMTP', product: '事务邮件（验证码/订单/投稿对接）',
    region: 'domestic', usedBy: ['注册找回', '订单与交易通知', '投稿渠道对接邮件'],
    consoleUrl: 'https://dm.console.aliyun.com/', necessity: 'alternative', note: '发信域名需 SPF/DKIM 校验；也可用企业邮箱 SMTP 中继',
  },
];

/** 目录自检：model-catalog 每个型号都必须能在目录里找到申请入口（LOCAL 本地引擎除外） */
export function directoryCoverage(catalog: { id: string; modality: string }[]): { missing: string[]; extra: string[] } {
  const mapped = new Set<string>();
  API_DIRECTORY.forEach((e) => { if (e.catalogId) mapped.add(e.catalogId); (e.catalogIds || []).forEach((x) => mapped.add(x)); });
  const catIds = catalog.filter((c) => c.id !== 'LOCAL').map((c) => c.id);
  const missing = catIds.filter((id) => !mapped.has(id));
  const extra = [...mapped].filter((id) => !catIds.includes(id));
  return { missing, extra };
}

export function apiByLayer(layer: ApiLayer): ApiEntry[] {
  return API_DIRECTORY.filter((e) => e.layer === layer);
}
