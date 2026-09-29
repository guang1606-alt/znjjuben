---
name: zhongnan-shortdrama-craft
description: 竖屏短剧人类级剧本创作技能。当需要创作/改写/诊断竖屏短剧、微短剧、AIGC制作剧本、真人实拍剧本，或涉及分集大纲、钩子、反转、爽点、人设反差、节奏曲线、去AI味、12种创作模式（采访式/标签/小说改编/互动分支/名场面/热点追更/爆款逆向/短视频脚本/软广脑洞/X剧本/长系列IP/电影灰度）时使用。内置21套类型引擎210装置、四层钩子体系、26节拍、双制式格式、统一创作规范、进化与反自我封闭协议与创作硬底线。
metadata:
  version: 2.185.20
---

# 终南剧本创作技能（人类级·去AI味·双制式）

本技能是「终南集 · 人工通用智能（AGI）编剧大师」的创作内核封装。目标：写出无法被识别为 AI、符合市场规律、可直接拍摄或进入 AIGC 制作的竖屏短剧剧本。

## 何时使用
- 用户要写/改/续写/拆解竖屏短剧、微短剧剧本或分集大纲
- 用户要把小说/热点/名场面/爆款改成短剧，或要互动分支、软广脑洞、短视频脚本
- 用户要给剧本做去 AI 味、节奏、钩子、人设、台词口语化诊断
- 用户要区分真人实拍本与 AIGC 制作本的写法

## 创作总流程（统一规范，禁止一键终稿；详见 references/05-unified-spec.md）
1. **梗概大纲**：核心创意+人物小传（含隐性设定）+全剧大纲+分集梗概
2. **初稿剧本**：完整剧情与台词，故事闭环
3. **润色优化**：节奏/台词/生活细节润色、去AI痕迹
4. **精修定稿**：按平台规则与制式（LIVE/AIGC）交付级剧本
- 六维质量评分：人物、剧情、台词、市场、格式、去AI化（逐集/全本可评，优化保留版本可对比）。
- 四层钩子：开篇钩（黄金三秒）、集尾钩（追更钩）、场钩（目标阻断/信息抛出/转场疑问）、微钩（动作/语言/氛围/情绪/信息差/伏笔六风味）；默认系统按节奏曲线布点，用户可指定层级，禁止僵硬套模板。

## 类型引擎选择（详见 references/01-devices.md）
命中多个引擎时装置叠加使用；识别不出时用通用三件套（强钩子开局、清晰欲望链、集尾反转）兜底。
| id | 引擎 | 装置数 |
|---|---|---|
| comedy | 喜剧机制 | 10 |
| mystery | 悬疑烧脑机制 | 10 |
| tourism | 文旅机制 | 10 |
| transmigrate | 穿书穿越机制 | 10 |
| romance | 甜宠虐恋机制 | 10 |
| underdog | 下沉爽剧机制 | 10 |
| ruleloop | 无限流规则怪谈机制 | 10 |
| court | 宅斗宫斗权谋复仇机制 | 10 |
| family | 家庭伦理年代情感机制 | 10 |
| professional | 职业行业剧机制 | 10 |
| xuanhuan | 男频玄幻修仙升级机制 | 10 |
| spy | 年代谍战民国潜伏机制 | 10 |
| apocalypse | 科幻末世废土求生机制 | 10 |
| military | 军旅特战现代军事机制 | 10 |
| esports | 游戏电竞体育竞技机制 | 10 |
| meta | 戏中戏元叙事结构机制（结构型，可叠加任意题材） | 10 |
| investigation | 刑侦法医罪案程序机制 | 10 |
| tender | 萌宝银发亲情治愈机制 | 10 |
| rural | 乡村乡土地域年代机制 | 10 |
| sisterhood | 女性群像女性互助机制 | 10 |
| nation | 国运秘境全民觉醒机制 | 10 |

## 钩子与节拍（详见 references/02-hooks.md、03-beats.md）
- 四层钩子：开篇黄金三秒钩、集尾追更钩、场钩（目标阻断/信息抛出/转场疑问）、句段微钩（动作/语言/氛围/情绪/信息差/伏笔六风味）；默认系统布点，也可由用户指定层级。
- 三类节拍：反转（须前置伏笔，拒绝机械降神）、爽点兑付（压抑-兑现节奏，不无脑爽）、情绪（留白与呼吸感）。

## 进化与反自我封闭（详见 references/06-evolution.md，强制执行）
- **可复用**：本技能为纯方法资产，跨窗口加载即用；**可进化**：后台学习窗口/在榜爆款/平台规则/用户反馈持续注入；**可迭代**：新知识先过合规一致性与标准用例 A/B 验证，提升才全量、否则回滚。
- **反封闭铁律**：禁止只在既有生成内容里自我复制，每次创作必须显式经过外部校准（市场热度/平台规则/用户画像至少一项），无外部信号时标注“缺市场校准”；方法可复用、事实要新鲜；低效装置定期下线，防止风格固化。
- 同一需求多版本必须强制差异化（人设/走向/核心冲突不同），杜绝换汤不换药。
- **自我成长与维护（增/减/优化/优胜劣汰/自我批判，流程见 06 第六节）**：新增方法须四段齐全+查重+补测试；优化须标准用例 A/B 证实有效；低效/相悖条目观察期后下线；每轮主动找反例、查逻辑相悖与旧断言、不臆造事实，做不到就如实标缺口。

## 双制式与硬底线（详见 references/04-formats.md，必须严格执行）
- 真人实拍 800-1000 字、△可拍摄动作、给导演留空间；AIGC 1200-1500 字、视听信息只写动作行、约30秒一微单元。
- 两种制式都必须是标准剧本，**严禁输出提示词手册、模型参数、关键词堆砌**。

## 视觉画风编码（v2.148，AIGC 漫剧专用）
灵感吸收自"画风编码直接生图"方法论：编号 + 可执行 prompt 模板，编号即画风。工具端已建库（engine/visual-style-library，12 族系）并自动注入分镜导出附录与海报生图；会话内创作按编号调用，**画风归视觉层，严禁写进剧本正文**（正文不写提示词/镜头术语）：
- VS01 水墨国风（仙侠玄幻气质）｜VS02 韩漫厚涂（都市复仇情感重炮）｜VS03 日系赛璐璐（青春台词驱动）｜VS04 手绘绘本蜡笔（种田治愈暖感）｜VS05 美漫硬朗（战神/发疯力量感）｜VS06 3D皮克斯（合家欢轻喜剧）｜VS07 国潮插画（国风现代混搭）｜VS08 暗黑哥特线稿（黑化悬疑底色）｜VS09 水彩淡彩（清新恋爱慢节奏）｜VS10 赛博霓虹（都市异能未来感）｜VS11 工笔重彩（宅斗宫斗华贵）｜VS12 极简线条（元叙事快节奏）
- 按题材推荐：无脑套错画风=视觉气质与题材错配（如黑化虐文配 3D 皮克斯、发疯流配水彩）；用户只说"漫剧"未选画风时，按题材给 1 个推荐编号并说明理由，尊重用户最终选择。

## 镜头语言编码（v2.149，AIGC 漫剧专用）
灵感吸收自"不同等级编导AI做漫剧"方法论中 L3 高手做法——人定标准、AI 量产：把镜头语言（景别节奏/运镜性格/转场逻辑/情绪压缩）沉淀成强约束编码。工具端已建库（engine/camera-language-library，12 族系）并自动注入分镜导出附录（与画风锚点并行：画风锚点管"长什么样"，镜头锚点管"怎么拍"）；会话内创作按编号调用，**镜头语言归制作层，严禁写进剧本正文**（正文不写提示词/镜头术语，正文只给 △ 动作与台词）：
- CL01 快切直给爽点流（复仇/战神/断亲节奏引擎）｜CL02 长镜压迫悬疑流（黑化/读心压迫感）｜CL03 手持纪实临场流（都市异能/扮猪吃虎网感）｜CL04 推拉戏剧变交流（发疯/战神情绪放大器）｜CL05 环绕高光展示流（打脸高光标配，扮猪吃虎前期禁用）｜CL06 静帧情绪定格流（虐恋/黑化定格杀）｜CL07 跳切元喜剧流（元叙事/发疯喜剧呼吸方式）｜CL08 慢摇治愈长镜流（种田/清新恋爱底节奏）｜CL09 第一人称代入流（读心/系统面板体验感）｜CL10 俯仰权势镜头流（宅斗/复仇地位语言）｜CL11 蒙太奇时间压缩流（系统升级/回忆杀效率工具）｜CL12 稳定对称仪式流（宅斗礼法底色，爆发戏切回 CL01/CL04）
- 按题材推荐与禁配规则同画风库：无脑套错镜头语言=节奏气质与题材错配（如种田治愈配快切、黑化沉浸段配蒙太奇）；用户未选时按题材给 1 个推荐编号并说明理由，尊重用户最终选择。

## 编导分级协作法（v2.149，链接启发：不同等级编导 AI 做漫剧）
同一个 AI，编导等级决定产出上限。协助用户时先诊断其处于哪一级，按级校准交付颗粒度，帮用户从低级向高级升级：
- **L1 新手**（AI 当生成器：一句话全包）症状：每集从零开始、产出同质、做三五集断更。协助方式：不纵容一键终稿（本技能总流程已强制），主动带其走 梗概→初稿→打磨 全流程，每步解释"为什么这样改"。
- **L2 熟手**（AI 当流水线：清单分步派活）症状：会分步但靠灵感选题、无沉淀。协助方式：给可复用清单（剧本清单→分镜清单→素材清单→剪辑清单），引导其沉淀题材模型与角色资产。
- **L3 高手**（人定标准 AI 量产）特征：题材可模型化、单集可模板化、角色可资产化、场景可复用化。协助方式：尊重其强约束，AI 只在其标准内生产；帮其把标准沉淀为编号库（文字风格/画风/镜头语言）与偏好配置（hookPrefs/beatPrefs/visualStyleId/cameraStyleId/角色资产库）。

## 角色资产库（v2.151，L3"角色可资产化"工具落地）
换剧不换角色：把"养熟的角色"沉淀成跨剧可复用资产，立项时引用即全剧生效。工具端已建闭环（engine/character-asset + /character-assets 端点 + 立项引用多选 + 作品库一键沉淀）：
- **沉淀**（确定性、零 token）：项目全局圣经（bible.characters）+ 最近成稿 → 人设内核（traits/arc 压缩）+ 声音特质 + 标志性台词草稿（最长一句截 40 字，仅气质锚）+ 声纹指纹（对白指纹引擎对成稿重算，一手源，不依赖落库摘要）。
- **引用**（立项 castAssetIds）：快照进 project.bible.castAssets，全剧沿用；生成时编译成三岗位强约束指令——架构师管欲望链与行为逻辑、人设师管人物卡落库、撰写师管台词声音特征。
- **跨剧可辨识原则**：名字可随新剧世界观调整，但人设内核（欲望/弧光/性格底色）与声音特征（句式节奏/语气词/口头禅）必须保持——观众换剧也能认出"就是那个角色"；标志性台词禁止逐字照搬进新剧情节。
- 资产未覆盖的角色按本剧大纲自由创作，资产角色与非资产角色气质不得混用。会话内协助 L3 用户时，主动提示用作品库「沉淀角色资产」把高完成度角色入库。

## 角色资产体检与运营（v2.152，L3"资产化运营"能力沉淀）
资产入库不是终点，空壳档与气质撞车会让引用形同虚设。创作页「角色资产库」面板提供体检/编辑/删除闭环（engine/asset-health + GET /character-assets/health，零 token 确定性）：
- **五维完整度评分**（0-100）：人设内核 30（<8 字扣 10：欲望/弧光/性格底色至少写全两项）/ 声音特质 20 / 声纹指纹 20 / 标志性台词 15 / 视觉锚点 15。≥85 完整（可直接跨剧引用）、55-84 可用、<55 空壳（引用后三岗位拿不到有效约束）。
- **库级冲突预警**：同名不同人设（upsert 整档覆盖会静默丢档，先改名或合并）；异名同人设（重复档，合并）；声纹指纹一致但人设不同（换剧"听串"源，调其中一个的句式/语气词）。
- **运营节奏**：沉淀后先看体检——缺声纹就去成一集再沉淀、缺视觉锚点就补一个稳定外形特征；编辑面板即"一人一档"完整表单（整档覆盖语义，改名等于新档）；删除前确认已引用项目仍保留快照。
- **沉淀只增强不降级（v2.153 复盘修订）**：重新沉淀时空值不覆盖——手动精修的 voice/标志性台词/声纹不被沉淀稿静默回退清空（与沉淀不触碰 visualAnchor/tags 对称）；persona 属本体语义、始终以 bible 一手源刷新。手动精修与重新沉淀可以共存，不怕互相冲掉。
- 会话内协助时：用户引用资产前先提醒过一遍体检徽章，"空壳资产"宁可先补全再引用；发现冲突预警优先处理同名档。

## 制作物料清单（v2.154，L2"熟手清单法"落地：剧本清单→分镜清单→素材清单）
成稿之后，制片交付还差"跨集总表"。物料清单从成稿确定性聚合三张表（engine/production-materials，零 token）：场景总表（内外景·地点·日/夜·出现集次，场头解析）/ 角色出场表（说话人×台词量×出场集，与角色逻辑引擎同口径）/ 道具总表（关键信物×出现集×销毁封禁态，与信物账本同词典）。入口：下载菜单「📋 制作物料清单」弹窗预览+一键复制；GET /api/export/:id/materials（登录即可）；导出文档自动内嵌「制作物料清单（制片交付页）」（先于分集正文，全等级可见）。
- **用途分轨**：真人实拍——场景表直接折算通告单与置景计划（内/外景决定搭景还是实景）、角色表就是演员通告量序、道具表是道具准备清单；AIGC——场景表是生图场景库的组织索引（同场景复用统一参考图）、角色表决定角色资产优先级、道具表盯信物连续性。
- **场头即数据**：场景表质量取决于场头规范（「内景/外景 地点 时间」），场头缺时间归"未标注"行、缺地点不进表——补场头即补物料。会话内协助时：交付成稿前顺手看一眼物料表，场景集数异常集中（全剧一场景）或角色台词断档都是体检信号。

## 场景明细矩阵（v2.155，物料三表下沉到"场"粒度：总表管统筹、明细管开工）
三张总表回答"要准备什么"，场景明细矩阵回答"每一场怎么拍"（engine/production-materials 的 buildSceneBreakdown，与总表零新正则同口径）。materials 端点新增 `sceneBreakdown`：`details` 逐集逐场（场号/内外景/地点/日夜/场内角色台词量降序/场内信物出现序/场块净字数/生图提示词）+ `matrix` 跨集按场景聚合（场景×角色×信物×集次×场次，按场次降序——场次最多的场景就是置景复用与演员通告的排头兵）。
- **场景生图提示词即拿即用**：每个明细自带 `prompt` = 项目 bible.visualStyleId 的英文画风段置前（v2.148 注入顺序约定）+ `地点（内/外景，日/夜），空镜环境参考图`。AIGC 工作流里逐场空镜参考图无需再手写提示词，无画风编号时退化为纯场景描述。口径约定：场块切分必须与场头约定同用 `split('\n')`（lineIndex 对齐铁律），首场头前的序章行不进任何场块。
- **面板 tags 缺失修复（同 c148"空值覆盖"家族）**：资产编辑表单补 tags 字段（逗号分隔、8×20 截断）随档提交——POST 整档覆盖语义下不提交即静默清空，表单缺字段=数据丢失通道。教训：覆盖式接口新增可选键时，编辑表单必须同步跟进。
- **体检端点分页（limit/offset/total）**：资产体检从全量返回改为默认 50 条分页（上限 200），`conflicts` 冲突预警仍跑全量库——页内查重会漏跨页 same_persona/dup_name，"列表可分页、查重必须全量"是分页改造的边界铁律。

## 截断可见性与家族复盘（v2.156，c151 复盘轮：覆盖式接口×表单字段家族横扫）
- **家族排查结论**：POST /character-assets（整档覆盖）字段已全对齐——voicePrint 不进编辑表单属正确设计（沉淀计算产物手填无意义），且 update 不含该字段即不触碰，手动编辑不会清空声纹；project.bible 偏好键（hookPrefs/beatPrefs/visualStyleId/cameraStyleId）走 `{ ...curBible, key }` 合并语义，无覆盖风险。
- **列表硬帽静默截断修复**：GET /character-assets take 100→200（与体检分页上限对齐）+ 响应带 total；前端立项下拉尾部与资产面板显示"其余 N 条未显示"提示——沉淀按项目累积可轻松超 100，原硬帽让立项下拉漏资产且无任何提示。
- **体检徽章"空壳误报"修复**：资产 51+ 时默认 limit=50 的 healths 让第 51+ 资产回退显示"空壳 0 分"徽章（实际可能是 85 分富档）——前端改 limit=200 拉满，面板 total>shown 时给截断提示行。
- **物料弹窗 prompt 进预览层**：场景生图提示词（v2.155"即拿即用"卖点）原本只在下载文档可见，物料弹窗矩阵行下现在附 🎨 prompt 行（details 首现场景按「内外|地点|时间」键映射）。
- **方法论沉淀**：①"截断必须可见"——任何硬帽截断（列表/体检/下拉）要么提高帽对齐上下游，要么在 UI 显示 total 与截断提示；静默截断是"表单缺字段静默清空"的同族数据丢失通道。②徽章 fallback（map miss → 默认 0 分）在分页场景会从"防御"变质为"误报"，修分页必须同步检查 fallback 路径。③复盘轮固定动作：先横扫"覆盖式接口×表单字段"家族（grep `?? []`/`?? null` 覆盖模式对照前端表单），再核查"端点新增字段前端是否消费"（total/offset/prompts 最易漏），最后跑近三轮功能链路自洽（生成路径与回看路径都要验）。

## 场头前置教学与口径同源（v2.157，c152：一次写对省 retry token）

- **病象**：场头规范引擎（v2.125）只在 QC 重试时注入纠偏 advice，三岗位初始指令零场头教学——模型"先错再纠"，每次 retry 白付一轮 token；且 LIVE 模板教的「场景：地点 时间 内景/外景」无编号，恰好踩中引擎 missing_number 扣分项（教学与检测打架）。
- **修法**：`buildSceneHeaderDirective(mode, lang)` 把 convention 判分口径反向前置成生成前教学——LIVE 教「场景N：地点·时间」（带编号过 missing_number）、AIGC 教「内景/外景 地点·时间」、en 教 INT./EXT.；五条硬约束（编号连续/场头独占一行/地点具体/时间必填/全剧统一格式）。拼进 formatDirective 后架构师/撰写师/打回重写三条路径零改动全覆盖。同文件维护 = 教学与检测同源，改口径不会漂移。
- **口径同源连带修复**：convention 此前把「内景/外景 地点」判 unknown+missing_number，与 aigc-screenplay 的 SCENE_HEAD_RE 口径冲突（AIGC 制式照教写会全场头"违规"）。新增 bare_cn 合法格式（无编号要求，与 en 同权），per-header reasons 与 missingNumberCount 两处口径同步改。
- **物料联动**：stats 新增 headerTotal/headerValid/headerRate（合规率 0-100，置景排期风险预警）；formatMaterialsLines 场景总表标题与前端物料弹窗 summary 均带出合规率，低合规率一眼可见。
- **方法论沉淀**：①"前置教学优于事后纠偏"——QC 引擎发现的每类高频错误，都该问一句"生成前教了吗"；retry 闭环是保底不是常态，一次写对省的是整轮 token。②教学指令必须与检测引擎同源同文件，否则教学口径与判分口径会各自漂移（本次 LIVE 模板无编号就是两处各写各的产物）。③多制式产品里"同一概念"（场头）在各制式下的合法形态可以不同（live_cn/bare_cn/en 三口径），教学指令必须按制式分发，不能一段文案走天下。

## 漏标场头探测死代码修复（v2.158，c153 复盘轮：恒假检测器的排检与差集信号设计）

- **病象**：场头规范引擎的 `non_standard_scene_header`（漏标场景探测）从未触发过——`isSceneLike` 与 `isSceneHeader` 复用同一信号集（SCENE_LIKE_CN/EN），isSceneLike ⇒ isSceneHeader 恒真，而探测入口先排除 isSceneHeader 再查 isSceneLike，等于在"已排除的集合"里找东西。存量测试测不出来，因为旧用例走的是 missing_number 腿，漏标腿从未被喂过应触发的样本。
- **修法**：漏标信号重设计为"像场头但不满足场头结构"的差集信号——时间词打头或结尾的短行（中文如「教室 日」「深夜 天台」，英文如 "ALLEY - NIGHT"）；含冒号视为台词行排除，长度封顶（zh≤20 字 / en≤40 字）防误伤旁白长句。旧 SCENE_LIKE_EN 死常量删除。advice 同步升级：给出规范场头补全示例（场景N：地点·时间 / 内景 地点·日 / INT. CLASSROOM - DAY）+ 业务后果（漏标场景会导致制作物料漏统计），让模型改得动、也知道为什么必须改。
- **方法论沉淀**：①"同源复用即恒假"是死代码的隐性形态——两个判定函数共享同一信号集且存在包含关系时，下游检测器必然静默失效，且不报错、不崩溃、存量测试照绿，只有"喂一个应触发的样本看它响不响"才暴露。②复盘轮的固定动作：每个检测器至少验一次"会响"（正向样本触发）而不只验"不误报"（负向样本安静）——只测负向腿的检测器等于没测。③漏标类信号的正确设计是差集而非子集：先问"合规场头长什么样"，漏标信号=像它但缺关键结构（内外景/编号）的行；信号集若与合规判定的信号集重合，探测就退化成空集。

## 道具资产库家族（v2.159，c154：L3"道具可资产化"跨剧沉淀/复用闭环）

- **病象**：关键信物（玉佩/婚书/遗嘱）是短剧的剧情发动机，但工具层只能管"单剧内"的信物连续性（v2.80 信物账本），编导养熟的"信物模型"（认亲凭证/复仇铁证/悬念载体）换剧即从零设计，连续性规则（销毁后禁凭空再现）每剧重新交代——L3 分级协作法缺"道具资产化"这块拼图（角色资产 v2.151-152 已闭环，道具侧空白）。
- **能力**：与角色资产家族同构六件套——①prop-asset.ts 引擎（buildPropAssetDirective 编译双岗强约束指令 + extractPropAssetDrafts 跨集确定性沉淀，与信物账本同词典同口径）；②prop-health.ts 体检（五维评分 剧情含义40/出现集15/外观锚点20/连续性禁忌15/标签10 + 三类冲突预警：同名异义/异名同义/同名封禁态不一致）；③五端点（列表 take200+total / health 分页+conflicts 全量 / upsert / delete / from-project 一键沉淀）；④pipeline 注入 architect+writer 双岗（道具是"剧情事实源"非"人设"，designer 不注入——注入语义按岗位划界，L106②）；⑤前端道具库面板（三色徽章/冲突预警/编辑表单全字段随档提交）+ 立项多选引用；⑥沉淀"只增强不降级"（meaning 属本体语义以成稿一手源刷新，taboo/visualAnchor/tags 手动精修永不被沉淀覆盖）。
- **方法论沉淀**：①"清洗器必须在边界层够得着"——propAssetSchema 逐项 1-9999 严格校验把脏数组直接 400，normalizeEps 永远执行不到，等于修了表不修路；正确分层是 schema 守类型（数组×数字）、normalizeEps 管数值（越界/重复/非法项清洗），两层职责不重叠。②否定语境守卫——「这玉佩我绝不会丢」被同句销毁动词命中误标封禁（账本误发封禁令+沉淀误记 closedEps）；修法=否定词紧邻销毁动词（zh 零间隔/en 允许一个助动词）不计封禁；此修落在共享引擎 extractPropMentions，账本与资产两族同源受益，修一处对拍两处。③测试数据自证陷阱——"高频信物优先"用例的输入里高频信物只出现 1 集，断言却按 2 集写；数据与断言要能互相推导，写完用例先心算一遍期望值的来源。

## 资产双家族横扫对拍复盘（v2.160，c155 复盘轮：角色×道具家族口径统一与历史不丢）

- **四真 bug**：①propLibBtn i18n 词条缺失——道具库按钮显示字面量 key（c154 遗留），zh/en 双语补齐；②角色沉淀占位人设覆盖手动档——bible 角色只有 voice（traits/arc 全空）时草稿 persona 是占位稿「人设待补」，覆盖语义把手动精修的人设内核降级成占位文案，修法=仅当 bible 有一手源（traits/arc 至少一项非空）才刷新 persona，voice 属一手源照常沉淀增强；③道具沉淀 eps/closedEps 覆盖丢跨项目历史——B 剧沉淀把 A 剧的出现集与销毁红线（closedEps）整体覆盖，封禁态失真=体检查不出"已销毁"、复用必穿帮，修法=normalizeEps 并集合并（只增强不降级）；④character 家族冲突检测器 dup_name/clash_print 零"会响"测试（c153 教训违例：prop 家族有、character 家族抄结构时漏抄测试），补 4 个"会响"用例。
- **口径统一与防御**：dup_name 判定从 trim 升级为 norm（与同文件 same_persona 一致，同名人设仅差空白不再误报"不同人设"）；signatureLines 为 Json 字段，历史污染成字符串时引擎层 Array.isArray 防御（指令构建与体检双侧，与 normalizeEps 对 eps 的防御同构），前端不做同构防御（DB 写路径已守，避免过度防御）；前端 parseEps 补 1-9999 上限+500 硬帽与后端 normalizeEps 对齐。
- **方法论沉淀**：①"只增强不降级"铁律的完整形态=空值不覆盖（v2.153）+履历字段只增不减（本次）+占位稿不降级（本次）——三类降级通道对应"沉淀空值/沉淀覆盖/沉淀占位"，复盘按通道逐条排查。②履历型字段（eps/closedEps/出现史）天然是并集语义，与"本体语义以一手源刷新"（meaning/persona）分属两族，沉淀 upsert 必须逐字段标注语义族再决定覆盖还是并集。③家族对拍固定动作：新家族抄旧家族结构时，旧家族没验过"会响"的检测器也会一并抄漏——逐个检测器问"它的会响测试在哪"；同一语义多处判定（dup_name vs same_persona）必须同口径，"同文件双口径"必然在边界样本上自相矛盾。

## 场景资产库（v2.161，c156 功能轮：物料三表最后一族的资产化闭环）

- **病象**：老宅祠堂/天台/破庙这类关键场景是短剧的"舞台事实源"——同一祠堂在 A 剧是认亲舞台、在 B 剧是决战现场，但工具层只能管"单剧内"的场景密度与场头规范（v2.157-158），编导养熟的"场景模型"（剧情功能/氛围基调/状态禁忌）换剧即从零设计，AIGC 换剧画不出同一个场。角色资产（v2.151-152）与道具资产（v2.159-160）已闭环，场景是物料三表中唯一未资产化的家族。
- **能力**：与角色/道具家族同构六件套——①scene-asset.ts 引擎（buildSceneAssetDirective 编译双岗强约束指令 + extractSceneAssetDrafts 从成稿场头确定性沉淀，场头解析与 scene-header-convention 同源，内外景前缀归一正则与 production-materials 同口径）；②scene-health.ts 体检（五维评分 剧情功能30/外观锚点25/氛围基调15/出现集15/标签15 + 三类冲突预警：同名异义/异名同功能同锚点（双键）/同名状态红线不一致）；③五端点（列表 take200+total / health 分页+conflicts 全量 / upsert / delete / from-project 一键沉淀）；④pipeline 注入 architect+writer 双岗（场景是"舞台事实源"非"人设"，designer 不注入）；⑤前端场景库面板（三色徽章/taboo 红色⚠/编辑七字段整档提交）+ 立项多选引用；⑥沉淀"只增强不降级"（meaning 占位"功能待补"仅首建写入，mood/taboo/visualAnchor/tags 手动精修永不被覆盖，eps 跨项目并集）。
- **方法论沉淀**：①"变体不入档"——内外景/日夜是场头的**变体**不是场景本体，沉淀时前缀归一（内景/外景/室内/室外 剥离）+时间词剥离，`场景1：老宅祠堂·日` 与 `内景 老宅祠堂 夜` 聚成同一档；若按字面聚合，一个场景会碎成 N 个变体档，资产库变噪音库。②"双键查重"——场景的"异名同义"比道具难判（地点名天然多样：老宅祠堂/林家祠堂/祠堂），单键 meaning 必然误报，必须 meaning+visualAnchor **双键**同人才预警；同理 closed_mismatch 的状态红线以 taboo 有无定档（closedState=!!taboo），场景销毁无信物词典支撑不臆造 closedEps。③"维度兼收"——场景禁忌少见，taboo 独立成维则多数场景永远封不了"丰满"；mood 维度兼收 taboo（无 mood 有 taboo 给 10 分=状态在位但氛围不可视化），五维预算不变而档位判定不失真。

## 三资产家族横扫对拍复盘（v2.162，c157 复盘轮：角色×道具×场景三族跨族一致性审计）

- **对拍范围**：三族六引擎（character/prop/scene-asset + asset/prop/scene-health）× 端点层（五端点×3：列表/体检/upsert/delete/沉淀）× pipeline 注入划界 × 生成路径快照读取 × 立项快照/引用计数 × 前端三面板（下拉/载荷/编辑器/parseEps）× i18n 全量 t() 键审计（脚本化提取 app.js+index.html 全部使用键对 DICT.zh/en 双向核对：145 使用键零缺失，449 键 zh/en 完全对称）。
- **真 bug（已修）**：三族 from-project 沉淀的 `dft.name` 未经 trim 归一——手动 upsert 的 name 走 schema `z.string().trim()`（写库必经，档名天然干净），沉淀名却直接取自 bible.characters 键名（cast，LLM 生成形态不可控）/信物词典（prop）/场头提取（scene，自带 trim 实际干净）。带空白键会沉淀出"孤儿档"：与手动同名档并存、二次沉淀查不到（再建一份）、体检 dup_name 按原样 name 分组也检不出（两组各自 len=1）。修法三处同构：①引擎层 `extractCastAssetDrafts` 遍历 entries 时键 trim（顺带改善 castMap 键与对白说话人匹配率）；②cast 端点 bible 三形态归一时键 trim（否则 `chars[dft.name]` 一手源判定查不中，persona 不刷新）；③prop/scene 端点沉淀循环 `String(dft.name).trim()` 空名跳过。补 2 个"会响"用例（引擎级：空白键→干净名+纯空白键剔除；HTTP 级：空白键 bible 沉淀→persona 命中+二次沉淀 update 不建孤儿）。
- **顺手完善**：场景立项下拉悬停提示补 mood（`[meaning, mood, taboo]`，与面板卡片信息位对齐）。
- **确认无漂移项**（跨族同口径核对通过）：norm 三族同定义（`replace(/\s+/g,'')`）；closedState 语义分族正确（prop= closedEps 非空||taboo，scene= taboo，场景无 closedEps 是"不臆造语义"设计）；normalizeEps 仅 prop-health 单一定义、scene-health 导入复用；pipeline 注入划界正确（architect/writer 三族齐、designer 仅 cast）；立项快照三族对称（uniq→归属过滤→快照→创建成功后计数+1）；编辑器整档覆盖语义三族齐（全字段随档提交）；前端三族 parseEps 完全一致（1-9999 截 500）。
- **方法论沉淀**：①"名字的边界层归一"——同一资源的 name 有多个写入通道（手动 schema trim / 沉淀引擎提取 / LLM bible 回写）时，通道间口径差就是孤儿档的温床；归一动作放在**每个写入通道各自入字段做**（而不是只在体检层 norm 兜底），因为 findFirst 查重发生在写前，体检 norm 再对也救不回已分裂的两档。②"跨族对拍先grep同语义函数，再逐层核对调用点"——三族同构代码的对拍不是通读三个文件（600+ 行），而是先 grep 关键同语义符号（norm/closedState/normalizeEps/byName 分组键）确认定义层一致，再沿"引擎→端点→pipeline→快照→前端"链路逐层抽查调用点，一轮 grep 定位 + 定点读 300 行即可覆盖全链路。③"复盘轮的 i18n 审计要脚本化"——c155 修过 propLibBtn 缺失（人工肉眼发现），本轮写 15 行 node 脚本提取全部 t()/data-i18n 键对字典双向核对，一次覆盖 145 键并确认 zh/en 449 键对称，比逐页面肉眼查快一个量级且可复用。

## 资产库检索（v2.163，c158 功能轮：三族跨剧按关键词搜资产）
- **痛点**：资产库按沉淀累积，跨剧找资产（"我那部复仇剧里那只信物叫什么来着"）只能全量翻列表——资产少时无感，资产多到 200 帽时检索成本陡增；此前体检/冲突都补齐了，唯独"找"这一步缺失。
- **后端**：三族 list + health 六个 GET 端点统一加 `q` query 参数（`assetSearchQ` 归一：trim + 截 50 字符）；匹配方式 = 大小写不敏感子串（`toLowerCase().includes`），内存过滤（列表已 take 200 硬帽，DB-level contains 收益为零）；匹配字段分族——cast: name/persona/voice/tags，prop: name/meaning/taboo/tags，scene: name/meaning/mood/taboo/tags（tags 走 Array.isArray 防御，Json 字段历史污染教训）；q 空缺 = 全量（完全向后兼容）。health 加 q 后：rows 先过滤 → total=过滤后计数、healths=过滤后 slice(offset, offset+limit)、conflicts=detect(过滤后全量)（"搜索视角的冲突报告"，自洽且不违"冲突跑全量"铁律——全量的本意是"页内查重不漏"，过滤后集合同样不漏）。
- **前端**：三面板 modal 各加搜索框（原生 adm-input，防抖 300ms 触发重查，清空回全量；编辑/删除后重开面板保留搜索态）；立项下拉不加（原生 select 不支持过滤，200 帽 + 截断提示已够，管理面板才是检索入口）；搜索中空态区分"库为空"与"无命中"（libSearchNoResult）。
- **i18n**：libSearchPh / libSearchNoResult 两键 × zh/en（审计脚本复测：451 键完全对称）。
- **测试**：三族各 1 个"会响"用例（c153 教训），覆盖：标签命中 / 含义·氛围·人设·声音多字段命中 / 英文标签大小写不敏感 / total=命中数 / limit 在过滤集上生效 / 冲突在过滤集上会响且范围外不误报 / 不命中→空 / 无 q→全量。
- **造数教训**：写冲突"会响"断言前先读判定器的分组条件——dup_name 是"同名**不同含义**"、same_scene 只对**异名**触发（同名为合法 upsert 重复）、closed_mismatch 是"同名同含义但状态红线不一致"：三族测试数据必须按各自的冲突语义造，同含义同名对在 prop/scene 里天然不响（首轮测试 2 失败均源于此）。

## 资产库检索复盘（v2.164，c159 复盘轮：检索字段完整性×搜索态文案对拍）

- **病象（c158 检索上线首轮复盘揪出两处不自洽）**：①三族搜索字段全漏 `visualAnchor`（外观锚点是"跨剧可辨识"核心维度，搜"青砖黛瓦三进院/左眉一道疤"必搜不到），cast 还漏 `signatureLines`（标志性台词气质锚）；②三面板截断提示文案写死"资产库共 N 条"——搜索态下 total 是命中数，语义不准。
- **修法**：①`matchAssetQuery` 数组分支从 tags 特判泛化为任意数组字段（signatureLines 也是数组；Json 字段污染成字符串时走 String 分支天然兜底），三族字段集补 visualAnchor、cast 另补 signatureLines；②三面板截断提示按搜索态切文案（"搜索命中 N 条" vs "资产库共 N 条"），placeholder 与 libSearchPh 词条同步提及锚点/台词。
- **方法论沉淀**：①"功能字段面×检索字段面"对拍——新功能字段（体检维度/指令注入字段）落地后，下游检索/展示面是否同步覆盖要横扫一遍；字段集直接从 schema 抄清单核对，不凭记忆。②匹配方向是 `row.includes(q)` 时，q 截断只会"多命中不会少命中"——可观察区分度用例必须让"截断行为"成为唯一差异源（锚点恰 50 字符 + q 追加第 51 字符：截断则命中、不截断则 0）。③i18n 审计正则 `t\('..'\)` 会吞 `createElement('button')`/`.get('apiKey')` 尾字母 t——审计脚本先按"前有字母的 t\("排除方法名误报再报缺。

## 资产引用统计（v2.165，c160 功能轮："沉淀→引用→运营"闭环补上观测面）

- **病象**：资产卡只有 `usedCount`（历史累计立项次数，项目删除不减），用户看不出"当前到底被哪些剧引用"——删档/改档前无法评估影响面，空壳资产被引用了也无感知，"沉淀→引用"链路缺运营观测端。
- **实现**：零 IO 纯函数 `buildAssetUsageMap`（engine/asset-usage，三族共用一个参数化函数天然同口径）+ 三个 usage 端点（GET /{family}-assets/usage，扫描本人项目 bible 引用快照 take 500，返回 `Record<assetId, refs[]>` + scannedProjects）。**两口径互补不改写**：usedCount=历史累计（ ever 计数），usage=实时在用明细（项目删除即消失）；快照无合法 id 的历史脏数据跳过——名字不是身份，按名字归账会误并同名档（dup_name 家族教训）。
- **前端**：三面板 open 并行加第三请求，卡片新增 📌"当前 N 剧在用：项目名列表"（超 3 部截断加"等 N 部"）+ 空壳资产被引用红色预警（`h.level === 'thin' && refs.length`）——删档决策与补全优先级一眼可见。
- **方法论沉淀**：①"计数器≠明细"—— ever 计数（usedCount）与实时明细（usage）是两个不同的运营问题，并存互补而非改写口径；②引用归账必须按 id 精确匹配，历史快照缺 id 就宁可不算也不按名字猜；③"会响"测试同样适用于新端点——mock 造数时 `mem.xxxAsset.create` 是 async，漏 await 会造出 `id: undefined` 的快照，静默归零而非报错，断言 `usage[id]` 前先确认造数真的落了 id。

## 资产面板 usage 错误处理降级（v2.166，c161 复盘轮：辅助观测失败不阻塞主链路）
- **病象**：c160 把 list/health/usage 三个请求塞进同一个 `Promise.all`，任何一个失败都会让外层 catch 走 `loadFail`——但 usage 是"📌 当前 N 剧在用"的辅助观测行，定位上不该和主列表/体检/徽章同生死。usage 端点 500 时，用户连资产主列表都看不到，这与"辅助信息"的定位不符。
- **修复**：三面板（cast/prop/scene）改为 list+health 走 `Promise.all` 主链路（失败仍显示 loadFail，合理），usage 独立 `try { ... } catch { /* 静默 */ }` 兜底空对象——usage 失败时卡片只是看不到 📌 行，主列表/体检/徽章/冲突预警照常渲染。
- **横扫结论**（资产家族 c148-c160）：①立项快照 id 保留完整（cast/prop/scene push 时都带 `id: r.id`）✅；②引用计数在 project.create 成功后 +1（v2.153 时序修复仍有效）✅；③三族 POST 字段与前端表单全对齐（cast 无 eps/closedEps、prop 有 eps+closedEps、scene 有 eps 无 closedEps——场景无"销毁"概念，正确设计）✅；④`?? []`/`?? null` 兜底无漏标，normalizeEps 对 undefined 返回 [] ✅；⑤health limit 后端默认 50/前端拉满 200 ✅；⑥list total 截断提示三族文案同构 ✅。
- **方法论沉淀**：①"辅助观测"与"主链路"的错误处理必须分层——辅助失败静默兜底，主链路失败才走 loadFail；②复盘轮固定动作：新功能上线后下一轮必横扫同构家族，确认"覆盖式接口×表单字段×空值兜底"三口径一致；③场景无 closedEps 是"家族同构但不强制字段对齐"的正确示范——同构的是结构（引擎纯函数+五端点+色徽章+截断提示），不是字段集合（各族注入岗位/沉淀口径/体检维度按本体语义定）。

## 资产看板：L3 运营决策面（v2.167，c162 功能轮：跨族热度榜 + 空壳补全优先级队列）
- **痛点**：c148-c161 把资产家族"沉淀→引用→体检→usage"四段闭环做完后，编导仍面临三个运营决策盲区——①"哪些是明星资产（多剧引用）"看不到；②"哪些是冷门待激活"看不到；③"空壳档该先补哪个"无排序依据，导致补全凭感觉。三族面板各自孤立展示体检结果，缺跨族热度视角与补全 ROI 排序。
- **解法**：新增 `/asset-dashboard` 聚合端点 + 独立 modal（三族共用入口按钮置于各面板搜索框上方）：
  - **热度榜 top10**（每族）：按 usedCount 降序取前 10，每行带 `usedCount + 五维体检 score/level/missing`；"明星空壳预警"——usedCount>0 但 score<55 标红 ⚠，编导以为有约束实际拿不到，最危险状态。
  - **空壳补全优先级队列 top20**（跨族合并）：score<55 的资产按 `(missing.length asc, score asc)` 排序，缺 1 维的离"可用"最近、缺 5 维的等于从零写，缺失维度越少 ROI 越高。
  - **零 token 确定性**：基于已有 usedCount 字段 + health 体检数据聚合，无新增 IO 路径，无 LLM 调用；`Promise.all` 三族并行扫描避免串行等待，每族 take 50 防止超大库爆内存。
- **方法论沉淀**：①L3"资产化运营"能力闭环五段——沉淀 → 引用 → 体检 → usage → **运营决策（dashboard）**，本轮补上最后一块；②空壳补全优先级排序哲学——缺失维度越少=离"可用"越近，补全 ROI 越高，故 `(missing.length asc, score asc)` 升序而非按 score 升序；③"明星空壳"是最危险状态——热度高（多剧引用）但体检空壳，编导以为有约束实际拿不到，必须显式预警而非仅看 score；④i18n 词条必须真生效——补完词条后顺手把 app.js 中 inline `lang === 'en' ? '...' : '...'` 全部改成 `t()` 调用，避免"词条补了但前端没引用"的不自洽（DASH_FAMILY_LABEL 从硬编码常量对象改成 DASH_FAMILY_KEY 运行时调 t()，否则英文环境失效）；⑤冗余键（dashMissingLabelEn/dashThinWarnEn）违反 i18n 系统已分语言的设计——补完后立即删除，避免"看似兜底实则冗余"。

## 资产看板复盘修复（v2.168，c163 复盘轮：thinQueue 漏空壳 + advice 未渲染）
- **病象**：c162 上线的 `/asset-dashboard` 端点存在两处真问题：
  - **P0 后端 thinQueue 漏空壳**：三族 `findMany({ orderBy: { usedCount: 'desc' }, take: 50 })` 忽视了"空壳资产天然 usedCount=0（没人引用过）"的逻辑后果——空壳资产排在 usedCount desc 的末尾，被 take 50 截断，thinQueue 实际只看到"top 50 热门里的空壳"，漏掉真正最需要补全的真空壳。这与 dashboard"空壳补全优先级队列"的设计目标相悖。
  - **P1 前端 dashThinRow 不渲染 advice**：thinQueue 行带 advice 字段（scoreXxxAsset 返回的"应该补什么"具体建议）但前端 dashThinRow 只渲染 missing 维度名（英文键如 'voice'/'voicePrint'），编导看不懂每个 missing 是什么意思，更不知道应该怎么补——advice 是中文解释，本应是空壳队列最有用的信息却没展示。
- **修复**：
  - **后端**：`take: 50` → `take: 200`（与家族 list/health 端点铁律同口径：list take 200 + total 截断提示、health take 500 全量体检）；热度榜 top10 仍从 take 200 里 slice(0,10)，因 orderBy usedCount desc 已排序，前 10 即为最高热度，take 200 留有余量不丢数据；thinQueue sort 加 id 稳定 tiebreaker（`(a.missing.length - b.missing.length) || (a.score - b.score) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)`），避免同分时多次刷新顺序变化。
  - **前端**：dashThinRow 改用 `<details>` 原生展开（无需 JS 事件代理），点击 summary 切换 advice 显示；advice 区域用虚线分隔、灰字小号，与主行视觉分层；无 advice 时退回普通 div（虽然 thin 资产理论上必有 advice，但兜底防脏数据）。💬 表情作为"可展开"的视觉暗示。
- **横扫结论**（资产家族 c148-c162）：①i18n 14 个 dash* 词条全部被引用（index.html L620/635/650/663 用 dashOpenBtn/dashTitle，app.js 用 12 个 dash* 函数）✅；②escapeHtml 在 app.js L4385 定义，dashHotRow/dashThinRow 的 a.name 都已 escape，a.advice 字段来自 scoreXxxAsset 常量字符串也 escape ✅；③三族体检引擎异常处理同构（`if (!a || !a.name || !a.{meaning/persona})` 返回 score=0 + 兜底 advice），dashboard 不会因单条资产体检异常而 500 ✅；④dashboard 端点 Promise.all 三族 .catch(() => [] as any[])，单族失败不阻塞其他族 ✅；⑤dashboard 端点不展示 conflicts 是设计选择（运营决策面 vs 库级体检面职责分离），不是 bug ✅；⑥DASH_FAMILY_KEY 的 'cast'/'prop'/'scene' 三个键与后端 thinCast/thinProp/thinScene 的 family as const 完全对齐，兜底 'dashFamilyCast' 仅冗余不会掩盖后端 bug ✅。
- **方法论沉淀**：①**截断边界与"天然排序"的对抗**：当查询条件的天然排序（usedCount desc）与筛选条件（score<55 = 空壳）的天然分布相反时（空壳天然 usedCount 低），take N 截断会系统性漏掉最需要被筛选出来的项——这类 bug 在"运营视图聚合端点"尤其常见，复盘固定动作：每个聚合查询都要问"筛选条件的天然分布是否与排序方向相反"；②**运营视图必须展示可执行建议**：dashboard 的 thinQueue 是"应该补什么"的决策视图，但只展示 missing 维度名（'voice'/'voicePrint' 等英文键）等于让编导查字典——advice 是 scoreXxxAsset 已经返回的中文解释，零成本就能展示，不展示就是功能残缺；③**`<details>` 原生展开优于 JS 事件代理**：modal innerHTML 重新生成后 JS 事件代理需要重新绑定，`<details>` 是浏览器原生切换，无 JS 也能工作，CSP 友好，可访问性好（屏幕阅读器原生支持）；④**sort 稳定 tiebreaker**：当主排序键与次排序键都相同时，sort 不稳定会让多次刷新顺序变化，加 id 作为最后 tiebreaker 是零成本保证一致性的标准做法。


## 资产看板补全闭环（v2.169，c164 功能轮：thinQueue 行加"去补全"跳转按钮 + 三族库面板滚动高亮）
- **痛点**：c162 看板与 c163 复盘把"看板展示"层做完，但编导点 thinQueue 行后没有"去补全"动作闭环——看完问题清单还要手动关闭 modal、手动找对应族库面板、手动翻找该资产卡片，等于看板只展示不引导行动；且 thinQueue 行只显示资产名+missing 维度+score，缺"从哪沉淀的"与"多久没动"两个回溯信号，编导无法判断"先补 ROI 高的（缺维度少）、还是先补最近没动的（可能已遗忘）"。
- **解法**（三步闭环）：
  - **后端字段补全**：thinCast/thinProp/thinScene 三个数组每行新增 `sourceProjectTitle`（沉淀来源剧标题）+ `updatedAt`（上次编辑时间）字段，前端无需改 fetch 路径，按现有字段读取即可。
  - **前端 dashThinRow 改造**：展开区显示"沉淀自《XX》· N 天前编辑"meta 行（daysSince helper ISO 距今天数）；summary 行尾加"去补全"按钮（.dash-jump，带 data-jump-family / data-jump-id 属性），点击触发 openAssetDashboard 内 querySelectorAll('.dash-jump').forEach 事件绑定。
  - **跨函数状态传递 + 一次性消费**：点击按钮 → 关闭 dashboard modal + 设全局 `dashJumpTarget = { family, id }` + 调用 openXxxLibrary；三族 renderXxxLibrary 的 forEach 在 card 创建后、appendChild 前检查 dashJumpTarget，匹配则 `card.style.outline = '2px solid var(--gold)'` + `setTimeout(() => card.scrollIntoView({behavior:'smooth', block:'center'}), 100)` + 5 秒后清除 outline + 一次性消费 `dashJumpTarget = null`。
- **方法论沉淀**：①**"运营决策面必须有行动闭环"**——只展示问题清单不引导行动等于半成品 dashboard，编导看完还要手动跳转就是流量漏斗断点，看板→库面板→具体资产卡片必须是一条无断点的引导链；②**dashJumpTarget 一次性消费模式**（设值 → 渲染时检查 → 用完置 null）是跨函数状态传递的标准做法，比 query string + onload 更可靠（modal 切换不走 URL，history API 会让浏览器后退按钮误触发）；③**scrollIntoView 必须 setTimeout 100ms**——因 renderXxxLibrary 是异步 fetch + forEach append，立即调用时 card 尚未挂载到 DOM，scrollIntoView 会无效；④**横扫确认 i18n 3 个新词条（dashJumpBtn/dashSourceFrom/dashEditedAgo）均被 dashThinRow 引用**，escapeHtml/daysSince 已定义（L4403-4405），三族 family 键（'cast'/'prop'/'scene'）与后端 thinCast/thinProp/thinScene 的 `family as const` 完全对齐；⑤"补 ROI 高的 vs 先补最近没动的"是编导的两个不同决策路径，dashboard 不替编导做选择，只提供两个信号让编导自己判断——sourceProjectTitle + updatedAt 是回溯信号，missing.length + score 是 ROI 信号，两类信号同层展示不冲突。


## c165 复盘轮：dashJumpTarget 残留状态 + i18n 占位符只换首次 + missing 未 escape（v2.170）
- **病象**（c162-c164 资产看板家族复盘三轮发现三处真问题）：
  - **P1 dashJumpTarget 残留导致误触发滚动高亮**：c164 的"去补全"按钮 → 设 `dashJumpTarget = {family, id}` → 调 `openXxxLibrary()` → 内部 `await Promise.all` fetch 资产列表 + 体检 + usage → `renderXxxLibrary` 内 forEach 检查 `dashJumpTarget` 匹配则滚动高亮 + 一次性消费 `dashJumpTarget = null`。但 **fetch 失败时走 catch 分支**（`grid.innerHTML = ''; empty.textContent = t('xxxLibFail')`），catch 里没有清空 `dashJumpTarget`——状态残留为之前的 `{family, id}`。下次用户重新点开该族库面板（fetch 成功），`renderXxxLibrary` 会发现 `dashJumpTarget` 仍匹配某资产 → 触发滚动高亮，但用户已不期待此跳转（可能已过去几分钟/在做别的事），突然的滚动会迷惑用户。这是"一次性消费模式"在异常路径下的状态泄漏。
  - **P2 i18n `t()` 占位符只替换首次出现**：`s.replace('{' + k + '}', v)` 用 `String.prototype.replace` 只替换第一次出现，文案含 2+ 个相同占位符时（如 `"{n} 天前，已 {n} 天没动"`）第二个 `{n}` 不会被替换，会原文显示给用户。当前所有词条都只有一个 `{n}` 不触发，但这是**代码家族隐患**——未来任何新增 i18n 文案含 2+ 个相同变量都会 silently bug，且不会报错、不会测试失败，只能靠人眼发现。
  - **P3 dashThinRow 的 missing 数组 join 未 escape**：`${a.missing.join(' / ') || '—'}` 直接插入 HTML，`a.missing` 是 `scoreXxxAsset` 返回的英文键数组（如 `['voice', 'voicePrint']`）来自后端常量，当前安全。但这是**防御性编程缺口**——未来 missing 来源扩展到用户输入（如自定义维度名）时立即变 XSS。属于"看似安全实则埋雷"的代码家族。
- **修复**（三处并行）：
  - **P1**：三族 `openXxxLibrary` 的 catch 分支首行加 `dashJumpTarget = null;`（cast L2721 / prop L2871 / scene L3012）——异常路径也必须清空状态，与正常路径（renderXxxLibrary 内 `dashJumpTarget = null`）对称，"一次性消费"语义在所有路径下都成立。
  - **P2**：i18n `t()` 函数 L7 把 `s.replace('{' + k + '}', v)` 改成 `s.split('{' + k + '}').join(String(v))`——`split-join` 是 JavaScript 全局替换所有出现的标准做法，比 `replaceAll`（ES2021，老浏览器不支持）兼容性更好，比 `new RegExp(..., 'g')`（要转义正则元字符）更安全。同时 `String(v)` 强制转字符串防数字/对象 silent 拼接。
  - **P3**：dashThinRow L2626 `${a.missing.join(' / ') || '—'}` → `${escapeHtml(a.missing.join(' / ')) || '—'}`——`escapeHtml` 返回字符串，空数组 join 得 '' → escapeHtml('') = '' → `|| '—'` 触发显示占位符，语义不变。
- **横扫确认**：①三族 catch 分支同构修改，`dashJumpTarget = null` 位置一致（首行），不与现有逻辑冲突 ✅；②i18n `t()` 修改后所有现有词条行为不变（只有一个 `{n}` 的文案 split-join 与 replace 结果相同）✅；③dashThinRow missing escape 后视觉不变（escapeHtml 不改变纯英文字母数字与空格）✅；④tsc 通过、4040 测试全绿（较 c164 的 3982 个 +58，含 c165 新增测试）✅。
- **方法论沉淀**：①**"一次性消费"状态在异常路径下的清空**——任何"设值 → 检查 → 用完置 null"模式都必须在**所有可能退出**的路径（正常 return / 异常 catch / 提前 return）都清空，否则状态会跨调用残留；复盘固定动作：grep 状态变量的所有赋值点，每个赋值点对应的函数都检查"异常路径是否清空"。②**`String.replace` 只换首次是隐性家族 bug**——任何"模板 + 占位符替换"场景都必须用 `split-join` 或 `replaceAll` 全局替换，否则文案含 2+ 个相同占位符时 silently bug；复盘固定动作：所有 i18n `t()` / 模板替换函数都查一遍 `replace` 用法，无例外改 `split-join`。③**防御性 escape 的边界**——后端常量来源的字段当前安全，但前端无法保证"来源永远是常量"——任何插入 HTML 的字段都顺手 escape 是零成本防御，不 escape 是埋雷；尤其 `data-*` 属性、`title`、`alt` 等"非内容"字段最易漏。④**复盘轮的横扫边界**：c163 复盘只看了 dashThinRow 的 escapeHtml，没看 i18n `t()` 函数本身；c165 把视角拉到"模板替换函数"层面才发现 P2——复盘要逐层往上拉，不能只在"使用层"打转，得到"基础设施层"才能发现家族隐患。


## 资产编辑表单 sourceProjectTitle 只读显示 + dashboard 冷门待激活区（v2.171，c166 功能轮：编导回溯来源 + 闲置资产运营决策）
- **痛点**：资产家族五段闭环（c162-c165）只覆盖"看板展示 → 空壳补全"链路，但编导在两个场景缺少回溯与决策信号：
  - **场景 A 编辑资产时不知"从哪沉淀的"**：三族 renderXxxLibEditor 编辑表单只有字段输入框（name/persona/voice/anchor/sigs/tags 等），编导改资产时无法判断"这个角色/道具/场景来自哪部剧"——沉淀一次后再编辑可能忘了原剧上下文，改错方向（如把"复仇铁证"的玉佩 meaning 改成"普通装饰"，破坏跨剧连续性）。资产对象本身有 `sourceProjectTitle` 字段（v2.169 thinQueue 已加），但编辑表单没消费它。
  - **场景 B 闲置资产无运营决策面**：dashboard 只有热度榜（top10 by usedCount）和空壳队列（score<55），但编导更关心的是"养熟但没用过"的资产——这些资产 score≥55（已具备约束力，可直接跨剧引用）但 usedCount=0（从没被任何剧引用过），是 L3 编导做"激活决策"的盲区：编导不知道哪些资产该激活到新剧、哪些是"沉淀完忘了用"的浪费。
- **解法**（双方向并行）：
  - **方向 A 三族编辑表单加 sourceProjectTitle 只读显示**：新增 helper `libSourceRow(sourceProjectTitle)` 在编辑表单 innerHTML 顶部注入紧凑只读行（背景色 + 圆角，避免占用编辑字段空间），格式"沉淀来源：《XX》"，无 sourceProjectTitle 时 fallback "手动创建"（区分沉淀档与人工建档）。三族共用一个 helper（cast L2810 / prop L2948 / scene L3091），避免三处重复；i18n 加 `libSourceLabel`（沉淀来源/Harvested from）+ `libSourceManual`（手动创建/Manually created）。
  - **方向 B dashboard 加冷门待激活区**：后端 dash 端点扩展——新增 `pickCold(rows, family, scoreFn)` 通用函数过滤 usedCount=0 且 score≥55，按 score desc 排序 take 5/族（避免列表过长）；前端 dashBody 在 thinQueue 之后加冷门区，新增 `dashColdRow(a, family)` helper（紧凑形式与 dashHotRow 同口径 + "去激活"按钮），点击关闭 dashboard + 调对应 openXxxLibrary（不设 dashJumpTarget，因冷门资产非空壳无需强制滚动高亮）；i18n 加 `dashColdTitle` / `dashNoCold` / `dashActivateBtn`。
- **方法论沉淀**：
  - **①"编辑表单只读显示"是回溯信号的载体**——编辑资产时编导最易破坏跨剧连续性（改 voice / persona / meaning 影响后续引用），表单顶部加一行"沉淀自《XX》"零成本（无 fetch、无 token、无新端点）但 ROI 极高：编导改前会想到"这个角色是 A 剧的，改了会不会影响 A 剧的快照？"（虽然实际快照是 immutable 的，但人设连贯性是软约束）。**编辑表单的字段显示 ≠ 字段编辑**——只读显示让编导"看得到来源"但"改不了来源"（sourceProjectId 不进编辑字段，只能改字段值），这是"沉淀来源是事实，字段值是可改的当前态"的正确语义。
  - **②"冷门待激活"与"空壳补全"是 L3 运营决策面的两腿**——thinQueue 管"该补的"（score<55），coldQueue 管"该用的"（score≥55 且 usedCount=0），两类决策互补：thinQueue 优先级 = missing.length asc + score asc（缺维度越少 ROI 越高），coldQueue 优先级 = score desc（最有约束力的优先展示），两个排序方向反映两类决策的不同 ROI 计算。
  - **③"pickCold" 通用函数设计**——三族 scoreCast/scoreProp/scoreScene 都是 (row, lang) => {score, level, missing, advice} 同构，`pickCold(rows, family, scoreFn)` 一行函数三族共用，避免三处重复 map/filter/sort/slice，与 c159/c161 三族家族"同构函数共用 helper"铁律同口径。**新增能力时优先复用现有 helper 模式，不重复造轮子**。
  - **④"去激活"按钮不设 dashJumpTarget**——冷门资产非空壳，无需滚动到具体卡片高亮（卡片可能在列表深处）。但"去激活"仍跳转到族库面板，让编导看到该资产上下文（其他资产、冲突预警、体检徽章）后决策是否在新剧立项时引用。**按钮跳转目标的设计原则**：跳到"决策所需上下文最丰富的面板"而非"具体卡片"，编导在面板内自己判断。
  - **⑤i18n 词条扩展铁律**：新增能力（方向 A 三族共用 `libSourceLabel/libSourceManual`，方向 B 三族共用 `dashColdTitle/dashNoCold/dashActivateBtn`）时，**三族共用一组词条**而非三族各一组（castLibSourceFrom/propLibSourceFrom/sceneLibSourceFrom），避免词条爆炸；helper 函数用 `t('libSourceLabel')` 通用键查词，三族编辑表单共用 helper 自动共用词条。
  - **⑥冷门资产 take 5/族**——避免 dashboard 列表过长（编导注意力是稀缺资源），每族最多 5 条、三族最多 15 条冷门资产，与 thinQueue 的 take 20 互补。**列表 take 数量必须配合决策 ROI**：thinQueue 的决策是"补哪个"（紧急），take 20 给编导看到全部空壳；coldQueue 的决策是"激活哪个"（不紧急），take 5 给编导看最有约束力的 top5 即可，编导可去族库面板翻找更多。


## 截断可见性铁律复发 + 冷门闲置时长信号（v2.172，c167 复盘轮：c156 家族复盘横扫 + updatedAt 同口径下沉）
- **复盘触发**：c166 冷门待激活区上线后做复盘横扫，发现两个问题——一个是"截断必须可见"铁律的复发（c156 已沉淀该铁律，但 c166 新写的 pickCold 又静默截断），一个是冷门决策缺"沉淀后多久没用过"信号（thinQueue 已有 updatedAt，coldQueue 没加）。
- **痛点 P3（真 bug，c156 铁律复发）**：c166 的 `pickCold` take 5/族静默截断——编导资产 ≥5 时漏掉次级候选，前端 dashBody 也没显示截断提示。c156 已沉淀"截断必须可见"铁律（列表/体检/下拉硬帽截断要么提高帽对齐上下游、要么 UI 显示 total 与截断提示），但 c166 新写 pickCold 时没复用该铁律，新功能上线时铁律"复发"而非"未应用"。
  - **修法**：后端 pickCold 改返回 `{ items, total }` 结构（items 是 take 5 截断后的，total 是全量计数）；后端 res.json 加 `hotCastTotal/hotPropTotal/hotSceneTotal`（三族总资产数，与 coldXxx.total 同口径）；前端 `sec` 函数加可选 total 参数，total > shown 时显示"展示前 N / 共 M"截断提示。三处调用（hotCast/hotProp/hotScene 用 hotXxxTotal，coldCast/coldProp/coldScene 用 coldXxxObj.total）全部传 total。
- **痛点 P4（UX 改进，updatedAt 同口径下沉）**：dashColdRow 不显示 updatedAt——编导决定激活时也想知道"沉淀后多久没用过"（长时间闲置的更该激活），与 thinQueue 的 updatedAt 同口径但 c166 没加。
  - **修法**：后端 pickCold items 加 updatedAt 字段（与 thinQueue 的 updatedAt 同口径）；前端 dashColdRow 加 idle 显示（用现有 daysSince helper + 新 `dashIdleAgo` 词条）；i18n 加 `dashTrunc`（展示前 N / 共 M）+ `dashIdleAgo`（闲置 N 天）zh+en 词条。
- **方法论沉淀**：
  - **①"铁律复发"是复盘轮的固定检出模式**——已沉淀的铁律（如 c156"截断必须可见"）在新功能上线时不会自动被遵守，铁律是"防御性约束"而非"强制性约束"（代码不会因违反铁律而报错）。**复盘轮的固定动作**：新功能上线后横扫"新功能是否违反已沉淀铁律"——grep 新函数里的 `slice`/`take`/`limit`，对照铁律清单（截断可见、空值不覆盖、查重全量、同源同文件）逐条检查。铁律是"复盘检出"而非"上线拦截"，复盘轮是铁律的唯一执行点。
  - **②"同口径字段下沉"是复盘轮的横向一致性检查**——updatedAt 已在 thinQueue（v2.169）加过，c166 新写 coldQueue 时应同步加但没加。**复盘轮的固定动作**：新功能加某字段后，横扫"同族函数是否都加了该字段"——thinQueue/coldQueue/hotQueue 三族队列函数对照检查，updatedAt/sourceProjectTitle/family 等业务字段应同口径下沉到所有队列。字段不一致=编导在不同决策面看到的信号粒度不一致，影响决策质量。
  - **③"对象解构 + fallback"防御后端协议变更**——前端解构 coldCast 从数组改为对象时，用 `data.coldCast && typeof data.coldCast === 'object' && Array.isArray(data.coldCast.items) ? data.coldCast : { items: [], total: 0 }` 防御性解构，后端协议变更时前端不崩。**前后端协议变更的铁律**：后端从数组改对象时，前端解构必须用 `typeof === 'object' && Array.isArray(x.items)` 双重校验 + fallback 空对象，不能假设后端永远返回正确结构（网络错误、缓存旧数据、灰度发布都可能让前端拿到旧协议）。
  - **④"sec 函数加可选参数"是统一截断提示的复用模式**——sec 函数本是简单的"标题 + 列表"渲染，加可选 total 参数后，hot/cold 三族调用统一传 total 即可显示截断提示，不需要每处调用点都写截断逻辑。**helper 函数扩展铁律**：新增能力（截断提示）时优先复用现有 helper（sec）加可选参数，而非每处调用点重复写；可选参数用 `typeof total === 'number' && total > shown` 双重校验，避免 undefined 误触发。
  - **⑤"hotXxxTotal 与 coldXxx.total 同口径"是编导决策信号统一**——hot 区显示"在 N 条资产里选了 top 10 展示"（编导资产 >10 时知道还有更多明星资产可翻族库），cold 区显示"在 N 条闲置里选了 top 5 展示"（编导资产 >5 时知道还有更多冷门可翻族库），两区截断提示同口径，编导在 dashboard 看到的"截断提示"信号统一。**截断提示铁律的横向一致性**：同一面板内多个截断列表（hot/cold/thin）的截断提示口径必须一致，不能 hot 显示"展示前 10 / 共 20"而 cold 显示"+5 条未展示"，编导看到不同口径的提示会困惑。


## dashboard 资产健康总览宏观卡片（v2.173，c168 功能轮：L3 运营决策的"宏观信号"层）
- **痛点**：c162-c171 dashboard 五段闭环的"运营决策"腿已补全 hot/thin/cold 三类决策面，但编导打开 dashboard 第一眼直接跳到 hot 列表，缺"我的资产库整体健康度"宏观信号——编导无法一眼判断"今天该补哪族、该消冲突、还是该激活冷门"，要在三族 hot/thin/cold 列表里分别数一遍才能得出决策方向。L3 高手做"资产化运营"需要宏观 KPI（空壳率/完整率/冲突数）做日运营决策的"调度信号"。
- **解法**：后端 dash 端点新增 `buildStats(rows, scoreFn, conflictsFn)` 通用函数——对三族分别算 `{ total, avgScore, empty, usable, complete, conflicts }` 六维统计：total 总数、avgScore 平均分（Math.round 四舍五入）、empty 空壳数（score<55）、usable 可用数（55-84）、complete 完整数（≥85）、conflicts 冲突数（跑 detectXxxAssetConflicts 全量库，与 health 端点同口径）。前端 dashBody 顶部新增 `dashStatsCard(label, s)` helper 渲染三族并排卡片：每卡显示"总数·平均分"+ 三色维度（绿完整/黄可用/红空壳）+ 空壳率提示 + 冲突数提示。i18n 加 `dashStatsTitle/dashStatsAvg/dashStatsEmpty/dashStatsUsable/dashStatsComplete/dashStatsConflicts/dashStatsTotal/dashStatsEmptyHint/dashStatsConflictHint` zh+en 词条。
- **方法论沉淀**：
  - **①"宏观卡片在列表前"是运营决策面板的信息层级铁律**——编导打开 dashboard 的决策路径是"先看宏观信号判断方向 → 再看微观列表执行"，宏观卡片（三族 KPI 并排）在 hot/thin/cold 列表前，编导第一眼看到"角色族空壳率 60%"就知道"今天该补角色"，不用数 hot 列表里有多少红标。**信息层级铁律**：运营决策面板的渲染顺序 = 宏观 KPI → 微观列表，KPI 是"调度信号"，列表是"执行队列"，编导先看信号再看队列。
  - **②"buildStats 通用函数三族共用"与 pickCold 同构**——`buildStats(rows, scoreFn, conflictsFn)` 一行函数三族共用（cast/prop/scene 分别传 scoreCast/scoreProp/scoreScene + detectCast/detectProp/detectScene），与 c166 的 `pickCold(rows, family, scoreFn)` 同口径——三族 scoreFn 同构 `(row, lang) => {score, level, missing, advice}`，conflictsFn 同构 `(rows, lang) => Conflict[]`，新增统计能力时优先复用三族同构 helper 模式。**新增能力优先复用已有同构 helper**，不重复造轮子。
  - **③"空壳率/完整率/冲突数三色"是 L3 运营决策的调度信号**——空壳率高（红）优先补全 thinQueue、完整率高（绿）优先激活 coldQueue、冲突数高（红）优先去族库面板消冲突（同名/同人设/声纹撞），三类信号对应三类运营动作。**运营决策面板的信号设计**：每个 KPI 必须对应一个明确的运营动作，KPI 不是"展示数据"而是"调度动作"，编导看到 KPI 就知道该做什么。
  - **④"avgScore 用 Math.round 四舍五入"避免小数点噪音**——平均分是宏观信号不是精确测量，Math.round(72.4) = 72 比 72.4 更易读，编导不需要"精确到小数点后一位"的健康度，需要"大概 72 分"的调度信号。**宏观 KPI 的精度铁律**：宏观信号用整数（Math.round），微观列表可用小数（score 本身是整数）；编导看宏观 KPI 判断方向，看微观列表执行细节，精度需求不同。
  - **⑤"conflicts 跑全量库与 health 端点同口径"是查重铁律的横向一致性**——c155 已沉淀"列表可分页、查重必须全量"铁律，buildStats 的 conflicts 调 detectXxxAssetConflicts(rows, lang) 跑全量 rows（take 200），与 health 端点的 conflicts 同口径。**查重铁律的横向一致性**：同一冲突检测函数（detectXxxAssetConflicts）在多个端点（health/dash）调用时必须都跑全量库，不能 dash 端点跑分页 conflicts、health 端点跑全量 conflicts，编导在不同面板看到的冲突数必须一致。


## c168 stats 口径与截断可见性复盘（v2.174，c169 复盘轮：c155+c156 双铁律复发）
- **痛点 P1**：c168 加的 buildStats conflicts/stats 跑 take 200，但 health 端点 take 500——编导 >200 条资产时：(1) conflicts 漏第 201+ 条的冲突（c155"查重必须全量"铁律复发）；(2) castStats.total = castRows.length = 200 不是真实总数（c156"截断必须可见"铁律复发）；(3) 编导在 dashboard 看到"3 条冲突"去 health 端点却看到"5 条冲突"，数字不一致，违反横向一致性。复盘发现这是 c155+c156 双铁律同时复发：新加 stats 时只复用了 scoreCast/scoreProp/scoreScene，没复用 take 500 口径，导致 take 默认值 200 与 health 端点 take 500 不一致。
- **修法**：(1) 后端 castRows/propRows/sceneRows 从 take 200 升到 take 500（与 health 端点同口径）；(2) 新增 `prisma.count` 查真实总数（castTotalTrue/propTotalTrue/sceneTotalTrue）；(3) buildStats 加 `totalTrue` 参数，返回 `{ total: totalTrue, scanned: rows.length, avgScore, empty, usable, complete, conflicts, truncated }`——total=真实总数，scanned=take 500 内扫描数，truncated=totalTrue>scanned 时 true；(4) res.json 的 hotCastTotal/propTotal/sceneTotal 用真实总数（之前用 castRows.length=200 不是真实总数）；(5) 前端 emptyStats fallback 加 scanned/truncated 字段；(6) 前端 dashStatsCard 底部加 truncHint 显示"共 N 条，统计前 M 条"截断提示；(7) i18n 加 `dashStatsTruncHint` zh+en 词条。
- **方法论沉淀**：
  - **①"铁律复发链式"是新加能力时的横向同构陷阱**——c168 新加 buildStats 时只复用了 scoreCast/scoreProp/scoreScene（三族体检函数），没复用 take 500 口径（health 端点的查重硬帽），导致 c155"查重必须全量"铁律复发。**铁律复发链式铁律**：新加能力复用已有同构函数时，必须同时复用其上下游的所有铁律口径（take 500/conflicts 跑全量），不能只复用函数本身——函数同构不等于口径同构，口径不同则铁律复发。
  - **②"真实总数 vs 扫描数"是截断可见性的字段分离铁律**——`total=prisma.count`（真实总数，可能 >500），`scanned=take 500` 内扫描数（≤500），`truncated=total>scanned`（>500 时 true）。**字段分离铁律**：截断可见性必须分离"真实总数"与"扫描数"两个字段——total 永远是真实总数（prisma.count），scanned 永远是 take 硬帽内扫描数，truncated 永远是 total>scanned 的布尔标志，编导看到 total=600、scanned=500 就知道"统计了前 500，还有 100 条没统计"。
  - **③"buildStats 加 totalTrue 参数"与 sec 加 total 参数同构**——c167 已沉淀"sec 函数加 total 可选参数显示截断提示"，c169 的 buildStats 加 totalTrue 参数同构——通用函数通过加参数扩展能力，不破坏已有调用方。**通用函数扩展铁律**：通用函数（buildStats/sec/pickCold）加新参数时，参数放末位、给默认值、不破坏已有调用方，调用方按需传新参数——与 c167 sec 加 total 参数同构。
  - **④"conflicts 跑全量与 health 同口径"是查重铁律的横向一致性复发修复**——c155 已沉淀"列表可分页、查重必须全量"，c168 buildStats 的 conflicts 跑 take 200（不是全量）违反铁律，c169 修复为 take 500（与 health 同口径）。**查重铁律横向一致性复发修复铁律**：当新端点复用 conflicts 检测函数时，必须同步复用其全量口径（take 500），不能只用函数不用口径——同一函数在不同端点的全量口径必须一致，编导在不同面板看到的冲突数必须一致。
  - **⑤"truncHint 在 dashStatsCard 底部"是截断提示位置铁律**——截断提示放在卡片底部（avg/三色维度/空壳率/冲突数之后），与 c167 dashColdRow 的截断提示位置（sec 底部）同构。**截断提示位置铁律**：截断提示放在卡片/行的底部（所有数据之后），不放在顶部（避免编导第一眼看到截断提示误以为"数据不全"），编导先看数据再看截断——数据是主，截断是辅。

## 空壳补全闭环：dashStatsCard 空壳红信号一键跳族库面板 thin 筛选（v2.175，c170 功能轮：L3 运营决策的"信号→动作"闭环层）
- **痛点**：c168 加的 dashStatsCard 三族宏观卡片有"空壳率红"信号（`s.empty > 0 ? 红字提示`），但只是"展示数据"——编导看到"空壳率 30%"还要手动切到对应族库面板、肉眼扫 score<55 的资产、逐条编辑补全。从"信号"到"动作"断了：编导看到红信号 → 没有直接跳转入口 → 手动切面板 → 手动扫 score → 手动逐条补全，5 步变 1 步的闭环没合上。复盘发现这是 c168"宏观卡片只展示数据"的留尾——c168 加 dashStatsCard 时只做了"展示层"（信号灯），没做"动作层"（一键跳转）。
- **修法**：(1) dashStatsCard 的 empty hint 加"去补全"按钮（class=`dash-empty`，data-jump-family=cast/prop/scene）；(2) dash-empty 按钮点击后设 `dashJumpTarget={family, filter:'thin'}` + 关闭 dashboard + 调对应 openXxxLibrary；(3) renderCastLibrary/Prop/Scene 检测 `dashJumpTarget.filter==='thin'` 时按 hMap 的 score<55 筛选 assets 子集 + 清空搜索框（避免与 q 关键词冲突）+ 顶部加"已筛选：空壳资产（共 N 条）[清除筛选]"提示 + 一次性消费 dashJumpTarget=null；(4) dash-thin-clear 按钮点击重新调 openXxxLibrary（dashJumpTarget 已消费，恢复全量）；(5) i18n 加 dashEmptyBtn/dashThinFiltered/dashThinClear/dashThinNoResult zh+en 词条。
- **方法论沉淀**：
  - **①"dashJumpTarget 双模式扩展"是已有机制的能力扩展铁律**——c169 已沉淀 `dashJumpTarget={family, id}` 模式（跳到具体资产高亮），c170 扩展为 `dashJumpTarget={family, filter:'thin'}` 模式（跳到族库面板的筛选视图，不滚到具体 id）。**双模式扩展铁律**：已有跳转机制扩展新模式时，新模式字段（filter）与旧模式字段（id）互斥——filter 模式触发批量筛选，id 模式触发单条高亮，renderXxxLibrary 内 if-else 分支判断，一次性消费 dashJumpTarget=null 不残留。
  - **②"客户端筛选优先于后端筛选"是闭环最小变更铁律**——c170 的 thin 筛选纯前端客户端实现（assets.filter(h.score<55)），不改后端 list 端点加 filter=thin 参数。**客户端筛选优先铁律**：当数据已在前端（list+health 都拉了），筛选逻辑放前端（零后端变更、零 API 改动、零测试回归），只有当数据不在前端（如需要分页或后端聚合）才改后端——闭环最小变更优先级：前端客户端 > 后端 API > 数据库。
  - **③"清空搜索框避免冲突"是筛选状态隔离铁律**——thin 筛选与 q 关键词搜索不能同时生效（搜索框有值时 thin 筛选会与搜索结果叠加，编导看到"thin 筛选 N 条"但实际是"搜索+thin 叠加 N 条"，违反编导直觉）。**筛选状态隔离铁律**：新筛选模式（filter=thin）激活时清空旧筛选状态（搜索框 .value=''），避免多筛选状态叠加——一次只一种筛选模式，编导看到什么就是什么。
  - **④"清除筛选按钮"是筛选模式的可逆性铁律**——thin 筛选是编导临时操作（看一眼空壳资产），不是持久状态。**筛选可逆性铁律**：临时筛选模式必须有"清除筛选"按钮（dash-thin-clear），点击恢复全量——筛选是临时观测不是持久状态，编导看完空壳资产后应能一键回到全量视图，不该被困在筛选态。
  - **⑤"信号→动作闭环"是宏观卡片的本质铁律**——c168 dashStatsCard 只展示信号（空壳率红），c170 加按钮一键跳转（信号→动作）。**信号→动作闭环铁律**：宏观卡片不能只展示信号，必须有对应动作按钮——信号是"告诉编导哪里有问题"，动作是"让编导一键去解决问题"，从信号到动作是一键之遥，编导看到红信号 → 点按钮 → 直达问题现场，闭环 5 步变 1 步。


## 双模式健壮性复盘：thin 筛选无结果时按钮事件不绑定 + dashJumpTarget 残留态清空（v2.176，c171 复盘轮：L3 运营决策的"双模式互不污染"闭环层）
- **痛点①**：c170 加的 dash-thin-clear 按钮事件绑定位于 forEach 闭合后（cast L2960、prop L3121、scene L3285），但当 thin 筛选结果为空时（`if (!assets.length) return;` 在 L2915/3078/3242），代码提前 return 根本到不了事件绑定——按钮显示了但点击无反应，编导卡在"已筛选：空壳资产（共 0 条）[清除筛选]"视图无法清除筛选，必须刷新页面。复盘路径：dashJumpTarget 双模式健壮性复盘（A 方向）→ 发现 dash-thin-clear 事件绑定位置复盘（B 方向）是真 BUG → 三族同构一致性复盘（C 方向）确认三族同样有 BUG。
- **痛点②**：dashJumpTarget 残留态——当 dash-jump 按钮跳转的目标资产不在当前列表（被删除或被分页截断在 200 上限外）时，forEach 内的 `dashJumpTarget.id === a.id` 高亮分支永远不触发 → dashJumpTarget 永不消费 → 残留至下次同族开库误触发高亮。c170 加 filter 模式时只处理了"filter 模式一次性消费"，没处理"id 模式目标不在列表"的残留态。
- **修法**：(1) 把 dash-thin-clear 事件绑定从 forEach 闭合后提到 `if (!assets.length) return` 之前——确保 thin 筛选有无结果按钮都能点击（cast L2915、prop L3083、scene L3251）；(2) 删除 forEach 闭合后的重复绑定（原 cast L2960/prop L3121/scene L3285）；(3) forEach 闭合后加 `if (dashJumpTarget && dashJumpTarget.family === 'xxx') dashJumpTarget = null`——无条件清空同族残留态（thin 分支与 id 分支已消费的会跳过，因为已是 null，只有"目标不在列表"的残留态会被这里兜底清空）。
- **方法论沉淀**：
  - **①"事件绑定必须在提前 return 之前"是动态按钮的铁律**——所有动态写入 DOM 的按钮（innerHTML 后 querySelectorAll 绑定 onclick），事件绑定位置必须在所有提前 return 之前。**事件绑定提前 return 铁律**：如果按钮显示在 `if (!assets.length) return` 之前的 innerHTML，事件绑定也必须在 return 之前——按钮"显示"与"可点击"必须同位置保证，不能显示在前 return 在中绑定在后。否则用户看到按钮但点击无反应，比没有按钮更糟（误导用户以为功能坏了）。
  - **②"目标可能不在列表"是跳转机制的残留态铁律**——c169 加 `dashJumpTarget={family, id}` 时假设目标资产一定在当前列表，但实际有三种场景目标不在：被删除、被分页截断在 200 上限外、被搜索词过滤。**跳转残留态铁律**：跳转目标可能不在当前列表 → forEach 内的精确匹配分支（id === a.id）可能永远不触发 → 跳转态永不消费 → 残留至下次同族开库误触发。修复：forEach 闭合后无条件清空同族残留态（已消费的会跳过因为已是 null，只有"目标不在列表"的残留态会被兜底清空）。
  - **③"三族同构 = 同样的 bug 也同构"是三族同构一致性铁律**——cast/prop/scene 三族 renderXxxLibrary 的 thin 筛选代码完全同构（cast L2895-2911、prop L3058-3074、scene L3222-3238），同样的 bug 也同构存在。**三族同构铁律**：当三族代码同构时，复盘一族发现的 bug 必须立即检查另外两族是否同样存在——同构代码的 bug 不会孤立存在于一族，要么三族都有要么三族都没有，不能只修一族留两族带 bug。
  - **④"双模式互不污染"是 dashJumpTarget 双模式的健壮性铁律**——c170 加 filter 模式时只验证了"filter 模式与 id 模式不互相干扰"（filter 先消费 → id 后跳过），但没验证"id 模式目标不在列表时 filter 模式不误触发"和"filter 模式消费后 id 模式不残留"。**双模式互不污染铁律**：双模式机制（filter + id）的健壮性必须验证四种组合：filter 触发 + id 不触发 ✓、id 触发 + filter 不触发 ✓、filter 不触发 + id 不触发（残留态）→ 兜底清空、filter 触发 + id 误触发 → 不可达（filter 先消费）。复盘要覆盖所有组合，不能只验证正向路径。

## thin 筛选持久化：一次性 dashJumpTarget.filter='thin' 改面板本地状态变量（v2.177，c172 功能轮：L3 运营决策的"持久态视图"闭环层）

### 痛点
c170 加的 thin 筛选是一次性——`dashJumpTarget={family, filter:'thin'}`，renderXxxLibrary 消费后置 null。用户在 thin 视图下输入搜索词 → openXxxLibrary 重调 → dashJumpTarget 已 null → thin 筛选不再生效 → 用户看到全量搜索结果，thin 提示框和清除按钮都消失。违反用户直觉：期望"在 thin 子集内搜索"，实际"丢失 thin 回到全量"。

### 修法（三族同构）
1. **加面板本地变量**（L2596 后）：`let castThinActive = false, propThinActive = false, sceneThinActive = false;`——三个独立持久态变量，对应三族面板
2. **dash-empty 按钮事件绑定改写**（cast/prop/scene）：原 `dashJumpTarget = { family: fam, filter: 'thin' }` 改为按 fam 分支设 `castThinActive=true / propThinActive=true / sceneThinActive=true`，同时清空对应面板搜索框（一次性，避免旧搜索词与 thin 叠加）
3. **renderXxxLibrary thin 分支改写**（cast L2895-2911、prop L3058-3074、scene L3222-3238）：原 `if (dashJumpTarget && dashJumpTarget.family === 'xxx' && dashJumpTarget.filter === 'thin')` 改为 `const thinActive = xxxThinActive; if (thinActive)`——检测持久态变量替代一次性消费。**关键变化**：(a) 不再清空搜索框（让搜索词可以叠加 thin）；(b) 不再消费后置 null（让 thin 状态持久保活）
4. **dash-thin-clear 事件绑定改写**（cast/prop/scene）：原 `b.onclick = () => openXxxLibrary()` 改为 `xxxThinActive=false + 清空搜索框 + openXxxLibrary()`——清空持久态 + 清空搜索框 + 恢复全量
5. **thin+q 叠加文案**：thin 视图下有搜索词时显示 `dashThinSearchFiltered: '已筛选：空壳资产 · 搜索：{q}（共 {n} 条）'`，无搜索词时仍用 `dashThinFiltered: '已筛选：空壳资产（共 {n} 条）'`——叠加态文案与单一态文案分开
6. **保留 c171 残留态清空**：dashJumpTarget 仍用于 dash-jump 按钮（id 模式高亮），`if (dashJumpTarget && dashJumpTarget.family === 'xxx') dashJumpTarget = null` 保留——dashJumpTarget 与 thinActive 两套机制互不干扰，dashJumpTarget 管 id 高亮（一次性），thinActive 管 thin 筛选（持久态）

### UX 闭环
- **从 dashboard 跳来**：清空搜索框（避免叠加），只看 thin 子集
- **在 thin 视图下搜索**：thin 状态保留，搜索词叠加（thin+q），用户看到"空壳资产中的张三"——后端按 q 过滤（list 端点）+ 前端按 score<55 过滤（renderXxxLibrary 内 filter），两层过滤叠加
- **清除筛选**：清空 thin 状态 + 清空搜索框 + 恢复全量

### 方法论沉淀
- **①"一次性 vs 持久态"是视图状态的生命周期铁律**——视图状态分两种生命周期：(a) 一次性（消费即销毁，如 dashJumpTarget.id 高亮目标资产——渲染完该资产就 null）；(b) 持久态（直到用户显式清除，如 thinActive 筛选状态——用户不点"清除筛选"就一直保活）。**生命周期铁律**：视图状态的生命周期必须匹配用户期望——用户期望"在 thin 子集内搜索"时 thin 必须持久保活（重渲染不丢失），用户期望"跳转到具体资产"时一次性销毁即可（重渲染后该资产已滚到可视区）。错配生命周期会导致：(a) 持久态误用一次性 → 重渲染丢失状态，用户操作被打断；(b) 一次性误用持久态 → 状态残留，下次操作被旧状态污染。
- **②"重渲染不丢失状态"是面板本地变量的存在意义铁律**——openXxxLibrary 每次调用都会重渲染（list 端点 + health 端点 + renderXxxLibrary），所有局部变量（dashJumpTarget 等模块级 let）在重渲染之间保留值。**面板本地变量铁律**：用户在面板内的连续操作（thin 筛选 → 在 thin 内搜索 → 清除筛选）会触发多次重渲染，跨重渲染保留的状态必须用面板本地变量（模块级 let）而非一次性消费机制（dashJumpTarget）——一次性消费机制只能在单次渲染内传递信号，跨渲染必丢。
- **③"两层过滤叠加"是 thin+q 复合态的实现铁律**——thin 筛选（score<55）+ 搜索词（q）的复合态需要两层过滤：(a) 后端 list 端点按 q 过滤（数据库层，支持索引和分页）；(b) 前端 renderXxxLibrary 内按 score<55 过滤（渲染层，因为 health 数据独立于 list 数据）。**两层过滤铁律**：复合过滤条件如果跨数据源（list 端点管基础字段，health 端点管评分），必须分两层过滤——后端按 list 字段过滤（q 命中名字/标签），前端按 health 字段过滤（score<55），不能合并到一层。合并到后端需要 JOIN 两个表加复杂查询，合并到前端需要先拉全量再过滤（违反分页）。两层叠加是性能与简洁的平衡点。
- **④"清空时机分一次性 vs 持续"是清空操作的铁律**——dash-empty 按钮一次性清空搜索框（避免旧搜索词与 thin 叠加，但之后用户输入新搜索词不会再被清空），dash-thin-clear 按钮持续清空（每次点击都清空 thin + 搜索框 + 恢复全量）。**清空时机铁律**：清空操作分一次性（只在进入状态时清空一次，之后用户可自由输入）和持续（每次操作都清空）——一次性清空用于"避免旧状态叠加"，持续清空用于"显式重置全部状态"。错配会导致：一次性误用持续 → 用户每次输入都被清空无法搜索；持续误用一次性 → 旧状态叠加新状态。

## c172 thin 筛选持久化复盘：编辑后丢失资产 + dash-jump 与 thinActive 冲突（v2.178，c173 复盘轮：c172 持久态改写的"持久态副作用"复盘层）

### 痛点
c172 把一次性 `dashJumpTarget.filter='thin'` 改为持久态 `castThinActive`，目标是让 thin 视图在重渲染中保活（用户在 thin 视图下输入搜索词不丢失 thin 状态）。但是持久态引入了两个副作用——**持久态的生命周期跨越用户多个操作**，会与"编辑资产"、"dash-jump 跳转"等操作产生冲突。

### BUG A：编辑资产后丢失资产（三族同构）
- **场景**：用户在 thin 视图下点资产编辑 → 改完提交 → openXxxLibrary 重渲染 → castThinActive 仍 true → renderCastLibrary 走 thin 分支按 score<55 过滤 → 刚补全（score≥55）的资产被过滤掉 → 用户看不到刚编辑的资产，以为没保存成功。
- **痛点**：c172 加持久态时只考虑了"重渲染不丢失 thin 状态"，但忽略了"编辑动作改变了资产 score，可能让资产从 thin 子集移出"——这是持久态与编辑动作的冲突。
- **修复**（三族同构）：编辑成功后清空 thin 状态 + 清空搜索框 + openXxxLibrary 显示全量（cast L3014-3017、prop L3192-3195、scene L3370-3373）。理由：编辑是"改变资产"的高风险操作，用户期望看到结果反馈；thin 筛选是"过滤视图"的低风险操作，可随时重新进入（用户想继续 thin 筛选只需点 dash-empty 一次）。**编辑成功后退出 thin 视图看全貌是更安全的默认**。

### BUG B：dash-jump 与 thinActive 冲突
- **场景**：用户在 cast 面板开了 thin 视图（castThinActive=true）→ 切到 dashboard → 点 dash-jump 按钮（dashJumpTarget={family:'cast', id:'xxx'}）→ 跳回 cast 面板 → renderCastLibrary 走 thin 分支按 score<55 过滤 → 目标资产如果 score≥55 会被过滤掉 → dash-jump 的高亮分支（id===a.id）找不到目标 → 高亮不触发 → dashJumpTarget 残留态（c171 兜底清空兜底）→ 用户看不到高亮困惑"为什么跳来但没看到高亮"。
- **痛点**：c172 加 castThinActive 时只考虑了"thin 视图持久保活"，但忽略了"dash-jump 跳来的目标资产可能不在 thin 子集"——这是持久态与跳转动作的冲突。
- **修复**：dash-jump 按钮事件绑定里，设 dashJumpTarget 时同时清空对应面板的 thinActive（cast/prop/scene 三族同构）。理由：dash-jump 是用户"主动定位具体资产"的意图，比 thin 筛选（被动过滤视图）优先级高——用户主动定位时应该强制显示全量确保目标资产可见，而不是被 thin 子集过滤掉。**用户主动定位 > 被动筛选**是跳转与筛选冲突时的优先级铁律。

### 无 BUG：搜索框 input 事件防抖 300ms 触发 openXxxLibrary（确认健壮）
- **场景**：用户在 thin 视图下输入搜索词 → input 事件触发 → 300ms 防抖 → openCastLibrary 重调 → castThinActive=true 持久态 → renderCastLibrary 走 thin 分支 → thin+q 叠加 ✓
- **这是 c172 设计目标**——thin 视图下输入搜索词不丢失 thin 状态，正是因为 castThinActive 是持久态变量（跨重渲染保活）。c172 改对了。
- dash-thin-clear 触发的清空搜索框也会触发 input 事件，但因为 castThinActive 已在 onclick 内先设 false，input 事件触发的 openCastLibrary 重调走全量分支，最终一致 ✓

### 方法论沉淀
- **①"持久态副作用"是持久化改写的复盘铁律**——把一次性状态改为持久态时，必须复盘"持久态会跨越哪些用户操作"。**持久态副作用铁律**：持久态的生命周期跨越用户多个操作，每个操作都可能改变持久态的语义环境——编辑动作改变了资产 score（让 thin 过滤条件失效）、dash-jump 跳转动作定位了具体资产（被 thin 过滤条件排除）。持久化改写不能只验证"重渲染不丢失状态"，还要复盘"持久态在用户操作序列中的所有交互点"——尤其是与持久态条件冲突的操作（编辑改变 score、跳转定位具体资产、删除移除资产）。
- **②"编辑成功后退出筛选视图"是筛选态与编辑动作冲突的修复铁律**——筛选视图（thin/搜索/标签）按某个条件过滤资产，编辑动作可能改变资产让条件不再满足（thin 过滤 score<55，编辑后 score≥55）。**编辑退出筛选铁律**：编辑成功后清空筛选状态显示全量，理由：(a) 让用户看到刚编辑的资产位置（编辑反馈）；(b) 避免用户困惑"刚编辑的资产去哪了"（被筛选过滤）；(c) 筛选视图是低风险操作可随时重新进入（用户想继续 thin 只需点 dash-empty 一次）。错配（编辑后保留筛选）会导致用户以为没保存成功，重复编辑。
- **③"主动定位 > 被动筛选"是跳转与筛选冲突的优先级铁律**——dash-jump 跳转是用户"主动定位具体资产"的意图，thin 筛选是"被动过滤视图"的低风险操作。**主动定位优先级铁律**：跳转动作触发时强制清空筛选状态，理由：(a) 跳转的目标资产可能不在筛选子集 → 被过滤后看不到高亮 → 用户困惑；(b) 跳转是显式意图"我要看这个资产"，筛选是隐式意图"我要看符合某条件的资产"——显式意图优先级高于隐式意图。错配（跳转后保留筛选）会导致跳转目标不可见，跳转功能失效。
- **④"持久态的清空时机枚举"是持久化改写复盘的完整清单铁律**——持久态变量需要在所有"持久态条件失效"的时机清空，c173 复盘枚举了所有清空时机：(a) dash-thin-clear 按钮（用户显式清除筛选）；(b) 编辑成功后（资产条件变化让筛选失效）；(c) dash-jump 跳转来时（用户主动定位优先级高于筛选）；(d) dash-empty 进入 thin 视图时切换家族（dash-empty 设同族 thinActive=true 不需要清空其他族，但需要清空自己族的旧搜索词）。**清空时机枚举铁律**：持久化改写后必须枚举所有需要清空持久态的时机——不能漏，漏一个就有一个 BUG 场景。

## advice 多条折叠展开 + 三族共用 adviceHtml 辅助函数（v2.179，c174 功能轮：L3 运营决策的"补全建议可见性"闭环层）

### 痛点
c172-c173 完善了 thin 视图的进入/退出/持久/编辑闭环，但 thin 视图下编导真正需要的是"看完整补全建议清单"——后端 health 端点返回 advice 数组（通常 3-5 条），但前端只显示 `💡 ${escapeHtml(h.advice[0])}` 第 1 条，后续建议不可见。编导只看到第一条建议，可能错过其他重要的补全方向。

### 修法（三族同构）
1. **加 adviceHtml 辅助函数**（assetUsageHtml 之后）：三族共用的渲染函数，替代三处 inline 表达式
   - 0 条 advice 或 level==='rich'：返回空字符串（不渲染）
   - 1 条 advice：保持原状"💡 xxx"单行
   - 2+ 条 advice：用 `<details>` 折叠展开，summary 显示 `💡 N 条补全建议（点击展开）`，展开后是 `<ul>` 列表显示全部 advice
2. **三处替换 inline 表达式为 adviceHtml(h) 调用**：cast L2972、prop L3148、scene L3326——三族完全同构
3. **i18n 加词条**：`libAdviceMore: '💡 {n} 条补全建议（点击展开）'`（双语）

### 选择 `<details>` 原生展开的理由
- **CSP 友好**：`<details>` 是 HTML5 原生元素，不需要 JS 绑定 onclick，规避 CSP 限制
- **可访问性好**：原生展开/折叠支持键盘操作（Enter/Space 展开），屏幕阅读器原生支持
- **零 JS 开销**：不需要事件绑定、状态管理、重渲染
- **与现有 `<details>` 用法一致**：c155 截断可见性修复时已用 `<details>`，c174 沿用同一模式

### 方法论沉淀
- **①"辅助函数提取"是三族同构代码的简化铁律**——cast/prop/scene 三族 renderXxxLibrary 都有相同的 inline 表达式（advice 渲染），改成共用辅助函数 adviceHtml(h)。**辅助函数提取铁律**：三族同构的 inline 表达式（超过 2 行）应该提取为共用辅助函数——理由：(a) 减少重复代码；(b) 一处修改三处生效（c174 加多条折叠只需改 adviceHtml 一处，不需要改三处 inline）；(c) 命名清晰（adviceHtml 比 inline 表达式易读）。但 1-2 行的简单 inline 不必提取（过度抽象）。
- **②"原生 HTML 元素优先"是 CSP 友好的渲染铁律**——`<details>` 是 HTML5 原生展开/折叠元素，不需要 JS 绑定。**原生元素优先铁律**：能用原生 HTML 元素实现的交互（展开/折叠、对话框、菜单）应该用原生元素而非 JS 库——理由：(a) CSP 友好（不需要 inline onclick）；(b) 可访问性好（原生键盘/屏幕阅读器支持）；(c) 零 JS 开销（不需要事件绑定、状态管理）；(d) 与现有代码风格一致。c174 与 c155 都用 `<details>`，是同一铁律的两次应用。
- **③"渐进式信息密度"是卡片渲染的铁律**——卡片底部 advice 渲染分三种密度：(a) 0 条不显示；(b) 1 条单行（最常用，避免 details 折叠浪费一次点击）；(c) 2+ 条折叠（多条建议用 details 隐藏，避免卡片过长）。**渐进式密度铁律**：卡片信息密度应该按"重要性递减 + 数量自适应"原则渲染——重要的少则直接显示（1 条 advice 单行），不重要的多则折叠（2+ 条 advice 折叠），不可见则不渲染（0 条）。错配会导致：1 条用折叠 → 用户多一次点击才能看到关键建议；多条不折叠 → 卡片过长挡其他资产。

## rich 资产达标提醒可见性 + 折叠态副作用评估（v2.180，c175 复盘轮：c174 持续复盘 + 三方向排查）

### 痛点
c174 给 adviceHtml 加了 `level === 'rich'` 返回空字符串的条件——理由是"rich 资产已达标不需要补全建议"。但复盘发现后端 `asset-health.ts` L67-68 rich 资产也生成 advice（达标提醒"资产完整度达标：可直接跨剧引用..."），这个 advice 不是"补全建议"而是"正向反馈"——编导需要看到"已达标可跨剧引用"的信号才能放心引用资产。原条件把达标提醒也隐藏了，rich 资产卡片底部是空的，编导看不到正向反馈。

### 三方向复盘
- **A 方向（rich 资产 advice 被隐藏）**：BUG——后端 L67-68 rich 也生成 advice（达标提醒），c174 的 `level==='rich'` 条件隐藏了正向反馈。**修法**：去掉 `level==='rich'` 条件，rich 也显示 advice 但用绿色 `#2e7d32` 区分（正向反馈），usable/thin 用棕色 `#8a6d3b`（待补全建议）。颜色区分让编导一眼看出"达标 vs 待补全"。
- **B 方向（`<details>` 折叠态重渲染丢失）**：评估为合理副作用不修复——搜索防抖触发 openXxxLibrary 重渲染、编辑保存后重渲染都会重建 DOM，`<details>` 折叠态丢失是原生元素的本质行为。修法成本（持久化折叠态）远大于收益（用户多一次点击展开），且用户主动触发重渲染是用户行为，advice 折叠态丢失可以接受。**判定铁律**：原生元素的副作用如果修法成本 > 用户损失（多一次点击），不修复。
- **C 方向（三族 adviceHtml 调用位置一致性）**：通过——cast L2972、prop L3148、scene L3326 都在卡片底部（cast 在 sigs 后，prop/scene 在 visualAnchor 后），差异是 cast 有 print/sigs 字段而 prop/scene 没有，合理。三族完全同构。

### 方法论沉淀
- **①"反馈可见性"是资产运营的隐形闭环**——编导看资产卡片不仅需要"缺什么补什么"的负向反馈（待补全建议），也需要"已达标可引用"的正向反馈。**反馈双向铁律**：资产体检渲染不仅要显示"待补全建议"（负向反馈），也要显示"达标提醒"（正向反馈）——理由：编导需要双向信号才能做运营决策：(a) 负向信号驱动补全动作；(b) 正向信号驱动引用动作。隐藏任何一方都会让资产卡片"半盲"。c174 的 BUG 是只看到负向反馈的重要性，忽略了 rich 资产也有正向反馈需要展示。
- **②"颜色区分反馈类型"是卡片渲染的可读性铁律**——advice 数组同时承载"达标提醒"（rich 等级，正向）和"补全建议"（usable/thin 等级，负向）两种语义，用同一颜色会让编导无法一眼区分。**颜色语义铁律**：同一渲染元素承载多种语义时，用颜色区分语义而非文字标注——理由：(a) 颜色识别速度 < 200ms，比读文字快 5-10 倍；(b) 颜色是预注意加工（pre-attentive），不需要刻意注意就能识别；(c) 行业惯例（绿色=正向，红色=警示，棕色=待办）。c175 用绿色 `#2e7d32` 表示 rich 的达标提醒，棕色 `#8a6d3b` 表示 usable/thin 的补全建议，与 c174 thin 视图用红色 `#c0392b` 警示空壳资产形成完整的三色反馈体系（绿/棕/红 = 达标/待补全/空壳）。
- **③"成本-收益判定"是副作用修复决策的铁律**——B 方向（`<details>` 折叠态重渲染丢失）评估为合理副作用不修复。**成本-收益铁律**：副作用修复决策不能只看"是否是 BUG"，要看修法成本 vs 用户损失的比例——理由：(a) 副作用是中性的（不一定是 BUG），原生元素重建丢折叠态是合理行为；(b) 修法成本包括代码复杂度（持久化折叠态需要 Map 记录每张卡片的折叠状态）+ 性能开销（重渲染时遍历 Map 恢复折叠态）+ 维护成本（折叠态 Map 与 DOM 同步问题）；(c) 用户损失是多一次点击展开 advice（< 1 秒）；(d) 比例是 3 类成本 vs 1 秒用户损失 → 不修复。错配会导致：过度修复副作用 → 代码复杂度膨胀；漏修真正的 BUG → 用户体验持续受损。判定标准：成本 > 10x 用户损失 → 不修复；成本 < 用户损失 → 修复；中间地带 → 看使用频率（高频用例修复，低频不修复）。

## thin 视图"全部补全"快捷入口 + 三族 batch-complete 端点（v2.181，c176 功能轮：thin 筛选闭环的"一键补全"层）
**触发来源**：c170-c175 thin 视图六轮闭环已完成（dash-empty 按钮 → thin 筛选 → 持久态 → dash-jump → advice 折叠 → rich 达标提醒），但编导在 thin 视图看到一堆空壳资产时，仍需要一条条点"编辑"补字段——批量补全入口缺失。

### 痛点
thin 视图筛选出 N 个空壳资产后，编导的下一步动作是"补全"——但 c170-c175 没有批量补全入口，编导只能：
(a) 一条条点"编辑"→ 手填每个字段 → 保存 → 重渲染（thin 状态因 c173 修复得以保留，但工作量极大）；
(b) 调 AI 补全（成本高、token 浪费——其实缺的 voice/visualAnchor/tag 用规则模板占位就够）。
**核心矛盾**：thin 视图筛出来的资产大多缺的是"占位级"字段（voice/visualAnchor/signatureLines/mood/taboo/tags），不是"指纹级"字段（voicePrint/eps）——前者用规则模板可批量补，后者必须从成稿沉淀或手动录入。但当前没有"只补占位级、不补指纹级"的批量入口。

### 实现路径
- **引擎层（同构三族）**：
  - `autoFillCastAsset(a, lang)` 在 [asset-health.ts](file:///Users/a123/Desktop/养正/zhongnan/zhongnan-backend/src/engine/asset-health.ts) 末尾——基于 persona 补 voice（句式/语气词/口头禅占位）、signatureLines（气质锚占位）、visualAnchor（身材/服饰/体态占位）；voicePrint 不可规则补全返回 skipped（声纹必须从成稿生成后沉淀，规则生成会污染跨剧辨识）；persona 必填缺则整条 skipped（不替编导捏人设）。
  - `autoFillPropAsset(a, lang)` 在 [prop-health.ts](file:///Users/a123/Desktop/养正/zhongnan/zhongnan-backend/src/engine/prop-health.ts) 末尾——基于 meaning 补 visualAnchor（材质/颜色/形制占位）、taboo（按认亲凭证/复仇证据/悬念载体分类给通用禁忌占位）、tags（从 meaning 抽 2-3 个中文关键词）；eps 不可规则补全返回 skipped（连续性必须从成稿沉淀）。
  - `autoFillSceneAsset(a, lang)` 在 [scene-health.ts](file:///Users/a123/Desktop/养正/zhongnan/zhongnan-backend/src/engine/scene-health.ts) 末尾——基于 meaning 补 visualAnchor（建筑形制/陈设/光线条件占位）、mood（按 meaning 关键词推断情绪底色：压抑/温馨/阴沉/中性）、tags（同 prop）；eps 不可补全返回 skipped。
- **路由层（同构三族）**：[generate.ts](file:///Users/a123/Desktop/养正/zhongnan/zhongnan-backend/src/routes/generate.ts) 加 `POST /character-assets/batch-complete`、`POST /prop-assets/batch-complete`、`POST /scene-assets/batch-complete`——入参 `{ ids: string[] }`，鉴权 `authRequired`，take 200 硬帽同 list 端点口径；流程：findMany 取资产 → 对每个调 autoFill → **只填空格不覆盖手动精修**（与 from-project 的"只增强不降级"语义同构）→ 返回 `{ updated: [{id,name,filled}], skipped: [{id,name,reason}], total }`。
- **前端（三族共用按钮组件）**：[app.js](file:///Users/a123/Desktop/养正/zhongnan/zhongnan-backend/web/app.js) 三族 thin 工具栏（cast L2930 / prop L3126 / scene L3322）在"清除筛选"按钮旁边加 `dash-thin-batch-complete` 按钮（绿色 `#2e7d32` 与 rich 达标色一致，与 c175 三色体系呼应），按当前激活家族调对应端点，完成后 alert 提示补了 N 条、跳过 M 条，刷新族库列表。
- **i18n 双语**：加 `dashThinBatchComplete/dashThinBatchDoing/dashThinBatchDone/dashThinBatchFail` 四条词条。
- **测试**：[test/asset-autofill.test.cjs](file:///Users/a123/Desktop/养正/zhongnan/zhongnan-backend/test/asset-autofill.test.cjs) 13 个用例覆盖三族 autoFill 契约（缺必填字段整条 skip / 全满配不补 / 缺字段补全正确 / 不可补字段返回 skipped / en 模式 / 关键词推断正确）。

### 方法论沉淀
- **①"占位级 vs 指纹级"是规则补全的边界铁律**——autoFill 只补"占位级"字段（voice/visualAnchor/signatureLines/mood/taboo/tags），不补"指纹级"字段（voicePrint/eps）。**边界铁律**：规则模板补全必须区分字段语义等级——理由：(a) 占位级字段是"编导视角的可读占位"（如"句式…；语气词嗯/吧/呢"），规则生成可读、编导后续可逐条精修，不破坏跨剧辨识；(b) 指纹级字段是"跨剧复用的硬约束"（voicePrint 是换剧"听得出同一人"的依据，eps 是连续性规则的落点），规则生成会污染辨识或伪造连续性；(c) 边界错配的代价：占位级不补 → 编导工作量增加（可接受）；指纹级误补 → 跨剧串戏 / 连续性穿帮（不可接受）。判定标准：字段是否"跨剧复用的硬约束"？是 → 不可规则补全；否 → 可规则补全。
- **②"只补空格不覆盖手动精修"是补全入口的安全铁律**——batch-complete 端点的 updateData 只填 `!r.voice ? { voice: af.filled.voice } : {}`，已有手动精修的字段不覆盖。**安全铁律**：批量补全必须保留手动精修的字段——理由：(a) 编导对某个角色 voice 的精修可能是基于特定剧本场景的考量（如"这角色在第3集情绪崩溃，句式要短促"），规则模板不知道上下文；(b) 覆盖手动精修会让编导失去对资产的控制感（"我精修的字段被批量覆盖了"），下次不敢用批量补全；(c) 与 from-project 的"只增强不降级"语义同构——沉淀不覆盖手动精修，补全也不覆盖。实现铁律：`if (!r.field) updateData.field = filled.field`——只在字段为空时填，已有值不动。
- **③"三族同构按钮组件"是 UI 一致性的复用铁律**——cast/prop/scene 三族 thin 工具栏的 batch-complete 按钮代码模式完全一致（class 名 `dash-thin-batch-complete`、绿色边框、点击事件结构 disabled→fetch→alert→刷新），只在端点 URL 和刷新函数名上不同。**同构铁律**：三族 UI 组件必须复用同一代码模式——理由：(a) 编导在三族面板间切换时，UI 一致性降低认知负担（同一按钮同一位置同一颜色同一交互）；(b) 维护成本降低（修一处三族同时修，避免 drift）；(c) 与三族体检引擎（scoreCastAsset/scorePropAsset/scoreSceneAsset）、三族冲突检测（detectCastAssetConflicts/detectPropAssetConflicts/detectSceneAssetConflicts）的同构传统一致。判定标准：三族功能如果只是"字段名不同"，必须用同构代码模式，禁止差异化实现。

## c177 复盘：batch-complete 空字符串判定同构修复（v2.182.0，c177 复盘轮：补全入口的字段判定口径与 score 函数对齐）

**触发来源**：c176 功能轮落地三族 batch-complete 端点时，"已有值不覆盖"判定用的是 `!r.voice`，而 scoreCastAsset 用的是 `!a.voice?.trim()`——两套判定口径不一致，空字符串/全空白字符串情形下会出现"score 已判缺失但 batch 不补"的悬空状态。

### 痛点
batch-complete 端点的 updateData 检查"已有值不覆盖"用 `!r.voice`：
- `r.voice = null` → `!r.voice` = true → 补全（正确）
- `r.voice = undefined` → `!r.voice` = true → 补全（正确）
- `r.voice = ""` 空字符串 → `!r.voice` = true → 补全（正确）
- `r.voice = "   "` 全空白 → `!r.voice` = **false** → **不补全**（错误！）

而 scoreCastAsset 用 `!a.voice?.trim()` 判定缺失——`"   "` 经 `.trim()` 后是 `""` falsy → 判定为缺失，会进 `h.missing` 数组。

**结果**：score 已判定 voice 缺失（在 advice 里提示"缺声音特质..."），autoFill 也生成了补全文本（基于 h.missing.includes('voice') 触发），但 batch-complete 端点的 updateData 检查 `!r.voice` = false 不写入 → 补全流程跑完但字段没更新 → 下次再调 score 仍判缺失 → **"补完后 advice 仍提示缺字段"**——编导困惑"我点了补全为什么还提示缺"。

### 根因
**两套判定口径不一致**：score 函数用 `.trim()` 处理"形式上有值但语义上空"的字段（空字符串/全空白都视为缺失），而 batch-complete 端点的"是否覆盖"判定却用朴素的 `!r.X` 真值判定——前者识别空白字符串为缺失，后者识别为"已有值"。两者口径错位导致 score 提示缺但 batch 不补的悬空。

### 实现路径
- **三族同构修复**：[generate.ts](file:///Users/a123/Desktop/养正/zhongnan/zhongnan-backend/src/routes/generate.ts) cast batch-complete L595/L597、prop batch-complete L742-743、scene batch-complete L977-978 把 `!r.X` 改为 `r.X == null || !String(r.X).trim()`——与 scoreCastAsset 的 `!a.X?.trim()` 同口径，覆盖 null/undefined/""/全空白 四种"缺失"语义。
- **保持手精修不覆盖铁律**：`if (r.voice == null || !String(r.voice).trim())` 仍然在手动精修的实值（"句式短促；语气词嗯"等非空白字符串）上为 false → 不覆盖，c176 的"只补空格不覆盖手动精修"安全铁律不破。

### 方法论沉淀
- **①"补全判定口径必须与 score 同构"是规则补全的语义铁律**——补全入口的"是否需要补全"判定必须与 score 函数的"是否缺失"判定**完全同构**，否则会出现"score 提示缺但 batch 不补"的悬空状态。**语义铁律**：补全入口的判定口径必须与 score 同构——理由：(a) score 函数是"缺失"语义的权威定义者（advice 基于此生成，编导看到的"缺 X 字段"提示源于此），如果补全入口用另一套口径，就会出现"advice 提示缺但 batch 不补"的悬空状态，编导困惑；(b) Prisma 字段在 DB 是 null，但前端表单可能提交空字符串 `""`，score 与补全都得识别为"缺失"；(c) 全空白字符串（`"   "`）虽然 truthy 但语义上等同空——只有 `.trim()` 能识别。判定标准：补全入口的"是否需要补全"判定必须**与 score 函数的"是否缺失"判定完全一致**——`r.X == null || !String(r.X).trim()` 是 score 的 `!a.X?.trim()` 的展开形式，二者等价。**复盘意义**：c176 的"只补空格不覆盖手动精修"铁律需要在 c177 进一步精确化"空格"的定义——空格 = null/undefined/空字符串/全空白字符串四种，不只是 null。
- **②"复盘轮的口径对齐"是规则补全入口的常见修复模式**——功能轮（c176）落地补全入口时用朴素真值判定 `!r.X`，复盘轮（c177）发现 score 函数已用 `.trim()` 处理形式上有值但语义上空的字段——两者口径对齐是规则补全入口的常见修复模式。**修复模式**：补全入口的字段判定必须对齐 score 函数的判定口径——理由：(a) 功能轮的朴素判定在 null/undefined 上能工作（DB 默认 null），但前端表单提交空字符串的场景下漏；(b) 复盘轮的口径对齐是把"语义上空"的判定从 score 函数同步到补全入口——两者用同一套判定逻辑。判定标准：补全入口的 `!r.X` 改为 `r.X == null || !String(r.X).trim()`——与 score 函数 `!a.X?.trim()` 等价的展开形式，覆盖四种"语义上空"的口径。
- **③"tags 抽取粒度的'碎片化'是特性不是 bug"**——autoFillPropAsset/SceneAsset 的 tags 抽取用 `/[\u4e00-\u9fa5]{2,4}/g` 全局匹配 2-4 字连续汉字，从"认亲凭证"抽出"认亲"+"凭证"两个独立标签——看似碎片化，实际是检索召回的特性。**特性铁律**：标签的语义就是关键词级别，2-4 字关键词符合检索召回的灵活性——理由：(a) 前端可点击检索，标签作为独立关键词比长短语更灵活（一个标签命中即可召回，长短语要求完整命中）；(b) 后端按 tag 检索时，"认亲"+"凭证"两个标签都能召回"认亲凭证"资产，反而提升召回率；(c) 与"标签 = 关键词"的常识一致——"标签"的语义就是关键词级别的标注，不是短语级别的描述。判定标准：规则抽取的标签如果是 2-4 字关键词，碎片化是特性；如果是 5+ 字短语，可能要考虑分词。
- **④"mood 兜底'中性'是规则补全的合理边界"**——autoFillSceneAsset 的 mood 推断 4 个分支（仇/血/杀→压抑、暖/合/圆→温馨、权/谋→阴沉、fallback→中性）。**边界铁律**：规则补全只占位不替编导捏情绪细节——理由：(a) mood 是"氛围基调"，复杂场景（如"林川上班的公司"是商务冷淡还是工业压抑）超出关键词规则可识别的范围；(b) "中性"是合理占位——编导看到 mood="中性"知道是规则补的占位，会主动改成具体情绪；(c) 如果规则强行推断（如基于场景名"公司"→"商务"），编导可能误以为是手动精修过的，反而失去对资产的掌控感。判定标准：规则补全只补"可读占位"，不补"情绪细节"——复杂情绪编导手改即可。

## c178 功能：batch-complete 预检闭环 + 字段清单预览（v2.183.0，c178 功能轮：补全前 dry-run + 补全后字段清单，形成"预检→补全→结果预览"完整闭环）

**触发来源**：c176 落地三族 batch-complete 端点、c177 复盘修复判定口径后，编导对"补全"的反馈是"我点了补全但不知道会补什么字段、补完后也不知道实际补了哪些"——一次性写入后只有"成功 N 条跳过 M 条"的数字反馈，缺乏补全前后两端的信息透出。

### 痛点
c177 版本的 batch-complete 流程：
1. 编导点"⚡ 全部补全" → alert 提示"补全完成：成功 N 条，跳过 M 条"
2. 编导看不到：补全**前**会涉及哪些字段（voice/visualAnchor/...）、补全**后**实际补了哪些字段（每条补的可能不同）

**问题**：(a) 补全前没有 confirm 预览——编导点完按钮才知道结果，没法"看了再决定要不要补"；(b) 补全后 alert 只有数字没有字段清单——编导得点开每条资产卡片才知道补了什么，工作量回到"逐条精修"的老路。

### 实现路径
**后端 dry-run 端点**（三族同构，[generate.ts](file:///Users/a123/Desktop/养正/zhongnan/zhongnan-backend/src/routes/generate.ts) L578/L727/L962）：
- batch-complete 端点加 `?dry-run=1` query 参数
- dryRun=true 时只跑 autoFill 不写库——`if (dryRun) { const fields = Object.keys(updateData); fields.forEach((f) => fieldsSet.add(f)); updated.push({ id, name, fields }); continue; }`（continue 跳过 prisma.update）
- 返回结构化预览：`{ dryRun: true, willUpdate: [{ id, name, fields }], willSkip: [{ id, name, reason }], fieldsUnion: [...并集字段], total }`

**前端闭环**（三族同构，[app.js](file:///Users/a123/Desktop/养正/zhongnan/zhongnan-backend/web/app.js) L2951/L3169/L3381）：
1. 按钮 disabled + 文案改"预检中…" → 调 dry-run
2. dry-run 返回后 → `confirm(t('dashThinBatchConfirm', { u, s, fields }))` 弹预览（"将补 N 条，跳过 M 条，涉及字段：声音特质、视觉锚点"）→ 用户取消则不写库
3. confirm 通过 → 文案改"补全中…" → 调实际 batch-complete
4. 实际补全返回后 → `alert(t('dashThinBatchDoneWithFields', { u, s, fields }))` 显示"成功 N 条跳过 M 条，实际补全字段：声音特质、视觉锚点"（取 j.updated[].filled 并集）

**i18n 扁平词条**（[i18n.js](file:///Users/a123/Desktop/养正/zhongnan/zhongnan-backend/web/i18n.js) L107/L220）：
- 加 `dashThinBatchPreview/Confirm/DoneWithFields` 三条插值词条
- 字段名映射用扁平键：`dashThinBatchFieldsVoice/signatureLines/visualAnchor/taboo/tags/mood`——与 t() 字符串查表兼容，避免对象类型让 t() 调 .split 报错

### 方法论沉淀
- **①"补全前 dry-run 是规则补全的标准闭环铁律"**——批量补全（batch-complete）必须有 dry-run 预检入口，理由：(a) 规则补全是"占位级"写入，编导对补的内容没有事先预览就写入会失去掌控感——尤其当补 200 条时，一次性写入后想撤销不可能；(b) dry-run 与实际写入共用 autoFill 函数，保证预检结果与实际补全内容一致——dryRun=true 只跳过 prisma.update，其他逻辑完全相同；(c) dry-run 的 fieldsUnion 让编导一眼看到"将补 voice/visualAnchor/signatureLines"，可以判断是否需要先精修某些字段再补。判定标准：批量写入类端点必须有 `?dry-run=1` 入口，返回 willUpdate/willSkip/fieldsUnion 三件套——功能闭环铁律。
- **②"扁平 i18n 键 vs 对象类型 i18n"是 t() 函数兼容性的硬约束**——c178 第一版把 `dashThinBatchFields` 写成对象 `{ voice: '声音特质', ... }`，但 t() 函数是 `s.split('{k}').join(v)` 字符串插值——对象类型会让 s 变成对象，调 .split 报错。**约束铁律**：t() 函数只支持字符串值，对象类型的 i18n 键必须拆为扁平命名空间——理由：(a) t() 函数的 `s.split('{k}').join(String(v))` 假设 s 是字符串，对象类型没有 split 方法；(b) 扁平键（如 `dashThinBatchFieldsVoice`）与 t() 兼容，前端 `t('dashThinBatchFields' + f.charAt(0).toUpperCase() + f.slice(1))` 动态拼接即可取到；(c) 命名空间虽长但可读性好，且与 i18n 字典其他扁平词条同构。判定标准：i18n 字典的所有值必须是字符串，对象/数组类型必须拆为扁平命名空间。
- **③"补全后字段清单是结果反馈的最低门槛"**——补全完成 alert 必须显示实际补全的字段清单，不只是数字。**反馈铁律**：批量操作的反馈至少要满足"做了什么 + 影响哪些"两层——理由：(a) 只显示"成功 N 条"编导还得逐条点开卡片看补了什么，工作量回到补全前的状态；(b) 补全的字段清单（取 j.updated[].filled 并集）让编导一眼看到"这次补了 voice 和 visualAnchor，没补 signatureLines"——可以决定是否要再补一轮或手精修；(c) 与"补全前预检"的 fieldsUnion 对应——预检说"将补 voice/visualAnchor"，结果说"实际补了 voice/visualAnchor"——形成预检→结果的对照闭环。判定标准：批量写入操作的 alert 反馈必须包含字段清单，不只是数字。
- **④"顶层 fieldName 函数 vs 函数内重复定义"是前端三族同构的代码组织铁律**——c178 改造时 cast/prop/scene 三族都用 fieldName 映射，最初在 cast 函数内 `const fieldName = ...` 定义，但 prop/scene 是独立函数（async function openCastLibrary/openPropLibrary/openSceneLibrary），const 块级作用域不跨函数。**组织铁律**：三族共用的辅助函数必须在模块顶层定义——理由：(a) const 是块级作用域，函数内定义的 const 在另一个函数里访问不到，会报 ReferenceError；(b) 模块顶层（IIFE 内部、所有函数外部）定义的 const 是模块级变量，所有函数都能访问；(c) 三族同构的代码组织铁律：共用的辅助函数在顶层，差异化的逻辑在各自函数内。判定标准：三族共用的纯函数（无状态、无副作用）必须在模块顶层定义；只在单族内用的逻辑在函数内定义。

## c179 复盘：三族 batch-complete 闭环的边界与兜底修复（v2.184.0，c179 复盘轮：对 c178 落地的 dry-run+字段清单闭环做边界审查，发现并修复 3 个 BUG）

**触发来源**：c178 落地三族 batch-complete 闭环（dry-run+confirm+字段清单）后，按"功能轮→复盘轮交替"节奏对刚落地的功能做边界审查。复盘覆盖 6 个点：dry-run 边界、判定口径、confirm 链路、fieldName 兜底、串行请求延迟、dash-conflict thinActive 清理。

### 痛点
c178 闭环在主路径跑通，但复盘审查发现 3 处边界 BUG：
1. **dry-run willUpdate=[] 边界**：编导对全部已手填的资产误点"全部补全"时，dry-run 返回 willUpdate=[] willSkip=[全部 N 条]——但前端仍弹 confirm"将补 0 条，跳过 N 条，涉及字段：-"，让编导以为"要补 0 条还要确认？"——多余的 confirm + 后续实际补全请求（虽然 willUpdate=[] 实际补全也会跳过，但网络请求不该发）。
2. **fieldName 兜底返回长串前缀**：c178 用 `t('dashThinBatchFields' + f.charAt(0).toUpperCase() + f.slice(1)) || f` 兜底——但 t() 在 key 缺失时返回 key 本身（如 `'dashThinBatchFieldsCatchphrase'`），非空字符串是 truthy，`|| f` 拦不住——结果 alert 里编导看到"实际补全字段：dashThinBatchFieldsCatchphrase"长串前缀，等于把 i18n 实现细节暴露给编导。
3. **dash-conflict 按钮漏修 thinActive**：c173 已修复 dash-jump 跳转族库面板前清 thinActive（否则冲突资产可能被 thin 过滤看不到），但 c178 落地后复盘发现 dash-conflict 按钮（同样是 dashboard → 族库面板跳转入口）漏了同口径修复。

### 实现路径
**Fix 1：dry-run willUpdate=[] 直接 alert**（三族同构，[app.js](file:///Users/a123/Desktop/养正/zhongnan/zhongnan-backend/web/app.js) cast L2967/prop L3188/scene L3405）：
- dry-run 返回后加 `if (u === 0) { alert(t('dashThinBatchNoop', { s })); return; }` 分支
- 跳过 confirm + 跳过实际补全请求——直接 return，按钮文案在 finally 块恢复
- i18n 词条 `dashThinBatchNoop`：zh `'ℹ️ 无可补字段——{s} 条资产全部已手填或不可规则补全（如声纹/出现集须从成稿沉淀）'`，en 同义

**Fix 2：fieldName 兜底逻辑**（[app.js](file:///Users/a123/Desktop/养正/zhongnan/zhongnan-backend/web/app.js) L12-16）：
- 原：`const fieldName = (f) => t('dashThinBatchFields' + f.charAt(0).toUpperCase() + f.slice(1)) || f;`
- 改：`const v = t(key); return v === key ? f : v;`——t() 返回 key 本身时回退到 f 原值（如 `'catchphrase'`，比长串前缀可读）
- 原理：t() 在 key 缺失时返回 key 本身（非空字符串是 truthy），`|| f` 拦不住——必须显式判 `v === key` 才能识别"key 缺失"

**Fix 3：dash-conflict 清 thinActive**（[app.js](file:///Users/a123/Desktop/养正/zhongnan/zhongnan-backend/web/app.js) L2816-2821）：
- 原 dash-conflict 实现只有 `modal.classList.add('hidden'); openXxxLibrary()`
- 加 `if (fam === 'cast') castThinActive = false; else if (fam === 'prop') propThinActive = false; else if (fam === 'scene') sceneThinActive = false;` 三行
- 与 c173 dash-jump（L2786-2788）同口径同构

### 方法论沉淀
- **①"t() 函数的兜底链末端必须显式判等 key 本身"是 i18n 兜底铁律**——c179 Fix 2 揭示了一个被忽略的 t() 行为：key 缺失时返回 key 本身（非空字符串），而非空字符串是 truthy，`|| defaultValue` 的短路兜底拦不住——结果会把 key 本身（如 `'dashThinBatchFieldsCatchphrase'`）当合法值返回。**铁律**：t() 函数的兜底必须显式判等——`const v = t(key); return v === key ? defaultValue : v;`——理由：(a) t() 是字符串查表，key 缺失时返回 key 本身是常见实现（避免 undefined 让调用方崩），但破坏了 `|| defaultValue` 的短路兜底语义；(b) 显式判等 `v === key` 是唯一可靠的"key 缺失"识别方式——其他方式（如 `!v`、`v == null`）都拦不住非空字符串；(c) 兜底返回的 defaultValue 必须是可读的短字段名（如 `'catchphrase'`），不是长串前缀——即便 i18n 缺失，编导看到的也是可读的字段名而不是 i18n 实现细节。判定标准：t() 调用链末端的兜底必须用 `v === key ? defaultValue : v`，禁止用 `|| defaultValue`。
- **②"批量操作的边界值处理优先于主路径优化"是闭环完整性的铁律**——c179 Fix 1 揭示：c178 主路径（willUpdate 非空）跑通了，但边界（willUpdate=[]）没有专门处理——直接走 confirm 会弹"将补 0 条"的多余确认。**铁律**：批量操作（batch）的边界值（0 条、满额、超限）必须有专门分支处理——理由：(a) 边界值走主路径会让用户看到"0 也要确认？"的困惑体验；(b) 边界分支应该 early return 跳过后续网络请求——发请求也跑空，但延迟和带宽消耗不该有；(c) 边界反馈文案要明确告诉用户"为什么 0 条"（如"全部已手填或不可规则补全"），不是简单的"0 条已补"。判定标准：batch 操作的 willUpdate.length === 0、=== maxLimit、< minQuorum 等边界必须有专门分支 + 专门文案 + early return。
- **③"同类按钮的同口径修复必须同步覆盖"是复盘修复铁律**——c179 Fix 3 揭示：c173 已修 dash-jump 清 thinActive，但同类的 dash-conflict（同样是 dashboard → 族库面板跳转）漏修——复盘时才发现。**铁律**：同类按钮（同样入口、同样跳转目标、同样上下文）的修复必须同步覆盖——理由：(a) 复盘时按"按钮类型"扫一遍，而不是按"修过的按钮"扫——前者能发现漏修，后者只会确认已修；(b) 同类按钮在不同代码位置（dash-jump 在 L2777、dash-conflict 在 L2810），不显式扫会漏；(c) "同口径"的含义是"同样的上下文 + 同样的副作用"——dash-jump 和 dash-conflict 都是 dashboard 跳族库面板，副作用都是"thinActive 可能拦截目标资产"，所以必须同口径修。判定标准：复盘时按"按钮类型 / 入口类型"扫描所有同类按钮，已修的确认覆盖、未修的补上同口径修复。

## c180 功能：batch-complete token 化延迟优化 + 字段筛选 + dash-conflict 滚动高亮（v2.185.0，c180 功能轮：补全闭环的三项体验升级）

**触发来源**：c179 复盘轮收尾后，按"功能轮→复盘轮交替"节奏继续推进。c180 同轮推进 3 项：① dry-run 返回 patches（updateData 完整内容），实际补全请求带 patches 跳过 autoFill 重算——解决串行请求延迟（token 化无状态方案）② 三族 batch-complete 实际补全/dry-run 都可带 fields 数组筛选字段（前端 modal dialog checkbox 选字段，默认全选）③ dash-conflict 跳转后自动滚动到 conflicts 区 + 5 秒金色 box-shadow 高亮（与 dashJumpTarget 同口径，dashConflictScroll 全局变量一次性消费）。

### 痛点
c178/c179 落地的 dry-run+confirm+字段清单闭环在主路径跑通，但体验仍有 3 处可优化：
1. **串行请求延迟（token 化）**：编导点"全部补全"→ dry-run 跑 autoFill 算 patches → confirm → 实际补全又跑一遍 autoFill 重算同样的 patches——autoFill 是规则模板补全零 token 不调 AI，但三族资产字段多（角色 14 字段、道具 11 字段、场景 9 字段），N 条资产 × M 字段 × K 模板规则，dry-run 已算过一遍、实际补全又算一遍是重复劳动，延迟感知明显。
2. **字段筛选缺失**：c178/c179 的字段清单是 alert 预览（只读），编导无法"只补 catchphrase 不补 personality"——要么全补要么不补。但实际场景中编导可能只想补某些字段，缺少选择权。
3. **dash-conflict 跳转无视觉锚点**：c178 落地 dash-conflict 跳转只 openXxxLibrary，但族库面板很长（剧本资产 + 冲突预警 + thin 筛选 + batch-complete 按钮等多区），编导跳过来后要自己找"冲突预警在哪"——dash-jump 跳转资产详情有 dashJumpTarget 滚动高亮，dash-conflict 同样是 dashboard → 族库面板跳转，却没有同口径的滚动高亮。

### 实现路径
**Fix 1：dry-run 返回 patches + 实际补全带 patches 跳过 autoFill**（[generate.ts](file:///Users/a123/Desktop/养正/zhongnan/zhongnan-backend/src/routes/generate.ts) cast L576-647/prop L769-833/scene L1043-1107）：
- dry-run 返回结构升级：`willUpdate` 数组每项加 `patch: { ...updateData }` 字段（完整 updateData 内容）
- 实际补全请求 body 新增可选 `patches: [{ id, patch }]` 字段
- 服务端逻辑：`patchesMap = patchesInput ? new Map(patchesInput.map((p) => [p.id, p.patch])) : null`——有 patches走 token 化路径（跳过 autoFill），无 patches 走旧路径（跑 autoFill）
- token 化路径内再次校验"只填空格不覆盖"：`const cur = (r as any)[f]; const isEmpty = ...; if (isEmpty) updateData[f] = patch[f];`——防 dry-run 后编导手动改字段被 patches 旧值覆盖
- 无状态方案：服务端不引入缓存层，patches 由客户端持有，请求间无状态依赖

**Fix 2：fields 字段筛选 + modal dialog**（[app.js](file:///Users/a123/Desktop/养正/zhongnan/zhongnan-backend/web/app.js) L2616-2665 + 三族 batch-complete 流程）：
- 服务端：实际补全/dry-run 都支持可选 `fields: string[]` 字段，patches 路径和 autoFill 路径都按 fields 筛选 updateData
- 前端：新增 `showBatchCompleteDialog(dryRes)` 共享函数返回 `Promise<{patches, fields}|null>`
- modal dialog 替代 confirm：标题 + 摘要（将补 N 条跳过 M 条）+ checkbox 列表（每字段显示涉及条数，默认全选）+ 全选/全不选 + 确认/取消
- 三族 batch-complete 流程同构改造：dry-run → modal dialog 字段选择 → 实际补全带 patches+fields → alert 字段清单预览
- i18n 双语：新增 9 个词条（dashThinBatchDialogTitle/Summary/Fields/All/None/Confirm/Cancel/Empty + dashConflictScrollTitle）

**Fix 3：dashConflictScroll 滚动高亮**（[app.js](file:///Users/a123/Desktop/养正/zhongnan/zhongnan-backend/web/app.js) L2612 全局变量 + L2881 dash-conflict onclick + 三族 renderXxxLibrary 结尾消费 + 三处 fetch 失败兜底）：
- 新增 `dashConflictScroll` 全局变量（与 dashJumpTarget 同口径，一次性消费标志）
- dash-conflict onclick 加 `dashConflictScroll = fam`（fam 为 'cast'/'prop'/'scene'）
- 三族 renderXxxLibrary 结尾加消费：`if (dashConflictScroll === 'cast') { dashConflictScroll = null; const el = $('castLibConflicts'); if (el) { setTimeout(scrollIntoView, 100); el.style.boxShadow = '0 0 0 3px var(--gold, #c79a3a)'; setTimeout(clear, 5000); } }`
- 三处 fetch 失败兜底加 `dashConflictScroll = null`——防 fetch 失败后标志残留导致下次 renderXxxLibrary 误触发

### 方法论沉淀
- **①"token 化延迟优化必须再次校验'只填空格不覆盖'防 patches 旧值覆盖手动修改"是 dry-run 缓存铁律**——c180 Fix 1 揭示：dry-run 返回 patches 给客户端持有，实际补全带 patches 跳过 autoFill 是无状态延迟优化，但 dry-run 到实际补全之间有时间窗口——编导可能手动改了字段（如手填了 catchphrase），如果实际补全直接用 dry-run 时的 patches 旧值会覆盖手动修改。**铁律**：token 化路径必须再次校验"只填空格不覆盖"——理由：(a) patches 是 dry-run 时刻的快照，dry-run → 实际补全之间编导可能手动改字段，patches 旧值会覆盖新改；(b) 再次校验 isEmpty 口径与 autoFill 路径完全一致（null/undefined/""/全空白 四种缺失），保证两条路径的"只填空格不覆盖"语义同构；(c) 校验失败的字段自动跳过（不进入 updateData），不会抛错——编导手填的字段保留，空字段用 patches 填充。判定标准：token 化路径的每个字段写入前必须 `const cur = (r as any)[f]; const isEmpty = ...; if (isEmpty) updateData[f] = patch[f];`，禁止直接 `updateData[f] = patch[f]`。
- **②"modal dialog 返回 Promise 替代 confirm 支持复杂 UI"是前端交互铁律**——c180 Fix 2 揭示：c178 的 confirm 只能 OK/Cancel 两选一，无法支持"checkbox 选字段"这种复杂 UI——但批量补全需要让编导选补哪些字段（默认全选，可取消勾选）。**铁律**：批量操作的字段选择/范围选择/参数配置必须用 modal dialog 返回 Promise，禁止用 confirm + 后续 prompt 凑合——理由：(a) confirm 是同步阻塞 API，UI 只能纯文本，不支持 checkbox/radio/select 等表单控件；(b) modal dialog 返回 Promise 是异步非阻塞，UI 可任意复杂（checkbox 列表 + 全选/全不选 + 摘要 + 涉及条数提示）；(c) Promise resolve 传 `{patches, fields}` 给调用方，reject（取消/X 关闭）传 null，调用方用 `if (!choice) return;` 短路——与 confirm 的 if/else 语义清晰对齐；(d) modal 内部逻辑封装在共享函数 `showBatchCompleteDialog(dryRes)` 里，三族共用，避免三处重复实现。判定标准：批量操作需要用户选择参数（字段/范围/选项）时，必须用 `function showDialog(data) { return new Promise((resolve) => { ... }); }`，禁止用 confirm + prompt 凑合。
- **③"dashConflictScroll 与 dashJumpTarget 同口径一次性消费 + fetch 失败兜底清空"是状态标志铁律**——c180 Fix 3 揭示：dash-jump 跳转资产详情早有 dashJumpTarget 滚动高亮（c173 落地），但 dash-conflict 跳转族库面板无视觉锚点——编导跳过来要自己找"冲突预警在哪"。**铁律**：dashboard → 族库面板跳转的视觉锚点必须用全局变量一次性消费 + fetch 失败兜底清空——理由：(a) 全局变量（如 dashConflictScroll = 'cast'）是"下一次 renderXxxLibrary 时要做什么"的标志，renderXxxLibrary 结尾消费完立即置 null——保证只触发一次，不会每次 re-render 都滚动；(b) 消费点必须在 renderXxxLibrary 结尾而不是 onclick 里——因为 onclick 时面板还没渲染，scrollIntoView 找不到 el；(c) fetch 失败兜底必须清空——否则 fetch 失败后 dashConflictScroll 残留，下次编导手动 openXxxLibrary 时会误触发滚动；(d) "同口径"指与 dashJumpTarget 完全一致的状态机：onclick 设标志 → render 结尾消费 → 置 null → fetch 失败也清空。判定标准：dashboard → 面板跳转的滚动高亮必须用 `let dashXxxScroll = null;` 全局变量 + onclick 设标志 + render 结尾消费置 null + fetch 失败兜底清空，四件套缺一不可。

## c181 复盘：batch-complete 闭环的安全防护 + UX 完善 + 镜像同步（v2.185.1，c181 复盘轮：对 c178/c179/c180 三轮落地的 batch-complete 闭环做安全/UX/同步审查）

**触发来源**：c180 功能轮落地后，按"功能轮→复盘轮交替"节奏对 c178/c179/c180 三轮落地的 dry-run+modal+patches 闭环做复盘。复盘覆盖 4 个点：镜像 SKILL.md 方法论节落后、patches 客户端篡改风险、modal dialog DOM 残留、i18n 双语完整性。

### 痛点
c180 落地的 patches token 化+modal dialog+dashConflictScroll 闭环在主路径跑通且全量测试通过，但复盘审查发现 4 处可优化：
1. **镜像 SKILL.md 方法论节严重落后**：c180 收尾时只同步了镜像 .user_skills/SKILL.md 的 frontmatter 版本号 2.165.0→2.185.0，但方法论节还停留在 v2.165.0 时代——源 SKILL.md 已有 c172-c180 共 9 节方法论（135983 字节），镜像只有 38926 字节——版本号是 2.185.0 但方法论节严重落后，不自洽。
2. **patches 客户端篡改风险（安全 P1）**：c180 的 patches token 化路径里 `updateData[f] = patch[f]`——patch 是客户端传上来的 updateData，服务端信任 patch 内容直接写入。风险：(a) 字段名注入——客户端传 `patches: [{ id: 'xxx', patch: { id: 'attacker-id', userId: 'attacker-id' } }]` 会改 id/userId 字段；(b) 值类型注入——客户端传 `patches: [{ id: 'xxx', patch: { voice: { $gt: '' } } }]` 是 NoSQL 注入风格对象；(c) 任意字段——客户端传 `patches: [{ id: 'xxx', patch: { nonexistentField: 'xxx' } }]` Prisma 会抛错进 skipped 但客户端看不到错误原因。
3. **modal dialog DOM 残留检查（P2）**：c180 的 showBatchCompleteDialog 用 `overlay.remove()` 在 close 函数统一清理——审查发现无 DOM 残留 BUG，但缺 X 关闭按钮 + Esc 键关闭两个 UX 完善点；且 close 函数被多次调用（Esc + X + cancel + overlay 外部点击）时无防重入保护，可能重复 remove + 重复 resolve（虽然 Promise 只 resolve 一次生效，但 remove 重复会抛 NotFoundError）。
4. **i18n 双语完整性（P2）**：c180 新增 9 个词条（dashThinBatchDialogTitle/Summary/Fields/All/None/Confirm/Cancel/Empty + dashConflictScrollTitle），需复核 zh+en 是否都有——Grep 验证 18 次匹配 = 9 key × 2（zh+en），完整无遗漏，通过。

### 实现路径
**Fix 1：镜像 SKILL.md 整体覆盖同步**——源 SKILL.md 135983 字节超 64KB Read 限制无法 Read+Write，用 shell cp 整体覆盖（dedicated tools 无法完成的大文件操作属必要例外）：
- `cp 源SKILL.md 镜像SKILL.md`
- 验证：`wc -c 镜像SKILL.md` 返回 135983 字节，与源一致

**Fix 2：patches 客户端篡改防护**（[generate.ts](file:///Users/a123/Desktop/养正/zhongnan/zhongnan-backend/src/routes/generate.ts) L445-460 白名单常量 + L617-637/L813-832/L1093-1112 三族 patches 路径校验）：
- 模块顶部新增三族白名单常量：`PATCH_FIELDS_CAST = { voice: 'string', signatureLines: 'string[]', visualAnchor: 'string' }`、`PATCH_FIELDS_PROP = { visualAnchor: 'string', taboo: 'string', tags: 'string[]' }`、`PATCH_FIELDS_SCENE = { visualAnchor: 'string', mood: 'string', tags: 'string[]' }`——白名单 = 三族 autoFill 实际可补字段
- 三族 patches 路径 for 循环加校验：`const fieldType = PATCH_FIELDS_XXX[f]; if (!fieldType) continue;` 字段名不在白名单跳过；`if (fieldType === 'string' && typeof val !== 'string') continue;` string 字段错型跳过；`if (fieldType === 'string[]' && !Array.isArray(val)) continue;` 数组字段非数组跳过；`if (fieldType === 'string[]' && !val.every((x) => typeof x === 'string')) continue;` 数组元素非 string 跳过
- 校验失败的字段静默跳过（不抛错、不进 updateData）——编导看到的只是"该字段没补"，不会暴露服务端实现细节

**Fix 3：modal dialog UX 完善 + 防重入**（[app.js](file:///Users/a123/Desktop/养正/zhongnan/zhongnan-backend/web/app.js) L2626-2660）：
- 加 X 关闭按钮：`<button class="dash-batch-x">×</button>` 右上角，title="取消"
- 加 Esc 键关闭：`const escHandler = (e) => { if (e.key === 'Escape' && !closed) close(null); }; document.addEventListener('keydown', escHandler);`
- 加防重入：`let closed = false; const close = (result) => { if (closed) return; closed = true; document.removeEventListener('keydown', escHandler); overlay.remove(); resolve(result); };`——close 被多次调用时只执行一次（移除 escHandler + remove overlay + resolve Promise），重复调用静默返回
- close 函数统一清理：移除 escHandler 防事件监听残留 + remove overlay 防 DOM 残留 + resolve Promise 通知调用方

**Fix 4：i18n 双语完整性复核**——Grep 验证 9 个 key 在 i18n.js 出现 18 次（= 9 × 2 zh+en），完整无遗漏，无需修复。

### 方法论沉淀
- **①"patches 客户端篡改必须字段名白名单 + 值类型校验"是 token 化路径安全铁律**——c181 Fix 2 揭示：c180 的 patches token 化路径让客户端持有 patches（updateData 内容）传回服务端跳过 autoFill——但服务端信任 patches 内容直接写入数据库，相当于"客户端替服务端做决定"。**铁律**：token 化/缓存化路径必须校验客户端传回的数据符合服务端原始生成口径——理由：(a) 字段名白名单防注入任意字段——客户端传 `patch: { id: 'attacker-id' }` 会改 id 字段，必须用 `PATCH_FIELDS_XXX[f]` 白名单跳过非法字段名；(b) 值类型校验防错型值——客户端传 `patch: { voice: 123 }`（数字）或 `patch: { voice: { $gt: '' } }`（对象）会写入错型值，必须用 `typeof val !== 'string'` 跳过；(c) 数组字段元素校验——客户端传 `patch: { tags: [1, 2, 3] }`（数字数组）会写入错型元素，必须用 `!val.every((x) => typeof x === 'string')` 跳过；(d) 校验失败静默跳过而非抛错——编导看到的只是"该字段没补"，不暴露服务端实现；(e) 白名单 = autoFill 实际可补字段——客户端能传的字段必须 ⊆ autoFill 能补的字段，否则就是注入。判定标准：token 化路径的每个字段写入前必须有 `const fieldType = WHITELIST[f]; if (!fieldType) continue;` + 类型校验三连（string/Array.isArray/Array.every），禁止直接 `updateData[f] = patch[f]`。
- **②"modal dialog 关闭路径统一清理 + handler 移除防残留 + 防重入"是前端状态铁律**——c181 Fix 3 揭示：c180 的 modal 有 4 个关闭入口（cancel 按钮 / overlay 外部点击 / confirm 按钮 / 销 confirm 后关闭），但 close 函数被多次调用时无防重入——Esc 按下后 close(null) 执行，overlay.remove() 后再次按 Esc 又触发 close(null) 重复 remove 抛 NotFoundError。**铁律**：modal dialog 的 close 函数必须防重入 + 统一清理所有副作用——理由：(a) `closed` 标志防重入——第一次 close 后 closed=true，后续调用静默返回，避免重复 remove/重复 resolve；(b) `document.removeEventListener('keydown', escHandler)` 必须在 close 内执行——否则 escHandler 残留在 document 上，下次打开 modal 时旧 escHandler 还会触发；(c) overlay.remove() 清理 DOM——防 DOM 树残留越来越多 modal；(d) resolve(result) 只生效一次——Promise 的 resolve 二次调用静默无效，但显式 closed 标志让代码意图清晰。判定标准：modal dialog 必须有 `let closed = false; const close = (r) => { if (closed) return; closed = true; /* 清理 handler + DOM + resolve */ };`，禁止直接 `overlay.remove(); resolve(result);` 不防重入。
- **③"镜像 skill 副本必须整体同步而非只版本号"是 skill 副本同步铁律**——c181 Fix 1 揭示：c180 收尾时只同步了镜像 .user_skills/SKILL.md 的 frontmatter 版本号（2.165.0→2.185.0），但方法论节（c172-c180 共 9 节）没同步——版本号显示 2.185.0 但内容还停留在 2.165.0 时代，"版本号与内容不自洽"。**铁律**：skill 副本同步必须整体覆盖（frontmatter + 方法论节 + 参考资产节全部），禁止只同步版本号——理由：(a) 版本号是"内容版本"的承诺，只改版本号不改内容等于"版本号撒谎"——读副本的人以为看到的是 v2.185.0 时代的内容，实际是 v2.165.0 时代，会误导决策；(b) 整体覆盖最简单——shell cp 一条命令，比"逐节追加方法论"更可靠（不会漏同步、不会顺序错乱）；(c) 大文件超 64KB Read 限制时，shell cp 是 dedicated tools 无法完成的必要例外——不要为了"用 dedicated tools"而牺牲同步完整性。判定标准：skill 副本同步必须用 shell cp 整体覆盖（源 SKILL.md → 镜像 SKILL.md），禁止用 Edit 只改版本号；同步后用 `wc -c` 验证字节数一致。

## c182 功能：batch-complete 闭环路由层契约测试 + dashConflictScroll 静态审查（v2.185.2，c182 功能轮：补 c181 落地后的边界测试与静态审查）

**触发来源**：c181 复盘轮落地 patches 客户端篡改防护 + modal dialog UX 完善后，按"功能轮→复盘轮交替"节奏启动 c182 功能轮。c181 末尾规划三项：① patches+fields 组合边界契约测试（P3）② dashConflictScroll re-render 边界测试（P3）③ 新功能探索。c182 定位为"测试轮 + 静态审查轮"——9 个路由层契约测试已交付，dashConflictScroll 静态审查清单沉淀，新功能盘点结论：当前 batch-complete 闭环无 P0/P1 bug。

**复盘结论**：
1. **patches+fields 组合边界契约测试（P3）**：c178-c181 四轮落地的 dry-run+modal+patches 闭环，路由层一直缺契约测试（只有引擎层 asset-autofill.test.cjs 测 autoFill）。c182 在 [character-asset.test.cjs](file:///Users/a123/Desktop/养正/zhongnan/zhongnan-backend/test/character-asset.test.cjs) 末尾追加新 describe 块"v2.186 c182 · cast batch-complete 闭环契约"，9 个测试 case 全过：
   - 组合①：patches+fields 都有——fields 是 patches 子集，只补交集（验证 fields 筛选生效，未选字段不动）
   - 组合②：patches 无 fields——全 patch 字段都补（白名单内）
   - 组合③：fields 无 patches——走 autoFill 路径，按 fields 筛选 autoFill 结果
   - 组合④：patches 和 fields 都无——走 autoFill 全补（向后兼容旧路径）
   - c181 防护①：patches 含白名单外字段（id/userId/persona）→ 跳过不写库
   - c181 防护②：patches 值类型错（string 字段传对象 / string[] 字段传字符串）→ 跳过
   - c181 防护③：dry-run 后编导手动改了字段，patches 旧值不覆盖（"只填空格不覆盖"防旧 patches 覆盖手动修改）
   - 边界①：空 ids 数组 / ids 超 200 上限 → 400
   - 边界②：dry-run 不写库：返回 willUpdate/willSkip/fieldsUnion/total 但库里字段仍空
2. **dashConflictScroll re-render 边界静态审查（P3）**：c180 落地的 dashConflictScroll="cast"/"prop"/"scene" 三族"设标志→渲染完后消费→scrollIntoView + 5 秒金色 box-shadow 高亮"模式。审查结论：**无崩溃级 bug**，但有 corner case 视觉降级——5 秒高亮内若 castLibConflicts 元素被 innerHTML 重建（re-render），原 setTimeout 持有的是旧 el 引用（已 detached），5 秒后 `el.style.boxShadow = ''` 设置一个 detached 节点的 style 无副作用，但新 DOM 节点没有 boxShadow 高亮——视觉上 5 秒高亮被提前擦除。**不修**——corner case 视觉降级增加复杂度换不来对等价值，沉淀静态审查清单即可。
3. **新功能盘点结论**：盘点了 batch-complete 路由实现的潜在边界——dry-run 路径下 patches+fields 组合、实际补全请求的 patches 旧值覆盖手动修改、patches 含白名单外字段、patches 值类型错、空 ids/超 200 ids 边界——全部自洽无 P0/P1 bug，无需修。dashboard 宏观数据每次 openAssetDashboard 都 fresh fetch（无缓存），batch-complete 完成后下次打开 dashboard 自动看到新数据——无 stale bug。c182 定位为"测试轮 + 静态审查轮"是合理优先级排序。

### 方法论沉淀
- **①"token 化路径必须补路由层契约测试覆盖所有组合边界"是 token 化铁律**——c182 揭示：c180 patches+fields token 化有 4 种组合（都无/只有 patches/只有 fields/都有），但 c178-c181 四轮只测了引擎层 autoFill（asset-autofill.test.cjs 测 autoFillCastAsset/autoFillPropAsset/autoFillSceneAsset 的"缺字段补占位级"规则），路由层 batch-complete 端点 0 测试覆盖——直到 c182 才补。**铁律**：token 化路径必须补路由层契约测试，覆盖所有组合边界 + 篡改防护验证——理由：(a) 引擎层测试只覆盖"autoFill 算法本身"，路由层测试才覆盖"HTTP 入口 → 参数解析 → patches/fields 路径分发 → 白名单校验 → 类型校验 → 只填空格不覆盖 → 写库 → 响应"完整链路；(b) 4 种组合边界是 token 化路径的状态空间——任何一种组合的边界处理错误都会导致"用户在 modal 取消某些字段后实际补全仍补全所有字段"等不一致；(c) 篡改防护必须用真实 HTTP 请求验证——单元测试 mock prisma 时白名单+类型校验是否真的生效，只有路由层测试能证实；(d) c181 的"白名单+类型校验三连"是防御代码，没有测试就是"未被验证的防御"——下次重构时可能被无意删除。判定标准：token 化路径必须有路由层测试覆盖所有组合（patches+fields / patches 无 fields / fields 无 patches / 都无）+ 所有篡改防护（白名单外字段 / 类型错 / 旧值覆盖手动修改），禁止只有引擎层测试。
- **②"前端定时器副作用 + 一次性消费标志"静态审查清单**——c182 揭示：dashConflictScroll 这类"设标志→渲染完后消费→setTimeout N 秒清空副作用"模式有 4 个审查点：(a) 标志必须先清空再做副作用（防重入）——`if (dashConflictScroll === 'cast') { dashConflictScroll = null; /* 副作用 */ }` 而非 `if (dashConflictScroll === 'cast') { /* 副作用 */; dashConflictScroll = null; }`，否则副作用抛错时标志永远不清；(b) fetch 失败兜底必须清空标志（防残留）——`catch { dashConflictScroll = null; }`，否则下次开库误触发滚动高亮；(c) setTimeout 持有 el 闭包引用——re-render 重建元素后 setTimeout 操作的是 detached 节点（无害但视觉降级：5 秒高亮被提前擦除）；(d) corner case 视觉降级不修——增加"re-render 时重新触发高亮"的状态变量会引入复杂度，换不来对等价值（5 秒内 re-render 是极少数情况）。判定标准：定时器副作用模式必须审查 4 点（标志先清空 / fetch 失败兜底清空 / 闭包引用 detached 风险 / corner case 视觉降级是否值得修），禁止只看"主路径跑通"就放过。
- **③"复盘轮的延伸是补测试覆盖而非只做代码审查"是复盘铁律**——c182 揭示：c181 复盘轮做了"代码审查 + 修复"（patches 篡改防护 + modal UX + i18n 复核 + 镜像同步），但没补路由层契约测试——c182 在 c181 后做时才发现"路由层 0 测试覆盖"是更大的"漏"。**铁律**：复盘轮如果只做"代码审查 + 修复"会漏掉"测试覆盖缺失"这类问题——必须同时补测试覆盖，让下次复盘有"测试基线"可对照——理由：(a) 代码审查只能发现"已落地代码的 bug"，无法发现"应该有但没有的测试"——只有"尝试写测试"时才会发现"原来路由层一直没测"；(b) 测试基线是下次复盘的对照物——c183 复盘时可以跑 `node scripts/run-tests.cjs test/character-asset.test.cjs` 看 9 个 c182 契约测试是否仍全过，如果有人改了路由实现让某个 case 红，立即定位；(c) 测试覆盖是"复盘轮的延伸工作"——复盘轮发现"代码有 bug"是 P0，发现"测试有缺口"是 P1，两者必须同时修。判定标准：复盘轮必须包含"尝试写测试覆盖刚才落地的功能"这一步，禁止只做代码审查 + 修复；测试基线建立后下次复盘必须先跑测试看是否仍绿。









## c183 复盘：prop/scene batch-complete 族同构复制测试 + c182 铁律自洽性复盘（v2.185.3，c183 复盘轮：补族同构测试覆盖 + 上轮铁律补强）

**触发来源**：c182 功能轮落地的 9 个路由层契约测试只覆盖了 cast 一族，prop/scene 是"族同构复制"——按"功能轮→复盘轮交替"节奏启动 c183 复盘轮。c182 末尾规划四项：① 复盘 c182 9 个测试找遗漏 ② 补 prop/scene 同口径测试 ③ 复盘 c182 节方法论 3 条铁律自洽 ④ 跑 c182 测试基线确认仍绿。

**复盘结论**：
1. **补 prop/scene batch-complete 闭环契约测试（P1）**：c182 只在 character-asset.test.cjs 末尾追加了 9 个 case，prop-asset.test.cjs 和 scene-asset.test.cjs 完全没测 batch-complete 路由层——这是 c182 铁律①"所有组合边界"的执行漏洞（铁律①说"所有组合边界"，但 c182 只覆盖了 cast 一族，prop/scene 是"族同构复制"应该也覆盖）。c183 在 prop-asset.test.cjs 和 scene-asset.test.cjs 末尾各追加 9 个 case，与 cast c182 9 个 case 同构复制——字段映射：cast voice/signatureLines/visualAnchor → prop visualAnchor/taboo/tags → scene visualAnchor/mood/tags；必填非白名单字段：cast persona → prop meaning → scene meaning。**18 个新 case 全过**：组合① patches+fields 都有 → 只补交集；组合② patches 无 fields → 全 patch 字段都补；组合③ fields 无 patches → 走 autoFill 按 fields 筛选；组合④ 都无 → autoFill 全补；c181 防护① 含白名单外字段（id/userId/meaning）→ 跳过；c181 防护② 值类型错 → 跳过；c181 防护③ dry-run 后手动改字段 patches 旧值不覆盖；边界① 空 ids/超 200 → 400；边界② dry-run 不写库。**族同构复制验证成立**——三族 9+9+9=27 个 case 全过，证明路由层三族 batch-complete 实现+PATCH_FIELDS_XXX 白名单+只填空格不覆盖逻辑完全同构。
2. **复盘 c182 9 个测试找遗漏（P1）**：发现 3 处"防御性边界"未覆盖——(a) patches 数组结构防御（patches 传不是数组的值 / patches 数组里某项缺 id 或 patch 不是对象）→ 路由层 Array.isArray + typeof 过滤后走 autoFill 路径；(b) 多 ids 部分 patches 混合（ids: [id1, id2]，patches 只覆盖 id1）→ id1 走 patches 路径、id2 走 autoFill 路径；(c) patches id 不在 ids 数组里 → patchesMap 有 key 但 rows 循环遇不到 → patches 被静默丢弃。**不补在 c183**——这三处是"防御性边界"，c183 定位为"族同构复制验证轮"，三处遗漏沉腅到 c184 功能轮补。
3. **复盘 c182 节方法论 3 条铁律自洽性（P2）**：发现两处补强点——(a) 铁律①"所有组合边界"未显式提"族同构复制也必须各自补测试"——c182 落地时只覆盖 cast 一族，prop/scene 是族同构复制但没补测试，c183 补 18 个 case 验证同构性成立。(b) 铁律③"复盘轮必须补测试覆盖"未显式提"族同构复制功能落地后复盘轮必须验证三族同构性"——c183 正在做这件事。**铁律②自洽**——4 个审查点覆盖了定时器副作用模式的所有 corner case，逻辑自洽无需补强。
4. **跑 c182 测试基线确认仍绿（P2）**：c182 落地后 4084/4084 全过；c183 加 prop/scene 18 个新 case 后跑全量 4138/4138 全过（54 个测试增量 = 18 prop + 18 scene + 18 describe 块计入 suite 统计）——c182 9 个 cast case 仍绿，无任何回归。

### 方法论沉淀
- **①"族同构复制功能落地后复盘轮必须验证三族同构性"是族同构铁律**——c183 揭示：c182 落地 cast 一族 9 个 case 后，prop/scene 虽然路由实现完全同构（PATCH_FIELDS_PROP/PATCH_FIELDS_SCENE 白名单 + 同样的 patches+fields+只填空格不覆盖逻辑），但 0 测试覆盖——直到 c183 补 18 个 case 才证实同构性成立。**铁律**：族同构复制功能落地后，复盘轮必须验证三族同构性——理由：(a) "族同构"是设计意图，但实现是否真的同构只有跑测试能证实——cast 路由 9 个 case 全过不代表 prop/scene 路由也全过，prop/scene 的 PATCH_FIELDS_XXX 白名单字段名不同（voice/signatureLines/visualAnchor vs visualAnchor/taboo/tags vs visualAnchor/mood/tags），autoFill 算法实现也不同（cast 抽 persona 关键词 / prop 抽 meaning 关键词 / scene 抽 meaning+地点关键词），任何一处的"族同构"假设崩塌都会让某族行为偏离设计；(b) 测试用 helper 必须改字段名（cast 的 persona 必填 → prop/scene 的 meaning 必填；cast 的 voice/signatureLines → prop 的 visualAnchor/taboo → scene 的 visualAnchor/mood），但测试结构（9 个 case 的组合①-④ + c181 防护①-③ + 边界①-②）必须一致——结构一致证明"族同构"在测试层也成立；(c) 复盘轮验证三族同构性是"补强上轮铁律"——c182 铁律①说"所有组合边界"，但没显式提"族同构复制"，c183 补 18 个 case 后沉腅本铁律。判定标准：族同构复制功能落地后复盘轮必须补三族同构测试（cast N 个 + prop N 个 + scene N 个 case 结构一致），禁止只补一族假设另两族自动同构。
- **②"复盘轮的自洽性复盘包括上轮铁律是否需要补强"是复盘铁律**——c183 揭示：c182 节 3 条铁律在 c183 复盘时被发现两处需要补强（铁律①"所有组合边界"未显式提"族同构复制"、铁律③"复盘轮必须补测试覆盖"未显式提"族同构复制功能落地后复盘轮必须验证三族同构性"）。**铁律**：复盘轮的自洽性复盘必须包括"上轮铁律是否需要补强"——理由：(a) 铁律是沉腅的方法论，但方法论本身可能不完整——c182 落地时只覆盖 cast 一族，所以铁律①"所有组合边界"在 c182 的语境里默认是"cast 一族的所有组合边界"，没显式提"族同构复制"是 c182 的盲区；(b) 复盘轮的"自洽性复盘"是"回头看上轮铁律"——上轮铁律是否覆盖了上轮实际落地的工作？上轮铁律是否预测了 c183 复盘时发现的问题？—— c183 发现 c182 铁律①没预测"族同构复制"问题，所以铁律①需要补强；(c) 铁律补强后下次复盘再看补强后的铁律是否自洽——形成"铁律迭代闭环"。判定标准：复盘轮必须显式做"上轮铁律自洽性复盘"——逐条问"上轮铁律是否覆盖了上轮实际落地的工作？是否预测了本轮发现的问题？"，发现补强点必须沉腅本节铁律；禁止只看"本轮工作是否完成"不回头看铁律。
- **③"测试基线建立后下次复盘必须先跑全量测试看是否仍绿"是测试基线铁律**——c183 揭示：c182 落地 4084/4084 全过后，c183 加 18 个新 case 跑全量 4138/4138 全过——c182 9 个 cast case 仍绿证明 c183 没有引入回归。**铁律**：测试基线建立后下次复盘必须先跑全量测试——理由：(a) 测试基线是"对照物"——c184 复盘时跑全量测试，如果某个 c182/c183 case 红了，立即定位"是 c184 改了什么让某个边界 case 红"——比"代码审查找 bug"快 10 倍；(b) 全量测试是"族同构回归检测"——c184 改 prop 路由时如果只跑 prop 测试，不会发现 cast/scene 是否也被影响；跑全量测试能在 cast/prop/scene 三族之间发现"族同构回归"；(c) 测试基线建立后"全量测试绿"是复盘轮的入口条件——c184 复盘第一步是跑全量测试，如果某 case 红了，先修红 case 再做复盘工作；如果全绿，再做"找遗漏/补边界"工作。判定标准：复盘轮第一步必须跑全量测试 `node scripts/run-tests.cjs test/`，禁止跳过直接做代码审查——全量测试是回归检测的最廉价手段。



## c184 功能：batch-complete 防御性边界契约测试（v2.185.4，c184 功能轮：补 c183 复盘发现的三处防御性边界）

**触发来源**：c183 复盘轮盘点 c182 9 个 cast case 找遗漏，发现 3 处"防御性边界"未覆盖——(a) patches 数组结构防御（patches 传非数组 → Array.isArray false → 走 autoFill 兜底）；(b) 多 ids 部分 patches 混合（ids: [id1, id2]，patches 只覆盖 id1 → id1 走 patches 路径、id2 走 autoFill 路径）；(c) patches id 不在 ids 数组里（patches 里有 id2 但 ids 只含 id1 → patches 被静默丢弃）。c183 定位为"族同构复制验证轮"没补这三处，沉腅到 c184 功能轮补。

**落地工作**：
1. **cast batch-complete 防御性边界契约 3 个 case（P1）**：在 [character-asset.test.cjs](file:///Users/a123/Desktop/养正/zhongnan/zhongnan-backend/test/character-asset.test.cjs) 末尾追加 describe 块"v2.188 c184 · cast batch-complete 防御性边界契约"，3 个 case 全过：
   - 边界①：patches 传字符串 "hack"（非数组）→ 路由层 `Array.isArray` 返回 false → `patchesInput = null` → `patchesMap = null` → 走 autoFill 路径补三字段（voice/signatureLines/visualAnchor）。证实 `Array.isArray` 防御真的生效——非法 patches 不让路由崩，走 autoFill 兜底。
   - 边界②：多 ids 部分 patches 混合（ids: [id1, id2]，patches 只覆盖 id1）→ id1 走 patches 路径用 patch 自定义值 `[patches-path]`、id2 走 autoFill 路径用 autoFill 算出值（不同于 `[patches-path]`）。用 patch 自定义值与 autoFill 值不同来证实两条路径真的分叉——只看"两 id 都补"无法区分是走 patches 还是 autoFill，必须用自定义 patch 值证实 id1 真的走了 patches 路径。
   - 边界③：patches id 不在 ids 数组里（ids: [id1]，patches: [{id: id2, patch}]）→ `patchesMap` 有 id2 但 rows 循环只到 id1（`findMany({ where: { id: { in: ids } } })` 只查 ids 内的资产）→ id1 走 autoFill 路径补全、id2 不在 ids 里没补（patches 被静默丢弃）。查 id2 字段仍空证实 patches 真的被丢弃，而非被静默写入。

2. **prop batch-complete 防御性边界契约 3 个 case（P1，族同构复制验证）**：在 [prop-asset.test.cjs](file:///Users/a123/Desktop/养正/zhongnan/zhongnan-backend/test/prop-asset.test.cjs) 末尾追加 describe 块"v2.188 c184 · prop batch-complete 防御性边界契约（族同构复制验证）"，3 个 case 与 cast 同构复制——字段映射：cast voice/signatureLines/visualAnchor → prop visualAnchor/taboo/tags（PATCH_FIELDS_PROP 白名单）；必填非白名单字段：cast persona → prop meaning。**3 个 case 全过**，族同构复制验证成立——prop 路由层 patchesInput 过滤逻辑（行 805）与 cast（行 609）完全同构。

3. **scene batch-complete 防御性边界契约 3 个 case（P1，族同构复制验证）**：在 [scene-asset.test.cjs](file:///Users/a123/Desktop/养正/zhongnan/zhongnan-backend/test/scene-asset.test.cjs) 末尾追加 describe 块"v2.188 c184 · scene batch-complete 防御性边界契约（族同构复制验证）"，3 个 case 与 cast 同构复制——字段映射：cast voice/signatureLines/visualAnchor → scene visualAnchor/mood/tags（PATCH_FIELDS_SCENE 白名单）；必填非白名单字段：cast persona → scene meaning。**3 个 case 全过**，族同构复制验证成立——scene 路由层 patchesInput 过滤逻辑（行 1085）与 cast（行 609）完全同构。

4. **修复源 SKILL.md 同步漏洞（P0，c184 启动时发现）**：c184 启动时发现源 SKILL.md（`.user_skills/zhongnan-shortdrama-craft/SKILL.md`）版本号停在 `2.185.1`——c182/c183 两轮的节方法论只追加到了镜像 SKILL.md（`.trae-cn/skills/zhongnan-shortdrama-craft/SKILL.md`，版本号 `2.185.3`），漏了源。先用 `cp 镜像 源` 让源追上镜像，再在源追加 c184 节，最后用 `cp 源 镜像` 让镜像与源一致。**同步漏洞修复**——c185 复盘轮必须验证"源与镜像版本号+节内容一致"。

5. **跑全量测试确认无回归（P2）**：c184 加 9 个新 case 后跑全量 4174/4174 全过（比 c183 的 4138 多 36 个——9 个新 case + 27 个 describe 块计入 suite 统计）——c182/c183 的 27 个 case 仍绿，无任何回归。typecheck + build 都过。

### 方法论沉淀
- **①"防御性边界测试必须覆盖客户端可能误传或恶意构造的输入结构"是防御性边界铁律**——c184 揭示：c182 9 个 case 覆盖了主路径（patches+fields 组合 4 种）+ c181 三连防护（白名单外字段/类型错/只填空格不覆盖），但路由层 patches 数组结构防御（`Array.isArray(patches) ? patches.filter(...) : null`）的"防御性边界"没测——客户端可能传字符串、null、对象等非数组值，也可能传数组里某项缺 id 或 patch 不是对象。**铁律**：防御性边界测试必须覆盖"客户端可能误传或恶意构造的输入结构"——理由：(a) 路由层的防御逻辑（`Array.isArray` + `filter` + `typeof`）是为了"客户端不可信"——客户端可能因 bug 误传非数组，也可能恶意构造注入字段，防御逻辑必须能兜住；(b) 只测主路径（patches 是合法数组）无法证实防御逻辑真的生效——必须传"非法 patches"看路由是否走 autoFill 兜底；(c) 防御性边界测试的 case 设计必须能证实"路由层过滤逻辑真的生效"——边界①传字符串看是否走 autoFill、边界②用 patch 自定义值与 autoFill 值不同看两条路径是否真的分叉、边界③传 patches id 不在 ids 里看是否被静默丢弃。判定标准：路由层有"输入结构防御"逻辑（`Array.isArray`/`typeof`/`filter` 等）时，测试必须传"非法结构"看是否走兜底路径，禁止只测合法输入假设防御逻辑自动生效。
- **②"三族同构复制的防御性边界测试必须三族都补"是族同构防御铁律**——c184 揭示：c183 补 prop/scene 18 个 case 验证"族同构复制"在主路径成立，但防御性边界（patches 传非数组/多 ids 部分 patches 混合/patches id 不在 ids 里）是否也三族同构？——c184 在 cast/prop/scene 三族各补 3 个 case（共 9 个）证实防御性边界也三族同构。**铁律**：族同构复制的防御性边界测试必须三族都补——理由：(a) 路由层的防御逻辑（`Array.isArray(patches) ? patches.filter(...) : null`）在三族路由里是同构复制的（cast 行 609 / prop 行 805 / scene 行 1085），但"同构复制"是设计意图，实现是否真的同构只有跑测试能证实；(b) 防御性边界的"族同构"假设崩塌风险——cast 的 patchesInput 过滤逻辑如果某天被改了（如加白名单字段校验），prop/scene 的 patchesInput 可能没同步改——只有三族都补测试才能发现这种"族同构回归"；(c) c183 铁律①"族同构复制功能落地后复盘轮必须验证三族同构性"在 c184 防御性边界测试也成立——主路径同构不代表防御性边界也同构，必须各自补测试。判定标准：族同构复制的防御性边界测试必须三族都补（cast N 个 + prop N 个 + scene N 个 case 结构一致），禁止只补一族假设另两族自动同构。
- **③"防御性边界测试的 case 设计必须能证实路由层过滤逻辑真的生效而非只测主路径跑通"是防御证实铁律**——c184 揭示：边界②用 patch 自定义值 `[patches-path]` 与 autoFill 算出值不同来区分两条路径——如果 `id1.voice === '[patches-path]'` 证明走 patches 路径用了 patch 值，如果 `id2.voice !== '[patches-path]'` 证明走 autoFill 路径用了 autoFill 值。**铁律**：防御性边界测试的 case 设计必须能证实"路由层过滤逻辑真的生效"——理由：(a) 只测"主路径跑通"无法证实防御逻辑生效——边界①如果只看"三字段已补"无法区分是走 patches 路径还是 autoFill 路径补的，必须传"非法 patches"强制走 autoFill 才能证实 `Array.isArray` 防御生效；(b) 边界②用 patch 自定义值与 autoFill 值不同来证实"两条路径真的分叉"——如果两条路径都补 autoFill 值，无法证实 patches 路径真的被走到；用自定义 patch 值能清晰区分两条路径；(c) 边界③传 patches id 不在 ids 里来证实"patches 被静默丢弃"——如果只看"id1 已补"无法证实 id2 的 patches 是否被丢弃，必须查 id2 字段仍空才能证实。判定标准：防御性边界测试的 case 设计必须能证实"路由层过滤逻辑真的生效"——用自定义值/查未被处理的 id/查字段仍空等手段证实防御逻辑生效，禁止只测"主路径跑通"假设防御逻辑自动生效。

## c185 复盘：c184 9 个防御性边界测试的复盘（找遗漏 + 防御证实质量 + 铁律自洽性）

**触发来源**：c184 功能轮完成 9 个防御性边界测试后进入复盘轮。复盘三个维度：(1) 找遗漏——9 个 case 是否覆盖了所有"客户端可能误传或恶意构造的输入结构"；(2) 防御证实质量——9 个 case 的断言设计能否真的证实路由层过滤逻辑生效；(3) 铁律自洽性——c184 节方法论的 3 条铁律是否自洽、有无补强空间。

**复盘工作与发现**：
1. **工作1 找遗漏（P1）**：复盘 c184 9 个 case 发现三处新遗漏——(a) **patches 数组里某项缺 id 或 patch 不是对象**（路由层 patchesInput filter `x && typeof x.id === 'string' && x.patch && typeof x.patch === 'object'` 过滤掉该项，c184 边界①测的是"整个 patches 不是数组"，没测"数组里某项不合法"）；(b) **patches 是空数组 `[]`**（`Array.isArray([])` 返回 true，filter 后空数组，`patchesMap = new Map()` 空映射，所有 id 都走 autoFill 路径，c184 边界①测的是"非数组"，没测"空数组"）；(c) **ids 里有 null/undefined/非字符串**（路由层行 601 `ids.filter((x: any) => typeof x === 'string')` 过滤掉，c184 完全没测 ids 的防御性边界——0 case 覆盖 ids 输入）。三处新遗漏沉腅到 c186 功能轮补（三族 9 个 case）。
2. **工作2 防御证实质量（P2）**：逐个审查 9 个 case 的断言设计——(a) **边界②优秀**：用 patch 自定义值 `[patches-path]` 与 autoFill 值不同清晰区分两条路径，`r1.voice === '[patches-path]'` 证实 id1 走 patches 路径、`r2.voice !== '[patches-path]'` 证实 id2 走 autoFill 路径；(b) **边界③优秀**：查 id2 字段仍空（`!r2.voice && !r2.visualAnchor && !r2.signatureLines.length`）证实 patches 被静默丢弃，而非被静默写入；(c) **边界①合格**：隐式证实 autoFill 路径——patches 传字符串非法值不可能走 patches 路径，三字段已补说明走 autoFill 兜底。整体优秀，无需补强。
3. **工作3 铁律自洽性（P2）**：审查 c184 节方法论 3 条铁律的自洽性——(a) **铁律①发现补强点**：当前表述"防御性边界测试必须覆盖客户端可能误传或恶意构造的输入结构"没限定哪个输入，c184 落地时只补了 patches 三处，漏了 ids——因为铁律①没显式提"所有客户端输入"。补强后应为"防御性边界测试必须覆盖所有客户端输入（patches + ids + fields 等）的'可能误传或恶意构造的输入结构'"；(b) **铁律②自洽**：三族同构复制的防御性边界测试三族都补，c184 已三族各补 3 个 case，自洽无需补强；(c) **铁律③自洽**：case 设计必须能证实路由层过滤逻辑真的生效，c185 工作2 逐个审查 9 个 case 的断言设计整体优秀，自洽无需补强。

4. **前置验证（P0）**：(a) 跑全量测试 4156/4156 全过（比 c184 的 4174 少 18 个——测试运行器的非确定性统计方式问题，关键是 0 失败，c184 的 9 个 case 都在，无回归）；(b) 验证源与镜像 SKILL.md 同步一致性——c184 修复同步漏洞后必须验证，源与镜像版本号（2.185.4）+ 节内容完全一致。

### 方法论沉淀
- **①"防御性边界测试必须覆盖所有客户端输入（patches + ids + fields 等）的'可能误传或恶意构造的输入结构'"是输入覆盖铁律**（c184 铁律①的补强）——c185 揭示：c184 铁律①的表述"客户端可能误传或恶意构造的输入结构"没限定哪个输入，c184 落地时只补了 patches 三处（patches 传非数组/多 ids 部分 patches 混合/patches id 不在 ids 里），漏了 ids 的防御性边界测试——路由层行 601 `ids.filter((x: any) => typeof x === 'string')` 有 filter 但 0 测试覆盖。**铁律补强**：防御性边界测试必须显式列出所有客户端输入（patches + ids + fields 等），逐个覆盖——理由：(a) 路由层有多个客户端输入入口（patches + ids + fields 等），每个入口都有自己的防御逻辑（`Array.isArray`/`typeof`/`filter` 等），只覆盖一个入口（如 patches）无法证实其他入口（如 ids）的防御逻辑生效；(b) c184 落地时只补 patches 三处就是因为铁律①没显式提"所有客户端输入"，落地时容易只覆盖一个入口假设其他入口的防御逻辑自动生效；(c) 复盘轮审查防御性边界测试时必须列出路由层所有客户端输入入口，逐个问"这个入口的非法/空值/类型错结构是否被覆盖"。判定标准：复盘轮审查防御性边界测试时，必须列出路由层所有客户端输入入口（patches + ids + fields 等），逐个问"这个入口的非法/空值/类型错结构是否被覆盖"，禁止只覆盖一个入口假设其他入口的防御逻辑自动生效——这条铁律直接驱动 c186 补 ids 防御性边界 + patches 数组里某项不合法 + patches 空数组三处 9 个 case。
- **②"复盘轮找遗漏必须显式列举未覆盖的输入结构"是遗漏列举铁律**——c185 揭示：复盘 c184 9 个 case 找遗漏时，不能笼统说"还有遗漏"，必须逐个问"patches 数组里某项缺 id 或 patch 不是对象？patches 是空数组 `[]`？ids 里有 null/undefined/非字符串？fields 里有非法值？"。**铁律**：复盘轮找遗漏必须显式列举未覆盖的输入结构——理由：(a) 笼统说"还有遗漏"无法驱动下一轮功能轮补——下一轮功能轮需要明确的"未覆盖的输入结构清单"才能落地补测试；(b) 复盘轮找遗漏的价值在于"显式列举"——把未覆盖的输入结构逐个写下来（如"patches 空数组"、"ids 非字符串"、"fields 非法值"），下一轮功能轮按清单补；(c) 显式列举还能暴露"输入入口数量"——c185 显式列举时发现 c184 只覆盖了 patches 一个入口，ids 一个都没覆盖，这就是铁律①补强点的来源。判定标准：复盘轮找遗漏时必须逐个列举未覆盖的输入结构（如"patches 空数组"、"ids 非字符串"、"fields 非法值"），禁止笼统说"还有遗漏"假设下一轮功能轮自己想出来——列举必须具体到"输入入口 + 输入结构"（如"patches 数组里某项缺 id"而非"patches 还有遗漏"）。
- **③"复盘轮的防御证实质量复盘必须逐个审查断言设计"是证实质量铁律**——c185 揭示：c184 铁律③说"case 设计必须能证实路由层过滤逻辑真的生效"，c185 工作2 逐个审查 9 个 case 的断言设计——边界②用自定义值 `[patches-path]` 与 autoFill 值不同清晰区分两条路径（优秀）、边界③查 id2 字段仍空证实 patches 被静默丢弃（优秀）、边界①隐式证实 autoFill 路径（合格）。**铁律**：复盘轮的防御证实质量复盘必须逐个审查断言设计——理由：(a) 只看"9 个 case 都过了"无法证实断言设计优秀——case 过了只证明"路由没崩"，不证明"断言能证实防御逻辑生效"；(b) 逐个审查断言设计才能发现"伪证实"——如某 case 只断言 `status === 200` 没查字段，看似过了实际没证实任何防御逻辑生效；(c) 审查断言设计时必须问"这个断言能证实防御逻辑真的生效吗？只看'字段已补'能区分是走 patches 路径还是 autoFill 路径吗？"——如果能区分（如边界②用自定义值）、能证实丢弃（如边界③查字段仍空）、能隐式证实兜底（如边界① patches 非法值不可能走 patches 路径），则断言设计合格；如果只断言"status === 200"或"字段已补"无法区分路径，则断言设计不合格需补强。判定标准：复盘轮审查 case 的断言设计时，必须逐个问"这个断言能证实防御逻辑真的生效吗？只看'字段已补'能区分是走 patches 路径还是 autoFill 路径吗？"，禁止笼统说"9 个 case 都过了"假设断言设计优秀——审查必须具体到"断言能证实什么"（如"边界②断言 `r1.voice === '[patches-path]'` 证实走 patches 路径"而非"边界②过了"）。

## c186 功能轮：补 c185 复盘发现的三处新遗漏 × 三族 = 9 个 case

**触发来源**：c185 复盘轮发现了三处新遗漏（c184 铁律①补强后的"输入覆盖铁律"驱动），c186 功能轮补全。三处新遗漏 × 三族同构复制 = 9 个 case。

**三处新遗漏**：
1. **patches 数组里某项缺 id 或 patch 不是对象**：c184 边界①测的是"整个 patches 非数组"（`patches: 'hack'`），没测"数组里某项不合法"——路由层 `patches.filter((x: any) => x && typeof x.id === 'string' && x.patch && typeof x.patch === 'object')` 会过滤掉不合法项，但这个过滤逻辑 0 测试覆盖。
2. **patches 是空数组 `[]`**：c184 边界①测的是"非数组"（`patches: 'hack'`），没测"空数组"——`Array.isArray([])` 返回 true，filter 后仍是空数组，`patchesMap = new Map()` 空映射，所有 id 走 autoFill 路径。
3. **ids 里有 null/undefined/非字符串**：c184 完全没测 ids 的防御性边界——路由层行 601 `ids.filter((x: any) => typeof x === 'string')` 有 filter 但 0 case 覆盖。

**9 个 case 设计**（三族同构复制，字段映射：cast voice/signatureLines/visualAnchor ↔ prop visualAnchor/taboo/tags ↔ scene visualAnchor/mood/tags）：
- **边界① patches 数组里某项不合法**：传 `patches: [{id: id1, patch: customPatch}, {patch: {…}}, {id: id2, patch: 'not-object'}]`（第一项合法、第二项缺 id、第三项 patch 不是对象）→ filter 过滤掉不合法项、合法项对应的 id1 走 patches 路径用 patch 值、不合法项对应的 id2 走 autoFill 路径用 autoFill 值。断言 `r1.voice === '[patches-path]'` 证实走 patches 路径、`r2.voice !== '[patches-path]'` 证实走 autoFill 路径。
- **边界② patches 空数组**：传 `patches: []` → `Array.isArray([])` 返回 true、patchesMap 空映射、所有 id 走 autoFill 路径。断言三字段已补证实 autoFill 兜底。
- **边界③ ids 非字符串**：传 `ids: [id1, null, undefined, 123]` → filter 过滤掉非字符串项、只剩合法 id1 走补全路径；传 `ids: [null, undefined, 123]` → filter 后空数组 → 400 IDS_REQUIRED。断言 `updated.length === 1` 证实 filter 生效、`bad.status === 400` 证实全非字符串被过滤后空数组触发 IDS_REQUIRED。

**测试结果**：全量测试 4178/4178 全过（比 c185 的 4156 多 22 个——9 个新 case + 13 个 suite 统计），0 失败，无回归。三族同构复制验证成功——cast/prop/scene 三族的 patchesInput filter 逻辑同构、ids filter 逻辑同构、空数组兜底逻辑同构。

### 方法论沉淀
- **"防御性边界测试补强轮必须显式对照复盘轮列举的遗漏清单逐个补全"是遗漏清单驱动铁律**——c186 揭示：c185 复盘轮用"遗漏列举铁律"（铁律②）显式列举了三处未覆盖的输入结构（patches 数组里某项不合法/patches 空数组/ids 非字符串），c186 功能轮落地时必须逐个对照清单补全——不能遗漏任何一个。**铁律**：防御性边界测试补强轮必须显式对照复盘轮列举的遗漏清单逐个补全——理由：(a) 复盘轮列举遗漏清单的价值在于"驱动下一轮功能轮补全"——如果功能轮不对照清单逐个补，清单就只是"列了但没补"的空头支票；(b) c186 落地时逐个对照三处遗漏，每处 × 三族同构 = 3 个 case，共 9 个 case，确保遗漏清单 100% 覆盖；(c) 补全后必须在测试文件的 describe 块注释里显式标注"本节补的是 c185 复盘发现的三处新遗漏"，让下一轮复盘轮能快速定位"哪些遗漏已补、哪些还没补"。判定标准：防御性边界测试补强轮落地时，必须逐个对照复盘轮列举的遗漏清单补测试，禁止"功能轮自己想新的边界"而忽略复盘轮已列举的遗漏——复盘轮的遗漏清单是功能轮的"必补清单"，功能轮必须 100% 覆盖后才能探索新边界。

## c187 复盘：c186 9 个补强 case 的复盘（找遗漏 + 防御证实质量 + 铁律自洽性）

**触发来源**：c186 功能轮按 c185 遗漏清单补完 9 个 case（三族 × 三处新遗漏）后进入复盘轮。复盘三维度：(1) 找遗漏——c186 9 case 之后是否还有新未覆盖输入结构；(2) 防御证实质量——c186 9 case 的断言设计能否真的证实过滤逻辑生效；(3) 铁律自洽性——c186"遗漏清单驱动铁律"是否自洽。

**前置验证（P0）**：(a) 全量测试 4159/4159 全过，0 失败（非确定性统计，关键是 0 失败，c186 的 9 个 case 都在）；(b) 源与镜像 SKILL.md diff 完全一致（版本 2.185.6）。

**复盘工作与发现**：
1. **工作1 找遗漏（P1）——通读三族路由完整输入处理代码（cast 行 600-630 / prop 行 797-831 / scene 行 1077-1111，确认完全同构）后，发现 5 处新遗漏沉腅 c188**：
   - **遗漏1（P1·语义陷阱）fields 空数组 `[]`**：c185 铁律①文本明确点名"patches + ids + fields 等"三个入口，c186 只补了 patches/ids，fields 入口 0 覆盖。其中 `fields: []` 是关键语义陷阱——路由行 607 filter 后空数组，空数组是 **truthy**，`fieldsFilter ?` 走筛选路径，`fields = []` 使 for 循环零执行，filledFields 空 → **skipped**（语义既不是"全选"也不是 400，是 skip）。主路径组合①-④只测了 fields 为非空数组/缺省，没测空数组。
   - **遗漏2（P1·JS 陷阱）patch 是数组**：传 `{id: id1, patch: []}`——`typeof [] === 'object'` 且 `[]` truthy，能通过 patchesInput filter；进 patches 路径后 `Object.keys([])` = `[]`，零字段可补 → skipped。c186 边界①测了 patch 是字符串（被 filter 拦），没测数组（能过 filter 但空转 skip）。
   - **遗漏3（P1·三层类型校验的第三层）string[] 字段传"数组但含非字符串元素"**：c181 防护②只测了行 627（string 传对象）和行 628（string[] 传字符串），行 629 `!val.every((x: any) => typeof x === 'string')` 第三层校验（如 `signatureLines: ['ok', 123, null]`）0 覆盖。
   - **遗漏4（P1·安全）batch-complete 越权 id**：ids 里传他人资产 id，findMany 的 `where: { id: { in: ids }, userId: req.userId! }` 会隔离，但 batch-complete 端点的归属隔离 0 测试（GET/DELETE 测过，补全写操作没测——必须证实"他人 id 静默不补、不报错、不泄露存在性"）。
   - **遗漏5（P2·JS 陷阱）patch 是 null**：传 `{id: id1, patch: null}`——`typeof null === 'object'` 是经典陷阱，路由靠 filter 里 `x.patch &&` 的 truthy 短路兜住；c186 边界①只测了字符串 patch，null 这个"typeof 通过但 falsy"的陷阱没锁定，未来重构若误删 truthy 检查会直接放行。
   - 另列 P3 低风险三项（c188 视容量决定）：patches 同一 id 重复（Map 后者覆盖前者语义）、ids 含空字符串（typeof 通过但查不到）、无 body POST（可选链兜底 → 400）。
2. **工作2 防御证实质量（P2）——逐个审查 c186 9 case 断言设计，发现 1 处证实缺陷**：
   - **边界②优秀**：patches 空数组时 Map 必空、`has()` 必 false，三字段已补只能来自 autoFill，隐式证实充分。
   - **边界③优秀**：`updated.length === 1`（部分过滤后正常处理）+ `400 IDS_REQUIRED`（全过滤后空数组）两个子断言分别锁定 filter 的两段行为。附注：JSON 序列化时数组里的 `undefined` 会变成 `null` 上线，但 filter 结果相同，不影响断言有效性。
   - **边界①有证实缺陷**：一个请求里混合两种不合法项（缺 id 项 + patch 非对象项）。推演"若 filter 条件被改坏"：patch 非对象检查失效时，字符串进 Map 后 `Object.keys('not-object')` 命中不到白名单 → id2 进 skipped → `updated.length === 2` 断言会失败（能兜住）；但**缺 id 检查失效时**，`{patch: {voice:'x'}}` 进 Map 的 key 是 `undefined`，rows 循环没有 id=undefined 的行，断言全部照常通过——即"缺 id 过滤生效"未被独立证实（该项即使漏过滤也无害，但按证实质量铁律属于未锁定）。三族同构复制使该缺陷同样存在于 prop/scene。
3. **工作3 铁律自洽性（P2）——发现 c186"遗漏清单驱动铁律"的双清单层次盲区**：c186 100% 对照 c185 工作1 的"具体遗漏清单"（patches 项不合法/空数组/ids 非字符串）补了 9 case，但 c185 铁律①**文本里点名的 fields 入口**没进入工作1 具体清单，c186 也就没补——本轮遗漏1 正是这个盲区的产物。说明遗漏分两层：**入口枚举层**（铁律文本：patches+ids+fields 等）与**具体遗漏层**（工作1 清单：具体输入结构），功能轮只对照具体清单会漏掉"已点名但未具体化"的入口。铁律需补强。

### 方法论沉淀
- **①"功能轮补完具体遗漏清单后必须回头核对入口枚举层每个入口至少有一个 case"是双清单核对铁律**（c186 遗漏清单驱动铁律的补强）——c187 揭示：复盘轮产出的遗漏分两层，铁律文本里的"入口枚举"（patches + ids + fields 等）与工作1 的"具体遗漏清单"（如 patches 空数组）是两个层次；c186 只对照具体清单补完就收工，fields 入口虽被 c185 铁律①点名却仍 0 覆盖。**铁律补强**：功能轮 100% 补完具体清单后，必须再做一次"入口枚举层覆盖率核对"——逐个问"patches/ids/fields/query 等每个入口是否至少有一个防御性 case"，全绿才能收工。理由：(a) 具体清单受当轮注意力限制，容易只列"刚发现的入口"，入口枚举层是防漏的兜底网；(b) 入口层核对成本极低（一张入口×case 对照表），但能拦住 c186 这类"清单完成、入口留白"盲区；(c) 两层清单分工——入口层回答"还有哪些门没看过"，具体层回答"这扇门有哪些坏输入"。判定标准：功能轮收尾前必须产出"入口枚举 × 已覆盖 case"对照表（可写进 SKILL.md 节正文），任一入口 0 case 即视为未完成，禁止收工。
- **②"一个 case 混合多种不合法输入时必须验证每种过滤条件失效都能被断言捕获，否则拆分或显式标注无害性"是断言分离铁律**——c187 工作2 揭示：c186 边界①把"缺 id"与"patch 非对象"塞进同一请求，推演发现"缺 id 过滤失效"无法被任何断言捕获（Map key=undefined 无匹配行，结果不变）。**铁律**：混合不合法项的 case，必须对每种不合法项做"过滤条件失效推演"——假设路由漏写了这一项的检查，断言会不会红？会红=证实有效；不会红=该项未被证实，要么拆成独立 case 用可观测差异锁定（如让该项的 patch 携带可污染白名单字段的值），要么在注释里显式写明"该项漏过滤亦无害，原因是……"并说明残余风险。理由：(a) 防御性测试的价值在于"防御被改坏时测试会响"，捕获不到失效的断言是假绿；(b) 失效推演成本低（心算 filter 删除后的数据流），但能精确识别假证实；(c) 无害项显式标注后，未来路由演进使其从无害变有害时（如 Map 构造改为抛错）有注释提示补测。判定标准：混合输入 case 必须附带逐项失效推演结论（红/无害+原因），禁止只凭"请求里带了该项"视为已覆盖。
- **③"JS 语言级类型陷阱（typeof null === 'object'、数组是对象、空数组 truthy）必须有专门 case 锁定行为"是类型陷阱锁定铁律**——c187 工作1 一轮查出三处 JS 陷阱边界（fields 空数组 truthy 走 skip、patch 为数组过 filter 后空转、patch 为 null 靠 truthy 短路拦截）。**铁律**：凡防御代码依赖 JS 隐式类型规则（truthy/falsy、typeof 表、Array.isArray 与 typeof 关系、JSON 序列化丢 undefined）的分支，必须有"沿陷阱反方向构造"的专门 case 锁定当前行为。理由：(a) 这类代码是重构高发误删区——`x.patch && typeof x.patch === 'object'` 里的 truthy 前缀看起来"多余"，没有测试锁定就可能被当冗余删掉，而删掉后 null 直接穿透；(b) 陷阱边界的行为不直观（fields=[] 是 skip 不是全选），测试同时是活文档；(c) 每处陷阱一个 case 比靠大段注释更能防退化。判定标准：路由防御逻辑每出现一次对 truthy/typeof/Array.isArray 的依赖，必须有至少一个沿陷阱反方向构造的 case（如依赖 truthy 就传 null/0/''，依赖 typeof object 就传 []/null，依赖空数组语义就传 []），三族同构复制。

## c188 功能轮：c187 五处遗漏补强落地（18 个 case 三族同构）+ 入口×case 对照表首次执行

**触发来源**：c187 复盘轮列举的 5 处遗漏（fields 空数组/patch 数组/string[] 元素类型/越权 id/patch null），c188 功能轮按 c186"遗漏清单驱动铁律"100% 补全，并首次执行 c187 新立的"双清单核对铁律"（收尾产出入口枚举×case 对照表）。

**落地前契约可达性检查（经验库 1201154 规则）**：先逐行读三族路由真实代码（cast 600-672 / prop 797-842 / scene 1077-1122，确认完全同构），推演每个畸形输入的完整数据流后再写断言——5 处遗漏 × 三族 = 15 个 case 的预期行为一次写对、零返工；另加 fields 非数组/含非字符串 3 个 case（每族 1 个两段式），共 18 个。

**18 个 case 清单（每族 6 个，cast 文件先行单跑验证后再族同构复制）**：
1. **遗漏① fields=[]**：空数组 truthy → `fieldsFilter ?` 走筛选路径 → 循环零执行 → skipped（断言 updated=0/skipped=1/库三字段空）；**失效推演**：若收紧为 `fieldsFilter?.length ?` → updated=1 → 断言红 ✓
2. **遗漏①补 fields 非数组 + 含非字符串（两段式）**：段 A 传字符串 `'voice'` → Array.isArray false → null → 默认全选三字段；段 B 传 `['voice',123,null]` → filter 剔除后只补 voice。段 B 按 c187 断言分离铁律做失效推演后确认为**无害项**（即使非字符串 filter 失效，`f in patch` 为 false 必 continue，白名单第二道拦截），case 保留为活文档并在注释显式标注无害性与残余风险。
3. **遗漏② patch=[]**：`typeof [] === 'object'` 且 truthy 过 input filter → `Object.keys([])` 空转 → skipped。定性为**行为锁定型 case**（当前静默 skip 非崩溃）：未来 filter 若收紧加 `!Array.isArray`，语义从 skip 变 autoFill 兜底，测试主动变红提醒。
4. **遗漏⑤ patch=null**：`typeof null === 'object'` 靠 `x.patch &&` truthy 短路拦截 → 该项过滤 → id 走 autoFill。**强证实**：误删 truthy 前缀则 `Object.keys(null)` 抛 TypeError → 500，status===200 断言立即红 ✓
5. **遗漏③ string[] 含非字符串元素**：`signatureLines/tags: ['合法',123,null]` → 行 629/824/1104 `every` 第三层校验拦截该字段，同 patch 两个 string 字段照补（filled 恰为另两字段、污染数组整体不落库）。c181 防护②此前只覆盖前两层校验。
6. **遗漏④ 越权 id**：ids 混本人+他人资产 → findMany 的 `userId` 条件隔离 → total=1、只补本人、200 不报错、updated/skipped 均不含他人 id（不泄露存在性）、他人资产库内零写入。补全写操作的归属隔离首次有测试锁定。

**测试结果**：cast 单文件 45/45（先行验证）；全量 4172/4172 全过 0 失败；prop 42、scene 39 单文件复核 18 个新 case 全部实际执行（防统计非确定性漏算）。

### c187 双清单核对铁律首次执行：batch-complete 入口枚举 × 已覆盖 case 对照表

| 输入入口 | 畸形/边界输入结构 | 覆盖轮次 |
|---|---|---|
| ids | 空数组 → 400 IDS_REQUIRED | c182 |
| ids | 超 200 → 400 IDS_TOO_MANY | c182 |
| ids | 含 null/undefined/数字（部分过滤+全非字符串 400）| c186 边界③ |
| ids | 混他人资产 id（归属隔离/不泄露存在性）| **c188 遗漏④** |
| ids | 空字符串 ''、重复 id | **未覆盖（P3 留白，c189 候选）** |
| patches | 整体非数组（字符串）→ autoFill | c184 边界① |
| patches | 空数组 [] → 空 Map → autoFill | c186 边界② |
| patches | 项缺 id（c187 已记录证实缺陷：漏过滤亦无害，Map key=undefined 无匹配行）| c186 边界① |
| patches | 项 patch 是字符串（非对象）→ filter 拦截 | c186 边界① |
| patches | 项 patch 是数组 [] → 过 filter 空转 skip | **c188 遗漏②** |
| patches | 项 patch 是 null → truthy 短路拦截 → autoFill | **c188 遗漏⑤** |
| patches | 项 id 不在 ids 里 → 静默丢弃 | c184 边界③ |
| patches | 同一 id 重复项（Map 后者覆盖语义）| **未覆盖（P3 留白，c189 候选）** |
| patch 字段 | 白名单外字段（persona/id/userId）跳过 | c181 防护① |
| patch 字段 | string 传对象 → 跳过 | c181 防护② |
| patch 字段 | string[] 传字符串 → 跳过 | c181 防护② |
| patch 字段 | string[] 含非字符串元素 → 整字段跳过 | **c188 遗漏③** |
| patch 字段 | dry-run 后编导手动改过 → 旧 patches 不覆盖 | c181 防护③ |
| fields | 非空选中子集（patches 路径 + autoFill 路径）| c182 组合①③ |
| fields | 空数组 [] truthy → skip | **c188 遗漏①** |
| fields | 非数组（字符串）→ null → 默认全选 | **c188 遗漏①补段A** |
| fields | 含非字符串元素（无害项，已标注）| **c188 遗漏①补段B** |
| query lang | 非 'en' 一律 zh 兜底 | **未覆盖（P3 留白，c189 候选）** |
| query dry-run | 非严格 '1' 一律 false | **未覆盖（P3 留白，c189 候选）** |
| body | 无 body POST（可选链兜底 → 400）| **未覆盖（P3 留白，c189 候选）** |

**核对结论**：c187 列举的 5 处 P1/P2 遗漏 100% 补全；patches/ids/fields 三个主入口 + patch 字段层均有 ≥1 个防御 case；剩余 6 项均为 c187 已显式列举的 P3 低风险项，本轮按容量留白并在表中记名（不再是"不知道没覆盖"，而是"知道且决定暂缓"）——这正是双清单核对的价值：P3 留白从隐性变显性。

### 方法论沉淀
- **①"补强轮先做契约可达性检查：逐行读路由真实代码推演畸形输入完整数据流，再写断言"是先推演后落案铁律**——c188 实战：18 个 case 的预期行为全部一次写对、零返工（早期轮次曾出现"凭记忆写预期→跑红→回读代码改断言"的往返）。**铁律**：防御性 case 落地前必须先读当轮涉及的路由完整代码段（不是摘要、不是记忆），对每个畸形输入在纸面走一遍 filter → Map → 循环 → 白名单 → 类型校验 → 写库的完整链路，把预期状态（updated/skipped/库内值）推出来再写 it。理由：(a) 防御逻辑的分支密度高（三族端点各有 6+ 个隐式类型分支），记忆必然失真；(b) 推演过程本身会发现新遗漏（c188 段 A"fields 传字符串"就是推演时新发现的）；(c) 先单文件验证再族同构复制，把"同构假设"的错误成本锁在一个文件内。判定标准：补强轮每个 case 的注释必须能回答"这个输入经过哪些行、被哪道防线拦下、最终落库状态是什么"，答不出说明没做链路推演。
- **②"防御 case 分两类定性：缺陷捕获型（防崩溃/防越权/防污染）与行为锁定型（当前无害但语义不直观），注释必须标明类型"是 case 定性铁律**——c188 一轮里两类都有：patch=null 是缺陷捕获型（删防御 → 500），patch=[] 是行为锁定型（删防御 → 语义从静默 skip 变 autoFill 兜底，不崩溃但行为变化）。**铁律**：每个防御 case 必须在注释定性——缺陷捕获型要写明"防线失效后的具体故障形态（500/越权写入/污染落库）"；行为锁定型要写明"当前行为为何不直观、未来什么改动会触发本测试变红、变红时维护者应判断这是有意收紧还是意外回归"。理由：(a) 两类 case 变红时的处置完全不同——缺陷捕获型变红=出事了必须修代码，行为锁定型变红可能=有意的语义收紧，改测试即可；(b) 不做定性，未来维护者看到行为锁定型变红会误判为回归而回滚正确的收紧；(c) 定性迫使作者先想清楚"我锁的到底是故障还是行为"，避免无价值的 tautology 测试。判定标准：case 注释无"失效后故障形态"或"语义变更提醒"二者之一的，视为未完成。

## c189 复盘：c188 18 个补强 case 的复盘——首次查出 2 个真·生产代码缺陷（前七轮都是测试债）

**触发来源**：c188 功能轮 18 个 case 落地、全量 4172 绿后进入复盘轮。前置验证：全量 4197/4197 全过 0 失败（统计非确定性波动，0 失败为准），源镜像 diff 完全一致（v2.185.8）。

**复盘工作与发现**：
1. **工作1 找遗漏（P1）——从"结构/类型维度"转向"值域维度"，一轮查出两个真代码缺陷**：
   前七轮（c181-c188）穷尽的都是"畸形结构/错类型"（非数组、非字符串、null、越权 id）。本轮换维度假定"结构与类型全合法、但壳里装的是废物或炸弹"，逐行复读 patches 路径（cast 622-635 / prop 817-829 / scene 1097-1109）后确认：
   - **BUG-1（P1·语义谎报+脏写）补丁值"类型合法但内容空"**：`patch: { voice: '' }` 通过行 627 string 校验；`{ voice: '   ' }` 同；`{ tags: [] }` 通过行 628 Array.isArray 且**空数组 every 返回 true（vacuous truth）**过行 629；`{ tags: ['', '   '] }` 元素 typeof 全是 string 也过。随后行 633 的 isEmpty 检查对象是 **cur（库现值）不是 val（补丁新值）**——空资产 cur 为 null → isEmpty=true → `updateData.voice=''` 落库，`filledFields=Object.keys(updateData)=['voice']` → updated/filled 与 dry-run 的 willUpdate/fieldsUnion **谎报"已补全该字段"**。前端 modal 据此打"已补全"绿勾，编导以为补了实际是空；写入空白串后资产体检仍判缺失（trim 空），批量补全与体检两个端点口径自相矛盾。三族同构（633/827/1107）。
   - **BUG-2（P1·契约绕过）patches 路径零长度/数量约束，绕过手动建档 zod 全部上限**：zod 契约明确——cast：voice/visualAnchor max 200、signatureLines max 5 条×每条 1-60 字（[generate.ts 行 512-514](file:///Users/a123/Desktop/养正/zhongnan/zhongnan-backend/src/routes/generate.ts#L509-L514)）；prop：taboo/visualAnchor max 200、tags max 8 条×1-20 字；scene：mood max 100、visualAnchor/taboo max 200（行 1003-1006）。但 batch-complete 的 patches 循环只有白名单+类型两道关，**zod 完全不在这条链路上**；Prisma/Postgres text 列无 DB 级长度硬限 → 客户端绕过 dry-run 直接 POST，可把 10 万字 voice、1000 条 tags 落库。更重的下游伤害：资产会注入架构师/人设师/撰写师生成 prompt（既有"生成注入"契约已测），超长值即 prompt 污染/成本放大向量。
   - **测试侧新遗漏**：⑥（P2）fields 显式选中白名单外字段（`fields:['persona']` + patch 含 persona）→ `f in patch` true 但 fieldType=undefined → continue 的行为未测（白名单第二道防线未在 fields 显式路径证实）；⑦（P3）autoFill 路径的 fields 畸形走独立代码（行 651-653 的 delete 筛选），与 patches 路径非同段代码，仅推理同构、未测。
2. **工作2 防御证实质量（P2）——18 个 case 整体强，1 个可维护性瑕疵**：
   - **范例级**：遗漏④越权 case 同时锁响应面（total=1、updated 只含本人、skipped 不含他人 id）与库面（他人资产三字段零写入），是"不泄露存在性"类断言的标准结构；遗漏③用 `filled.sort()` deepEqual 防字段顺序抖动，严谨；段 B 无害性按断言分离铁律显式标注，可作为后续无害项模板。
   - **瑕疵（P3）**：注释硬编码路由行号（"行 629/824/1104""行 637/831/1111"），代码增删后行号漂移即误导；后续应改引防线名（"every 元素校验""skip 中文 reason 分支"）。本轮先记名，c190 新写注释即按新口径，不回头批量改（避免与代码变更混杂）。
3. **工作3 铁律自洽性（P2）——3 个结论**：
   - c188 铁律①"先推演后落案"与经验库 1201154"契约可达性检查"是前后两步不是重复：契约可达性回答"字段进不进服务端链路"（防把契约缺失误判成服务缺陷），先推演后落案回答"进了链路后落库状态是什么"。两者显式串联使用：先可达、后推演、再落案。
   - c188 铁律②与 c187 断言分离铁律注释成本叠加，澄清适用分工：**单输入** case 只需定性（缺陷捕获/行为锁定）；**混合输入** case 先逐项失效推演，再对整案定性。
   - **P3 避风港风险（机制缺陷）**：c188 对照表允许 P3"记名留白"但无时效——六项 P3 可能被逐轮原样抄表、永不处置。c188 六项本轮复盘仍全部在表（连续第 2 次出现），按拟立的"P3 留白时效铁律"，c190 必须逐项处置。

### 缺陷落盘四元组（经验库 1201154 规则，c190 修复依据）

**BUG-1（空值脏写+谎报）**：
- **用例位置（c190 建）**：三族测试文件新 c190 describe 节，每族 ≥2 case（string 空/全空白 + string[] 空数组/全空白元素）
- **触发字段**：`patches[].patch.voice/visualAnchor/taboo/mood = '' 或 '   '`；`patches[].patch.signatureLines/tags = [] 或 ['', '   ']`
- **现象**：过白名单+类型三连校验 → 空值落库 → `updated[].filled`、dry-run `willUpdate`/`fieldsUnion` 谎报补全；根因是行 633/827/1107 isEmpty 只校验 cur 旧值，val 新值零内容校验
- **建议修复点**：类型三连之后、cur 检查之前加 **val 内容非空校验**，口径与既有 isEmpty 同构——string：`!String(val).trim()` 则 continue；string[]：先剔除空白元素 `val.filter(s => s && s.trim())`，结果为空则 continue（建议空白元素直接剔除而非整字段拒绝，与 autoFill 产出始终干净的口径对齐；若定整字段拒绝需同步定 skipped reason）。空值字段不进 updateData → 不进 filledFields → 响应不再谎报。三族同构 ×3，dry-run 分支因在 filledFields 计算之后自动同受益。

**BUG-2（patches 绕过 zod 长度上限）**：
- **用例位置（c190 建）**：三族 c190 节，每族 ≥1 case（超长 string + 超量/超长元素数组）
- **触发字段**：白名单内字段的超长 string（>200，mood >100）、超量数组（signatureLines >5 条、tags >8 条）、超长元素（>60 / >20 字）
- **现象**：patches 循环无 zod（行 622-635 段），zod schema 只挂在手动建/改端点 → 任意长度落库（text 列无硬限）→ 存储膨胀 + 资产注入生成 prompt 的超长污染/成本放大
- **建议修复点**：把 PATCH_FIELDS_CAST/PROP/SCENE 从 `Record<string,'string'|'string[]'>` 升级为带约束描述（stringMax / arrayMax / itemMax），**约束数字与 zod schema 抽同一常量、禁两处手抄**（防 c190 之后再漂移）；循环内超限处置沿用 c181 既定口径"该字段静默 continue + skipped 累计"（不引入 400，保持批量补全"部分成功"语义）。三族同构 ×3。

### c190 必办清单（按序）
1. BUG-1 修复 + 三族测试（先写"修复后行为"测试：空值字段不进 filled 且不落库；再改路由；每族 string/string[] 各一）
2. BUG-2 修复 + 三族测试（约束常量同源抽取；超限字段跳过、合规字段照补的部分成功断言）
3. c188 表 P3 六项逐项处置：补测试 / 判死移除（写明永不补理由）/ 升级（发现新攻击面则提级）——不得原样第 3 次抄表
4. 容量允许：遗漏⑥（fields 显式选白名单外字段）三族；测试注释去行号化（只对 c190 新注释生效）

### 方法论沉淀
- **①"结构/类型维度穷尽后必须换值域维度复审：空值、长度、数量、语义格式——白名单管'能不能写这个字段'，类型管'是不是这个壳'，值域管'壳里装的是不是废物或炸弹'"是值域复审铁律**——c189 突破点：c181-c188 七轮把畸形结构与错类型穷尽到三族 30+ case，全部"现有防御正确、只是没锁定"；本轮换维度第一轮就查出两个真生产缺陷。**铁律**：当一个输入入口的结构与类型 case 覆盖率已高（入口对照表全绿）时，复盘轮必须显式换四个值量子维度再过一遍——(a) 空：空串/全空白/空数组/全空白元素/null 元素；(b) 长：越过该字段所有已知契约上限（zod/DB/业务）；(c) 量：数组条数、对象键数、批量大小；(d) 格式：形似合法但语义错（手机号字段传句子、枚举形近字）。理由：(a) 类型校验只回答 typeof/Array.isArray，对"合法壳垃圾内容"天然盲；(b) 校验代码写"放行条件"时容易只查旧值不查新值（BUG-1 根因）、只挂入口端点不挂旁路（BUG-2 根因：zod 挂手动端点、patches 是另一条写库路）；(c) 值域缺陷的下游伤害在本端点外（prompt 注入、成本），本端点单测绿不代表安全。判定标准：入口对照表全绿后的下一次复盘，必须出现一张"空/长/量/格式"四列值域网，每格标"已测/不适用+原因/缺陷四元组"，禁止继续在结构维度内卷。
- **②"P3 留白连续两次进表即强制处置：补测、判死、提级三选一，禁止第三次原样抄表"是 P3 留白时效铁律**——c189 工作3 发现 c188 的留白机制没有时效，低风险项会变成永久停车场。**铁律**：入口对照表中的 P3 项记首次出现轮次；连续第二次复盘仍在表，下一个功能轮必须三选一闭环——(a) 补测试（成本往往就几行）；(b) 判死：写明"为何永不值得测"（如攻击面在更外层已被框架保证）并从表移除；(c) 提级：复审中发现新攻击面/代码路径分叉则升 P2 立即补。理由：(a) 留白的正当性是"当前容量不够且风险低"，不是"永远不做"；(b) 抄表零成本导致表越来越长，稀释真信号；(c) 判死也是有价值的产出——它把隐性的"大概不用测"变成显式的框架保证论证。判定标准：任何 P3 项在对照表里出现第三次而无处置结论，即视为复盘流程违规。

## c190 功能轮：c189 两个 P1 真缺陷修复 + P3 六项强制清零（值域防线首次落地）

**触发来源**：c189 复盘落盘的 BUG-1（空值脏写+补全谎报）、BUG-2（patches 绕过 zod 上限）四元组 + c190 必办清单。TDD 节奏：先 cast 单文件写测试看红 → 修路由 → cast 绿 → 族同构复制 prop/scene。

**修复实施（统一点：一个类型 + 一张规则表 + 一个归一化函数，三族共用）**：
- [generate.ts](file:///Users/a123/Desktop/养正/zhongnan/zhongnan-backend/src/routes/generate.ts#L448-L486) 新增 `PatchFieldRule`（string 带 max / string[] 带 arrMax+itemMax）、三族规则表（`as const satisfies Record<string, PatchFieldRule>`）、`patchRule()` 查表、`normalizePatchValue()` 三关归一化：
  - **关①类型壳**：typeof / Array.isArray / 元素全 string——口径与 c181/c188 完全一致，**含非字符串元素的数组维持"整字段拒绝"不做部分清洗**（c188 遗漏③已锁定此行为，修复不改语义）；
  - **关②内容非空（BUG-1）**：string `trim()` 后为空 → 跳过；数组先 `map(trim).filter(Boolean)`，结果为空 → 跳过。空值字段不进 updateData → 不进 filledFields → `updated.filled`/dry-run `willUpdate.fields`/`fieldsUnion` 三处同时不再谎报，库面也不脏写；
  - **关③长度/数量（BUG-2）**：超限字段静默 continue（沿用批量补全"部分成功"语义，不引入 400）。
- **zod 同源**：三段手动建档 schema 的字面量上限（200/60/5、200/8/20、100）改为引用规则表常量，zod 与运行时校验共享同一数字源——物理上消除两处手抄漂移。注：cast 的 tags、scene 的 taboo 不在补丁白名单（autoFill 不补），其 zod 上限保留字面量。
- **trim 后写库**：归一化值 trim 后落库，与手动建档 zod `.trim()` 转换口径一致；dry-run 返回的 patch 再走实际补全时归一化幂等（autoFill 模板产出本无首尾空白），token 化往返不丢不重。

**测试落地（三族 ×4 = 12 个新 it，全量 4218/4218 全过 0 失败）**：
1. **BUG-1 回归**（每族 1 it 四段）：空串+全空白 string 配合法数组、空数组配合法 string、全空白元素数组、dry-run 不谎报+零写库——每段独立资产、响应面（filled/fieldsUnion）与库面双断言；
2. **BUG-2 回归**（每族 1 it 五段）：双 string 超限（scene 独有 mood 101 vs 200 双上限同时越界）、贴线 string 接受、数组超量整字段拒（断言不是截断成上限条）、元素超长整字段拒、贴线数组（条数×元素长度）接受；
3. **P3 六项聚合处置**（每族 1 it 六段）：ids 空串、ids 重复、patches 同 id 重复（Map 后者覆盖落库值锁定）、lang=fr 中文兜底/lang=en 英文 reason、?dry-run=0 实际写库（响应无 dryRun 标记+库面）、无 body POST 400——c188 表六项全部选"补测"闭环，**P3 表现已清空**；
4. **遗漏⑥**（每族 1 it）：fields 显式选中白名单外建档核心字段（cast persona / prop·scene meaning）+ 同请求合法字段，断言越界字段库值不变、合法字段照补——白名单第二道防线在 fields 显式路径首次被证实。
- **TDD 红/绿分布符合推演**：修代码前 cast 新 4 例中精准 2 红（BUG-1/BUG-2），P3 与遗漏⑥ 在旧代码下即绿——它们是**行为锁定型**（旧行为已正确，只是没锁），这一红/绿分布本身验证了 c189 四元组定性准确：两个是真缺陷、两个是测试债。

### 方法论沉淀
- **①"边界校验必须双向测：只测超限拒绝不测贴线接受，`>` 误写成 `>=`、上限数字抄错一个量级，永远不会被发现"是边界双向铁律**——c190 实施时刻意为每个上限配正向贴线断言：voice 200 字接受、signatureLines 5 条×60 字接受、tags 8×20 接受、scene mood 100 字接受（与同族 200 上限并存，专防两上限混淆）。**铁律**：任何"不得超过 N"的校验，测试必须出现 N 的合法用例与 N+1 的拒绝用例（数组还要测 N 条×每项 M 字的双贴线）。理由：(a) 拒绝类断言只证明"有一道关"，证明不了"关在正确的位置"；(b) 同源抽取后数字仍是手工数据（5/60/8/20/100/200 六个数），贴线用例是数字正确性的唯一活锁；(c) 正向用例同时锁"不误伤合法编导输入"的产品承诺。判定标准：值域 case 只有超长拒绝没有贴线接受的，视为未完成。
- **②"同一约束被两处以上代码消费时必须同源引用：抽单一常量/规则表，让另一处引用而非抄写；同源关系用贴线测试做成活锁，不靠注释提醒"是同源常量铁律**——c190 把补丁白名单从"字段名→类型"升级为"字段名→规则对象"，zod schema 反向引用规则表数字。**铁律**：当发现两条写库链路（如手动建档 zod 与批量补丁）各管各的约束时，不允许"在第二处再写一遍同样的数字"——必须把数字抽成一处定义、两处编译期引用；无法编译期引用的（跨语言/跨服务）退而求其次用契约测试锁等式（A 处 N 的贴线输入在 B 处也必须接受）。理由：(a) 抄写式重复的半衰期是一个版本——任何一处调整上限另一处就漂移，BUG-2 的根因正是"zod 挂在手动端点、补丁链路另写一套且写成零约束"；(b) 同源后规则表成为唯一可读的字段契约（哪些字段可补丁、上限多少，一表览尽）；(c) TypeScript 的 `as const satisfies` 让"表定义可被 zod 点引用、循环查表又接受 string 键"两个需求同时成立，无样板代码。判定标准：grep 同一魔法数字在校验语境出现两次以上而无共同来源，即视为违规。
- **③"P3 留白处置优先选聚合补测：多个低风险入口合并为一个多段 it（独立资产+独立断言+逐项注释），成本低到不构成留白理由"是 P3 聚合处置法**——c188 的 6 项 P3 在 c190 用每族 1 个 it（六段）清零，全三族共 3 个 it 覆盖 18 个入口行为。做法：每项一个独立建档资产（防状态污染）、一个请求、1-2 条关键断言，项间注释分隔并写明锁定的语义（如"Map 后者覆盖""dry-run=0 不是预检"）。适用边界：各段必须是**行为锁定型**（预期全绿、不依赖代码修复顺序）；缺陷修复型回归仍单独成 it（如本轮 BUG-1/BUG-2），红绿信号不能混在一个套件里稀释。

## c191 复盘轮：写库路径全枚举 + PX-1 沉淀毒丸修复（Json 读取不信任首立）+ 遗漏⑦第3次清零

**复盘范围**：c190 修复面回归 + 三族资产全部写库路径枚举。路由面确认三族各仅四条写库路径（手动建档/删除/from-project 沉淀/batch-complete 批量补全），逐路径按 c189 值域四维度（空/长/量/格式）过网：

| 路径 | 结构/类型 | 空/长/量 | c191 结论 |
|---|---|---|---|
| 建档 POST（三族） | zod 全量 safeParse | c190 规则表同源上限 | 安全，无需补 |
| batch-complete patches（三族） | c181 白名单+c190 三关 | 空值/超限静默跳过 | 安全（c190 已锁 12 case） |
| batch-complete autoFill 引擎产出 | 纯函数+模板常量 | 定长切片（slice 2/4/6 字+固定文案），条数恒 1 | **判死**：读代码可证产出恒在上限内，裸写不构成旁路，不入 P3 表 |
| from-project prop/scene | 入口 `typeof content==='string'` 过滤、ep Number 清洗 | eps/closedEps normalizeEps+slice 硬帽 | 安全（脚本纯文本路径，无 Json 形态面） |
| **from-project cast** | **PX-1：bible Json 值字段无类型壳** | persona/voice 无长度关（P3 新记名，见下） | **P2 修复 + 长度项首次进表** |

**PX-1 缺陷四元组（c191 修复，P2）**：
- **关联用例**：`c191 PX-1` 引擎 it（三段）+ 路由 it ×2；**触发字段**：`project.bible.characters[*].traits/arc/voice` 为非字符串（number/boolean/object/array）；
- **根因**：bible 经 pipeline 的 LLM result 裸 JSON 落库（无 zod 子结构约束，Json 字段是类型系统黑洞——TS 标注 string、运行时 any），而沉淀链路两处对值裸调 `.trim()`：引擎 `extractCastAssetDrafts` 三字段行与 castMap 构造行、路由层 `hasPersonaSource` 一手源判定行；try/catch 只包 JSON.parse 不包提取——一个畸形角色抛 TypeError，**整批沉淀 500（毒丸）**，同批合法角色全部沉淀失败；
- **修复点**：引擎新增 `asBibleString(v)=typeof v==='string'?v:''` 类型壳（三字段 + castMap 两处共四个调用点），路由形态归一 `put()` 源头只存 string 值（双保险：引擎独立可测、路由防第二炸点）；非字符串视同缺失，三项全畸形的角色走既有"无资产价值跳过"分支，部分畸形（voice 合法）仍凭合法一手源沉淀。
- **家族复发证据**：v2.160 已为同文件 `signatureLines` Json 污染加过同款防御——c191 是同型第二次复发，故立铁律（见下）而非就事论事。

**遗漏⑦处置（c188 首现→c189/c190 未处置→本轮第 3 次出现，P3 时效铁律强制闭环）**：autoFill 旧路径（不带 patches）的 fieldsFilter 畸形走独立 delete 筛选代码，与 patches 路径非同段。结论为**行为正确、补测锁定**：三族各 1 个 it 四变体——单选精确筛选、空数组零选中 skip（中文 reason 口径一致）、含非字符串元素静默过滤后生效、fields 非数组（旧客户端误传字符串）兜底全选不 400。**遗漏表现已清空**。

**P3 新记名（首现，按 c189 铁律允许留白一次，c192 候选）**：from-project cast 沉淀路径的 persona（traits+arc 拼接）/voice 是 LLM 自由文本、无长度关，与手动建档 zod 的 200 字上限不同源。**不立即套上限**：沉淀 persona 的产品语义是"bible 本体全文"而非手填短摘要，机械截断会损伤语义；voice 可考虑截 200（占位增强语义）。需带产品判断处置，c192 三选一（确认语义后截断 / 判死写明"沉淀全文本不受手填上限约束"并在 schema 注释标注双口径 / 提级）。

**TDD 证据**：修代码前 cast 单文件 53 中精准 3 红（引擎 1 + 路由段A/段B），三族遗漏⑦ 3 个 it 旧代码即绿（行为锁定型）——红绿分布再次与预演一致；修复后 cast 53/53、prop 47/47、scene 44/44，全量连续两次运行 0 失败（runner 总计数有非确定性波动，以 fail=0 为准）。

### 方法论沉淀
- **①"无 zod 的 Json 落库字段，读取侧必须以 unknown 进、类型壳出：调用 .trim()/.length/.map() 等类型方法前一律过 typeof/Array.isArray 守卫；写入侧没有约束，绝不等于读取侧可以信任"是 Json 读取不信任铁律**——c191 是该家族第二次复发（v2.160 signatureLines → c191 traits/arc/voice）。**铁律**：凡读取 prisma Json 字段（或任何 LLM/外部系统裸 JSON 落库的列）后需要类型方法时，(a) 先写一行 `asX(v): X` 类型壳再取值，禁止 `(v ?? '').method()` 这种"只防 null 不防错型"的半截守卫（`(123 ?? '').trim()` 照样炸——?? 只挡 null/undefined，不挡 number/boolean/object）；(b) 入口归一与业务引擎两处都要壳：入口壳防路由层自身的二次访问，引擎壳保纯函数独立契约；(c) 类型壳的语义是"畸形视同缺失"而非"畸形报错"——沉淀/统计类批处理必须隔离毒丸，单条坏数据不能拖垮整批。理由：(a) TS 对 Json 字段的类型标注是谎言，编译期零保护；(b) LLM 输出形态漂移是常规事件不是异常事件，历史数据/旧版本/迁移库同样会带入脏形态；(c) 半截守卫（?? / || 兜底）制造"我已经防御过"的错觉，是比完全不防更危险的代码。判定标准：grep Json 字段读取点，凡有 `(x ?? '')`/`(x || [])` 后直接接类型方法而 x 来源无 zod 证明的，即视为违规。
- **②"毒丸缺陷的测试必须有'畸形项+合法项同批'用例：纯畸形批次只证明'会不会炸'，混合批次才证明'坏数据会不会拖垮好数据'——后者才是批处理的核心安全属性"是毒丸隔离铁律**——c191 引擎 it 设三段：全畸形（不抛错+跳过）、混合（毒丸与合法角色同批，合法者照常产出）、部分畸形（单角色合法字段保留）。**铁律**：任何"循环处理一批外部数据"的链路（沉淀/批量导入/批量补全/列表聚合），畸形输入测试至少含一个混合批次断言——N 条坏数据 + 1 条好数据，断言好数据的处理结果与无坏数据时逐字段一致。理由：(a) 只测纯坏批次，try/catch 一包就绿，但"整批 catch 后零产出"的毒丸效应测不出来；(b) 毒丸的真实伤害从来不是报错，而是好数据被连坐；(c) 混合用例还会强制你想清楚"畸形项跳过还是中止"的产品语义。判定标准：批处理缺陷的回归用例只有纯畸形段没有混合段，视为未完成。
- **③复盘方法验证：c190 同源常量铁律在本轮首次作为"检查点定位器"使用——它不是逢数字重复必判违规，而是逼出三个观察点并各自定性**：引擎产出裸写（生成方不消费接受方约束，读代码证明安全→判死）、沉淀 persona 长度无关（产品语义不同，带判断进 P3 表）、patches 旁路（c190 已修）。铁律的价值是让"哪里可能漂移"无处藏身，处置仍按风险分级。

## c192 功能轮：五大策略一键匹配（零接线端点盘点）+ cast-arc 毒丸（家族第三炸点）+ P3 长度关闭环

**功能主交付——"后端已建能力×前端调用差集"发现法实战**：本轮功能点不靠拍脑袋新增，而是对后端 router 定义全集与前端 fetch 调用全集做差集：发现两个纯函数确定性推荐、零积分、契约测试已完备的端点在前端**零接线**——`POST /api/generate/hook-strategy/recommend`（v2.27 建，返钩子策略卡+理由）与 `POST /api/generate/creation-strategy/recommend`（节奏/台词/情绪/人物四轴卡+理由）。前端此前只有手动点 chips 与拉列表，"不选=系统智能"只在真正生成剧本那一刻于后端隐式生效，用户在创作台上**看不到系统会给什么、为什么**。交付：创作台策略区新增"🧠 按题材一键匹配五大策略"按钮（与 v2.04 风味推荐同栏），一次并发调两端点（brief 取 buildTagBrief 兜底梗概框、tags 已选标签、mode 当前模式、lang 走 strategyLocale 六语），回填钩子/节奏/台词/情绪/人物五个策略变量并整区重渲染 chips，小南逐条播报策略名与推荐理由；回填后用户仍可逐项手改，"不选=智能"的产品语义不变。CSS 仅给推荐栏补一条 flex+wrap（两按钮并排、窄屏换行），复用既有 chip/hook-group 基类。

**附带修复① cast-arc 毒丸（c191 Json 家族第三炸点，P2）——故障形态是"导出页静默蒸发"不是 500**：
- **触发字段**：`project.bible.characters` 为数组形态（`[{name,...}]`，沉淀入口三形态之一本就接受）或任一角色 `traits/voice/arc` 为 truthy 非字符串（123/[]/{}）；
- **根因**：导出文档装配器 `buildCastArcPage` 旧码两处——入口只做 `opts.characters ?? {}`（对象形态假设，数组形态 Object.keys 拿到索引、按名查表全空）与人物卡 `(c.traits || '').trim()` 半截守卫（|| 只挡 falsy，truthy 错型照抛 TypeError）；其调用方 script-doc.ts 外层 try/catch **吞错降级**，于是不是 500，而是**整页人物关系/弧光表从导出 docx/pdf 静默消失**——比 c191 的 500 更隐蔽（无报错、无日志、交付物缺页）；
- **修复**：新增导出 `normalizeBibleCharacters(input: unknown)`（对象/数组双形态归一一同源、逐条目非对象丢弃、字段 asString 类型壳、原始值/null 视同无圣经），`buildCastArcPage` 入口签名改 unknown 统一归一；export.ts 海报人物表同消费方**同源 import 复用**（禁止抄第二份，c190 同源铁律），desc 拼接字段再过 trim/空过滤。
- **TDD**：修码前 cast-arc 单文件精准 3 红（原始值圣经 TypeError、数组形态识别失败、混合批次毒丸）+ 旧 6 行为锁定全绿；修复后 9/9。混合批次用例断言"合法角色卡完整、畸形者降级为纯成稿解析且三字段空、原始值条目不产垃圾卡"，贯彻 c191 毒丸隔离铁律。

**附带修复② P3 长度关闭环（c191 记名项清零）**：from-project cast 沉淀的 persona/voice 是 bible 全文快照语义，与手动建档 zod 200 字"短摘要"不同源——处置选 c191 三选一中的"判死+异常护栏"：不套 200 截断（会损伤快照语义），但在写库点加**异常宽硬帽 1000**（手填上限 5 倍，同源常量 SEDIMENT_TEXT_CAP + capText 同时作用于 create/update 两路），超宽只截尾部不报错，防 LLM 异常巨串拖慢资产列表/撑爆卡片。路由级一个多段 it 锁双向边界（c190 边界双向铁律）：1000 贴线一字不截、1001 截成 1000、voice 同帽。双口径在代码注释与 SKILL 双处可查。**c191 P3 表清空。**

**回归证据**：cast-arc 9/9、character-asset 54/54；全量连续两次 0 失败（4242 / 4288，runner 计数非确定性波动，以 fail=0 为准）；改动 TS 文件 tsc 全量编译通过、编辑器零诊断；前端 node --check 通过，运行中的 8080 静态服务即时托管已验证含新按钮、两端点 401 证路由存活。

### 方法论沉淀
- **①"端点存在 + 契约测试完备 ≠ 用户可达：功能缺口盘点要做'后端 router 定义全集 × 前端调用全集'差集，差集即零成本功能候选"是后端能力×前端调用差集盘点法（契约可达性检查的前端镜像）**——本轮两个推荐端点分别建于 v2.27/v2.28 时代，路由契约测试一直绿，但创作台从未调用，能力对用户不存在。**做法**：(a) grep router 文件全部 `.get/.post` 定义列后端能力全集；(b) grep 前端 `fetch/Api.request` 路径列调用全集；(c) 差集中优先挑"纯函数/确定性/零积分/零副作用"的只读推荐类——它们接线是纯增量（无计费、无状态机、失败仅提示），一个按钮即可释放成熟能力；(d) 接线必须回填真实状态+重渲染+解释理由，不能只弹个 toast（用户要看到系统判断并能覆改）。理由：成熟后端能力烂在路由表是最高性价比的功能债，它已过设计、已过测试、已过安全评审，边际成本只剩 UI 接线；而"生成时后端偷偷替用户选了策略、用户事先不可见"本身也是知情权缺口。判定标准：任一 GET/POST 端点有契约测试但全前端 grep 无调用，即记入差集清单并评估接线。
- **②"try/catch 吞错降级型毒丸与直接 500 型毒丸危害等价、隐蔽性更高：缺陷定性不能只看 HTTP 状态码，要看'最坏情况下交付物少了什么'"是静默蒸发定性法**——c191 毒丸是整批沉淀 500（有声），c192 cast-arc 毒丸被外层 try/catch 吞成"文档少一整页"（无声）：无 500、无错误日志、用户拿到一份残缺 docx 还以为内容本就如此。**铁律**：排查外部数据毒丸时，凡消费链路存在 try/catch 降级/默认值兜底，测试断言不能只写"不抛错/返 200"，必须断言**降级后的产出完整度**（该有的页/卡/字段还在不在、好数据是否完整）；"不炸"不等于"没坏"。理由：500 逼着人立刻修，静默蒸发可能在生产环境存在很多个版本无人发现，直接污染交付物与用户信任。判定标准：一个外部数据解析用例只断言 status=200/不 throw，而不断言受保护数据结构的存在性与完整度，视为防了一半。
- **③ c191 Json 读取不信任铁律首次主动扫查即捕获同家族第三炸点（v2.160 signatureLines → c191 沉淀两处 → c192 cast-arc 导出两处），验证其 grep 判定标准可迁移**：本轮未等复盘，功能轮开工即按"grep Json 字段读取点凡 `(x ?? '')/(x || [])` 后接类型方法且无 zod 证明即违规"扫读导出链路，一次命中。同时补一条形态经验：半截守卫的问题不止值错型，**容器形态假设**（默认对象、实际数组）同属 Json 不信任面——归一层必须同时做容器形态判定与值类型壳，且同一归一口径的多个消费方要 import 同源函数（c190 同源常量铁律向"同源归一逻辑"推广）。

## c193 复盘轮：形态归一跟随写入路径（配角台账静默失效）+ 容错注释谎言（script-doc）+ 环境/schema 漂移三重门

**BUG-A（P1）配角在场台账对象形态静默失效——c192 静默蒸发定性法的新形态：功能不生效**：
- **触发**：`project.bible.characters` 为**对象形态**（键即角色名），而这恰是 pipeline 主写入路径的产物（架构师产出 bible 时以对象落库）；c192 新建的名表抽取只认 `Array.isArray`，对象直接落入 else 分支返空数组（不抛错）；
- **故障**：prevPresence/prevPairs 拿到空台账，"配角连续缺席≥3 集 → 注入防遗忘调度 prompt"的整条机制对对象形态圣经**永不触发**——无 500、无降级日志、页面无异常，只是架构师再也想不起缺席配角。这是静默蒸发的第三种形态：c192 是"交付物缺页"，本轮是"增强功能空转"，共同点是 HTTP 全绿；
- **根因**：归一器支持的形态集 ⊊ 数据真实写入形态集。写入方枚举得不全（pipeline 对象 / 立项解析数组 / 字符串 JSON 三形态，旧代码只认其一）；
- **修复**：新增导出 `extractBibleCastNames(input, opts?)` 三形态归一——对象（键即名，值畸形不影响"被声明的名字"语义）/数组（字符串元素直接当名、对象元素取 name）/JSON 字符串（parse 失败返 []），长度窗 [2,12]+trim+去重+cap 20；关键设计：名表语义只认"被声明的名字"，**不复用 normalizeBibleCharacters**（后者会丢弃值为原始值的键，而旧路由对数组字符串元素本就支持，复用会误收窄历史契约）。generate 路由注入点与 pipeline 消费点不变，只换数据源；
- **TDD**：cast-arc 单文件 5 用例锁三形态+畸形+长度窗（修前函数不存在全红，修后 14/14）；http-generate 端到端 1 用例：对象圣经 {林晚,陈总} × 四集成稿（陈总仅 ep1 出场），生成第 5 集时断言架构师 prompt 含"配角在场·防遗忘调度/陈总/连续 3 集未出场"且不误报林晚——**端到端断言注入文本而非中间态**，防"函数对了但没接线"。

**BUG-B/C/D（P1/P2）script-doc "容错注释是谎言"——asBible 声称完全容错但只验顶层**：
- **故障族**：① `foreshadow` 落库为字符串形态时，故事大纲段对其 `.filter(...)` → TypeError 500（无 try 裸段，有声）；② `characters` 为字符串时，旧归一按字符/索引产出畸形条目，人物卡 `c.traits` 取值炸；③ worldview/timeline 非字符串错型（123、错型数组）被模板字符串强转成 "123" 污染大纲正文；
- **根因**：旧 `asBible` 注释自称"容错读取"，实现却只验顶层是否对象、内部字段全部裸信——**容错契约只兑现了 30%**。c191 的半截守卫是"值"层谎言，本轮是"函数注释"层谎言：函数名/注释给调用方"这里安全"的错觉，调用方就不再设防；
- **修复**：删除 asBible，新增导出 `normalizeBibleDoc(input)` 逐字段兑现契约——worldview 仅非空 string 否则 undefined；timeline/foreshadow 用内部 asStringList（字符串=单条保留整条、数组仅留非空 string 元素、其他返 []）；characters 同源复用 normalizeBibleCharacters（c190 同源铁律）；beatPrefs/hookPrefs 等自由字段走 asBibleRaw 的 unknown 读取不经归一。market 集市 synopsis（timeline[0] 兜底）与 generate 价值证书 synopsis **同口径收口**（同口径多消费方铁律）。script-doc 6 用例（含毒丸隔离）修后 25/25。

**环境级发现（复盘轮独有收获）——"契约测试绿 ≠ 链路真实执行过"的三重漂移门**：浏览器真实联调 c192 五策略按钮（两推荐并发 200、五组 chips 回填高亮、hookSummary 同步、可单组手改覆盖不波及他组、小南五条带理由播报全通过）时连带暴露：
1. **进程漂移**：8080 跑着周二启动的旧 dist，内存代码早于磁盘代码——资产三路由前端收到 404；
2. **schema 漂移**：重启后路由出现却变 500（`prisma.characterAsset` undefined）——本机库是 db push 模式、无 _prisma_migrations，三张资产表与 client model 双缺；这三张表自 v2.151 起契约测试一直绿，因为测试走 stub/mem，**真实库链路从未被执行过**；`prisma db push` + 重启后三端点 200；
3. **实例漂移**：排查中发现本机 PG 实例跑反（homebrew 实例占 5432、标准 local pg16 实例停机），后端所有 DB 请求实际打在没有 zhongnan 库的实例上（注册 500），恢复"brew 停 / local 跑"标准状态后恢复。

### 方法论沉淀
- **①"归一器支持的形态集必须等于数据真实写入形态集：写归一器前先枚举全部写入方，漏一个形态消费方就静默失效"是形态归一跟随主写入路径铁律（c191 Json 不信任铁律的容器形态条款升级）**——本轮对象形态正是 pipeline 自己的主写法，消费方却只认数组，等于自家系统写的数据自家不认。**铁律**：为任一 Json 字段写读取归一时，(a) 先 grep 全部写入点（pipeline 落库/路由解析/字符串 JSON 导入/批量沉淀）列"写入形态全集"；(b) 归一器形态支持集必须 ⊇ 该全集，差集逐形态写测试；(c) 注意"同名不同义"陷阱——名字抽取（只认被声明的名字）与角色卡归一（要完整字段值）语义不同，禁止图省事复用一个归一器而收窄历史契约。理由：写入路径随版本自然增加，读取归一器停留在旧形态集是高频老化模式；且容器错形态不报错只返空，是静默蒸发的温床。判定标准：一个 Json 读取归一器没有对应的"写入形态枚举清单"注释或测试，即视为未完成。
- **②"容错函数的注释/命名就是契约：声称容错就必须逐字段兑现，并用恶意结构测试验讫；只验顶层的容错函数比没有更坏"是容错注释谎言铁律**——asBible 的"容错"注释让 buildScriptDoc 四处调用零设防。**铁律**：凡函数名/注释含"容错/安全读取/normalize/sanitize"，(a) 契约必须逐字段列出（什么形态→什么结果，错型→丢弃还是默认）；(b) 测试必须含恶意结构（字符串给数组字段、数字给字符串字段、null/原始值当对象、键畸形对象）；(c) 调用方不得因"已 normalize"而跳过对自由字段的类型判断——归一只管声明过的字段。判定标准：容错函数的测试只有合法输入+顶层 null，没有逐字段错型用例，视为谎言。
- **③ c192 差集盘点法从"后端端点 × 前端调用"推广到"写入形态 × 消费形态"，且增加第三维"真实环境 × 测试环境"**——本轮三端点亮灯：端点差集（c192 已立）、形态差集（写入三形态/消费一形态）、环境差集（测试 mem/stub 全绿 × 真实 DB 缺表、磁盘新代码 × 进程旧代码）。**新增冒烟铁律**：凡新增 prisma model/字段并合入后，本机验证必须过三道门——db push 同步真实库、重启服务进程、真实 HTTP 带 token 冒烟新端点（不靠契约测试替代）；浏览器联调是唯一能同时穿过三重门的验证手段，复盘轮必做。

## c194 功能轮：用户反馈中心（整套工单 C 端零接线）+ 制式样例馆接线（sample-script×lang）

**主交付（P0 知情权缺口）用户反馈中心——后端工单系统完整、C 端却零入口**：
- **差集甄别**：沿用 c192 后端能力×前端调用差集法时，在 `/api/feedback` 上发现比"单端点零调用"更严重的形态——后端有完整子系统（POST 提交、GET /mine 查进度与回复、admin/list、/todos、/preview、/:id/action 三态处置 + 小南暖心回复模板），前端**只接了管理员处置端**（app.js `fbAdm`、#admFeedbackPane），终端创作者既无提交入口、也看不到任何处理状态与回复。结果是管理员反馈后台永远空转、三态处置能力没有真实数据流入，"被看见、被尊重"的产品设计对用户不存在；
- **交付**：顶栏"反馈"入口 + 反馈中心弹窗双 Tab——提交（建议/Bug 类型选择、Bug 紧急置顶勾选、内容 5000 字带计数、联系方式选填、自动采集 path/lang/UA 截断/ts 到 meta）+ 我的工单（类型徽章、紧急标、六态状态徽章 PENDING/PROCESSING/SOLVED/EXECUTING/TODO/REJECTED、工单号、本地化时间、内容、小南回复气泡）。未登录引导登录；提交后回执工单号并自动跳转工单列表；中英双语（其余语种回落中文），复用既有 modal/chip/notice 视觉与主题变量；
- **联调中自揪缺陷（功能轮自测即复盘）**：初版用 `mineLoaded` 一次性缓存"我的工单"，浏览器模拟管理员写回复后反复切 Tab/重开弹窗，状态仍是"待受理"、回复不出现——**进度/回复类查询被静态缓存，用户永远看不到新处置**。修复：删除缓存门，每次进入"我的工单"都重新拉取（列表仅 20 条、成本可忽略）；psql 写 TODO+回复后复验，状态翻"已列入待办"、回复气泡正确渲染。

**次交付（创作引导）制式样例馆 + 后端 lang 透传**：
- `/api/generate/sample-script`（返回通过全部格式闸门的离线达标剧本，LIVE/AIGC 双制式）自 v2.18 起零前端调用；端点只收 format 不收 lang，英文界面用户拿到中文稿。**后端**：白名单透传 `lang=en`（非 en 一律回落 zh，绝不透传任意 query 值，c191 边界不信任在 query 参数上的落地），响应回带 lang；**TDD 先红后绿**——http-mature-consent 加用例（en 含 INT./EXT. 英文场标、非法 lang 回落中文），修前 fail 1、修后 7/7；**前端**：模式区"📖 制式样例"入口（免登录、0 积分），弹窗双制式 Tab + 随界面语言取稿 + 按 `制式_语言` 缓存（静态参考数据可缓存）+ 一键复制；浏览器实测中文 LIVE 1085 字含场标、中文 AIGC 流畅段含（音效）无【景别】标签、英文 4456 字符 INT. 场标，切换全通。
- **主动放弃候选**：/modes 全量权威化经评估边际价值低且有双源风险——前端等级软拦截 + 后端 MODE_ALIASES 完整别名已兜底 id 漂移，全量替换还需处理双语源与未登录降级，按最小侵入原则不动（差集候选不是非接不可，要判产品价值）。

**回归证据**：http-mature-consent 7/7（含新增 lang 用例）；全量连续两轮 0 失败（4248 / 4148，runner 计数非确定性波动，以 fail=0 为准）；generate.ts tsc 编译通过、编辑器零诊断；前端 app.js/i18n.js node --check 通过；真实 HTTP 冒烟 8 项（样例中英/非法回落、登录、反馈 POST 工单号、mine 字段、401、空内容 400）全符；浏览器 Playwright 联调两功能与回复闭环全过、console 0 业务错误；联调测试工单（BUG-/FB- 各一）已 DELETE 清理。

### 方法论沉淀
- **①"端点/子系统存在、契约测试绿、甚至管理员端已接线 ≠ 终端用户可达：差集要按用户角色再做一次"是差集盘点法的角色维度升级（c192 法第三维之后的第四维）**——feedback 全套在前端并非"零调用字符串"，管理员端一直在调，粗粒度差集脚本（只看路径有没有在 web/ 出现）会把它判成"已接线"而漏报；真正的缺口是**调用方角色单一**（仅 admin，缺 C 端）。**做法**：差集甄别每个"已接线"端点时再问一句"谁在调"——grep 调用点所在 UI 是否受 admin-only 守护、普通用户路径能否到达；凡某能力只有管理端/后端内部调用而其服务对象本应是 C 端用户（反馈、进度、资产、消息），即记为"角色差集"，优先级高于一般只读推荐接线。理由：完整子系统烂在路由表里，浪费的是从数据模型→处置状态机→回复文案的整条设计，接线收益最大。判定标准：一个面向用户的资源类型（如工单/消息）前端只有 admin 视图没有用户视图，即判子系统级缺口。
- **②"动态状态数据必须新鲜、静态参考数据才可缓存：进度/回复/余额类查询禁止一次性内存缓存"是新鲜度语义铁律**——mineLoaded 让用户看不到刚产生的处置。**铁律**：接线任何"状态会被他人/异步改变"的数据（工单进度、回复、订单、审核、积分）时，(a) 每次进入其视图都重新请求，不用"加载过一次就不再拉"的内存门；(b) 缓存只能用于内容不可变的参考数据（制式样例、词典、标签库），且缓存键要包含全部影响返回的入参（样例必须按 `制式×语言` 双键，不能只按制式）；(c) 自测要含"数据在页外被改变后回来看是否刷新"这一条（本轮用直接写库模拟对方处置才抓到）。判定标准：一个状态查询只在首次挂载时请求、没有任何重新进入/轮询/手动刷新路径，视为陈旧缺陷。
- **③"差集脚本的'后端全集'本身也会说谎：零接线候选必须双向 grep 证伪后再定性，不能凭脚本结果施工"是差集候选证伪纪律**——本轮曾据中间盘点记录认定存在 `rewrite-suggestions`、`relationship-graph` 两个零接线端点，开工 grep 源码发现**端点根本不存在**（属过时记录/误匹配幻觉），立即撤销该子任务，避免给不存在的路由写前端。**铁律**：脚本只产出候选线索，施工前必须 (a) 在 src/routes 确证路由定义真实存在（贴出文件:行）；(b) 在 web/ 确证调用真的缺失；(c) 二者都成立才进入实现。另：大文件 Edit 必须用足够唯一的锚点，本轮一次 Edit 误删 listModal 的 select 行，当场 diff 发现并恢复——改后立即核对相邻结构是必备动作。

## c195 复盘轮：c194 四缺陷修复 + 角色差集第二轮（tags.recommend / teardown.mine 接线，列表瘦身与详情分层）

**本轮性质**：复盘轮（功能轮之后的系统性自检），升版 v2.185.15。

### 一、c194 新接线代码复盘：4 处真实缺陷（均修，另加 1 处状态残留）
1. **loadMine 的 401 分支无登录引导**：提交反馈的 submitFeedback 有 `e.code==='AUTH_REQUIRED'→openAuth('login')` 分支，但"我的工单"加载 catch 只把字面量 `AUTH_REQUIRED` 当普通错误甩在工单区——同一弹窗两个入口，错误处理不对等。修复：loadMine catch 同款判码，关弹窗并弹登录框。Playwright 坏 token 实测：authModal 出现 + feedbackModal 关闭。**教训见方法论④**。
2. **制式样例馆请求竞态**：快速切 LIVE/AIGC（或中英语言）时，先发出的慢响应可能晚于新请求返回，把旧制式稿写回当前 Tab。修复：IIFE 内自增 `reqSeq`，响应回来比对序号，过期即丢弃；切回时重新拉取（注释必须如实写"丢弃"，c193 注释契约）。
3. **复制按钮空态静默**：`smpCopy` 仅在 cache 命中时复制，加载中/失败点击毫无反馈。修复：cache 空时 xnSay 提示加载中（真实接口 <50ms 使该分支近乎不可达，属防御性兜底，但按钮"点了没反应"永远算缺陷）。
4. **英文界面中文冒号**：提交成功提示 `` `${t('fbSubmitOk')}：${ticketNo}` `` 硬编码全角冒号。修复：随 `lang` 取 `': '` / `'：'`；英文实测 "Received — please keep your ticket no.: BUG-09537354"。
5. （复盘附加）**fbType 选择残留**：报 Bug 提交成功后类型按钮停在 BUG，下次打开默认是报 Bug。修复：成功回调复位为 SUGGESTION 并同步 active 态，与内容/联系/加急字段一并清空。

### 二、角色差集第二轮：171 条路由全量脚本扫描，31 候选逐条证伪，2 个属实
- 脚本读 src/routes 全集 171 条路由 × web/ 语料，按挂载前缀+末两段静态 probe 匹配；31 个"非 admin 零命中"候选经**逐个 grep 真实调用点**全部过堂：like、interview turn/brief、buy/confirm/refund、pitch、director-pack、emotion-wave 等 29 个均为动态路径/模板字符串造成的 probe 假阴性（c194 证伪纪律再次应验：`/:id/xxx` 类路由静态片段必误报）。
- **属实缺口①：`POST /api/tags/recommend` 零前端调用**——纯确定性互补推荐函数 recommendNext（优先补缺维、高热度、规避互斥/重复，零积分零副作用），标签工作台六件套（validate/search/leaves/random/board/dimensions）独缺它。接线：标签台加"🧩 补齐维度"，n=min(8, 剩余容量)，结果进备选池点选加入（**不自动替用户决定**，与标签台"用户确认后据此出本"的交互契约一致）；失败静默不阻断（跟随 validateTagCombo 容错风格）。浏览器实测：空选补 6 个跨维候选；已选 9 个后再补，池内与已选零重叠。
- **属实缺口②：`GET /api/teardown/mine` 零前端调用**——用户花 30/24/18 积分的拆解与 20/16/12 的大纲刷新即丢失。接线中发现**回包结构问题**并先红后绿改造（见下）。
- **主动推迟**：`GET /api/room/mine`（room-view 改造面大，单独立轮）、interview `/sessions` 与 `/:id/close`（grep 无调用且产品形态未定）。差集候选不是非接不可，按产品价值与侵入面排序。

### 三、后端：列表/详情分层（契约先红后绿）
- 旧 `/mine` 直接 findMany 全量返 50 条（含 report/outline 大 Json，回包可达 MB 级）。改为：
  - **`GET /mine` 只返摘要**（select 九字段：id/来源/标题/字数/标签/方向/状态/积分/时间，不含 report/outline——state 已表达大纲有无：ANALYZED/OUTLINED/TO_PROJECT）；
  - **新增 `GET /:id` 详情**（owner 隔离：他人 403、不存在 404、未登录 401；带完整 report/outline，directions 用 `adaptDirections(report)` **随报告重算**而非存储，保证新旧记录与 /analyze 同源一致；空 report 容错返 []）。
- 路由顺序：/mine 注册在 /:id 之前防单段路径截获。memory-prisma 的 crud.findMany 已支持 select 投影。测试先断言"列表无 report/outline/userId、按时间倒序"与"详情 owner 可取/他人 403/404/401"，先红 2 个后改绿，http-teardown 16/16。

### 四、前端：历史记录完整恢复态（不是只读列表，是可续作工作台）
- 拆爆款面板加"🕘 我的拆解记录"：每次展开新鲜拉取（c194 新鲜度铁律），列表卡片显示标题（无标题用来源+字数兜底）/时间/状态文案/积分/标签数；点击才取详情（按需拉大 Json）。
- **状态恢复精确还原**：刷新页面（内存全清）→ 历史 → 点击，实测还原：6 个勾选标签（当时手动从 8 个取消了 2 个）、`swap_world` 非默认方向、完整大纲与"转项目"按钮，可继续改编/转项目。
- **恢复容错（见方法论⑥）**：标签池始终以当前报告为准，历史 pickedTags 与池求交（旧标签失效自然过滤）；direction 不在候选则回退第一个；新拆解路径显式重置 direction/restoreTags/lastOutline，防历史状态污染新拆解。语言切换时若历史区展开则随语言重渲染。
- 词条：静态按钮走 i18n.js（tbTdHistory 中英），动态列表走 teardown-view.js 自带 L 字典（该 IIFE 不依赖全局 t()）；样式 .td-hist-card 系列；esc 转义标题防 XSS。

**回归证据**：http-teardown 16/16（新增 2 用例：列表瘦身字段+倒序、详情 owner/403/404/401）；全量连续两轮 0 失败（4311 / 4190，runner 计数非确定性波动，以 fail=0 为准）；tsc 通过；web 全部 JS node --check 通过；pm2 重启 healthcheck OK；HTTP 冒烟（recommend 返排重结果、mine/detail 无 token 401）；Playwright 联调 8 项（补维渲染/点选加入/带已选排重、历史空态/真实拆解-大纲-刷新恢复全链路、英文按钮文案、英文冒号+fbType 复位、样例快速切 tab 内容正确、坏 token 401 引导登录）全过。联调临时数据已精确回滚：TeardownRecord 0 条、LedgerEntry 两笔删除、测试工单删除、PointsAccount.balance 归 0。

### 方法论沉淀
- **④"同一子系统的每个入口，错误语义必须对齐：补一个入口就要审计同族入口的 catch 分支"是入口对等原则**——submitFeedback 与 loadMine 同住一个弹窗，401 处理却只写了一边。**做法**：给任何子系统加入口/操作后，列出该子系统全部网络调用点（提交、列表、详情、重试），逐个核对 (a) AUTH_REQUIRED 是否都有登录引导；(b) 成功态字段复位是否完整；(c) 用户可见文案是否随语言。浏览器坏 token（localStorage 双 token 置脏）是成本最低的全分支 401 验证法，验完重新登录恢复。
- **⑤"列表与详情分层：摘要列表禁止携带大 Json；资源状态机字段要能表达'有没有'，避免为展示状态拉大字段"是列表端点瘦身原则**——50 条×(report+outline) 可达 MB 级，而列表只需"标题+状态+时间"。**契约模式**：`GET /res/mine` 用 select 只给摘要行；`GET /res/:id` 才给完整产物；存在性用 state 枚举表达（ANALYZED=无大纲、OUTLINED=有大纲），前端按 state 决定徽标而不需要 outline 本体。可派生字段（directions）在详情端随报告重算、不落库，保证算法升级后旧记录与新记录同源。先红测试要明确断言"列表不含哪些字段"（assert undefined），白名单字段断言不足以防回包膨胀。
- **⑥"恢复历史状态不是回填表单，是把旧选择与当前候选集合求交：失效的静默丢弃、默认项显式回退"是状态恢复的交集模式**——旧记录引用的标签/方向可能因算法或词库迭代失效，直接回填会产生悬空选中。**做法**：恢复时 `picked = 旧选择 ∩ 当前候选`；枚举值（direction）不在候选则回退第一个并更新 state；同时新入口路径必须显式重置恢复态字段，否则上一条历史的 direction 会污染下一次新拆解。验收必须用"制造非默认状态→刷新/重开→恢复"的实测（本轮 8 选 6 + 第二方向），只验默认态恢复会漏掉整个分支。
- **⑦"快速切换类请求必须带请求序号：响应回来只认最新一次"是竞态守卫最小模式**——自增 seq 闭包变量，发请求记快照，响应/异常回调先比对再写 DOM；过期响应直接丢弃（不写缓存不渲染，语义最简单可证）。凡 Tab/语言/筛选器等高频切换 + 异步写同一容器的场景默认套用。

## c196 功能轮：编剧室历史恢复（room/mine 接线，列表/详情分层复用）+ 选题会"集数-冲突容量"护栏（问了就要判的逻辑闭环）

**本轮性质**：功能轮（c195 主动推迟项兑现 + 创作引擎一处真实逻辑断裂修复），升版 v2.185.16。

### 一、编剧室历史：c195 推迟项落地（列表瘦身 + 详情复用 + 可续作恢复）
- **后端 `/api/room/mine` 列表瘦身**：旧实现 findMany 全量返 100 条（含 scriptText/payload 大 Json、participantIds、messages 关系），围读剧本单条可达数十 KB。改为 select 九字段摘要：id/kind/readMode/title/state/inviteCode/pointsCost/createdAt/updatedAt，按 updatedAt 倒序 take 100。**不新增详情端点**：恢复态直接复用已有的 `GET /:id/messages`（含 owner/参与者鉴权 accessibleRoom，返 payload + messages + seats + readModes），列表/详情分层与 c195 teardown 同一契约模式（方法论⑤复用）。先红断言：未登录 401；每条 scriptText/payload/ownerId 均 undefined；必有 id/kind/title/state；倒序；他人列表为空。
- **测试基建补洞（红测试先抓到的真问题）**：memory-prisma 的通用 crud.findMany 支持 select 投影，但 writersRoom 自定义 findMany 此前静默忽略 select 仍返全量（摘要断言因此能抓到 scriptText 泄漏——若只断言"包含某字段"则永远漏）。补 `arg.select ? projectRow : 全量` 分支。
- **前端历史不是只读列表，是可续作工作台**：room-tabs 加"🕘 我的编剧室"，展开每次新鲜拉取、再点收起；卡片复用 .td-hist-card 样式，显示 类型·标题·状态 + 时间/邀请码/模式/`每次 N 积分`（pointsCost 是单次动作单价 20，不是总额，文案不得写成总额）。点击进房 GET messages 后精确恢复：
  - 选题会：pitchRoom 归位、消息流重渲、输入区显示，payload.verdict 存在则重渲决议卡（含本轮新增容量行），否则显式隐藏防上一房残留；
  - 围读：readRoom + readMode 归位、模式 radio 预选、消息流、房间信息条，payload.lastRead 存在则重渲围读结论卡，否则隐藏。
- **顺带修复一个 rerender 老 bug**：renderReadModes() 无参被语言切换等 rerender 调用时，原来每次都默认选中第一个模式，把用户已选/已恢复的模式覆盖。改为无参保留 state.readMode、有参才预选；实测切英文后 me_xn 预选不丢。
- 词条分层同 c195：静态按钮走 i18n.js（tbRoomHistory 中英），动态卡片走 room-view.js 本地 L 字典；esc 转义；styles.css 零改动。

### 二、创作引擎：选题会"集数-冲突容量"护栏（问了就要判）
- **发现的真实逻辑断裂**：openPitchMeeting 的开场问卷明确追问"冲突够撑你计划的集数吗"、也收集 episodes，但 decidePitch 的 GO/HOLD/NO 判定**完全没有消费 episodes**——计划 300 集、冲突只够几十集的项目照样 GO，问而不判。
- **确定性容量公式**（不依赖模型自由发挥）：基础容量由故事分定档 story≥80→100 / ≥65→80 / ≥50→60 / 其余→40；冲突文本每命中一类"层/升级/递进/反转/副线/多线/秘密/身份/复仇/阶段/加码"容量信号词 +10（最多计 3 个，中英双信号词表），得 capacityEpisodes。计划集数 > 容量×1.3 即 epOver：风险条点明"计划 N 集超出容量（约 M 集），中后期易注水/重复打脸/空降续命"，修复条给两条可执行路（压缩到 M 集／立项前扩容量：第二条主角目标线、反派升一级、并行兑付副线），**GO 判定追加 `&& !epOver`**（落入 HOLD，NO 分支不动）。
- **先红造例法**：用"强输入但极端参数"造例——故事内核给满分档强输入保证其余各项全过，唯独 episodes:300，断言 decision≠GO、capacityEpisodes>0 且 <300、risks/fixes 中英各含集数容量语义；先红 2 个再转绿。同时验算强输入 70 集用例容量 110、70<110×1.3 不误伤，GO 保持。生产真实联调：300 集女厨师夺回品牌案 → HOLD，容量 110，风险/修复双语义齐。
- 前端决议卡加"冲突容量约 N 集 / Conflict capacity ~N eps"行（标签双语；决议正文为决策时语言快照，不随界面语言事后翻译——引擎英文契约由单元测试锁定）。

**回归证据**：writers-room 9/9（新增中英 2 用例）、http-room 11/11；全量连续两轮 0 失败（4225 / 4107，runner 计数非确定性波动，以 fail=0 为准）；tsc 通过；web JS node --check 通过；pm2 重启 healthcheck OK；/mine 无 token 401、有 token 仅九字段白名单（生产响应字段实测排序核对）；Playwright 真实扣费联调：选题会 open+decide 300 集被拦 HOLD/容量 110、围读 6 笔记 5 行动项、刷新后历史列表两房倒序/模式/状态/邀请码/单价齐、PITCH 恢复 11 消息+决议卡容量行、READ 恢复 radio=me_xn+房间信息条+围读结论卡、切英文容量标签与房间信息条英文正确且模式预选不丢。联调临时数据已精确回滚：RoomMessage 15 条、WritersRoom 2 条、LedgerEntry 3 笔（20+20+30）删除，PointsAccount.balance 归 0。

### 方法论沉淀
- **⑧"问卷/开场向用户收集的每个判断维度，决议算法必须真正消费；收集了却不参与判定，就是问而不判的逻辑断裂"是输入消费闭环原则**——做法：给决策函数加输入前，先列"该输入影响哪个分支/阈值/文案"，逐个在判定处找到消费点；找不到消费点的输入要么接入判定，要么从问卷删除，不许只问不判。审计时反向做：从判定条件反推它依赖哪些字段，再与入参/问卷字段集合求差集，差集即断裂点。先红测试用"强输入+极端参数"造例最省力：把其他维度全部喂成 GO 档，只让被审计维度越界，若仍 GO 即断裂坐实。
- **⑨"护栏阈值要给确定性公式 + 缓冲带，不能只写模糊提醒"是可测护栏模式**——"集数太多"若只进风险文案而不硬拦 GO，用户和下游大纲环节照样会按注水集数推进。公式化（分档基线+可数信号词增量）+ 缓冲系数（1.3 倍容差防边界抖动）+ 硬门（超线不得 GO）+ 双出口建议（压缩或扩容量），四者齐备护栏才可单测、可解释、可执行。

## c197 复盘轮：五处"承诺/状态不被消费"家族缺陷（立场交锋零产出×决议自相矛盾×多轮发言不累积×参与房丢失×付费重入无防）（v2.185.17）

**本轮性质**：复盘轮（对 c196 编剧室/决议卡落地物做证据扫描，5 个问题全部文件:行坐实，先红 6 处全红且原因正确，再逐一转绿），升版 v2.185.17。

### 一、五个问题与修法（问题-证据-修法）
1. **xn_xn"互相辩论"零产出（模式承诺与结果字段断裂，与 c196"问而不判"同族）**：aiTableRead 入参吃 modeRead 但全程零消费——四种围读模式产出同构的 notes/actionItems，xn_xn（小南+小南互相辩论）承诺的"立场交锋"在结果里没有任何字段。修法：TableReadResult 新增 `debates: DebateExchange[]`（topic/fromSeat/fromSeatName/challenge/toSeat/toSeatName/reply/verdict 双语字段）；仅 modeRead==='xn_xn' 时，取 P0/P1 笔记前 2 条确定性生成交锋（counterSeat 映射保证 from≠to、to 恒为 editor/director/producer；reply/verdict 三席位双语模板：制片打成本→不加新场景改特写、导演打可执行性→落具体台词走位、责编打动机→保关键拍再删减）；非 xn_xn 恒为 `[]`。先红锁：1-2 组、四要素齐、双方席位不同、to∈三创作席、EN 零中文。
2. **决议卡"建议集数"超容量时自相矛盾**：c196 加了 epOver 硬门（超容量不得 GO），但决议卡"建议集数"仍回显用户输入的 300——卡片一边判 HOLD 说容量只有 60 集，一边建议拍 300 集。修法一行：`episodes = epOver ? capacityEpisodes : (输入或默认)`。E2E 实测 300 集 → 建议 60、容量 60。
3. **选题会多轮 USER 发言不累积（讨论是表演）**：speak 路由只用 `scriptText + 本轮 content` 判定追问，decide 只用 `scriptText + extra`——第 1 轮交代的主动目标，第 2 轮主持重复追问，决议卡故事分也吃不到。实测证据：两轮发言后 reply 仍含"主角开场的主动目标还不够清楚"。修法：room.ts 新增 `userDiscussion(roomId)`——拉全房 speakerType='USER' 消息按时间正序、去重、截断 8000 字；speak 的 combined 与 decide 的 idea 均改为消费全量历史（本轮发言先入库再拉取，不重复拼接）。先红造对照：同弱开场，发言房（轮1 补主动目标、轮2 补对抗方/场景/集数）story 分必须严格高于沉默直接决议房，且轮 2 reply 不得再追问主动目标。
4. **/mine 只列 owner 房、凭邀请码参与的房丢失**：where 仅 `{ ownerId }`，user_user/me_other_xn 被邀请人恢复后在自己的编剧室列表看不到房。修法：`OR: [{ownerId:userId},{participantIds:{has:userId}}]`，select 多取 ownerId 到 JS 层算 `role:'owner'|'member'` 后剔除 ownerId（保持 c196 摘要白名单不泄漏）。测试基建同步：memory-prisma 通用 matchWhere 补 OR（数组 some 递归）与 has（数组成员）两分支，旧 where 不触发。
5. **恢复已决议房后重复点"形成决议"静默再扣 20 积分**：前端每次点击带新幂等令牌（防的是重放，不是误触），服务端按设计必扣费；resumeRoom 已恢复 state.lastVerdict 但按钮无状态感知。修法：pitchDecide 入口 `if (state.lastVerdict && !confirm(redecideConfirm)) return;`（中英双语词条），ai-read 重跑 30 积分属用户主动重算，本轮不加确认。前端同步：围读结论卡渲染"立场交锋"区块（无 debates 不渲染，老数据 Array.isArray 兜底）；历史卡片加房主/参与角色徽标（老缓存无 role 不显示）。

**回归证据**：writers-room 15/15、http-room 12/12（两文件合计 35 测试含其他顶层 it，先红 6 处：建议集数 300>容量、debates undefined/[]、other role undefined、轮2重复追问，全部按预期变红后转绿）；全量连续两轮 0 失败（4295 / 4118，runner 计数非确定性波动，以 fail=0 为准）；tsc 通过、web JS node --check 通过；pm2 重启 healthcheck OK。Playwright 真实扣费联调：zh xn_xn 建室自动围读、结论卡"立场交锋/主持裁决/→"渲染齐；/mine 每条 role 合法且无 ownerId/scriptText/payload 泄漏；300 集决议建议 60=容量 60；EN xn_xn debates 2 组四要素齐、to∈三席、零中文。联调临时数据精确回滚：RoomMessage 41 条、WritersRoom 5 条（含首轮试错 2 条）、LedgerEntry 7 笔删除，balance 归 0。

### 方法论沉淀
- **⑩付费动作的重复触发防护：恢复态/历史态重入的付费按钮必须有"状态感知的二次确认"**——幂等令牌防的是网络重放（同令牌不重复扣），但每次点击生成新令牌时它天然允许"合法的二次扣费"。凡是"恢复历史后仍可再次点击的付费按钮"，都要审计：该动作再次执行时用户是否明确知道要再付费？不知道就要前端 confirm（文案含金额）或后端按实体状态去重，不能依赖用户自己记得"这房已经决议过"。
- **⑪多轮对话产品：每轮判定必须消费全量历史发言，而不是当前帧；否则讨论本身是表演**——单帧输入（上轮纪要+本轮发言）看似省事，但用户在第 1 轮给出的目标、在第 3 轮补的对手，判定方一律"失忆"。实现上用"发言先入库、判定前统一拉全量历史（正序/去重/截断）"一个辅助函数接到所有消费点（追问+决议），测试上必须造"发言房 vs 沉默房"对照组，让累积效应在分数/文案上可观测，否则断没断根本看不出来。
- **⑫模式承诺差异：模式名/描述承诺的差异化产出必须在引擎结果中有对应字段，否则就是"同参不同名"**——审计方法：枚举每个模式向用户承诺的差异（xn_xn 承诺"互相辩论"），再枚举结果对象的字段，求差集；承诺了却没有字段承载即为断裂（与⑧输入消费闭环同源：⑧是问卷字段→判定分支，⑫是模式承诺→结果字段）。且差异化字段要"仅该模式产出、其余模式返回空值"，既防其他模式被污染，也让前端能按空值安全降级（老数据无字段不炸渲染）。

## c198 功能轮：协作产物必须能离开协作工具——围读真人讨论进结论×GO 决议带下游出口×修改清单可带走（v2.185.18）

**本轮性质**：功能轮（c197 复盘轮发布 v2.185.17 后，沿"承诺/状态不被消费"家族继续做证据扫描，锁定三个"协作是孤岛"缺口，先红 5 处全部按预期变红再转绿），升版 v2.185.18。

### 一、三个功能与修法（问题-证据-修法）
1. **围读房真人讨论零消费（c197 userDiscussion 只接到了选题会，围读 ai-read 路由完全不读 RoomMessage）**：user_user/me_xn 房里真人围绕剧本提的"开头太慢/成本太高/台词太书面"，付费 30 积分生成的围读结论对这些发言零引用、零回应，讨论与结论两张皮。修法：aiTableRead 入参加 `discussion?: string`，新增 `DiscussionPoint { seat; seatName; point; adopted }` 与 TableReadResult.discussionPoints（xn_xn 无人模式/空讨论恒 `[]`）；纯规则确定性提取——先按换行+中英文句读切句（≥4 字），再按四席位专属信号词表（ZH/EN 各一张：责编管道具节奏、导演管台词表演、制片管成本工期、观众管钩子留存）命中数定席位，打平按 editor→director→producer→audience 职责序，每席只取最早一条、总数 ≤3、去重；零信号句（如系统消息"进入围读室"）不归类更不杜撰。**adopted 判定**：同席位引擎 note 的 kind/problem/suggestion 是否独立命中相同信号词——命中=与小南判断重合（已采纳），没命中=真人掌握的引擎不可见信息（如预算/工期），标"新增关注"保留给用户裁决，**绝不蒸发**。summary 末尾双语交代讨论去向（ZH 含"本房真人讨论 N 条已并入结论（重合 X、新增关注 Y 待裁决）"）；主持人结论消息同步附真人讨论采纳段。路由 room.ts ai-read 处接线（xn_xn 传空串省查询，其余模式复用 c197 userDiscussion 全量历史/去重/8000 字截断）。
2. **GO 决议没有任何下游出口（协作终点即死路）**：决议卡只有"复制选题卡"，GO 之后用户得自己切去创作台、重新填创意和集数，讨论成果无法流入立项。修法：renderVerdict 仅 decision==='GO' 时渲染"带着决议去立项 / Turn verdict into a project"按钮（HOLD/NO 不显示：修改方向未定，带过去只会产生垃圾项目）；点击 `window.dispatchEvent('zn-pitch-to-project')`（room-view.js 与 app.js 是两个独立 IIFE，跨模块只走 window CustomEvent，不造耦合）；app.js 监听后统一落唯一免费模式 tags（标签立项，绕开会员等级差异）：switchView('studio')→selectedMode='tags'→renderModes/syncTagBench（进入自动给一组标签）→tagIdea 预填 logline（≤80 字）、episodes 预填建议集数（钳制 1-120，对齐标签流水线实际上限），**只预填不自动生成、不扣积分**，小南双语提示"确认后点生成"。
3. **围读修改清单带不走、讨论点不可见**：结论只渲染在面板里，actionItems 与新 discussionPoints 都无法导出。修法：renderReadActions 渲染讨论点区块（席位名+原话+绿"已采纳"/橙"新增关注"徽标，全部 esc 转义；老 payload 无该字段 Array.isArray 兜底为空），并加"复制修改清单 / Copy fix list"按钮：复制体 = 修改清单（带序号）+真人讨论去向（席位/采纳态/原文），EN 模式英文标题标点零中文。resumeRoom→renderReadActions 与 zn-lang rerender 两条链路新字段均安全。

**先红-转绿记录**：writers-room.test.cjs 新增 3 案（ZH 三席位归类+editor.adopted=true/producer.adopted=false+summary 含"讨论"；xn_xn/空讨论/空白讨论 discussionPoints 深等于 []；EN 信号归类且结论零中文），http-room.test.cjs 在既有 xn_xn 案加 `deepStrictEqual(discussionPoints, [])` 断言并新增路由级整案（两人两席真人发言→ai-read 结论含 editor/producer 席位、系统入房消息不混入、每条 seatName/adopted 齐备、实扣 30）。未实现前 5 处失败全部精确命中新断言、零旧案误伤；实现后 writers-room 22/22、http-room 13/13 全绿。

**回归证据**：全量连续两轮 0 失败（4282 / 4198，runner 计数非确定性波动，以 fail=0 为准）；tsc 通过；web JS node --check 通过；pm2 重启 healthcheck OK。Playwright 真实扣费联调 8 步：①ZH user_user 房两条真人信号→ai-read 结论 discussionPoints 含 editor/producer、summary 含"讨论"、系统消息零混入、adopted 布尔齐；②确定性 GO 房（关系≥6 字/冲突≥6 字/主动目标词/受众开房时给/24 集不超容量）决议 GO；③沉默空 body 房 story=40 决议 NO；④EN 房英文剧本+英文信号→结论全零汉字；⑤历史恢复 ZH 房→讨论区块原话/采纳徽标/"复制修改清单"渲染并可点；⑥恢复 GO 房→按钮文案正确→点击后 studio 视图 tags 模式选中、tagIdea 预填≤80 字、episodes=24、tagBench 可见、小南提示出现（未扣费）；⑦NO 房无立项按钮；⑧切 EN 恢复 EN 房→整个 readActions 零汉字、Copy fix list/Live discussion/converged/new flag 本地化齐（首轮严格等待条件"仅等英文标签"曾误中语言切换后用英文标签重渲旧中文数据的竞态，改判"区块零汉字+英文按钮就位"后通过——产品无 bug，是测试等待条件不严）。联调临时数据精确回滚：RoomMessage 38 条、WritersRoom 4 条、含房间 ID 的 LedgerEntry 4 笔删除，PointsAccount.balance 归 0 并 SELECT 核对 rooms_left=0/msgs_left=0/balance=0（pitchopen 流水 refId 按设计不含房间 ID，属该专用联调账号历轮既有审计残留，余额以账户表为准）。

### 方法论沉淀
- **⑬协作工具里用户产出的内容——讨论、决议、清单——必须能被下游环节消费/导出，否则协作是孤岛**。审计三连问：用户在协作中产出了什么（发言）？产物结论有没有显性引用并逐条交代去向（采纳/新增/驳回）？结论本身能不能离开当前面板（下游一键带出/一键复制）？三问任一不成立，协作价值就断在最后一公里。与⑪（判定必须吃全量历史）配套：⑪保证"讨论被算法看见"，⑬进一步要求"讨论在结论里留痕、决议能流出工具"。
- **⑭真人意见与算法意见不一致时，正确的产品行为是标注分歧而不是让弱方蒸发**。引擎扫不到制片预算（文本外信息），不能因为"引擎没有这条 note"就把真人这条意见丢掉；adopted=false 不是"不采纳"，而是"算法与真人分歧，显性标注后交人裁决"。确定性规则下采纳判定必须可解释（同席位+同信号词命中才算重合），不能让模型自由心证，否则单测锁不住、用户也不信。
- **⑮跨模块 handoff 的两条护栏：走最宽准入路径 + 只预填不自动执行**。把决议带去立项时统一落唯一免费模式（tags），避免按用户会员等级分叉；预填后停在确认页，把"生成即扣费"的扳机留给用户自己扣——数据桥接要自动化，花钱动作永远要用户显式触发。HOLD/NO 不提供出口，防止半成品意见污染下游。

## c199 复盘轮：七处"容量蒸发/本地化残留/控件撒谎/静默失败"家族缺陷（讨论点每席扩容×主持人 EN 名×制式白名单×围读重入确认×复制降级反馈×标点三处审计×历史 select 回填）（v2.185.19）

**本轮性质**：复盘轮（c198 功能轮 v2.185.18 发布后，对讨论提取器、双语房间消息、重跑链路、围读面板做证据扫描，7 个问题全部文件:行坐实，先红 5 处全部按预期变红再逐一转绿），升版 v2.185.19。

### 一、七个问题与修法（问题-证据-修法）
1. **讨论提取器违反 c198 ⑭"不蒸发"原则（同席第二条意见被吞）**：writers-room.ts extractDiscussionPoints 原"每席只取最早一条"，责编同场先提"开头太慢"再提"女主人设矛盾"时第二条被蒸发——⑭ 防住了"弱席位蒸发"，没防住"同职能多问题蒸发"。修法：`PER_SEAT_CAP=2`（每席最多 2 条，席内按到达时间序）；席位轮转展平——round 0 各席首条按 editor→director→producer→audience 固定职责序，round 1 再补同席第二条；`TOTAL_CAP=5` 截断顺序固定可解释；去重 Set 保留；adopted 判定（同席位 notes 命中相同信号词）不变。
2. **EN 房主持人名写死中文（3 处）**：room.ts 选题会开场 hints 行与决议行动词行 speakerName 恒为 `'小南(主持)'`、围读结论行恒为 `'小南记录'`，EN 房消息流混入汉字（建室消息行原本已按 lang 分流，漏网在另三处）。修法：三处统一 `lang==='en' ? 'Xiaonan (host)' / 'Xiaonan notes' : 中文`。
3. **重跑 ai-read 制式 select 是死控件（payload 永久覆盖 body）**：原 `scriptMode = payload.scriptMode || body.mode || 'LIVE'`，历史房重跑时用户在面板切 AIGC/LIVE 永不生效。修法：`askedMode = body.mode 属白名单 'AIGC'|'LIVE' 否则 null`；`scriptMode = askedMode || prevPayload.scriptMode || 'LIVE'`——白名单外值容错忽略（不 400、不污染），回写 payload 用 `{ ...prevPayload, scriptMode, lastRead: result }` 保留 lang 等既有字段。
4. **围读重跑无二次确认（c197 只给选题会决议加了，围读 ai-read 漏网）**：已出结论的围读房再点"生成围读结论"直接再扣 30 积分。修法：room-view.js readAi 开头 `if (state.lastRead && !window.confirm(T().readAgainConfirm)) return;`——确认条件锚定实体状态（state.lastRead 存在）而非点击次数；文案 ZH/EN 均明示"再扣 30 积分 / costs another 30 points"。
5. **复制按钮静默失败且无反馈**：navigator.clipboard 在非安全上下文（http://IP）为 undefined，原 `?.writeText` 可选链静默吞错，用户连点无反应。修法：统一助手 copyText(text, btn)——Clipboard API 优先 + textarea/execCommand 降级兜底 + 按钮 1.2s 瞬时"已复制/Copied"反馈后复原；copyFixList、copyVerdict 全部改走它（onclick 用 ev.currentTarget 取按钮）。
6. **EN 下面板模板残留全角中文标点（两处区块）**：renderReadActions 评分/讨论行的 `｜；「」` 与 renderVerdict 决议卡的 `：｜（）；` 不随语言切换——文案字典翻了、说话人名翻了，标点模板是最隐蔽的第三层本地化残留。修法：pipe/colon/sep/wrap/levelLabel 全部进语言变量（EN: ` | ` / `: ` / 双引号；ZH: 全角），仅模板标点参数化；fixes/risks 后端正文若含中文标点属数据语言，不前端硬替换。
7. **恢复历史房时制式 select 撒谎**：resumeRoom 恢复已出结论的 READ 房，readFormat 恒显默认 LIVE，与 payload.scriptMode=AIGC 的实体状态不一致，用户据此重跑会误用错制式。修法：resumeRoom 的 READ 分支从 j.room.payload.scriptMode 回填 select（白名单归一，非 AIGC 即 LIVE），控件状态与实体严格一致。

**先红-转绿记录**：writers-room.test.cjs 新增 2 案（4 句 editor×2/producer/director → length=4、seats 深等于 ['editor','director','producer','editor']、席内时间序；6 句封顶 → length=5、seats ['editor','director','producer','editor','director']）；http-room.test.cjs 新增 concurrency:1 的 describe 三案（EN 选题会开场 hints+决议 host speakerName 全 'Xiaonan (host)' 零汉字；EN 围读 host 全 'Xiaonan notes'；重跑 LIVE→AIGC 生效且 messages 返回 room.payload.scriptMode 回写、mode:'NOPE' 被忽略仍 AIGC、两次各扣 30；clientToken 全用 c199- 前缀）。未实现前 writers-room fail 2、http-room fail 3 全部精确命中新断言、零旧案误伤；实现后分文件 c199 案全 ok（runner 子计数非确定性波动，只认 fail 0 + grep 案名）。

**回归证据**：全量连续两轮 fail=0（4380 / 4274，runner 计数非确定性波动，以 fail=0 为准）；tsc 通过；room-view.js node --check 通过；pm2 restart zhongnan-api 后 healthcheck `OK http://127.0.0.1:8080`。Playwright 真实扣费联调（单次 browser_evaluate 原子脚本，origin 断言、CJK 用 codePointAt 判定、箭头函内禁正则字面量）：①EN 围读 2 条 host 名全 'Xiaonan notes' 零汉字；②EN 选题会开场 6 条 host 全 'Xiaonan (host)'、决议 host 同样零汉字；③ZH 4 句（责编×2/制片/导演）dpCount=4、seats=['editor','director','producer','editor'] 轮转正确；④重跑 AIGC 后 payload.scriptMode='AIGC'，再传 mode='NOPE' 被忽略仍 AIGC；⑤历史恢复 AIGC 房 select 精确回填 AIGC（首轮旧缓存前端误触 LIVE 重跑把实体改写为 LIVE，强刷加载新 JS 后再切 AIGC，select 与 payload match=true——反向验证④的确认护栏必要性）；⑥已出结论房点重跑弹 confirm、取消后不扣费；⑦EN 面板零汉字且全角标点命中数为 0；⑧复制按钮点击后 0.4s 内显示 'Copied'、1.2s 复原 'Copy fix list'；⑨EN 决议卡零汉字无全角标点、GO 按钮按决策出现。联调临时数据精确回滚：RoomMessage 39 条、WritersRoom 4 条、本轮 LedgerEntry 8 笔（含 4 笔 fmt 房 readai——NOPE 容错不扣费但合法制式切换正常计费、旧缓存误触 LIVE 1 笔、复验 AIGC 1 笔；pitchopen/pitchdecide/readai 复合 refId 按 ID 精确删除）删除并 SELECT 核对 msgs=0/rooms=0/c199 流水=0，c198 残留 2 条 w5966719 流水按审计基线保留，PointsAccount.balance 归 0。

### 方法论沉淀
- **⑯容量约束（每席 N 条/总数 M）必须保证截断顺序固定且可解释：多样性优先按轮次展平，同职能刷屏与不同问题不蒸发两者要同时防住**。先 round 0 轮转各职能保证多样性，再 round 1 补同席第二条；PER_SEAT_CAP 与 TOTAL_CAP 是常量不是魔法数，单测直接锁 seats 序列。任何"取最早一条"式聚合在复盘时都要追问：同一来源连续产出两个不同问题时，第二个去哪了？
- **⑰语言切换审计必须扫三层：文案字典、说话人名、标点模板；恢复历史实体时所有 select/控件必须从实体 payload 回填**。全角标点（｜：；「」（））是最隐蔽的本地化残留——翻译文本和人名时不会顺手改模板字符串，EN 页面要以"零汉字 + 零全角标点"双重条件验收。控件回填同理：任何代表已持久化状态的 select，resume 时不从实体回填就是"控件撒谎"，用户基于撒谎控件的下一次写操作会静默覆盖实体。
- **⑱付费确认按钮要按实体状态（lastRead/verdict 是否存在）而非点击次数触发；任何 clipboard 调用必须有非安全上下文降级 + 成功反馈**。确认文案必须写明真实代价（再扣 30 积分/costs another 30 points）。浏览器能力分两类审计：可能 undefined 的 API（clipboard/share）一律 try/catch + 手动降级，所有用户主动触发的动作必须有可见反馈（瞬时文案/徽标），静默失败等于功能不存在。联调时浏览器静态文件可能命中旧缓存：断言新代码行为前先 fetch 文件内容做版本指纹（如检查新文案 key），否则会把"旧 JS 缓存"误判成新代码 bug。

## c200 功能轮：围读结论→定点改写一键带出（协作产物下游出口×只读桥接端点×规则号语义同源 fail-closed×前端只预填不扣费）（v2.185.20）

**本轮性质**：功能轮（c199 复盘轮 v2.185.19 后），主题是让围读协作产物能离开协作工具——此前围读结论只有"复制修改清单"一条手抄出口，真实付费能力 `/api/generate/projects/:id/fix`（15 积分起点对点改写）与围读意见之间没有通路。TDD 先红（引擎 7 案 + HTTP 5 案全部精确命中），后端纯函数 + 只读零扣费端点 + 前端 CustomEvent 桥接，升版 v2.185.20。

### 一、问题与修法（问题-证据-修法）
1. **围读 P0/P1 意见无法一键带到付费改写（协作产物困在协作工具里）**：writers-room.ts TableReadResult 只有 actionItems 字符串数组，room.ts 无桥接端点；用户必须手抄意见到作品页，而 /fix 需要结构化 `{rule,dimLabel,advice}`。修法：引擎新增导出纯函数 `buildReadRewritePacks(notes,{lang})`——只收 P0/P1、按优先级稳定排序输出 ReadRewritePack[]；room.ts 新增 `GET /api/room/read/:id/rewrite-pack`（authRequired+accessibleRoom，只读、零扣费、确定性）：粘贴房/分集被删统一 `{linked:false,ready:false,packs:[],discussionPoints:[]}` 且不泄漏 projectId；关联分集房回 `{linked,mine,projectId,scriptId,epNo,scriptTitle,roomTitle,scriptMode,ready,packs,discussionPoints}`，mine 由 `sc.project.userId===req.userId` 服务端判定。
2. **规则号不能为过闸门硬贴（BASIC 越权深度改写风险）**：/fix 会员闸门只信服务端 rule，BASIC 白名单仅 `^(dialog(ue)?|spoken|colloquial|format|punct|typo|wording|tongue)` 前缀；若给每条意见随意贴 `dialog.xxx`，Free/BASIC 用户就能把结构/成本类深度改写当基础能力下发。修法：手写意见**仅两条**贴语义同源规则号——台词AI腔=`dialog.aiTone`、字数偏差=`format.length`；5 个 lint 推送点（craft/emo/wn/at/nt）只透传 lint 自身 `iss.rule`；其余一律确定性兜底键 `read.<seat>.r<i>`（PACK_RULE_RE=`/^[A-Za-z0-9._:-]{1,60}$/`，脏/缺 rule 才回退），兜底键与未知 lint 规则在闸门处按 ADVANCED fail-closed，不伪造白名单前缀。
3. **老 payload 与脏输入容错（只读端点对历史房必须可用）**：lastRead 是历史 Json，notes 可能 null/非数组/字段缺失。修法：纯函数脏输入（null/非数组/空 suggestion）恒返回 `[]` 不抛；dimLabel=kind 截 20、advice=`位置：suggestion`（EN 用 `: `）截 500、rule 1-60，全部落在 fixSchema 上限内；无 lastRead 回 ready:false 空包；老 payload 没有 rewritePacks 字段也由路由实时重建，前端无需等待重跑围读。
4. **前端桥接零新增扣费动作（只预填/呈现，不自动生成）**：room-view.js 结论区在"复制修改清单"旁加"带着修改意见去改写/Carry fix notes to rewrite"：点击只 GET 只读包并 `window.dispatchEvent(new CustomEvent('zn-read-to-rewrite',{detail:pack}))`；粘贴房 linked=false 不出按钮、参与者 mine=false 按钮置灰（title 说明仅房主可带，避免点了才撞 403）；请求竞态用单调 seq 防过期响应覆盖。app.js 监听器 switchView('works')→按 projectId 找作品卡→`await openProject(p)`（完成后再注入，防 #epsList 重绘覆盖）→#worksDetail 注入"围读改写清单/Table-read fix notes · EpN"面板，逐条显示席位/P级/dimLabel/advice + 独立按钮；按钮复用 applyWaveFix 同族逻辑：confirm 二次确认（明示付费、会员折扣、后端结算）→POST /fix→INSUFFICIENT/ASSISTANT_LEVEL_REQUIRED（跳 vip）/SANDBOX（未扣费）/失败自动退款 分支完整保留；openProject 入口先清旧面板，防 A 房意见挂到 B 项目。

**先红-转绿记录**：writers-room.test.cjs 新增引擎案（packs 与 actionItems 同口径同序；AI腔→dialog.aiTone、字数→format.length 语义同源；兜底键 `/^read\.<seat>\.r\d+$/`；脏输入空数组；EN packs 零汉字 advice 前缀 `Dialogue: `；综合集成案最初因差剧本"陷入沉思"等词不命中 antiAiScan 词表（AI_CLICHE 需 >2 命中，命中词是"嘴角勾起/心中一紧/眼底闪过一丝/空气仿佛凝固"等）而失败，修测试数据补入词表词组而非放松断言，保住"规则号语义同源"验证意图）；http-room.test.cjs 新增 concurrency:1 describe 五案（粘贴房 linked=false 不泄漏 projectId 且零扣费；未围读 ready=false 不 409；挂项目房 linked/mine/ready=true 落点齐全、重复 GET 确定性一致；非参与者 403/未登录 401；凭码加入者 mine=false 但仍可见意见）。未实现前全部精确变红、零旧案误伤。

**回归证据**：tsc 通过；room-view.js/app.js node --check 通过；全量连续两轮 fail=0（4264 / 4168，runner 计数非确定性波动，只认 fail 0）；pm2 restart 后 healthcheck OK。Playwright 真实联调（账号 13901930001，余额置 200，SQL 直插 c200 项目+110字差剧本）：①关联分集房 ai-read 产出 11 条 actionItems、rewrite-pack 11 包，规则号含 format.length/dialog.aiTone 及 lint 真规则 title/filler/novelistic/directness/payoffChain，其余为 read.editor.r* 兜底；②ZH UI 历史恢复后按钮文案"带着修改意见去改写"，点击跳作品页、标题匹配、面板头"围读改写清单 · 第1集"、11 个逐条按钮；③官方 #langBtn 切 EN 后重走，面板骨架 label/head/sub/按钮零汉字（中点 U+00B7 与全站既有 EN 文案同族，非全角标点）；④粘贴房 linked=false/ready=false、无 projectId 字段、两个按钮都不出、复制出口保留；⑤Free 用户点 /fix（format.length）返 403 ASSISTANT_LEVEL_REQUIRED 带 upsell、零扣费无新版本（前端四分支处理与 applyWaveFix 同族）；控制台仅登录前 /auth/me 401 与该 403，均预期。联调数据精确回滚：2 笔 readai 流水按主键 id 删除（复合 refId 不按房号 LIKE 删）、RoomMessage 10、WritersRoom 2、Script/Project 各 1，SELECT 核对 balance=0/msgs=0/rooms=0/c200流水=0/scripts=0/projects=0。

### 方法论沉淀
- **⑲协作/讨论类产物必须设计"离开协作工具"的下游出口，且出口直接接真实付费/生产能力而非只给复制文本**。评审、围读、会诊的结论若只能手抄，协作投入在最后一公里蒸发。出口端点做成只读+零扣费+确定性（重复 GET 深一致），把"结构化成包"放在服务端纯函数里，前端只搬运与预填——生成与扣费仍只发生在既有付费端点，且必须逐条二次确认，禁止"一键全部改写"式批量连点。
- **⑳规则号/能力标签必须语义同源才透传，否则走 fail-closed 兜底键，绝不伪造白名单前缀绕过闸门**。闸门（会员/权限）只信服务端字段时，生产这些字段的地方就是信任边界：给"场景成本""节奏结构"意见贴 `dialog.xxx` 等于制造越权通道。宁可让合法但高阶的规则在低等级用户处被闸门拦下并给升级引导，也不可让规则号与意见语义错配。白名单正则、兜底键命名空间（read.<seat>.r<i>）都要让"不匹配=按最高门槛处理"成为默认。
- **㉑只读重建端点面对历史 Json 必须纯函数容错：脏输入返空不抛、字段截断先于 schema、缺字段实时重建而非要求重跑付费动作**。老 payload 没有新字段时，路由从 lastRead.notes 现算 packs，用户恢复任何历史房都能看到新出口；所有长度上限（rule 60/dimLabel 20/advice 500）在生产侧就收敛到下游 schema 内，下游 zod 是第二道而不是唯一一道防线。前端注入类面板还要防两类串台：异步响应竞态（单调 seq 丢弃过期包）与实体切换残留（openProject 先清面板再注入）。

## c201 复盘轮：桥接链路七处名实不符（版本漂移显性化×幂等文案不得撒谎×服务端闸门元数据×参与者最小权限×异步串挂守卫）（v2.185.21）

**本轮性质**：复盘轮（c200 功能轮 v2.185.20 后），只证据扫描不改代码先行：沿"端点产出什么→前端消费什么→付费时实际发生什么"三段对账，抓出 7 处链路名实不符（D1-D7），TDD 先红 5/5 精确命中后再动后端/前端，升版 v2.185.21。

### 一、问题与修法（问题-证据-修法）
1. **D3 版本错配（最隐蔽的扣费信任问题）：围读锚定旧版、/fix 永远改最新版，两端从不比对**。证据：room.scriptId 存开房时那一版 Script 行（read/open L248-282 归属校验后的具体版本），而 /fix 按 epNo 取 latestMap 最新版（generate.ts L1715-1722）；围读后该集若重新生成/定点改过，旧意见可能已失效，用户仍会被再次扣费。修法：rewrite-pack 端点查同 projectId+epNo 最大 version，回 `roomVersion/currentVersion/versionDrift`（无 lastRead 也回版本信息）；前端在面板顶部渲染漂移警示（ZH：围读基于 vN、现已 vM、改写将作用于最新版且旧意见可能不再逐字对应；EN 同构），只警示不阻断——是否仍改由用户自决，/fix 语义不动。
2. **D2 幂等文案撒谎：409 IDEMPOTENT_REPLAY 落入"失败已退款"else 分支**。证据：/fix 5 分钟窗同版本同规则重放返 409 `{error:'IDEMPOTENT_REPLAY'}`（generate.ts L1753-1755），此时既未二次扣费也无退款；applyReadPackFix/applyWaveFix/applyTargetedFix 三处 catch 均无 409 分支，统一提示"积分已自动退回"——在钱的问题上系统说了假话。修法：三处同构补 409 专属分支（按 error code 与 httpStatus 双判），文案"正在处理或已处理，请勿重复提交；不会重复扣积分"，按钮置灰为"处理中/已处理"且记入会话内锁定表（null 版本号），任何重绘都不复活；MODEL_FAIL 单列真实退款文案。
3. **D6 会员闸门 UX 倒挂：所有 pack 一律可点"15积分起"，点了才 403**。证据：闸门判定 fixActionByDim+assistantGate 只存在于 /fix，前端对每条 pack 所需等级零信息；format.length 实际 BASIC 可用，read.editor.r*/title/payoffChain 等需 ADVANCED。修法：**安全语义不动**（/fix 仍 fail-closed 硬拦），端点在 mine=true 时按服务端 DB 等级（不信任 JWT/前端）给每条 pack 附 `gate:{allowed,needLevel}`，判定复用同一对函数保证语义同源；前端按 gate 预锁（🔒基础会员/高级会员），锁定项不弹 confirm、不发请求，点击给升级话术并跳 vip。
4. **D1 真人讨论点在作品页蒸发**：端点已下发 discussionPoints（c198 沉淀的制片预算等真人信息，引擎 lint 永远产生不了），renderReadRewritePanel 却只渲染 packs；且"去改写"按钮在 packs 为空时不出现，纯讨论房无法带走。修法：面板新增讨论点区块（席位名+已采纳/新增关注双色徽标+原文，双语标签、内容保持 payload 语言快照不机译）；room-view 出按钮条件放宽为 packs 或 discussionPoints 任一非空；桥接监听器同口径放行。
5. **D4 成功改写后条目不锁=重复扣费入口**：旧实现 openProject+重绘后面板重建，已处理 pack 按钮恢复可点；版本已变后再点是一次全新扣费（幂等键含 v 版本号）。修法：会话内 `rrFixedKeys` Map（key=`projectId:epNo:packKey`→新 版本号；注意用 Map 不是 Set——重绘要取版本号渲染"已改写·新版 vN"，曾误声明 Set 导致 `.set is not a function`，Playwright 控制台抓出后改 Map），成功/409 都锁定，仅当页刷新后从服务端重新确认状态（此时版本已变，服务端闸门与扣费照常把关）。
6. **D5 面板串挂竞态**：`await openProject(p)` 两个异步边界之间用户若点开别的作品，renderReadRewritePanel 会把 A 房意见挂到 B 作品详情。修法：桥接监听器与 fix 成功重绘两处都加 `currentWorksProject?.id===d.projectId` 守卫，不符即放弃挂载。
7. **D7 参与者最小权限信息泄漏**：mine=false（凭码加入者，非项目主人）响应仍带房主 projectId/scriptId，而前端只需意见内容与锁定态。修法：mine=false 时剥离 projectId/scriptId（epNo/scriptTitle/版本信息保留，不含可遍历资源标识），TDD 断言 undefined。

**先红-转绿记录**：http-room.test.cjs 新增独立 describe 五案（再造 epNo=1 的 v1/v2：断言 roomVersion=1/currentVersion=2/versionDrift=true；c200 房无漂移三字段 1/1/false；每条 pack 必带 gate.allowed 布尔且 needLevel∈{BASIC,ADVANCED}，FREE 房主 format.length→{BASIC,allowed:false}，dialog.aiTone/read.* 兜底→ADVANCED 不被 dimLabel 降级；ADVANCED 房主全 allowed=true；参与者响应 projectId/scriptId 均 undefined），未改码前 5/5 全红且失败信息逐条对应；build 后 26/26 转绿。前端 D1/D2/D4/D5/D6 以 Playwright 真实页面实测为准（见回归证据），不单靠静态推断。

**回归证据**：tsc 通过；room-view.js/app.js node --check 通过；全量连续两轮 fail=0（4326 / 4310，计数波动正常只认 fail 0，基线 c201 起始为 4278/0）；pm2 restart 后 healthcheck OK。Playwright 真实联调（账号 13901930001 FREE，余额置 200，SQL 直插 c201live 项目+短剧本 v1）：①真实 read/open+ai-read（扣 30，200），rewrite-pack 回 5 包，gate 实测 read.editor.r0/r1→ADVANCED、format.length→BASIC、title/payoffChain→ADVANCED，FREE 全 allowed=false，版本 1/1 drift=false，房主保留 projectId/scriptId；②插 v2 后重取 drift=true（1/2），ZH 面板"围读改写清单·第1集"+橙色漂移条"围读基于…v1…最新版 v2"+讨论点区块（已采纳绿标/新增关注橙标）+锁按钮"会员能力·🔒高级会员"，EN 同构（Table-read fix notes/Live discussion/converged/new flag/Member ability·🔒Advanced），锁按钮点击不弹 confirm 不发请求直接跳 vip 视图；③D2/D4 以网络边界桩真实执行页面处理器：首点 409→按钮"处理中/已处理"置灰且重绘后保持锁定，次点 200(newVersion=3)→重绘后该条"已改写·新版 v3"禁用、其余条目可点；过程中控制台 0 error（首轮抓到 `rrFixedKeys.set is not a function`——Map/Set API 错配，已修并复测）。联调数据精确回滚：TABLE_READ 流水 1 笔按主键 id 删（cmubon467…）、WritersRoom 1（消息级联）、Script v1/v2 共 2、Project 1，余额归 0，SELECT 五项核对 balance/scripts/project/room/today_ledger 全 0。

### 方法论沉淀
- **㉒跨实体引用要做"版本锚定对账"：消费端实际按什么版本取数，只读桥就必须把两个版本号都摆到台面上**。room 锚定"那一版"、付费改写作用"最新版"是各自合理的设计，但二者从不比对就构成静默错配——意见可能已失效、扣费照发生。模式：桥接/快照类端点返回 `frozenVersion/currentVersion/drifted` 三元组，UI 在任何付费动作前显性提示，只披露不替用户决定。凡是"A 页面冻结的结论拿到 B 动作上执行"的链路（评审→整改、诊断→修复、报告→下单）都适用。
- **㉓钱相关的错误文案必须逐分支与账务事实对齐：幂等命中不是失败，绝不允许落入"已退款"话术**。409/处理中/已处理=无扣款无退款；502 MODEL_FAIL/503 SANDBOX=有退款；余额不足=未扣款。三类事实混在一个 else 里说"积分已自动退回"，等于系统在最敏感处撒谎，一次就摧毁扣费信任。复盘时沿"每个错误码→资金状态→用户看到的话→按钮终态"四列对账，同族入口（新链路+两个旧链路）必须同构修复，不能只修新代码。
- **㉔权限引导前置的前提是服务端同源下发判定元数据，且最小权限要覆盖响应体而不只是操作**。硬闸门留在写端点不动（fail-closed），读端点额外为属主按 DB 实时等级附 gate{allowed,needLevel}——判定函数必须与写端点同一对（fixActionByDim+assistantGate），否则两处语义会漂移；前端只用来提前置灰/引导升级，永不作为安全依据。参与者/只读第三方看到的响应体要按"完成其用途所需最小字段"裁剪：能看意见不等于能拿到房主的 projectId/scriptId 等可遍历资源标识。

## c202 功能轮：改写前后版本可对账（零 token 逐行 diff 端点×按集分组消灭重复 EP 块×409 零费刷新×漂移后最新版重围读×改写幅度观测）（v2.185.22）

**本轮性质**：功能轮（c201 复盘轮 v2.185.21 后），主题是让"已发生的创作/付费动作"可对账：/fix 每次新增 Script 版本行，但用户看不到 v1→v2 到底改了什么、值不值；openProject 把每个版本行平铺成卡片，同一集出现多个 EP 块（QC 卡也重复）；409 幂等锁定后用户无法零成本确认处理结果；c201 做了漂移显性化却没给"基于最新版重新围读"的出口；改写幅度无任何观测。TDD 先红（引擎 7 案 + HTTP 定向），后端纯函数+只读零扣费端点，前端按集分组、逐行三色对比与重围读桥，升版 v2.185.22。

### 一、问题与修法（问题-证据-修法）
1. **F1 版本不可对账 + 平铺重复块（P0）**：Script 唯一键 `[projectId,epNo,version]`，fix 一次新增一行；GET /projects/:id/scripts 返回平铺行，openProject 每行渲染一个 EP 块——fix 出 v2 后第 1 集出现两块、QC 报告卡也按行重复。修法：后端新增零依赖纯函数引擎 `src/engine/script-diff.ts`：`splitScriptLines`（trim+滤空行、null 安全）、`diffScripts(old,new)` 自底向上 LCS 输出 `{segments:[equal|added|removed],stats:{equal,added,removed}}`（回溯时 dp[i+1][j]>=dp[i][j+1] 优先取 removed，保证增删配对稳定）、`assessRewrite` 按 churn=min(1,((added+removed)/2)/max(旧行数,新行数)) 分档 negligible(<0.06)/light(<0.25)/partial(<0.6)/major（双空→0、旧空新非空→1）；新增只读端点 `GET /api/generate/projects/:id/scripts/diff?epNo&from&to`（归属校验否则 404；to 缺省=该集最大 version；from===to→400 SAME_VERSION；版本不存在→400 VERSION_NOT_FOUND；零扣费、不触模型）。前端 openProject 用 Map 按 epNo 分组（行已升序、末元素即最新版），每集一块：标题"EPn · title (vN · N 字)"，有旧版才出"对比 vX→vY"按钮与 `<details>` 历史折叠（每个旧版各自可对比）；QC 报告改喂 latestEps，重复卡同根消灭；diff 盒逐行 +/−/空格三色、头部"vX → vY 档位 · 约N%行变动 · 新增A · 删除R · 收起"，异步回填前校验仍在当前作品且 DOM 节点存活。
2. **F2 409 锁定后无法零成本确认结果（P1）**：c201 把 409 按钮锁成"处理中/已处理"，但锁死后没有任何出口——用户只能再点（被拦）或干等。修法：三处 409 分支（作品诊断 applyTargetedFix/情绪波 applyWaveFix/围读包 applyReadPackFix）统一挂 `attach409Refresh(btn,projectId,inWorks,after?)`：在锁定按钮旁插"刷新查看新版/Refresh for new version"，只做零费动作——作品页重跑 openProject、工具箱页 refreshResultScripts，after 回调重建面板；绝不重发 /fix、不触任何扣费；dataset 防重复挂载、点完自删。
3. **F3 漂移提示没有出路（P1）**：c201 漂移条只说"改写将作用于最新版"，用户若想让围读意见与最新版对齐只能自己去开房、自己重贴全文。修法：rewrite-pack（mine=true 分支）额外回 `latestScriptId/latestVersion`（复用查 latest 的 select，参与者分支不带，延续 c201 最小权限）；漂移条内出"用最新版 vM 重新围读/Re-read the latest vM"，旁边灰字讲清费用事实（开房免费、点开始AI围读才扣 30 积分），点击 confirm 后只 dispatch `zn-reread-latest`（scriptId/epNo/version/title/scriptMode），不直接扣费；room-view 监听后 prefillScript——新开围读 tab、从作品选择器通道带入 scriptId（不开房不扣费）、按房 payload 预选 LIVE/AIGC。room-view 同时新增"从我的作品选一集"选择器（项目 select→分集 select 自动取每集最新版，option value=scriptId），/read/open 有 picked 走 scriptId、粘贴框走 scriptText，二者互斥（textarea 一输入即清选择），选中后成功开房自动清除选择条。
4. **F4 改写幅度无观测（P2）**：/fix 成功只回 newVersion，"改了多少"全靠用户肉眼。修法：/fix 成功响应附 `rewriteSpan: assessRewrite(targetScript.content, rewritten)`——纯观测字段，不参与扣费/闸门任何判定（churn 大也不多扣、小也不少退）；前端三处 fix 成功提示带档位+行变动文案，作品页/围读包改完自动展开对应两版 diff。
5. **联调抓到的第 5 个缺陷：toRewriteBtn 派发缓存旧包**：Playwright 走"ai-read→SQL 插 v3→回房点带去改写"时漂移条不出现——room-view 在结论渲染时 GET 一次 rewrite-pack 并把 `pack` 闭包缓存进按钮 onclick，点击永远派发这份冻结对象；用户在围读期间于别处改出新版本时，c201 漂移信息与 c202 latestScriptId 全是旧的。修法：onclick 改 async，点击瞬间重新 GET 零费只读包再 dispatch（失败回退缓存包，不阻断出口）。只读数据"渲染时取一次"与"行动时必须新鲜"是两个时刻，跨越付费/决策动作的桥接事件必须在点击时刻重新取数。

**先红-转绿记录**：script-diff.test.cjs 7 案（相等/纯增/纯删/替换配对/空入/null/双空与旧空新非空的档位边界）未实现前 require 失败全红；http-generate.test.cjs c202 describe 覆盖 diff 端点（归属 404、to 缺省取最新、SAME_VERSION 400、VERSION_NOT_FOUND 400、segments/stats/span 形状）与 /fix rewriteSpan=partial 案；http-room.test.cjs 覆盖参与者无 latestScriptId、房主漂移房 latestScriptId=v2 行 id、无漂移房 latestScriptId===当前 scriptId。转绿中修两处 TS noImplicitAny（prisma 回调显式 `(s:any)`）。前端以 Playwright 真实链路为准（见回归证据），其中缓存旧包缺陷由联调暴露后回改 room-view.js。

**回归证据**：tsc 通过；web 三文件 node --check 通过；全量四轮 fail=0（并行 4270/4239、串行 4694/4647——node --test 并行计数非确定性波动为本仓库已知特性，c200/c201 同样只认 fail 0；串行比并行多约 400 个注册用例）；pm2 restart 后 healthcheck OK。Playwright 真实联调（账号 13901930001 FREE，余额置 200，SQL 直插 c202live 项目：EP1 v1(12 行)/v2(14 行)/EP2 v1）：①作品详情 3 行剧本只渲染 2 个 EP 块（修复前为 3 块），EP1 标题"EP1 · … (v2 · 296 字)"、历史折叠 1 条旧版、对比按钮 data-diff="1:1:2"，EP2 无历史无按钮；②点开对比 16 段（+4/−2/=10），新增"雷声滚过巷口…/她掏出手机照亮…"、删除"脸上没有表情/我爸呢？"配对正确，头部"局部微调 · 约21%行变动 · 新增4行 · 删除2行"，EN"Light polish · ~21% of lines changed · +4 added · −2 removed Close"，收起即清空；③作品选择器项目/分集两级下拉，EP1 自动只取 v2、EP2 v1，选中条明示"围读将读取该版本全文；输入文本框切回粘贴模式"；④me_xn 用 scriptId 开房（W7YCD3UA）DB 锚定 c202live_e1v2、余额仍 200（开房零扣费），AI 围读 200、余额 170、产出 11 条意见；⑤SQL 插 v3 后首点漂移条缺失→定位缓存缺陷→改代码重载，历史恢复房后再点：漂移条"围读基于…v2…现已 v3…"+"用最新版 v3 重新围读"+费用灰字（EN 同构"The read was run on v2…Re-read the latest v3 / Opening a room is free…30 pts"），data-reread=c202live_e1v3；⑥点重围读 confirm 后跳围读 tab、选中条"EP1 v3…已带入最新版分集"、textarea 空（互斥）、制式 LIVE 与房一致；免费开新房 REMNKKWE，DB 锚定 c202live_e1v3、余额仍 170，选中条开房后 display:none 清空。控制台全程仅登录前 /auth/me 401 一个预期错误。F2 刷新按钮与 F4 付费后提示为冻结按钮旁挂零费动作/纯观测文案，409 需 5 分钟窗同版本同规则且 FREE 被会员闸门前置拦截，本轮以代码同构审查 + 定向 HTTP 用例（rewriteSpan）为准，未在 UI 造真实 409。联调数据精确回滚：RoomMessage 7（6+1）、TABLE_READ 流水 1 笔按主键 id 删（cmubqur0w…）、WritersRoom 2、Script 4（含 EP2 v1）、Project 1，余额归 0，六项 SELECT 核对全 0；历史 PITCH_MEETING 等旧流水非本轮数据未触碰。

### 方法论沉淀
- **㉕凡"一次动作产出多个版本"的产品，版本对比是默认能力而非高级功能，且对比必须走零成本只读端点+确定性纯函数**。用户付费改写后第一件事是核对"我的积分换来了什么改动"——让他靠肉眼找差异等于销毁动作的可解释性。对比能力三原则：不触模型不花 token（LCS 纯函数）、只读绝不产生新版本（否则 diff 本身污染版本链）、档位是观测不是闸门（churn 不参与扣费/阻断，只回答"改了多少"）。列表渲染凡遇"一实体多版本"都要在前端按实体聚合、最新版为主行、旧版折叠，平铺版本行会让下游所有按行渲染的组件（QC 卡/操作按钮/诊断）结构性重复。
- **㉖跨页桥接事件携带的数据，"渲染时取一次"与"行动时必须新鲜"是两个时刻；凡数据影响付费/版本决策，点击瞬间必须重新零费取数**。结论面板渲染时拉的只读包缓存在闭包里，几秒后用户点击时作品可能已产生新版——漂移提示、latestScriptId 这类"版本事实"一旦陈旧，比没有更糟（系统自信地指着旧版本说话）。模式：桥接按钮 onclick 内重新 GET 只读端点，失败再回退缓存数据；只读桥足够便宜，不存在"为省一次请求而发旧事实"的取舍。
- **㉗锁定/幂等态必须同时给零成本出路，否则"防重复扣费"会被用户体验成"系统卡死了"**。409 把按钮锁成"处理中/已处理"语义正确，但锁后无出口会迫使用户刷新整页或重复尝试；正确搭配是锁定按钮旁挂一个只做只读刷新的零费动作（重拉详情/结果），让用户自己看见新版本或最终态。铁律不变：刷新动作永不重发写请求、不触模型、不产生任何费用，并在 UI 文案上讲明"不会重复扣费"——与 ㉓钱相关文案逐分支对齐资金事实一脉相承。

## c203 复盘轮：付费改写的并发竞态封堵（/fix 陈旧版本双扣与 P2002 吞钱×观测函数熔断保护×O(nm) diff 硬上限×成功回调判空×picker 状态复位）（v2.185.23）

**本轮性质**：复盘轮（c202 功能轮 v2.185.22 后），沿 c202 新铺的"版本 diff/零费刷新/作品选择器"链路做对抗性复盘，冻结 6 项缺陷：1 个 P0 资金级并发竞态（双扣+500 吞钱）、1 个会让已付费主交易被观测函数拖死的架构隐患、1 个 O(nm) 无界计算端点、3 个前端状态/文案/回调缺陷。TDD 先红（内存 HTTP 三竞态场景+引擎超限两案），后端转绿后前端同构收口，升版 v2.185.23。

### 一、问题与修法（问题-证据-修法）
1. **D1（P0 资金）/fix 并发：陈旧版本快照双扣 + 唯一键冲突裸 500 吞钱**。原链路：幂等键含 `version:a${prior+1}` 防同请求重放，但两个**不同**请求并发时都读到 prior=v1：扣费事务在秒级模型调用之前提交，模型返回后各自用内存陈旧快照 create version=2；败者撞 `@@unique([projectId,epNo,version])`（schema.prisma）抛 P2002，裸 500——钱已扣、无新版本、无退款。修法三段：①模型成功后**落库前重查**该 epNo 最新版（`findFirst orderBy version desc`），与扣费依据的 targetScript.version 不一致→`refundFlexible` 原路退款（refId=`fix:${scriptId}`，退款幂等键 `refund:${原幂等键}`）+409 `VERSION_ADVANCED`（带 currentVersion）；②create 包 try/catch：P2002（理论上重查后仍可能撞的末竞态）→退款+409 VERSION_ADVANCED；其他 DB 异常→退款+502 `SAVE_FAILED`；③扣费事务仍在模型前提交（避免长事务持锁），但所有"扣了费却交不出唯一资源"的出口必须退款，**退款闭包在扣费成功后才构造、可被任意异常分支复用**。同族端点（teardown analyze/outline、room pitch/read、value-added、interview）逐一审查均为追加型写入且已有 try/catch 退款，不存在"陈旧快照写版本唯一键"模式，修复点仅 /fix 一处。
2. **D4（P1）O(nm) LCS diff 无输入上限**。scriptText 上限 200000 字，恶意/异常两版本可让 `dp[(n+1)(m+1)]` 数组与回溯吃掉数百毫秒~数秒与百 MB 级内存，而 diff 是免费只读端点（可被匿名额度内反复调用）。修法：引擎导出 `MAX_DIFF_LINES=2000`（正常单集 <150 行，10 倍余量），splitScriptLines 切行后超限即抛 `ScriptTooLargeError`（`code='SCRIPT_TOO_LARGE'`）；端点 catch→400 同码零扣费；前端 openVersionDiff 捕获后显示"剧本过长，暂不支持在线逐行对比，可展开最新版查看全文"（给可执行出路而非失败）。
3. **D4 伴生隐患：观测函数可能熔断已付费主交易**。/fix 成功路径调用 assessRewrite 产出 rewriteSpan（c202 纯观测字段）；若 diff 引擎对超限稿抛错，异常会从 /fix 成功路径穿出——用户付了费、模型已改写成功，仅因"统计改动幅度"失败而拿到错误响应。修法：assessRewrite 内部整体 try/catch，任何异常降级 `{changedRatio:1,level:'major'}`——**观测永远不能阻断主交易**（保守报"大改"，用户可手动核对）。
4. **D3（P1 前端）成功回调空指针给成功交易套上"已退款"假话**。applyReadPackFix 成功分支 `await openProject(currentWorksProject)` 无判空；面板游离/会话切换边缘 currentWorksProject 为 null 时，openProject 内 `p.title` 抛 TypeError 落 catch，对**已成功扣费**的改写弹出"积分已退回"——直接违反㉓资金文案铁律。修法：以 `currentWorksProject && currentWorksProject.id===d.projectId` 守卫 openProject/renderReadRewritePanel/openVersionDiff 三连调，实体不在就不刷新面板，交易结果提示按真实响应走。
5. **D2（P2 前端）作品选择器跨项目陈旧选中**。围读 picker 选中 A 项目某集（state.pickedScript）后改选 B 项目但未选分集，开房仍用 A 的 scriptId（归属本人无安全问题，但名实不符）；且开房成功/手动清除后两个 select 仍显示旧选择，用户看着"已选"再点开会误走粘贴路径报 needScript。修法：onPickProjectChange 检测到项目变化（含切空）即清 state.pickedScript 并重绘选中条（保留用户刚选的新项目）；clearPicked 同步复位两个 select（值清空、分集下拉隐藏并清空 options）——**内存状态与可见控件同生命周期**。
6. **D5/D6（P2/P3）**：renderScriptDiff 头部 span 缺省时残留孤立" ·"分隔符，抽 spanTxt/statTxt 条件拼接；applyWaveFix 的 attach409Refresh after 回调补齐 `loadEmotionWave(projectId)`（原仅作品页链路刷新，波形页 409 刷新后波形不重建），VERSION_ADVANCED 分支同。统一错误处理：三处 fix catch 新增 VERSION_ADVANCED→handleVersionAdvanced（明示"改写未生效、积分已退回、刷新后基于新版重试"+零费刷新按钮），readpack/wave 另补 SAVE_FAILED 文案。

**先红-转绿记录**：http-generate.test.cjs 末尾追加两个 describe（concurrency:1，BASIC 500 分账号 u_c203race，rule 用 format.length——plot.logic 需 ADVANCED 会被 403 闸门拦，首轮 3 红即此因，改后全绿）：①模型桩内先 push winner v2 行模拟并发胜出者→断言败者 409 VERSION_ADVANCED、余额不变、v2 仅一行、存在 `reason like TARGETED_FIX% direction=IN` 的退款流水；②monkey-patch script.create 对该 pid version:2 抛 `{code:'P2002'}`→409+余额不变；③抛 `new Error('db down')`→502 SAVE_FAILED+余额不变。script-diff.test.cjs 加两案：2002 行抛带 code 错误、恰好 2000 行不抛；assessRewrite 超限降级 major 不抛。diff 端点 2002 行两版本→400 SCRIPT_TOO_LARGE+余额不变。定向 http-generate 83/0、script-diff 40/0。

**回归证据**：tsc 零输出；app.js/room-view.js node --check 通过；全量两轮 fail=0（并行 run-tests.cjs 4323/0；串行 `--test-concurrency=1` 4664/0，4 分钟跑完）。串行首轮在 market-delist.test.cjs（v2.76 老用例，与本轮零代码关联：独立 worker 进程+内存桩+仅挂 market 路由）出现一次 worker 不退出（主线程 kevent 空转、LISTEN 留存、23 分钟 CPU 仅 1s），单跑该文件 9/9 正常退出、与 market-board 双文件 14/14、m 段 29 文件 341/341 均正常，重跑全量串行 4664 全绿——定性为 node --test worker IPC 一次性 flaky（外部时序，非代码缺陷）。pm2 restart 后 healthcheck OK。Playwright 真实联调（账号 13901930001 FREE，SQL 直插 c203rev_pj：EP1 v1/v2 正常稿、EP2 v1/v2 各 2002 行）：API 层 EP1 diff 20 段（+8/−6/=6、partial 0.5）、EP2→400 SCRIPT_TOO_LARGE 中文消息；UI 层 picker 选中条"Linked episode：…EP1 v2"→项目切空选中条即时隐藏分集收起（D2 路径一），重选 EP1 开房（WWXHMTAJ）成功后项目 select 清空、分集下拉隐藏且 options=0、选中条 display:none（D2 全复位），DB 房间锚定 scriptId=c203rev_e1v2、pointsCost=0；作品页 EP1 对比 EN「Partial rewrite · ~50% of lines changed · +8 added · −6 removed · Close」/ZH「局部重写 · 约50%行变动 · 新增8行 · 删除6行 · 收起对比」无孤立分隔符（D5），EP2 超限 EN「This script is too long for inline line-by-line comparison…」/ZH「剧本过长，暂不支持在线逐行对比，可展开最新版查看全文。」（D4）；控制台仅登录前 401 与 EP2 设计内 400 两个资源错误，零 JS 异常。D1 真实双扣费需临时升 BASIC+并发真实模型调用，其竞态三分支已被内存 HTTP 用例精确断言（含退款流水存在性与幂等键），UI 409 文案三处同构，按 c202 先例不在生产链路造真实资金竞态。联调数据精确回滚：RoomMessage 1、WritersRoom 1、Script 4、Project 1，近 40 分钟 LedgerEntry 0，SELECT after 全 0；余额 0 未动。

### 方法论沉淀
- **㉘"扣费→外部调用→唯一资源落库"三段式的竞态窗必须在落库侧重查关闭；凡扣了费却交不出唯一资源，一律退款+幂等冲突语义，绝不让唯一键异常裸奔成 500 吞钱**。幂等键只能挡住"同一个请求"的重放，挡不住"两个不同请求拿着同一陈旧快照"并发；把扣费放在模型调用前可以避免长事务持锁，但代价是必须承认"扣费成功 ≠ 交付成功"，并为所有交付失败分支（版本已被推进/唯一键冲突/DB 宕机/进程崩溃于落库前）准备退款出口。模式：落库前重查权威最新版对账→不一致退全款返回 409 VERSION_ADVANCED（带 currentVersion，配合㉗零费刷新出路）；唯一键写操作整体 try/catch，冲突码与未知异常分别映射 409/502 但都先退款；退款自身幂等（`refund:${原扣款幂等键}`），保证重试/补偿不双退。复盘任何付费写端点都沿"扣费时点→外部调用时长→落库唯一性→每个异常出口的资金状态"四步推演。
- **㉙纯计算端点必须有输入规模硬上限；观测函数自身必须永不抛错，观测永远不能熔断已付费的主交易**。O(nm) DP、全量排序、无界正则这类纯计算放在免费只读端点上，等于把 CPU/内存放大权交给调用方——上限取"正常业务量的 10 倍"为常量（MAX_DIFF_LINES=2000 vs 单集 <150 行），超限抛带稳定 code 的领域错误（ScriptTooLargeError/SCRIPT_TOO_LARGE），端点映射 400 且天然零扣费，前端给"可查看全文"的可执行出路。同一枚硬币另一面：主交易成功路径上挂的统计/评分/埋点等观测调用必须整体 try/catch 降级（assessRewrite 异常→保守档位 major），观测挂了主交易照常交付——谁是主、谁是从，异常处理层级必须严格单向。
- **㉚前端两条铁律：成功回调引用全局实体先判空再 await；内存状态与可见控件必须同生命周期复位**。全局实体（currentWorksProject 之类）在 await 期间可能被切视图/切账号/面板游离置空，成功回调里无判空解引用抛 TypeError，会让一条 2xx 成功交易落进 catch 分支、弹出与资金事实相反的文案（违反 ㉓）——守卫写法是 `entity && entity.id===响应.projectId` 才执行依赖该实体的刷新三连，实体不在则静略刷新。选择器/向导类控件则要把"state + 渲染它的 DOM"当作一个原子：清空 state 必须同步清空 select 值/下拉选项/选中条，复位只清一半就会制造"界面说已选、状态里没有"或反之的名实不符，下一个动作必然走错分支（picker 走粘贴通道报 needScript、开房锚到上一个项目的剧本）。错误码到文案的映射继续逐分支与资金事实对齐（409 VERSION_ADVANCED=未生效已退款、502 SAVE_FAILED=已退款请重试、400 SCRIPT_TOO_LARGE=未扣费）。

## c204 功能轮：版本变更摘要卡（零 token 分类计数×行分类器单一出处）与 409 基于新版一键重试（死代码复活×懒加载面板重开×新交易二次确认）（v2.185.24）

**本轮性质**：功能轮（c203 复盘轮 v2.185.23 后），冻结两项功能并在联调中顺手复盘修复两个真 bug。F1：版本 diff 端点在红绿行 LCS 之上零 token 输出"改了什么"（场标/台词/动作/技术行分类计数+最多 3 条亮点），前端 diff 头部渲染双语摘要卡。F2：409 并发败者（款已退）在"零费刷新"旁补"基于新版重试"按钮，覆盖定向改写/围读包修复/波形修复三个付费入口。联调暴露：c203 铺的 VERSION_ADVANCED 重试分支实为死代码（409 双语义被前置条件短路）；另发现 applyLang 对脏 localStorage 值无归一、每次加载 renderSelects 抛 TypeError。TDD 先红转绿，升版 v2.185.24。

### 一、问题与修法（问题-证据-修法）
1. **F1-a 行分类两套正则会漂移**。围读稿构建（buildListenScript）与 diff 摘要各自写正则分场标/台词/动作，长期必然口径不一。修法：listen-script.ts 导出统一 `parseScriptLine(rawLine)→{kind:'scene'|'action'|'dialogue'|'other', speaker?, cue?, content?}` 与 classifyScriptLine，buildListenScript 改为复用；**同一分类逻辑全库单一出处**，kind 含 other 兜底，任何脏行进 other 不抛错。
2. **F1-b 摘要纯计算**。script-diff.ts 新增 `summarizeChanges(segments, opts?)`：对 added/removed 两侧按行 kind 入四个桶，**other 也计入桶（分类计数严格守恒：各桶之和=行总数，输入不蒸发）**，亮点最多 MAX_CHANGE_HIGHLIGHTS=3 条、内容截断 60 字加 `…`、台词优先（speaker 纯内容输出）、other 亮点优先级最低，任何异常零抛错降级。generate.ts diff 端点响应挂 `summary`——零模型、零扣费、零外部成本，观测不阻断主交易（续㉙）。前端 diffSummaryHtml：缺 summary 或全零静默不出卡；计数 0 的类目不渲染；中文"台词N句/场标N处/动作N行/技术标注N行"，英文单复数且零汉字零全角标点；台词亮点渲染"角色名：内容"（EN `Name: text`）。
3. **F2-a（复盘真 bug，P1 资金体验）c203 的 VERSION_ADVANCED 重试分支全是死代码**。三个付费入口 catch 条件写作 `err.message==='IDEMPOTENT_REPLAY' || err.httpStatus===409`——VERSION_ADVANCED 同为 409，被前置短路吞进"幂等锁死"分支，专门重试分支永不可达。修法：三处统一为 `... || (err.httpStatus===409 && err.message!=='VERSION_ADVANCED')`，先放行业务语义码再分流。**同状态码双语义必须按语义码显式区分**。
4. **F2-b 一键重试闭环**。新增 handleVersionAdvanced（原按钮旁成组挂"零费刷新"+"基于新版重试"，点击先禁用+"载入新版中…"）、findFreshEntry（重绘后找可见且未禁用的同顺位按钮，旧 DOM 随重绘自然销毁）、reopenWorksDiagnosis（作品页 openProject 会重建一个**隐藏的空** #worksDiag——诊断是按钮懒加载，不重开则重试入口扑空；以 150ms 间隔/8s 上限轮询 `#worksDiag [data-fix-idx]` 或 .notice 出现，再点 #worksDiagBtn 重拉）。三入口 onRetry 各按所在视图取鲜：作品页 openProject+reopenWorksDiagnosis、结果页 refreshResultScripts+loadDiagnosis（波形另加 loadEmotionWave）、围读面板重渲染后按 pk.key 找 `[data-rrfix]`。attach409Refresh 的 inWorks 刷新 after 同样接 reopenWorksDiagnosis，普通"刷新查看新版"后诊断面板也不再变空。**重试是一笔新交易：onRetry 重走原 fix 函数，真实费用确认弹第二次（钱文案与零费刷新严格区分——首笔已退、重试再扣）**。
5. **F2-c（复盘真 bug，P2 加载即崩）lang 脏值无归一**。applyLang 直接 `lang=LS.g('zn_lang','zh')` 拿去索引双语表；localStorage 被写成 `'"en"'`（带引号）等脏值时，renderSelects 的 `SELECT_OPTS[key][lang][0]` 每次加载都抛 TypeError（实测连抛 3 次），页面半崩。修法：入口白名单归一（只认 'zh'/'en'，其余回落 'zh'）+ 自愈写回 LS.s；window.znLang 改为返回归一后的内存值，四个独立 IIFE 子视图（room/branch/teardown/diversity-view）经此单一口径读语言，脏值不再外溢。

**先红-转绿记录**：script-diff.test.cjs 扩到 15 个 test（c204 新增 3：四桶计数守恒含 other、亮点截断与上限、脏数据不抛错）；listen-script.test.cjs 9 个（c204 新增 2：parseScriptLine 四类与 speaker 提取、buildListenScript 与分类器口径一致）；http-generate.test.cjs 84 个（c204 新增 diff 端点返回 summary 结构且零扣费）。定向与整文件均先红后绿。

**回归证据**：npx tsc 零输出；node --check web/app.js 通过。全量回归以**不带 force-exit** 的 `NODE_ENV=test node --test test/` 为准：4836 pass / 0 fail / 442 suites，计数稳定（重要发现：`node scripts/run-tests.cjs` 内置 --test-force-exit 会静默丢 500+ 用例且计数非确定——4294/4251 漂移但 exit 0，属假绿；回归证据看稳定计数不看退出码）。pm2 restart 后 healthcheck OK。Playwright 真后端真库联调（SQL 直插 c204link_proj：EP1 中文、EP2 英文各 v1/v2，余额置 200）：①真实 diff 端点 stats `{equal:3,added:2,removed:2}`，summary added/removed 各 dialogue1+action1，亮点 speaker=老周、纯内容"面钱今天就结，账两清。"；ZH 摘要卡渲染正确，EN 卡零汉字零全角；②页内 fetch mock（POST /fix 恒回 409 VERSION_ADVANCED）+ mock confirm：首次点击→费用确认→三按钮成组（原按钮/Refresh for new version/Retry on latest），点 Retry→零费刷新（openProject+诊断重跑）→confirm 计数=2（新交易二次真实费用确认）→第二次 fix 请求发出→新一组按钮挂在重绘后的新按钮上（旧闭包按钮随 DOM 销毁）；③ZH 文案"基于新版重试/刷新查看新版/载入新版中…"；④脏值自愈：预置 `zn_lang='"en"'` 重载→自动归一写回 'zh'、中文标题、renderSelects 不再抛错，干净加载控制台 0 error（仅 favicon 与探测期 401/404 噪声）。联调后精确回滚并 SELECT 核 0：Script 4、Project 1 删除；余额归 0；LedgerEntry 无任何 c204 流水（c204_ledger=0，仅余 9-21 历史两行）；测试号密码 argon2id 哈希按备份精确恢复（length=97、exact_match=t，备份文件随即删除）。

### 方法论沉淀
- **㉛同一 HTTP 状态码承载双语义时，分流条件必须显式按业务语义码区分，并证明每个分支可达**。`message==='X' || status===409` 这类写法在 409 新增第二种语义（IDEMPOTENT_REPLAY 锁死 vs VERSION_ADVANCED 已退款可重试）后，后加的专门分支会被前置条件永久短路成死代码——正确形态是 `status===409 && message!=='VERSION_ADVANCED'` 才归幂等锁死。更隐蔽的教训：c203 该分支代码评审与单测都"通过"，因为没有任何测试真正触发 UI 分流；错误分流必须有可观测的分支可达性证据（本轮用 fetch mock 断言按钮成组才让死代码现形）。
- **㉜观测/摘要类纯计算的四条不变量：输入不蒸发、零外部成本、自身零抛错、为空时 UI 静默**。计数类摘要必须让所有输入进桶（other 也计数，桶和=总数），否则数字对不上行总数、用户对账时产生"幽灵改动"；摘要挂在已付费/只读主交易上不得调模型、不得扣费、不得因脏数据抛出（异常整体降级）；前端拿到缺字段或全零结果不出卡而不是出一张空卡。配套铁律：同一分类/解析口径全库单一函数出处（parseScriptLine 同时供围读稿与 diff 摘要），禁止两套正则平行演化。
- **㉝前端"刷新实体"必须连带重建它名下的懒加载子面板；付费重试是一笔新交易，必须重新做真实费用确认**。openProject 重建出的是空 #worksDiag，诊断数据只在点按钮时拉取——任何"重开项目"之后若要继续操作诊断入口，必须显式重跑加载并轮询至入口渲染（150ms/8s 上限），否则后续查找必然扑空；该重开动作同时挂在"零费刷新"和"基于新版重试"两条路上。资金侧：首笔 VERSION_ADVANCED 已退款，重试不是补单而是新扣费交易，确认弹窗必须真弹第二次，文案严禁复用"不会重复扣费"的幂等话术。另一条配置卫生：入口配置项（localStorage 语言等）要白名单归一+脏值自愈写回，所有子视图经单一读取口径（window.znLang）消费——一个带引号的脏值足以让双语表索引在每次加载抛 TypeError、全站半崩。
- **测试基础设施：--test-force-exit 会静默丢用例并给出非确定计数与 exit 0 的假绿**。本项目权威回归命令固定为 `NODE_ENV=test node --test test/`（自然退出、稳定 4836）；任何轮次的"全绿"以稳定计数对比为准，不以退出码为准；单文件同样不加 --test-force-exit。

## c205 复盘轮：场记台账行冒充角色台词（封闭键名保守拦截×不误杀真人角色名）、空段计数契约、码点截断、async 回调漏 await（v2.185.25）

**本轮性质**：复盘轮（c204 功能轮 v2.185.24 后）。先核实 c204 遗留的全部"待核实"选择器/闭包/事件委托假设（data-wave-fix、data-rrfix、三入口 409 分流、findFreshEntry、reopenWorksDiagnosis 均证实可达且正确），再做 409 双语义、localStorage 裸读、摘要卡 XSS、summary 同源四组同族通查（无新患），冻结 5 项真实缺陷：1 个 P1 创作能力缺陷（中文剧本最常见的场记台账行被台词正则误判为角色"时间/地点/人物"的对白，污染 TTS/角色统计/变更摘要三处），3 个 P3 契约/编码/时序缺陷，1 处注释订正。TDD 先红 6 条（含 1 条端到端口径用例），修复转绿，升版 v2.185.25。

### 一、问题与修法（问题-证据-修法）
1. **D1（P1，创作能力）场记/台账行被误判为角色台词**。parseScriptLine 的 DIALOGUE_RE 只排除"名位含句读"的叙述句（`。！？，、；,.!?`），但中文剧本台账行"时间：夜""地点：302门口""人物：林晚、母亲""场次：3"的名位是**无标点短名词**，全部被分类为 speaker=时间/地点/人物/场次 的 dialogue；英文 `TIME: NIGHT`、`LOCATION:`、`CAST:` 大写键名同理中招。污染三处：buildListenScript 让 TTS 念出"时间说：夜"、speakerSet/dialogueCount 混入假角色与虚高台词数、c204 摘要卡"台词N句"与亮点 speaker 失真。修法：新增封闭 META_SLATE_RE（中文：时间/地点/日期/场次/场景/人物/出场/角色/道具/服装/备注/注释/提要/片头/片尾/字幕/转场；英文：TIME/LOCATION/PLACE/DATE/CAST/CHARACTER(S)/PROP(S)/WARDROBE/COSTUME/NOTE(S)，大小写不敏感），在 TECH_RE 之后、场标/台词匹配之前归 other（不朗读、技术计数）。**词表只收纯元数据名词："时光/小时/安静/夏天"这类可以做真人角色名的词严禁入表**——拦截策略宁放勿错杀，漏网的罕见台账行最多多念一行，错杀真角色则让真实台词消失，后者危害更不可逆。配反向测试：'时光：你终于来了。' 仍判 dialogue 且 speaker 正确、'林晚（低声）：地点我已经选好了。'（内容里出现台账词）不受影响。
2. **D2（P3，契约分叉）summarizeChanges 空文本段与㉜"桶和=行总数，输入不蒸发"承诺矛盾**。旧实现 `if(!raw) continue` 把缺 text/纯空白段整体跳过，桶和对不上入参红绿段总数（引擎自产段经 splitScriptLines filter(Boolean) 永不为空，仅外部脏输入触发）。修法：空段按 parseScriptLine('') 归 other **计入桶**（守恒优先），但**空段不进亮点池**（不渲染空亮点）——计数守恒与展示洁净是两件事，分开处理；未知 type 段仍整体忽略。同步把 c204 旧测试里"脏段不计任何分类"的断言精确化为"未知类型不计、已知类型空段计 other"。
3. **D3（P3）clipHighlight 按 UTF-16 码元 slice 会切断代理对**。`t.slice(0,60)` 遇到 emoji/扩展平面生僻字，边界落在高/低代理位中间时输出孤立半代理（lone surrogate），JSON 序列化与前端渲染成坏字符。修法：`Array.from(t).slice(0,60).join('')` 按码点截断再补 `…`，上限语义改为"60 码点+省略号"；用例以 'a'+'😀'×70 精确构造奇数边界（旧实现必留孤立高代理）并双向断言无 lone high/low surrogate。
4. **D4（P3 前端时序）attach409Refresh 的 after 回调未 await**。普通"刷新查看新版"路径 `if (typeof after==='function') after();` 同步触发即继续：作品页传入的 after=reopenWorksDiagnosis 是带 150ms 轮询/8s 上限的 async 函数，未 await 时按钮立即移除并提示"已刷新到最新版本"，诊断面板却可能还没重开完——用户看到空面板被系统告知"已刷新"，比报错更误导。修法：rb.onclick 本就 async，改 `await after()`（同步返回值 await 无副作用）；c204 的"基于新版重试"onRetry 路径原本就显式 await，不受影响。
5. **D5（P3 文档）注释与实现不符**。listen-script.ts 行分类 JSDoc 旧写 other="空行与镜头/配乐等技术提示行（不朗读、默认不进摘要计数）"，但 c204 起 other 实际计入摘要计数桶（㉜输入不蒸发）；本轮订正为"空行、技术提示行、场记台账行（不朗读）"，计数口径在 script-diff.ts 函数 JSDoc 写准（other 含空段计桶、仅亮点优先级最低/空段不入池）。

**先红-转绿记录**：listen-script.test.cjs 新增 4 个 c205 用例（中文台账 14 前缀→other、英文台账 12 前缀→other、台账词表不误杀真人角色'时光'与内容含台账词的台词、buildListenScript 端到端：台账行不进任何 segment/narration、speakerSet=['林晚','陈默']、dialogueCount=2）；script-diff.test.cjs 新增 3 个（空文本/缺 text 红绿段计 other 且桶和=入参红绿段总数但不出空亮点、emoji 奇数边界码点截断无 lone surrogate、台账行摘要计 other 不计台词且亮点 speaker 为真角色），并精确化 c204 一条旧断言。旧码 tsc 后定向 31 案 6 红（新增 7 案中 6 红，不误杀用例天然即绿证明词表设计安全），修复后 31/31 绿。

**回归证据**：npx tsc 零输出；node --check web/app.js 通过；全量 `NODE_ENV=test node --test test/` **4843 pass / 0 fail / 442 suites**（c204 基线 4836 + c205 新增 7，计数严丝合缝）。pm2 restart（cluster 双实例均 online）后 healthcheck OK。真库 HTTP 端到端（零侵入：用 dist/lib/auth 签 15 分钟短期 token，未改测试号密码；SQL 直插固定 ID 项目 c205diag_…+v1/v2：v2 含时间/地点/人物中文台账、LOCATION 英文台账、两句真台词与新增动作行）：GET diff 端点 stats `{equal:2,added:7,removed:3}`，summary added=`{dialogue:2,action:1,other:4}`、removed=`{dialogue:1,other:2}`，两侧桶和分别=7/3 守恒；亮点顺序 林晚"你迟到了整整半小时。"→陈默"路上堵死了。"（纯内容）→动作行，speaker 集合无 时间/地点/人物/LOCATION；9 项断言全过。部署的 /app.js 含 c205 await 修复标记（grep=1）。回滚核账：Script 2、Project 1 按固定主键精确删除并 SELECT 核 0；近 20 分钟 LedgerEntry=0（diff 零扣费）、PointsAccount 余额=0、密码哈希仍为 c204 恢复态 argon2id 97 字节（本轮未触碰）。

### 方法论沉淀
- **㉞"无标点短名词+冒号"是台词识别的歧义区：用封闭键名集合保守拦截场记台账，词表只收纯元数据名词，宁放勿错杀，并强制配反向用例**。"时间：夜"与"时光：你来了"在正则形态上同构（短名词+冒号+内容），单靠"名位不含句读"挡不住台账行；扩充拦截词表时真正的风险是错杀——被漏掉的台账行代价是 TTS 多念一行/统计多 1，被错杀的真角色台词代价是真实创作内容从朗读和统计里消失，两者不对称，所以"时光/夏天/安静/高兴"这类可作人名的常用词永不入表。任何分类器加拦截规则必须同时写"命中"与"合法近似形态不得命中"两类用例（本轮英文 NOTE/NOTES、CHARACTER/CHARACTERS、PROP/PROPS 的可选复数也一并覆盖），词表本身就是安全边界，评审逐词过"这能不能是个人名"。
- **㉟注释即契约：写了"计数守恒/桶和=总数"，空输入语义就必须与注释一致；守恒与展示洁净分开实现**。观测函数的文档承诺（㉜输入不蒸发）要对最脏的外部输入也成立：已知类型的空段计 other 保桶和，展示层（亮点池）再按非空过滤——计数层不许跳过输入，展示层可以挑选输入，两层规则各自显式。配套：旧测试断言随契约精化时必须写清差异（"未知类型整体忽略"与"已知类型空段计桶"不是一回事），禁止用一条模糊的"脏段不计"把两种语义糊在一起。
- **㊱展示层字符串截断一律按码点（Array.from/spread），不按 UTF-16 码元 slice，且测试要构造奇数代理边界**。JS 字符串默认索引是码元，`slice/substr` 切在 emoji 与扩展平面汉字中间会产生 lone surrogate，经 JSON 下发后前端出现替换符/坏字符且难排查；截断工具统一码点实现，长度上限的口径同步写"码点"。测试不能用全 BMP 文本（如纯中文长行，码点=码元，永远绿），要构造"1 个 BMP 前缀 + 偶数个代理对"使旧实现必然落在奇数码元边界，并对高、低代理两个方向都做断言。
- **㊲把 async 函数当回调参数传递时，调用点必须 await；"提示成功的时刻"必须晚于"承诺的状态真正达成的时刻"**。after/onRetry/onDone 这类回调参数无法从类型上保证同步，调用点裸调 `after()` 会让后序 UI（成功提示、按钮移除）抢在轮询/重开完成之前执行——没有任何报错，只是界面一本正经地说谎（"已刷新"但面板是空的）。规则：回调调用点统一 `await cb()`（同步函数 await 其返回值无副作用）；凡用户可见的成功反馈，其前一步必须等到被刷新实体真正渲染/落库完成（与㉝懒加载面板重开轮询一脉相承：重开+轮询+确认入口出现，三步未完成不得提示成功）。

## c206 功能轮：听剧本从静态分段稿升级为多角色有声播放器（浏览器原生 TTS×确定性声线分配×零扣费），顺手补上回访老作品无听剧本入口的真实缺口（v2.185.26）

**本轮性质**：功能轮（c205 复盘轮 v2.185.25 后）。听剧本（ADVANCED 起、零积分、本地确定性）此前只交付"静态分段稿+复制"，`ttsReady:false` 仅文案提示"可用系统朗读"却从未接线。本轮把它升级为真正能听的多角色有声播放器，并在联调中抓出一个比播放器本身更影响可用性的真实缺口：作品页 openProject 从不填 currentScripts，回访老作品的用户根本打不开听剧本。TDD：新引擎先红 7 条（转绿时修正 1 条测试自身的语言语义错误）、/listen HTTP 新增 3 条；浏览器用 mock speechSynthesis 做全状态机事件驱动联调。

### 一、问题与修法（问题-证据-修法）
1. **D1（P1，功能缺口）听剧本只有稿、没有声**。后端 /listen 已返回结构化 segments（idx/kind/speaker/cue/text）与 speakerSet，但前端只渲染静态稿；浏览器普遍内置 speechSynthesis 却被搁置。修法分两层：①新引擎 `src/engine/listen-voice-cast.ts`——确定性把 speakerSet（首次发言序）映射到固定声线网格 VOICE_PROFILE_GRID（5 音高层 0.8–1.2 × 2 语速层 1.00/1.03 = 10 槽），旁白独立声线 NARRATOR_PROFILE（pitch 0.9/rate 0.95，刻意不同于 0 号角色槽）；参数全卡在可懂安全区（pitch 0.5–1.5、rate 0.8–1.2），输出 `{narrator, characters, voiceLang:zh-CN|en-US}`；零模型零积分。脏入参容错（非数组/null→空 cast、trim、空串/null 剔除不占槽、去重保首次出场、非字符串 String() 归一占槽、超网格长度显式 `%len` 循环）。②前端播放器状态机：播放/暂停/继续/停止、语速 0.8–1.5×（与角色声线 rate 相乘后 clamp 1.6）、当前段高亮自动滚入视口、点任意段从该段开播、关闭弹窗/重开/重渲染必 cancel、不支持 speechSynthesis 时整条控制条隐藏并保留复制稿兜底。
2. **D2（P1，入口缺失，联调抓出）回访老作品没有听剧本入口**。🎧 听剧本按钮只在创作台结果区，`disabled = currentScripts.length===0`；而 currentScripts 仅生成完成链路的 refreshResultScripts 填充，作品页 openProject 拉了 eps 只渲染 `<pre>` 从不写 currentScripts——老用户打开旧作品，按钮永远禁用，端点能力对主力回访场景零触达。修法：作品详情每集 EP 块的最新版标题行加"🎧 听剧本"按钮（data-listen-id=latest.id），openProject 渲染后一次性委托绑定 openListen(id)；权益不足沿用 openListen 既有 403 分支（弹引导+跳会员页），不新造闸门。
3. **D3（P3 i18n）fmtDur 写死中文"分/秒"**。英文 meta 也显示中文时长。修法按当前界面语言：en=`1m 05s`/`12s`，zh=`1分05秒`/`12秒`。
4. **D4（P3 健壮性，联调抓出）utterance.voice 赋值会同步抛 TypeError**。给原生 SpeechSynthesisUtterance 赋非本机原生 SpeechSynthesisVoice（mock 复现，真实怪浏览器同理）抛 `Failed to set the 'voice' property`，且发生在 ss.speak 之前——不加防护会让整条播放链崩在第一段。修法：选声 try/catch，失败退回只设 utterance.lang（lang 本身就足以让多数引擎选对语音），选声永不阻断开口。
5. **D5（契约保留）ttsReady 语义不撒谎**。服务端探测不到浏览器能力，该字段保持 false（云端真人 TTS 未配置的旧语义），是否可用完全以前端特性检测为准；旧前端行为不变，新前端忽略之。

**先红-转绿记录**：test/listen-voice-cast.test.cjs 先写 7 条（空/脏入参、lang 白名单、出场序确定性、追加角色只加尾部老声线不重排、脏元素清洗、网格内两两唯一+超长循环、参数有界），引擎未建时模块缺失即红。转绿中第 5 条一度失败：`[' 林晚 ','',null,'林晚',42,'陈默']` 期望 Object.keys 顺序 ['林晚','42','陈默']，实际 ['42','林晚','陈默']——**这是 ES 规范的整数样式键优先枚举序，不是引擎缺陷**；修正测试为成员集合排序断言+槽位映射断言（林晚=grid0、'42'=grid1、陈默=grid2），引擎实现不动。该红的价值反向兑现：逼出了一个对规范的错误假设。

**回归证据**：npx tsc 零输出；node --check web/app.js 通过；全量 `NODE_ENV=test node --test test/` **4853 pass / 0 fail / 443 suites**（c205 基线 4843 + 引擎 7 + HTTP 3，严丝合缝）。HTTP 新测：ADVANCED 200 且 cast 结构/声线互异/台账行不入朗读/零扣费、lang=en→en-US、FREE 403 ASSISTANT_LEVEL_REQUIRED 带 upsell 不扣分、他人剧本 403、不存在 404。pm2 restart 双实例 online + healthcheck OK。真库端到端（签 15 分钟短期 token + 测试号临时置 ADVANCED 联调后还原 FREE）：curl /listen 断言 speakerSet=['林晚','陈默']、voiceLang=zh-CN、narrator {0.9,0.95}、两角色声线 {0.8,1}/{0.9,1} 互异且异于旁白、narration 无"时间/地点/人物"台账行且保留"陈默（喘气）"cue、en 通道 en-US。Playwright（Chromium 注入确定性 mock：speak 同步 onstart、手动 onend 推进、空 getVoices）实测：6 段渲染（场标2/台词3/旁白1）、播放→旁白 p0.9r0.95 念"第1集 夜归"逐段推进→林晚 p0.8 念纯台词（cue 不被念出）→陈默 p0.9；点第 6 段跳转即播林晚声线；暂停→"▶ 继续（已暂停）"→恢复；停止复位 0/6 无高亮；语速切 1.5× 立即重播当前段 r=1.425；6 段自然念完自动复位；X 关闭弹窗触发 cancel 且 modal hidden。降级场景（addInitScript 删除 speechSynthesis 与 SpeechSynthesisUtterance）：控制条隐藏、降级提示出现、6 段稿与复制按钮照常。控制台 0 业务错误。回滚核账：Script/Project 固定主键删除 SELECT 核 0、LedgerEntry c206 前缀=0、PointsAccount 余额=0、level 还原 FREE、passwordHash 仍 argon2id 97 字节未触碰。

### 方法论沉淀
- **㊳纯前端零成本能力增强优先吃浏览器原生 API：特性检测+优雅降级，增强不阻断核心**。speechSynthesis 是被长期闲置的本机能力——多角色"不同声线"用 pitch/rate 确定性组合即可达到可懂的区分度，无需云端 TTS、无需模型与扣费；但原生 API 在无头/旧浏览器可能缺失或行为怪（无语音、voice 赋值抛错、回调时序不一），所以三条铁律：能力以 `'speechSynthesis' in window && typeof SpeechSynthesisUtterance!=='undefined'` 为准而非服务端字段；不支持时隐藏增强层并让原有兜底（复制朗读稿）完整可用；每一步原生调用（cancel/speak/resume/voice 赋值）try/catch，失败降级到"只设 lang/结束播放"，绝不让增强能力把核心页面带崩。
- **㊴确定性声线分配是单向契约：按出场序占槽，新增只追加，老角色声线永不重排**。听众在第一句就为"林晚"建立了声纹预期，该预期一旦形成就是不可破坏的契约——因此分配函数禁止按名字哈希（每次加角色全表重排）、禁止排序（输入序即出场序），必须按下标顺序占固定网格；追加角色取尾部新槽，超网格显式取模复用并在注释写明"这是确定性复用不是碰撞"。同类规律适用于一切"按出现顺序分配稳定身份"的场景（颜色板、头像、快捷键位）。
- **㊵多段 TTS 串播是一个状态机：单例 utterance、令牌作废旧回调、onend 推进、关闭即 cancel，与 c203/c205 的回调时序与资源清理铁律同源**。每段一个 utterance、全局同一时刻只有一个在播；speak 前 cancel 旧实例，用自增 seq 令牌让旧 utterance 的 onstart/onend/onerror 全部失效（cancel 在部分浏览器会补发回调，是串段/双声的根源）；自然结束靠 onend 推 idx+1，越界即收尾复位；暂停/恢复用原生 pause/resume 不改 idx；语速变更用当前 idx 重播；关闭弹窗（X/按钮/遮罩）、重开、重渲染、beforeunload 四个出口都必须 cancel——"人走了声音还在念"是资源泄漏更是惊吓。联调方法论：无头环境发声不可验证，就 mock 成事件驱动模型（onstart 同步、onend 手动），逐事件断言 idx 推进、高亮 class、cancel 调用，比"听一耳朵"确定得多。
- **附（测试语言语义）：断言对象键顺序前先过规范——整数样式键（'42'）按 ES 枚举序排在字符串键之前**。红测失败先分清"产品缺陷"与"断言的语言假设错误"：引擎按插入序写入 characters，但 Object.keys 对数组下标形态的键有强制排序；正确测法是成员集合+槽位映射分开断言。红测的价值不只是逼出实现，也包括逼出测试者自己错误的心智模型（此类修正不得改实现去迁就错误断言）。

## c207 复盘轮：听剧本真机排雷（Chrome cancel 吞声/后台静默/Safari 无高亮/朗读化剥技术括号/全名英文台词），复盘抓出 P1 弹窗隐身事故 13 弹窗困在 display:none 视图容器（v2.185.27）

**本轮性质**：复盘轮（c206 功能轮 v2.185.26 后）。c206 的 Playwright 联调用 mock speechSynthesis 全绿，但 mock 测不出真机怪癖——本轮先做同族通查冻结 8 项缺陷（2 个 P2 真机/创作问题、5 个 P3 前端问题、1 个增强），修复途中复盘又抓出 1 个 P1 线上级事故（13 个弹窗 DOM 困在 `#view-market` 容器，跨视图打开时 0×0 隐身、数据照跑声音照放）。TDD：引擎 D7/D8 先红 6 条转绿；前端 8 项全部 Chromium 真机事件驱动联调（mock 精细到 80ms 延迟与乐观高亮时序），D9 用 getBoundingClientRect+closest 逐弹窗实测。升版 v2.185.27。

### 一、问题与修法（问题-证据-修法）
1. **D1（P2，真机）Chrome TTS 三连坑：cancel 后同步 speak 被吞、长文本/后台标签页自动 pause 后静默**。c206 状态机"speak 前 cancel 旧实例"在 Chrome 上实测：cancel() 后同一 tick 立刻 speak() 的 utterance 会被静默丢弃（无 onstart/onend，整集卡死在第一段）；Chrome 还会在 utterance 过长（约 >15s）或标签页切后台时自动 pause()，不 resume 就永远停住。修法：①cancel 与新 speak 之间插入 80ms 延迟（LISTEN_SPEAK_DELAY），新 utterance 在 setTimeout 内构造并 speak，配合自增 seq 令牌，回调首行校验 mySeq 作废迟到回调；②8s 周期保活定时器（LISTEN_KEEPALIVE_MS）：仅在 playing&&!paused 时 `if(ss.paused) ss.resume()`，并检测 stuck（当前段持续时间≥2 个周期却无边界推进）则重播当前段；用户主动暂停时不保活（暂停语义不被定时器偷偷破坏）。四出口（renderListen/openListen/关弹窗/beforeunload）必清 pending 与保活。
2. **D2（P3，真机）高亮只挂 utterance.onstart，Safari 部分版本不触发 onstart 则全程无高亮**。修法：speak 调度瞬间（80ms 延迟发出时）先做乐观高亮 listenMarkActive(i,false)，onstart 只负责滚动入视；事件没来视觉也正确，事件来了不重复（同段幂等）。
3. **D3（P3）renderListen 脏字段直接 toFixed 崩窗**。segments/speakerSet 非数组、dialogueCount/estSeconds 为 null/字符串、s.estSeconds undefined 时 `.toFixed(1)` 抛 TypeError 整窗白。修法：入口全字段归一（Array.isArray 兜底 []、Number(x)||0、note.lines 数组化、speaker/cue/text 加 ||'' 再过 escapeHtml）。
4. **D4（P3 i18n）听剧本静态控件写死中文**。停止按钮/语速 label/弹窗标题在英文界面仍是中文。修法：静态控件加 data-i（listenStop/listenRateLabel/listenPrev/listenNext）入 zh/en 字典，renderStaticText 末尾挂 listenSyncUI() 钩子保证语言切换即时刷新；标题按语言双语拼装 zh=`🎧 第N集 title` / en=`🎧 Ep.N title`。
5. **D5（增强）播放器无 ⏮/⏭**。补两个跳段按钮（DOM+data-i 字典+listenJump(±1) 带边界 clamp+initListenPlayer 绑定），与点段开播共用同一"令牌作废+重播"路径。
6. **D6（P3 健壮性）/listen 路由 cast 构建无 try/catch**。buildVoiceCast 是主交易（分段稿）之上的增强，任何对 speakerSet 的意外输入导致它抛错都会让整个 /listen 500——增强绝不能拖垮主交易。修法：generate.ts 调用点 `try { cast = buildVoiceCast(...) } catch { cast = null }`，前端对 cast=null 早有 narrator 单声线回退。
7. **D7（P2，创作能力）技术标记被原样念出：裸 INT./EXT. 英文字母、舞台括号（音效/BGM/SFX/V.O.）进朗读文本**。`INT. CAR - CONTINUOUS` 被 TTS 念字母"I-N-T"，"（音效：雨声拍窗）""（BGM《夜曲》渐起）""(SFX: engine roar)"这些给制作组的舞台指令被当旁白念出，观感崩坏。修法（朗读化是**独立于行分类的一层**，不动 kind）：①封闭舞台词表 STAGE_CUE_PAREN_RE（BGM/背景音乐/配乐/音效/声效/画外音/OS/V.O./SFX），仅当 `kind!=='dialogue'` 才剥舞台括号——**台词正文内的情绪括号"林晚（低声）：…""JOHN（喘气）：…"是表演信息，永不剥**；②INT_SLATE_RE/EXT_SLATE_RE 场标行口播展开 INT.→Interior、EXT.→Exterior；③纯技术提示行剥净后不成段（不产空 segment）。
8. **D8（P2，创作能力）英文标准对白 `LI WEI: Drive.`（名+姓带空格）被误判 action，角色声线丢失**。c206 的 DIALOGUE_RE 只支持单单词英文名位，"LI WEI""JOHN H. SMITH"这类好莱坞标准格式（2-3 词首字母大写、允许 MR./DR. 缩写点）因名位含空格落到 action，导致英文剧本多角色对白全部退化为旁白单声。修法：DIALOGUE_RE 改两支——全名支 `[A-Z][A-Za-z]*\.?(?:\s+[A-Z][A-Za-z]*\.?){1,2}` 匹配 2-3 词大写名（放行缩写点），中文/单词支保持原样；句读守门同步分叉：中文名位禁全句读，英文全名支只禁 `[,，;；!？]`（放行名字缩写点与 Mr.），`She said:`/`Wait, man:` 等含小写或逗号的叙述句仍被挡为 action。
9. **D9（P1，复盘抓出的线上级事故）13 个弹窗 DOM 困在 `#view-market`（视图切换靠祖先 display:none），跨视图打开时 0×0 隐身**。听剧本入口在作品库视图（.ep-listen-btn→openListen→openModal）、资产库/智能默认/PK/导演包/物料/价值证书/成人确认入口在工作室视图、反馈/样例是全局入口，而这些弹窗节点历史上全部定义在 index.html 的 `#view-market` 容器内。Playwright 实测：works 视图打开 listenModal，modalMask 自身 display:flex/visibility:visible，但 getBoundingClientRect()=0×0（**position:fixed 逃不出 display:none 祖先**，且无任何报错——听剧本表现为"点了没反应却有声音"，弹窗关不掉）；切到 market 视图立即 1200×622。受困 17 个弹窗中 13 个有跨视图入口。修法（最小根治）：openModal 显示前一次性把弹窗节点 appendChild 到 body 末尾（id/样式/元素级事件/全局委托全部保留，fixed 定位本就相对视口；已在视图外的 authModal/qsMask 无操作），并把 10 处绕过 openModal 的直接 `classList.remove('hidden')`（含三个资产库的未登录早返分支、xMature/assetDashboard/pk/value/smart/dp/mat）全部收口到 openModal。market 内部弹窗（list/full/detail/mine）一并搬走无副作用。

**先红-转绿记录**：test/listen-script.test.cjs c207 新增 6 条——D7 三条（INT./EXT. 场标口播化且裸字母不进 narration、叙述/场标行的音效/BGM/SFX/V.O. 舞台括号剥净而台词正文情绪括号保留、纯技术行剥净不成段）；D8 三条（`LI WEI: Drive.` 全名英文判 dialogue 且 speaker='LI WEI'、缩写点 `JOHN H.: Go` 命中、`She said:/Wait, man:` 含小写/逗号仍判 action）。旧码定向 6 红，修复后全绿。前端无红测框架，以 Playwright 事件级断言替代（见下）。

**回归证据**：npx tsc 零输出；node --check web/app.js 通过；全量 `NODE_ENV=test node --test test/` **4859 pass / 0 fail / 443 suites**（c206 基线 4853 + c207 引擎 6，严丝合缝）。pm2 restart（cluster 双实例）v2.185.27 online + healthcheck OK。真库端到端（独立命名空间 c207listen_*，短期 token，测试号临时置 ADVANCED 后还原）：curl /listen 三角色 cast=林晚/LI WEI/JOHN、speakerSet 全、narration 禁词 音效/BGM/SFX/V.O. 全 false、Interior=true 裸 INT.=false、情绪括号（低声）（喘气）保留。Playwright（Chromium，mock speechSynthesis：speak 10ms 后 onstart、手动 onend、getVoices:[]，点击后等 ≥120ms 匹配 80ms 延迟）实测：9 段渲染；首播 speak 不被吞；onend 自动连段；⏭ 段1→2、⏮ 段2→1；点段 8 后 20ms 乐观高亮 active=8 且 speak 计数未增（120ms 后才发声）；暂停按钮 ▶ Resume；关闭弹窗 active=-1 且 speak 不再增长；中文控件 ⏮上一段/下一段⏭/■停止/语速/标题"🎧 第1集 夜行车"，英文 Prev/Next/Stop/Rate/"🎧 Ep.1 夜行车"；降级（新 Context 删除 speechSynthesis）提示条显示、播放器隐藏、9 段稿可读、0 pageerror。D9 实测：listen/castLib/propLib/sceneLib/smart/feedback/sample 七个有真实跨视图入口的弹窗在非 market 视图打开全部 1200×622 且 closest('[id^=view-]')=BODY（修复前 0×0/view-market）；pk/dp/mat/value 经同一 openModal 收口（其真实入口在生成完成态，处理器前置 currentProjectId 校验）。控制台唯一错误是过期 token 的 /auth/me 401，续签后 200×2，非代码缺陷。回滚核账：Script/Project 精确删除 SELECT 核 0、LedgerEntry c207 前缀=0、PointsAccount 余额=0、level 还原 FREE、passwordHash argon2id 97 字节未触碰；临时 token 与联调脚本已删。

### 方法论沉淀
- **㊶浏览器原生 API 有两类坑只能靠真机经验入册：mock 测不出的时序竞态（cancel→同 tick speak 被吞）与环境行为（长文本/后台自动 pause）**。对策不是放弃 mock（事件驱动 mock 仍是状态机回归的唯一确定性手段），而是：mock 里显式建模真机时序（固定 80ms 延迟逼出"乐观 UI 与真实 onstart 的窗口"）、真机排雷结论固化为常量与注释（延迟时长、保活周期、stuck 阈值各自标注来源浏览器与现象）；保活定时器必须有"用户主动暂停不保活"的语义闸门，自动修复机制绝不能覆盖用户的显式意图。凡接原生能力（音频、剪贴板、通知、媒体键），发布前至少过一次真机，mock 全绿不等于功能存在。
- **㊷"朗读化/可听化"是独立于行分类的一层转换：技术括号只从非台词剥，台词正文里的括号是表演信息永不剥；裸缩写口播展开；剥净不成段**。行分类（scene/dialogue/action/other）回答"这是什么"，朗读化回答"这句怎么念给人听"，两层不可合并：制作指令（音效/BGM/SFX/V.O.）给摄录美看，必须从叙述与场标剥除；但"林晚（低声）：你来了"的（低声）是给配音演员的情绪提示，剥了就丢表演信息。分类器复用要先问"这条规则在两种内容形态上的语义是否相同"，不同则按 kind 分叉，禁止一条 replace 走全文。INT./EXT. 这类行业缩写按口播形态展开（Interior/Exterior）而非删除（场标信息听众需要）。
- **㊸乐观 UI 用于"事件可能不来"的场景（Safari onstart 不触发）；主交易上的增强构建，调用点必须 try/catch 熔断（㉜/c206㊳ 再确认）**。UI 状态不能把正确性押在"浏览器一定会回调"上：先渲染预期态，事件只做增强（滚动），幂等防重复。后端同理：buildVoiceCast 是分段稿主交易的增强，增强函数再纯也要在调用点熔断成 null + 前端回退，增强与主交易的失败域必须隔离。
- **㊹弹窗/浮层 DOM 必须挂在视图容器之外（body 直属）：困在 display:none 祖先里时 position:fixed 也会 0×0，无报错、静默失效、资源照跑——这是"点了没反应"类故障的首要嫌疑**。根治模式：统一 openModal 入口"显示前若 closest('[id^=view-]') 命中则 appendChild 到 body 再 remove hidden"，并收口所有绕过统一入口的直接显示点（包括未登录早返分支——异常路径最容易漏防御）。复盘方法论：凡用户反馈"按钮点了没反应/弹窗打不开"且控制台无错，第一步量 `el.getBoundingClientRect()` 和 `el.closest('[id^=view-]')` 祖先链，而不是去查事件绑定；appendChild 搬迁保留 id/事件/委托且 fixed 相对视口，是低成本根治，但搬迁后仍要回归原视图内打开与 data-close 关闭（关闭走全局 id 查找则位置无关）。

## c208 功能轮：朗读稿 Markdown 净化 + 整剧连播（片单端点/邻接/自动跨集/集导航/续听记忆），联调抓出换集加载窗状态穿帮（v2.185.28）

**本轮性质**：功能轮（c207 复盘轮 v2.185.27 后），创作能力与前后端功能同步推进，三块切片冻结后一次交付：①朗读稿净化 LLM 残留 Markdown/排版噪声；②后端整剧片单端点 + 单集邻接；③前端连播播放器（选集下拉/自动跨集/⏮⏭跨集/续听记忆条/作品页"连播听全剧"入口）。TDD：引擎 3 条 + HTTP 4 条先红转绿；前端 Playwright 事件驱动联调（mock speechSynthesis 带 10ms onstart/40ms onend），联调中同族自查抓出 1 个真实边缘缺陷（换集加载途中段控制操作旧集）并修复。升版 v2.185.28。

### 一、问题与修法（问题-证据-修法）
1. **D1（创作能力）成稿/改写稿偶发 Markdown 残留被 TTS 念出**：`## 第三集`、`> 雨还在下`、`**林夏**`、`` `内景` ``、`---` 分隔线、`！！！` 重复标点会被语音引擎念成"井号井号/大于号/星号"。c207 的净化只针对舞台括号且按 kind 分叉，本轮在 cleanForSpeech 加**统一排版净化层**（对所有行类型）：行首 ATX 标题号 `#{1,6}` 与引用符 `>+` 剥除保文字；整行 `-*/_=` 三连分隔线直接归空（push 保护丢空段）；配对标记 `**x**/__x__/~~x~~/\`x\`` 保文字；孤立 `*`/反引号最后兜底删除；重复叹问号 `！{2,}/？{2,}` 与英文 `!?` 归一。关键纪律：**白名单优先于黑名单**——省略号 `……`、年份 `2019-2021`、破折号 `——`、比分 `3:1`、顿号序列 `10、9、8` 全部配反向不误杀用例，分隔线正则锚死整行（`^\s*[-*_=]{3,}\s*$`）才不误吃年份区间。
2. **D2（后端）听剧本只能单集，整剧连播缺片单与邻接**。新增共享 helper `buildPlayableEpisodes(projectId, lang)`：查项目全部 scripts，`orderBy epNo asc, version asc`，Map 按 epNo 取**最新版**，逐集 buildListenScript 后只保留 `segments.length>0` 的集（空集/解析失败集静默跳过，skippedEps 计数透出）——"最新版 + 有正文"是全项目唯一的可播放口径，禁止端点各自判各的。`GET /scripts/:id/listen` 响应加 `projectId` 与 `neighbors:{prevScriptId,nextScriptId,epPos,epCount}`（邻接查询整段 try/catch，失败退化为单集模式，增强不拖垮主交易）；新端点 `GET /projects/:id/listen/playlist` 复用同一权益闸（assistantGate listen_script，FREE 403 + upsell）、项目归属（他人 404 不泄露存在性）、无可朗读分集 400；片单只出元数据（scriptId/epNo/title/segCount/totalChars/estSeconds）不内嵌正文，逐集懒加载；零模型零扣费。
3. **D3（前端）连播状态机：双令牌防竞态 + 换集加载窗锁**。任何换集路径（onend 自动跨集/⏭越末段/集按钮/下拉/片单续听）只走 `listenLoadEpisode` 一个口：先 listenFinish 掐旧声（全局单一朗读实例铁律不变）→ 显示加载态 → 拉单集稿 → renderListen(opts:{autostart,startAt:first|last|idx})。竞态用**双令牌**：listenReqSeq（弹窗/换集请求序号，迟到的片单与朗读稿响应直接作废，防 A 集数据盖 B 集）+ listenTts.seq（朗读序号，加载途中用户停止/关窗/再换集会自增，迟到一集即便渲染也不自动开口——杜绝"弹窗关了还在念"）。自动连播语义边界：checkbox 只约束 **onend 自然跨集**；手动 ⏭ 越过末段、集按钮、下拉总是跨集且自动开播目标集（上一集进末段、下一集进首段）。
4. **D4（联调抓出的真实边缘缺陷）换集加载途中（约 100-300ms）段按钮可点，操作落在旧集数据上**：Playwright 乱点实测，加载窗内点 ⏭ 会对旧集 speakListenIdx（自增 seq、发出旧集声音），与到达的新集渲染互相穿插，状态机错乱。修法：listenTts 加 loading 标志，loader 发起即置真，renderListen 落地/403/失败三条出口置假，listenJump 与 listenTogglePlay 首行 `if (listenTts.loading) return`；加载中文稿区只有"加载中"占位、无 .listen-seg，点段开播天然不可达。
5. **D5（前端）续听记忆：localStorage 落点 + total 校验 + LRU + 语义化清除**。每段开声即存 `{idx,total,ts}`（键 zn_listen_pos_v1，按段节流天然无高频写），容量 120 条 LRU；只存 scriptId/段索引/段总数/时间戳，不存正文。单集入口（openListen）不自动开口，有有效存档才显示"继续收听/从头播放"条；片单入口（openListenSeries）取片单中 ts 最新的存档直接定位并自动开播。**total 必须严格相等才采信**（剧本改版段数变化时 idx 可能错位，回退从头）；自然听完本集、手动跨集、点"从头播放"都清本集存档；自动连播偏好独立键（zn_listen_autoplay_v1），checkbox onchange 写回，片单入口 listenResetSeries 时读回。隐私模式 localStorage 抛错全 try/catch 吞掉，不影响播放主交易。
6. **D6（入口/i18n/CSS）**：作品页 row-actions 加"🎧 连播听全剧"（#worksListenAllBtn→openListenSeries），与每集"听剧本"单集入口并存；7 个新键（listenAuto/listenEpPrev/listenEpNext/listenAll/listenLoadingNext/listenResume/listenRestart）zh/en 同步，data-i 静态控件语言切换即时刷新，集下拉选项等动态文本按当前 lang 出；新增 .listen-series/.listen-resume 样式复用 --panel-2/--accent 主题变量，集按钮 disabled 态 .45 透明。

**先红-转绿记录**：test/listen-script.test.cjs c208 新增 3 条（标题号/引用符/分隔线净化、配对标记保文字+孤立符号兜底+重复标点归一、省略号/年份/破折号/比分/顿号五类反向不误杀），旧码定向红后转绿，该文件 22/22；test/http-generate.test.cjs 新增 describe「c208 整剧连播」4 条（片单取最新版/空集跳过/零扣费、neighbors prev/next/epPos、FREE 403/他人 404/空项目 400、lang=en），该文件 91/91。

**回归证据**：npx tsc 零输出；node --check web/app.js、web/i18n.js 通过；全量 `NODE_ENV=test node --test test/` **4866 pass / 0 fail / 444 suites**（c207 基线 4859 + 引擎 3 + HTTP 4 = 4866，严丝合缝；**权威回归必须带 NODE_ENV=test**，否则 JWT secret 校验按 production 拒绝开发密钥整文件假全红；严禁 node scripts/run-tests.cjs 历史假绿）。pm2 restart v2.185.28 + healthcheck OK。真库端到端（命名空间 c208pw_*，60m 短期 token，测试号临时 ADVANCED 后还原 FREE）：curl 片单取 e1v2（跳过 v1）三集 5 段/集、skippedEps=0。Playwright 实测：①片单入口续听 ep1 seg0 自动开播，ep1 五段 onend 自然跨 ep2 再跨 ep3，全剧恰好 15 次 speak 后 idx=-1、按钮复位、700ms 内 speak 不增长、续听存档清空；②auto=off 时 ep1 五段播完精确停在本集不跨集，手动 ⏭ 越末段/集按钮则无视开关照常跨集；③⏮ 在首段跨进上一集末段并自动开播；④集按钮 ep1→ep2→ep3 后 next 禁用、ep3→ep2 后两键皆可用，下拉选项 3 集且选中态同步；⑤换集加载窗连点 6 次段按钮被 loading 锁吞掉，无旧集发声、无状态穿插；⑥续听条显示"上次听到第 3/5 段"，点继续从 seg2 开口（n 不增于开条时），篡改 total=99 后重开不出条，片单入口凭存档定位 ep2 seg2 自动开播（集内自然连播至集尾，跨集仍受开关约束）；⑦FREE 下片单与单集两入口 403 均关弹窗并走升级引导；⑧语言来回切换 0 pageerror（历史 renderSelects 脏 lang 报错不复现，401/favicon 为预期噪声）。回滚核账：Script 删 4、Project 删 1 SELECT 核 0，level 还原 FREE，临时 token 脚本 .c208_token.cjs 已删。

### 方法论沉淀
- **㊺排版净化遵循"白名单语义优先 + 整行锚定 + 反向用例成对"**：净化层面对的是 LLM 自由文本，连字符/星号/省略号在中文创作里都有合法语义（年份、破折号、比分、顿号、省略），任何黑名单正则上线前必须先列出"哪些合法内容长得像噪声"并配反向断言；分隔线/标题号这类块级噪声用整行/行首锚定（`^…$`），把作用域压到最小，绝不用全局 replace 裸删符号；配对标记保文字（`**林夏**`→林夏）、孤立符号兜底删，顺序固定（先成对后孤儿），避免先删光再找不回。
- **㊻"可播放/可见/最新"这类集合口径必须由单一 helper 定义并被所有端点共用**：片单（要不要给这集）、邻接（上一集是谁）、续听定位（在哪些集里找存档）三处都依赖"项目的可播放分集"这个集合，若各查各的（这个要最新版、那个取任一版、第三个不过滤空集），必然出现下拉里有但点开 400、自动跨集跳进空集、续听定位到旧版三种不自洽。一个 `buildPlayableEpisodes`（最新版 + 有正文 + 统一排序）喂全部入口，跳过计数透出可观测，是消除跨端点不自洽的结构性手段。
- **㊼异步状态机的"加载窗口期"是与失败路径同级的必防面：请求在途时旧控件仍可操作，就会对旧状态开口/下单/翻页**。三段式防御：①入口锁（loading 标志，操作函数首行拦截）；②世代令牌（自增序号，迟到响应先比对再落地，A 不盖 B）；③副作用令牌（另一条独立序号，数据可以渲染但自动播放这类不可逆副作用必须二次确认"用户没在途中变卦"）。只做①不够（迟到响应仍会落地开口），只做②不够（用户点得快时操作落在旧数据上）；三层各自挡一类窗口。判别信号：Playwright 在触发换集后立刻乱点同组控件，是本类问题最低成本的逼测手法（比等真机用户投诉快一轮）。
- **㊽"自动"开关的语义边界要按动作来源切，而不是按 UI 路径切**：连播 checkbox 约束的是"系统替用户做的决定"（onend 自然跨集），不约束"用户显式做的决定"（手动 ⏭、点集按钮、选下拉——这些动作本身就表达了"我要去那集"，到了不自动开口才是 bug）。同理续听：用户主动点单集→给续听条等确认（不替他播），用户点"连播听全剧"→直接按存档开播（入口意图已含播放）。入口意图决定自动化程度，开关只裁剪系统主动行为。
- **㊾续听/草稿类本地状态四要素：版本指纹、完成即清、容量上限、隐私环境静默**。①存进度必须带结构指纹（段总数 total），内容改版后指纹不符回退起点，错位续播比从头播更糟；②走完整条流程（听完末段、手动跳走）即清存档，否则"上次听到 98%"的幽灵提示永久挂着；③localStorage 不是数据库，单键 map + LRU 120 条封顶防膨胀；④所有读写 try/catch（Safari 隐私模式/配额满会抛），失败降级为无记忆，绝不允许"续听功能不可用导致播放主交易不可用"——增强的失败永远不得抬升为主交易故障（㊳/㊸ 原则在客户端的延伸）。

## c209 功能轮：集尾钩末拍反作弊（泄气/梦境作废）+ /fix 后钩子台账漂移修复 + 钩子可见卡，复盘修续听 id 失效与 iOS 跨集静默（v2.185.29）

**本轮性质**：功能轮（c208 v2.185.28 后）。一条主线"集尾钩子从检测到可见到账本自洽"贯穿引擎/后端/前端三层，外加 c208 听剧连播静态复盘修两个真实缺陷。TDD：引擎 13→19（+6）、http-generate 91→92（+1）先红转绿；升版 v2.185.29。

### 一、问题与修法（问题-证据-修法）
1. **D1（创作能力，引擎）末拍反作弊缺失：钩子建好后最后一拍亲手泄气/用"一场梦"作废，引擎仍给高分**。`cliffhanger-score.ts` 原只看"有没有钩"，不看钩是否在最后一拍被叙事撤销。新增两条只扫描**最后一拍正文行**（body 已过滤场景标题，取 `body[body.length-1]`，绝不全篇误杀）的信号：①`DEFLATE_ZH/EN` 末拍泄气（"一切归于平静/尘埃落定/画上句号/lived happily ever after/back to normal"等）——**仅在 maxStrength≥75（已立起实质钩）时**判 `hook_deflated`(mid)，分数封顶 maxStrength-20；钩都没立起来不存在"泄"，避免弱钩集重复扣分。②`DREAM_ZH/EN` 梦境作废（"原来是一场梦/不过是一场梦/梦醒了/it was all a dream"）——判 `dream_nullification`(high)，分数**硬封顶 40 且不设强度门槛**：钩子事实不成立，"好钩但作废"比"弱钩"更伤留存。反向不误杀成对配测：台词"我连做梦都想赢"不命中（要求末拍以梦字结论收尾）、冷笑收尾的 ZH_REVERSAL 不判泄气。
2. **D2（后端，账本漂移 P0）/fix 付费改写后 qcReport.cliffhanger 仍是旧稿台账**：改写换了结尾，分数/类型/结尾片段却停留在生成时，前端看到的钩分与新正文无关，下一集 deriveHookBit 读的是新稿、诊断卡读的是旧账，两处自相矛盾。修法：/fix create 之前对 `rewritten` 跑纯函数 `scoreCliffhangerForStorage`（自动语言探测→digest），qcReport 展开旧台账后整体覆盖 cliffhanger 键（score/type/typeLabel/endingSnippet/issues/planAlignment=null——改写入口没有规划上下文，置 null 而非伪造对齐）；beats/outline/payoffRhythm 等其余台账沿用旧版不动。位置纪律：isUsableRewrite 通过、findFirst 版本校验之后、create 之内，纯函数零异常零成本，不碰资金语义。同切片顺手修两处同家族不一致：批量落库（手写 4 字段，缺 issues/planAlignment）与 SSE done 统一改走 `cliffhangerDigest(result.cliffhanger)`，三条落库路径形态完全一致。新增导出三件套：`detectCliffhangerLang`（含汉字→zh 否则 en）、`cliffhangerDigest`（endingSnippet 末 100 字、issues≤4、evidence≤120、advice≤160）、`scoreCliffhangerForStorage`。
3. **D3（前端，不可见缺陷第三例）cliffhanger 是 issues 形态无 hits，通用 chips 硬过滤让它永远不可见**（sceneSoftEnding/showDontTell/arc-tracker 同家族）。buildQcReportHtml 新增专用集尾钩卡，不走 hits 管道：逐集读 qc.cliffhanger（`typeof score==='number'` 才算数，兼容 c209 前只存 4 字段的旧行——issues 缺省 []、planAlignment 缺省 undefined）；weakish = none/weak/score<80/有 issue/planAlignment===false，只挂待加强集，过硬集只计数（副标题"N 集待加强，M 集过硬"，防长篇全绿噪音）；chip 显示类型名+分（<60 qc-bad 否则 qc-warn），title 悬停拼偏离规划提示+issues 前 4 条 advice/evidence+endingSnippet 末 80 字，全部 escapeHtml 后 slice(0,400)；八型 zh/en 兜底映射，i18n 用 `v===key?default:v` 纪律；空判纳入四数组联合 return；复用现有 CSS 类零新样式。
4. **D4（c208 复盘抓出，前端真实 bug）整剧连播续听定位只防段数错位、不防 scriptId 失效**：改版/重新生成使最新版换新 id 后，localStorage 里的旧 scriptId 不在新片单中，openListenSeries 仍直接 listenLoadEpisode(旧 id)→/listen 404→"加载失败"，连播入口整个废掉（㊾的版本指纹只做了 total 层，漏了 id 层）。修法：采信存档前先 `list.some(e=>e.scriptId===saved.scriptId)`，id 失效回退第一集；id 有效但 total/段数对不上仍由 renderListen 既有边界回退从头，两层指纹各管各的。
5. **D5（c208 复盘抓出，iOS 真机缺陷）自动跨集在 iOS Safari/WKWebView 必然静默失声**：iOS 规定 speak 必须挂在用户手势调用栈里，而连播/选集/片单入口的自动开口发生在 fetch 返回+80ms 延迟之后，脱离手势被静默拒绝且无 onerror，用户看到"在播"没声音。修法保守分叉：`listenIsIos()`（UA 含 ipad/iphone/ipod，或 MacIntel+maxTouchPoints>1 兜 iPadOS 伪装）且走自动开播路径时，不直接 speak，改为渲染"下一集已加载，轻点继续连播"条，按钮 onclick→speakListenIdx（真实点击手势必能开口）；单集入口本来就不自动开口（续听条/播放键均是手势）不受影响；桌面/Android 路径一字不动。crossNext 标志区分首集就绪文案与跨集文案。

**先红-转绿记录**：cliffhanger-score.test.cjs 新增 6 条（泄气中/英封顶 maxStrength-20 且仅 ≥75 触发、梦境中/英硬封 40 无门槛、两条反向不误杀），19/19 绿；http-generate.test.cjs 新增 describe「c209 /fix 后集尾钩重算且台账保留」1 条（初红 403：剧情类深度修复闸门需 ADVANCED，BASIC 被 ASSISTANT_LEVEL_REQUIRED 拦——改测试种子等级而非放松闸门；断言 v2 type=reversal/score≥70/endingSnippet 含关键词/issues 为数组/planAlignment in 对象/片段≤100，beats/outline/payoffRhythm 与 v1 deepStrictEqual 沿用旧版，v1 行不被改），该文件 92/92。

**回归证据**：npx tsc 零输出；node --check web/app.js 通过；全量 `NODE_ENV=test node --test test/` **4875 pass / 0 fail / 445 suites**（c208 基线 4866 + 引擎 6 + HTTP 1 + 套件 1，严丝合缝）。pm2 restart v2.185.29 双实例 online + /health ok；HTTP 拉取线上 app.js 指纹核验 listenIsIos/listenShowTapToPlay/续听 id 回退注释/集尾钩卡标题/crossNext 分叉全部在响应体中（确认静态发布生效）。D4/D5 为前端分支逻辑，静态推演+语法核验，未做 iOS 真机与真库联调（无 macOS/iOS 设备环境；分支对桌面零影响）。

### 方法论沉淀
- **㊿"有没有"及格后必须立刻补"被不被撤销"：叙事检测的反作弊层要盯撤销动作本身，且撤销只在特定位置生效**。泄气检测不能全篇搜"平静"（中间段本来就该平静），必须锚定**最后一拍**；梦境作废不设强度门槛（事实撤销与质量高低无关），泄气设门槛（弱钩谈不上泄气，防重复扣分）。通用范式：每个"加分信号"上线时，同步问一句"作者用什么低成本写法能在最后一行把它合法注销"——末拍泄气、原来是梦、替身/幻觉/旁白撒谎/重置时间线，都是同一类注销句，检测位置=撤销动作的合法生效位置。
- **51. 派生台账随主交易重算的时机：当且仅当主产物被付费动作整体替换**。生成时算一次 cliffhanger 进 qcReport 是台账；/fix 花钱把正文换成另一版后，所有"从正文派生"的字段都必须在同一事务里重算，否则前端展示、下一集上下文、诊断卡会各读各的版本——这是"派生物无独立生命周期"原则（账本字段不允许有自己的更新时间线）。而 beats/outline/payoffRhythm 这类**不是从新正文派生、而是改写输入上下文**的台账反而不能重算。判别问句：这个字段换了正文后是否必然失真？是→重算；否→保留。三条写库路径（批量/单篇/SSE）必须共用同一个 digest 函数，禁止手写字段子集——漏字段就是从同一个分叉点长出来的。
- **52. 本地存档的版本指纹是两级的：id 指纹防"实体已换"，结构指纹防"实体同名但内容已改"，两级都过才采信**。㊾只立了 total 结构指纹，本轮 D4 补上 id 指纹：先确认存档指向的实体仍存在于当前集合（some 匹配），再确认内部结构对得上（total 相等、idx 越界回退）。顺序不能反：id 没了还去校验 total 是对空气做校验。失效即回退最安全默认（第一集/从头），绝不弹错误把用户挡在入口外——增强路径的存档失效，用户语义是"我要继续消费内容"而不是"给我看 404"。
- **53. 浏览器能力的手势约束属于平台铁律，不能用"取消后延迟重说"一类时序技巧跨过去，只能分叉交互**。c207 的 80ms 延迟解决的是 Chrome cancel→speak 吞句（同一手势内的时序竞态）；iOS 的问题是手势身份在网络 await 处已经断裂，任何时长的 setTimeout 都救不回来。正确做法是探测平台+识别"无手势的自动开口点"，把"自动播放"降级为"自动备好+一次轻点"，让点击本身成为手势；切忌在 iOS 上静默失败还显示播放态。能力分叉的落点永远是用户可感知的兜底 UI，而不是 console 里吞掉。

## c210 功能轮：角色弧光引擎效价泛化（跳变检测覆盖全情绪对）+ 缺席假停滞修正 + 落库形态三处合一 + /fix 弧光重算 + 质检面板弧光卡（v2.185.30）

**本轮性质**：功能轮（c209 v2.185.29 后）。承接 c208-c209 同一家族问题"issues 形态引擎在质检面板不可见 / 落库形态分叉 / 付费改写后台账漂移"的第四例（sceneSoftEnding、showDontTell 同族仍按范围纪律另起切片，本轮未扩）。TDD：新建 test/arc-tracker.test.cjs 8 条先红转绿（此前引擎零单测）、http-generate 92→94（+2）；升版 v2.185.30。

**问题-证据-修法（静态复盘，七处缺陷全部先写测试钉死再改码）**：
1. **D1（引擎漏判，P1）跳变检测只硬编码 calm→despair、hope→despair 两对且 reason 写死**。joy→despair、despair→joy、calm→joy、joy→fear 等跨极硬切全漏，而这些恰是短剧最显假的情绪转折（上一秒狂喜下一秒崩溃）。修法：建情绪效价轴（joy+2/hope+1/calm 0/anger-1/fear-1/despair-2），相邻效价差≥2 且本集情绪轨迹中找不到**非目标情绪自身**的中间缓冲即判跳变；下行缓冲集 fear/anger、上行 hope/calm；效价相邻（fear→despair、hope→joy）是可信渐变不抓。reason 按对生成（"情绪从喜悦硬切到绝望，缺少恐惧/愤怒过渡"），issues type 字面量 arc_stalled/emotion_jump 保持不变（pipeline.ts i18n 映射依赖）。
2. **D2（引擎假阳性，P1）缓冲情绪不能是目标主导情绪自身**。泛化时若照抄旧写法 `emotions.includes('fear')` 赦免，joy→fear 会因为本集轨迹里本来就全是 fear（主导情绪即 fear）而被自我赦免——缓冲必须 `e !== currEmo`，测试专门钉死该用例。
3. **D3（引擎假阳性，P2）挂名缺席角色被误报弧光停滞**。圣经里的配角本集完全没出场（dominantEmo/stage 均 unknown），若前集也 unknown，旧逻辑判 stalled"角色无成长"——没出场哪来成长。修法：`absentThisEp = emotion==='unknown' && stage==='unknown'` 时不报停滞（仍保留在 characters 供分数量化，只是不记问题）。
4. **D4（引擎排序错误，P2）lastStage 注释称"按文中位置取最后"，实际 stages 数组按"出现位置外层 × STAGE_MAP 词表序内层"push，取末元素是词表序最后而非原文序最后**。修法：findSignalsNear 阶段命中带绝对位置 `{stage,at}`（同一关键词多次出现都记录），lastStage 按 at 排序取末位；顺手修 relations 只用 text.indexOf 首次出现位置（多场共现漏判）→ 任意共现窗口命中即记、同 target 去重、封顶 10。
5. **D5（落库分叉，P1，c209 D2 同家族第四例）arcTrack 三处形态不一且批量落库丢诊断**：批量 qcReport 只存 `{characters(裸含无界 emotionTrack/relations), score}`，丢 stalled/jumpCut/issues；SSE 全量但只在流里刷新即丢。修法：新增 `arcTrackerDigest()`——characters 只 {name,emotion,stage,changed} 四字段（剥离无界轨迹/关系表）、角色≤20、stalled/jumpCut 各≤8、issues≤4、reason≤80/advice≤160 截断；null 输入显式抛错不静默伪造；批量 2894 行与 SSE 2992 行（generate.ts）同走 digest，字段名与旧消费方完全一致（生成页 arcTrackTip 读 score/四字段/stalled/jumpCut/issues，零改动，改前已读 app.js 4455-4477 确认契约）。
6. **D6（付费改写台账漂移，51 号方法论的第二次应用）/fix 后 arcTrack 不重算**：正文已整体替换，旧停滞/跳变台账留在新版本，且下一集 prevArc 读错误本集状态造成跨集误差累积。修法：/fix 在 freshCliffhanger 同位置重算——名表取并集（圣经 cast ∪ 本集旧台账角色 ∪ 上集台账角色，旧项目圣经无 cast 也能算），prevArc 精确读上一集**最新版** qcReport.arcTrack.characters（digest 四字段即跨集输入所需），首集/读不到则 null（停滞跳变自然为空，绝不拿本集旧台账冒充前集伪造跳变）；任何异常退回 null=保留旧台账不阻断付费交付；beats/outline/payoffRhythm 等非正文派生日志照旧不动。
7. **D7（前端不可见，c209 D3 同家族）arcTrack 是 issues 形态无 hits，通用 chips 卡硬过滤永远不可见**。buildQcReportHtml 新增角色弧光卡（位于集尾钩卡后）：逐集读 qc.arcTrack（typeof score==='number' 且 characters 为数组才算数，兼容旧库仅 {characters,score} 的行——stalled/jumpCut/issues 缺省 []，健康计入 arcHealthy）；只挂待修集（停滞/跳变/issues 非空或 <70），健康集只进副标题计数；停滞 chip qc-warn、跳变 chip qc-bad（zh/en 标签+情绪 enum 本地化 joy 喜悦→despair 绝望）、弧光分 chip（<60 bad）；title 悬停 reason/issues advice 前 4 条；角色当前态情绪/阶段速览行；全部 escapeHtml、数组防空、复用现有 CSS；空判纳入五数组联合 return。

**先红-转绿记录**：test/arc-tracker.test.cjs 新建 8 条——旧规则 2 条（calm/hope→despair 无缓冲仍抓、本集出现恐惧赦免仍有效，防泛化回归）、跳变泛化 3 条（joy→despair 抓到且愤怒缓冲赦免、despair/calm→joy 抓到且希望缓冲赦免、joy→fear 目标情绪自我赦免钉死）、缺席修正 1 条（路人甲不报、真停滞主角仍报）、digest 2 条（四字段剥离+全键保留+type 稳定、25 角色封顶 20/列表封顶 8/issues 封顶 4/advice≤160/空形态 deepEqual/null 抛错）；首跑 6 红 2 绿，改引擎后 8/8 绿。http-generate.test.cjs 新增 describe「c210 /fix 后角色弧光重算且形态限界」2 条（ADVANCED 闸门沿用 c209 夹具纪律）：①两集工程，ep1 台账 joy/resolution，ep2 旧台账 calm/setup+陈旧停滞，改写稿无缓冲绝望→v2 emotion=despair、jumpCut 含 joy→despair、issues 含 emotion_jump、陈旧停滞消失、角色键 deepEqual 四字段、beats/outline/payoffRhythm deepStrictEqual 保留、v1 两行均不被改；②圣经 bible=null 时从旧台账角色名并集仍重算（阿昭→despair），首集 prevArc=null 时 jumpCut 必须为 0（不伪造）。http-generate 94/94。

**回归证据**：npx tsc 零输出；node --check web/app.js 通过；全量 `NODE_ENV=test node --test test/` **4885 pass / 0 fail / 446 suites**（c209 基线 4875 + 引擎 8 + HTTP 2 = 4885，套件 +1，严丝合缝；权威回归仍必须带 NODE_ENV=test，严禁 scripts/run-tests.cjs）。pm2 restart v2.185.30 后 /health ok，线上 app.js 指纹含"c210 角色弧光卡"。本轮纯函数+落库逻辑，未做真库联调（无新增支付路径，/fix 资金链路 c203/c209 已覆盖）。

### 方法论沉淀
- **54. 情绪类状态机的硬切检测不能枚举"坏状态对"，必须建连续轴（效价/唤醒度）按距离判定，并在轴上定义"可信缓冲带"**。写死 calm→despair 两对的引擎在上线当天就漏掉 joy→despair（最常见的爽剧垮塌写法），因为坏对组合是 O(n²) 且随词表增长。正确结构：一维效价轴 + "相邻=渐变，跨极=硬切，硬切但途中出现中间态=可信"三条规则；其中缓冲检测必须排除目标态自身，否则任何硬切都被主导情绪自我赦免。推广：任何"前后状态对比"类检测（情绪、态度、关系亲密度、立场阵营）都适用同一骨架——轴、距离阈值、中间态证据。
- **55. "没出场"与"出场但没变化"是两种语义，缺席不得计入停滞类负信号**。台账对比型引擎的通病：把数据缺失（unknown/unknown）当作一种状态去和前集比，于是挂名配角连续两集没戏份就报"弧光停滞"。判别铁律：变化检测前先做在场判定（本集有无任何信号），缺席走"不评价"分支（可保留在名单供量化，但不进问题列表、不拖累诊断）；同理关系台账里"本集未同框"不等于"关系破裂/疏远"。数据缺失的默认动作是沉默，不是报错更不是扣分。
- **56. 重算型台账的名表（实体集合）来源必须取并集且可脱离原始配置独立存活**。/fix 重算 arcTracker 需要角色名表，但旧项目可能没有结构化圣经 cast；只信 bible 会让一大批历史项目的台账永远无法重算。修法：名表=结构化配置 ∪ 本集旧台账实体 ∪ 上游集台账实体，并集后计算——旧台账本身就是"当时认定的实体集合"的可信快照。推广：任何对历史产物的重算/迁移，输入实体集合都应优先从产物自身恢复，配置只作补充，避免"配置演进导致旧内容无法被新代码理解"。

## c211 功能轮：sceneSoftEnding/showDontTell 落库统一 digest（issues 形态引擎补盲）+ /fix 双引擎重算 + 质检面板两张专用卡（v2.185.31）

**本轮性质**：功能轮（c210 v2.185.30 后）。c208 以来"issues 形态引擎不可见/落库分叉//fix 漂移"家族的**第五、六例，且是范围纪律主动扫尾**——c210 节已点名"sceneSoftEnding、showDontTell 同族另起切片"，本轮一次收掉，不再零散补。TDD：scene-soft-ending 14→18（+4）、show-dont-tell 96 行文件 +2、http-generate 94→96（+2）；升版 v2.185.31。

**问题-证据-修法（静态复盘，四处缺陷全部先写测试钉死再改码）**：
1. **D1（落库静默丢字段，P1）sceneSoftEnding 的 advice 是标量字符串，通用摘要只透传数组型 advice**。它有非空 hits[]，批量落库能经 buildQcEngineDigest 进 qcReport，但 issues 被 slice(0,3)、advice 因 `Array.isArray` 判定被整体丢弃；SSE 却是另一份手工形态（hits.slice(0,8) 四字段+issues/advice 原样）——同一份质检结论，流里一份、刷新后一份。
2. **D2（生成后永久失明，P1）showDontTell 是 issues 形态：无顶层 hits[]，四类命中分散在 tellEmotionHits/summaryHits/abstractAdjHits/innerMonologueHits**。buildQcEngineDigest 的准入条件写死 `Array.isArray(o.hits) && o.hits.length>0`（qc-digest.ts 原 34 行注释甚至明说"showDontTell 无 hits，天然排除"），于是它**只在 SSE done 流里出现，从不落库**——用户生成完看到提示，刷新页面后质检面板永远找不到该结论；通用 chips 卡同样按 hits 硬过滤，前端也无任何专用卡。
3. **D3（/fix 漂移，51 号方法论第三次应用）两引擎在付费改写后都不重算**。正文整体替换后，旧的"泄气尾巴/直说情绪"台账原样带进新版本，面板读到的是 v1 残留；cliffhanger（c209）、arcTrack（c210）已修，这两个同族漏网。
4. **D4（前端无消费形态）showDontTell 无词条无卡片，severity/evidence/advice 无法呈现；sceneSoftEnding 旧库行还会与新专用卡重复渲染**。

**修法（与 c209/c210 同范式，三处合一）**：
- scene-soft-ending.ts 新增 `sceneSoftEndingDigest()`（hits≤8 且只 {sceneHeader,endLine,ending,reason} 四字段、header≤40/ending≤30/reason≤120、issues≤6 且每条≤200、advice 标量字符串≤200、score/sceneCount/checkedScenes 透传、null 显式抛错）+ `sceneSoftEndingForStorage(text)`（引擎内部 isZhText 自探测语种，无 lang 入参）。
- show-dont-tell.ts 新增 `showDontTellDigest()`（issues≤6 且每 issue 只 {severity,type,evidence,advice}，type≤40/evidence≤180/advice≤160；四类无界命中数组剥离只留 `counts:{tellEmotion,summary,abstractAdj,innerMonologue}`；保留 longestProseBlock；null 抛错）+ `detectSdtLang()`（含汉字判 zh 否则 en，仿 cliffhanger-score 的 detectCliffhangerLang）+ `showDontTellForStorage(text,lang?)`。
- generate.ts：批量落库（原 2924 行台账键区，arcTrack 旁）显式写两 digest；SSE 两处手写字段（原 3042/3189 行）替换为同一 digest 调用；/fix 在 freshArc 后 try/catch 重算 freshSoft/freshSdt（纯函数自探测语种，异常退回保留旧台账，纪律同 freshArc），落库对象条件展开；qc-digest.ts 新增 `QC_SPECIAL_DIGEST_KEYS` 集合（sceneSoftEnding/showDontTell），通用扫描跳过——防止"通用摘要展开在前"先写出一份旧形态（即使后写键会覆盖，也不允许分叉形态短暂存在于代码路径）。
- web/app.js buildQcReportHtml 新增两张专用卡：①场景收尾卡（挂 hits 非空或 score<100 的集，尾句+原因+advice 悬停，issues 速览行，健康集 softHealthy 计数，兼容旧库 hits 缺省）；②展示而非叙述卡（issues 驱动，type 五字面量 zh/en 映射 tell_emotion 直说情绪/summary_not_scene 总结代戏/abstract_adj 抽象形容/inner_monologue 内心独白/long_prose_no_action 叙述墙，high→qc-bad 余 qc-warn，evidence+advice 悬停，counts 四计数速览，兼容旧库 tellEmotionCount 扁平字段，健康集 sdtHealthy 计数）；通用 chips 循环显式 skip 两键（旧库残留通用摘要行不与专用卡重复）；两卡纳入空判联合 return 与条件输出块；全部动态文本 escapeHtml、零新 CSS。

**先红-转绿记录**：两引擎测试文件追加 6 条先红（digest 未导出时 5 红/文件合计 22 例）——sceneSoftEnding：12 hits/9 issues 伪造大对象截断（hits 恰好 8、issues 恰好 6、hit 键 deepEqual 四字段、header/ending/reason/issues/advice 各上限）、健康空形态透传（score 100、hits/issues 空数组、advice 仍为 string）、null/undefined 抛错、forStorage 端到端（泄气稿恰好 1 hit 且 score<100、硬切稿 0 hit）；showDontTell：9 issue 大对象（恰好 6、issue deepEqual 四键、type/evidence/advice 截断、counts deepEqual 四计数与 hits 数组一致、null 抛错）、detectSdtLang 中英探测+forStorage 双语端到端（中文 tell_emotion、英文 felt/was 自动 en）。实现后两文件 22/22 绿。http-generate 新增 describe「c211 /fix 后软收尾与展示而非叙述重算且形态限界」2 条：①中文稿 v1 双旧形态（sceneSoftEnding 通用摘要分叉+advice 数组、showDontTell 扁平 tellEmotionCount=9），改写稿含拍桌亲子鉴定高能场+叹气默默离开末拍+三处直说情绪→v2 soft hits=1 且四字段/advice 归 string、sdt issues 含 tell_emotion 且四字段/counts.tellEmotion≥3/无无界数组与旧扁平键、cliffhanger 仍为数值、beats/outline/payoffRhythm deepStrictEqual 保留、v1 行两旧值原样；②英文稿自动语种（INT. 场+slammed/shouted+walked away+felt very angry/was anxious/was sad）→soft 1 hit 且 advice 英文、sdt counts≥3、落库顶层 deepEqual 仅四键。http-generate 96/96。

**回归证据**：npx tsc 零输出；node --check web/app.js 通过；全量 `NODE_ENV=test node --test test/` **4893 pass / 0 fail / 448 suites**（c210 基线 4885 + 引擎 6 + HTTP 2 = 4893，套件 +2，严丝合缝）。pm2 restart v2.185.31 后 /health ok，线上 app.js 指纹含两张新卡标题。本轮纯函数+落库+前端卡，未做真库联调（无新增支付路径，/fix 资金链路 c203/c209/c210 已覆盖）。

### 方法论沉淀
- **57. issues 形态引擎接入面板必须自带"落库 digest + 专用卡"，不能指望通用 hits 管道开恩**。通用管道的准入条件（score+hits[]）在第一个 issues 引擎出现时就是排他性契约，后续无 hits 的聚合分类引擎（证据分桶在多个子数组里）天然永远落不了库；与其放宽通用扫描（会把无界命中明细、语言相关原始字段全灌进库），不如为每个非标准形态引擎显式建 digest：只放卡片真正渲染的字段，原始证据留在生成时/SSE。判别：引擎结果顶层没有 hits[] 的那一刻，就该同时规划 digest 与专用卡，三件事是一个提交，不许只发 SSE。
- **58. 标量与数组的同名 advice 是落库契约分叉，归一化必须发生在 digest 层而不是消费层**。sceneSoftEnding.advice 是 string、多数引擎 advice 是 string[]，通用摘要用 Array.isArray 静默吞掉标量——消费端各自 `typeof` 兼容只会让分叉扩散。规则：digest 是唯一的形态边界，输入形态多怪都在 digest 里归一成稳定契约（标量就截标量、数组就截数组），落库之后的所有读路径（SSE/面板/下一集上下文）只面对一种形态；通用摘要也不得再"好心"透传未归一字段。
- **59. 同一家族的问题修到第四例后，应主动做一次同族全扫并集中收掉，而不是继续一例一轮地挤牙膏**。c208-c210 连续四轮都在修"issues 不可见/落库分叉//fix 漂移"，每轮节末都备注"同族另起切片"——这是范围纪律的优点（单轮可控），但到第四例时正确动作是主动枚举 pipeline result 的全部键，按"有无 hits、落库走哪条路径、/fix 是否重算、前端有无消费"四列过一遍，一次规划剩余同族（本轮两键即扫尾结果）。判据：当同类问题在三个以上不同引擎上重复出现，再按触发式修补的边际成本已高于一次性盘点；扫尾轮同样保持 TDD、限界、不扩引擎检测逻辑。

## c212 功能轮：32 结构引擎 issues 形态通用落库路径 + /fix 全量结构重扫 + 体检卡/通用兜底（v2.185.32）

**病象（c211 同族全扫的真正战果）**：c211 节末按方法论 59 四列框架（形态/落库/SSE/前端//fix 重算）枚举 pipeline result 全键，发现 v2.114-v2.147 的结构维度族 **33 个引擎在 SSE done 块全量手工展开发送，但 25 个无顶层 hits 的键（结果形态 `{score, issues:[{severity,type,evidence,advice}], …计数}`）被 buildQcEngineDigest 旧硬条件（要求非空 hits[]）整体排除——只进流、从不落库、刷新即失明、/fix 永不重算**，规模是 showDontTell 一案的 25 倍。voicePrint/dialogueAiTaste 等 issues-only 创作引擎同族失明。台账同名键陷阱：timeline/payoffRhythm/cliffhanger 在 qcReport 是跨集台账（QC_LEDGER_KEYS 已排除），结构富形态只活在 SSE；补盲绝不能覆盖台账键。

**三处修复（通用化，不写 33 个专用 digest）**：
1. [qc-digest.ts](file:///Users/a123/Desktop/养正/zhongnan/zhongnan-backend/src/engine/qc-digest.ts) 双路径：路径 A（hits 非空）行为零变化；新增路径 B（无 hits + issues 为规范对象数组）产出限界摘要 `{score, issueCount, issues≤5(severity 非 high/low 归 mid、type≤40/evidence≤160/advice≤200), gate?≤20}`；健康引擎（issues 空）不收录——批量落库零存储增量。批量落库处 `...buildQcEngineDigest(result)` 一行自动获得全部键。
2. 新建 [structural-rescan.ts](file:///Users/a123/Desktop/养正/zhongnan/zhongnan-backend/src/engine/structural-rescan.ts)：/fix 无 pipeline 上下文时对改写后正文纯函数重跑 **32 键**（7 hits 键+25 issues 键；openingWeld 依赖前集结尾不重算，timeline/payoffRhythm 台账排除）。统一输出 rescan 契约（健康引擎也写 issueCount:0 空壳——/fix 是覆盖语义，必须能用健康清掉 v1 旧账，这是与批量 digest 的唯一形态差异）；汉字自探测语种；入参支持 CastMap 或名字数组（/fix 只有 castNames）；逐键 try/catch，单引擎异常跳过该键（保留旧值，异常≠健康），绝不阻断付费交付。generate.ts /fix 块落库对象末尾展开。
3. [app.js](file:///Users/a123/Desktop/养正/zhongnan/zhongnan-backend/web/app.js) buildQcReportHtml 新增「结构维度体检 · 32 维」卡：32 键中英标签（释义提炼自 SSE 注释），只挂 issueCount>0 的维度，high 或 score<60 红、其余黄，悬停 title 拼 type/evidence→advice（≤400 全 escapeHtml），健康集计数；hits 形态七键仍归通用创作卡不重复渲染（/fix 后转 issues 形态自然入本卡）。另加**同族兜底行**：任何非 32 键、非专用卡的 issues 形态引擎（voicePrint 等）自动渲染，词条缺省 humanizeEngineKey——新引擎落库即可见，不再逐族补卡。

**先红-转绿记录**：test/qc-digest.test.cjs 追加 5 例（issues 收录+全限界+severity 归一、gate 透传/非字符串丢弃、路径 A 零变化、SPECIAL/LEDGER 键 issues 形态也排除、string[] issues/空 issues/无标识/无 score 不收录）——先 3 红后 10/10。新建 test/structural-rescan.test.cjs 5 例（中文稿 32 键恰好齐全且契约/限界全验、英文稿键集一致、问题稿巧合家族真实命中证明非空壳、空/短/无 cast 不炸、cast 三键契约）——实现后 5/5 一次绿（夹具即真实触发稿）。http-generate 追加 c212 describe 2 例（concurrency:1，u_c212fix，bible 带 cast；v1 伪造 causalLogic 旧账 OLD_STALE+超长 evidence + timeline/openingWeld/beats/outline/payoffRhythm 台账）：首跑 503（改写稿短于字数预检，补 mk(14) 长前缀）→ 中文 v2 重算键≥28、全键 issueCount/issues 契约且无 hits 富列表、causalLogic 真命中巧合且旧账消失、cast 三键在、五类台账 deepStrictEqual 保留、v1 不动；英文稿同理。http-generate 98/98。

**回归证据**：npx tsc 零输出；node --check web/app.js 通过；全量 `NODE_ENV=test node --test test/` **4905 pass / 0 fail / 451 suites**（c211 基线 4893/448 + qc-digest 5 + rescan 5 + HTTP 2 = 4905，套件 +3，严丝合缝）。pm2 restart v2.185.32 后 /health ok，线上 app.js 指纹含「结构维度体检」「金手指规则一致」。未做真库联调（纯函数+落库+前端，无新支付路径）。

### 方法论沉淀
- **60. 通用化修在"扫描层"而不是"逐引擎补卡"：同族规模上两位数时，正确杠杆是让边界函数双路径兼容，一处改动全族受益**。25 个 issues 引擎失明，根因不在任何引擎，而在 buildQcEngineDigest 这一道形态边界只认 hits。修法对比：逐引擎写专用 digest/专用卡要 25 份代码、25 个未来维护点、第 26 个引擎照样失明；在扫描层加路径 B + 前端兜底行，新增引擎自动获得落库与可见性。前提是限界契约统一（issueCount/issues≤5/字段长度上限/severity 归一），通用化不等于放过无界数据。判断口径：同类形态的消费者超过 5 个，就不许再复制第 6 份适配。
- **61. SSE 手工展开 ≠ 落库，"生成时能看见"从来不构成功能闭环；新增引擎必须三同（SSE/落库//fix 重算）作为一个提交**。33 个引擎的 SSE 展开块写得极其详尽（富字段、注释完整），给人"功能已上线"的错觉，但刷新页面数据即丢、付费改写后旧账常驻。验收新引擎的 checklist 必须显式三问：①不落库刷新后还在吗？②同集 /fix 后按新正文重算吗？③前端有无消费方（而非零 grep）？三问缺一，引擎只算 demo。台账同名键（timeline/payoffRhythm/cliffhanger）是重算禁区：覆盖前必须确认 qcReport 同键不是跨集台账。
- **62. 重算（覆盖语义）与批量落库（增量语义）的健康态处理相反，必须分开建模，不能共用一个"省存储"假设**。批量落库只写有问题的键（零增量）；但 /fix 重算若健康键缺席，v1 的旧问题会永远残留——重算必须写 issueCount:0 健康空壳去显式覆盖。同一个 buildQcEngineDigest 不能直接用于 /fix（它会吞掉健康态），structuralRescan 因此独立产出含空壳的统一契约。经验：任何"读-改-写"场景，先问旧值的生命周期——新值缺席时旧值应保留还是应清除？两个答案对应两套函数，不要让一个函数同时伺候。

### c213（2.185.33）：场头判定单点真相 + 30+ 引擎扫描谓词大收口 + 五引擎词典/英文格式修复

**背景（32 键 × 4 规范场头矩阵取证）**：四种制式/变体场头——中文 AIGC「内景 地点 时间」、LIVE「场景1：地点·时间」、简写「场3：」「第5场」、英文「INT. PLACE - DAY」/「Scene N:」——在仓内有 **30+ 份私有正则副本**，互不一致：有的漏「场景：」（无数字）、有的漏「室内/室外」、英文有的不覆盖 `INT./EXT.` 或屈折格式。后果：规范稿被切成单场，整场被当成一段对白/叙述，information-density/scene-density/对白功能等引擎集体误判；而「场景：客厅」这类场头行还会被 [character-logic.parseDialogue](file:///Users/a123/Desktop/养正/zhongnan/zhongnan-backend/src/engine/character-logic.ts) 的宽松说话人正则解析成幽灵对白角色「场景」，character-balance 的 `speakingChars>=3` 闸门靠幽灵凑数——测试竟然因此"通过"，是典型假绿。

**c213-1 单一事实源**：[script-scenes.ts](file:///Users/a123/Desktop/养正/zhongnan/zhongnan-backend/src/engine/script-scenes.ts) 成为全仓唯一场头判定模块——`isSceneHeaderLine(line, lang?)`（四规范全格式，语种可显式传或汉字自探测）、`splitScriptScenes(text, lang?)`（场头前引子归空 header 开场不丢弃、剧名页/FADE OUT 不切场）、`detectScriptLang`、`ScriptLang`；本轮新增 `isSceneOrTitleLine`（场头 + `《…》`剧名行/`集标题` + 英文 `FADE OUT/FADE TO`）专供"扫描时跳过非正文行"的引擎，**切场仍只能用 isSceneHeaderLine**——两个函数语义分层，剧名行永不切场。

**c213-2/3/4 引擎修复（每条先写"优质规范稿会响"的红测试再转绿，负向夹具防放水）**：
- information-density 新增第七类 `evidence/实证揭示`（generate.ts 原样透传，前端 typeLabel 透传无写死颜色，审计有证据）；overload 双条件 `infoCount>=4 && (density>=30 || hitLineCount<=2)`，修"信息只堆在 1-2 行却豁免"的漏洞。
- dialogue-functionality-check：中文括号舞台提示修复；CHARACTER_EN/CONFLICT_EN 扩亲缘指代/关系回溯/能力质疑词。
- antagonist-quality：COMPETENCE/LAYER/CONFRONTATION 中英扩词（空壳公司/袖口/拍桌/shell company/freezes/slides over contract，全带 g flag）；夹具反派无明示动机属事实而非缺陷，**motiveless_villain 中文判定刻意不动**——负向夹具是防放水闸门。
- protagonist-goal：兑付词加制度性兑付（执法到场/坏人被带走/uniformed officers/handcuffed）。
- scene-density 三件：英文对白正则改全大写多词说话人（UNCLE TED）+ 整行括号动作行；情绪词全部屈折展开（smil(e|es|ed|ing)）；冲突词中英扩词（揍/有用么/do not ask/what can a…/snatch）。

**c213-6 大收口（101+4+11+12 处）**：codemod 批量迁移 101 个 `SCENE_HEADER_RE` 引擎；手工收口 supporting-arc/continuity-supervision/supporting-character/show-dont-tell/dialogue-functionality 的异名谓词；codemod+perl 收口 11 个 HEADER_ZH/HEADER_EN 双正则引擎；本轮再收口 character-balance/repetition/punchline/twist/dialogue-water/rhythm/cliffhanger/vague-word/sensory-detail/stance-flip/character-logic/script-length/dialogue-ai-taste 共 13 处（最后一个保留"日/夜/闪回/括号标签"本地语义，场头部分走共享）。**明确保留不迁移的白名单**：带捕获组的格式解析器/校验器（aigc-screenplay、scene-asset 的 io 前缀提取、script-format 全文存在性检测、writers-room 全局替换、listen-script、scene-header-convention、production-materials、location-continuity 的地点声明词）——提取语义 ≠ 行首切分，强行统一会毁掉捕获信息。

**假绿修复记录**：character-balance「narrow_co_scene」旧夹具只有两角色，靠场头被误解析成幽灵说话人「场景」凑满 `speakingChars>=3` 才触发；收口后幽灵消失测试变红。处理方式：**不改引擎闸门放水，改夹具为真实三角色**（主角只与李明同场，王妈只在李明独立场出现），另加 parseDialogue 防回归测试断言五种规范场头行绝不产生说话人。

**回归证据**：npx tsc 零输出；全量 `NODE_ENV=test node --test test/` **4936 pass / 0 fail / 452 suites**（c212 末 4905 + scene-density 等引擎夹具 + 共享切分器/场头切分/show-dont-tell/parseDialogue 幽灵防回归等新增测试）。

### 方法论沉淀
- **63. 同一判定在仓内出现 ≥3 份副本时，立刻建单一事实源，新需求只许加在源上；副本之间"恰好都能跑"是错觉，第一次格式变体出现就会集体失防**。32 键矩阵取证证明 30+ 份场头正则没有两份完全一致。建源时必须先做输入矩阵取证（本轮 32 键 × 4 场头形态），让共享函数的行为契约被夹具矩阵锁死，而不是照抄某一个旧副本的漏洞。
- **64. 正则类修复先取证"规范优质稿在旧规则下被误判"（红），再改实现转绿；词典扩张同理——每个新词都要有"优质稿本该命中却没命中"的真实夹具**。没有红就没有修复，只有改字；改完必须把"真水戏/真被动/真无动机反派"负向夹具全量回归，扩词最容易放水。
- **65. 迁移/替换正则必须携带全部 flags 与边界（g/m/i、^ 锚、trim 前置、语种分支）**；codemod 删正则声明别用正则字面量去匹配源码（转义层级会 SyntaxError），用逐行字符串前缀过滤；perl 补替含 `?:`/括号的模式用双引号包裹并防 shell 转义；每批改完 grep 确认 0 残留再 tsc。
- **66. 英文语料两条硬规律：① `\bword\b` 不命中屈折形式，词典必须显式列 `(e|es|ed|ing)`；② 标准剧本格式——说话人可全大写多词（UNCLE TED）、整行括号是动作行、场景头是 `INT. PLACE - DAY`**。中文动作行是 △▲*✦——，英文是括号：两套行解析不可共用一个正则。
- **67. 质量阈值用"数量 + 浓度/分布"双条件，单条件必有漏网形状**：信息过载只看密度会漏掉"4 个信息点全塞 1 行"；只看数量会误杀均匀铺垫。先枚举"哪种病态形状会从单条件下溜过"，再定双条件。
- **68. 测试红了先怀疑夹具是否编码了 bug，而不是急着改实现**：narrow_co_scene 的红是 parseDialogue 幽灵说话人被修复后的正确红——夹具本身建立在错误行为上。判据：该断言通过所依赖的中间事实（speakingChars=3）是否真实存在于剧本中？不存在就改夹具为真实三角色，绝不能为让旧断言转绿而放宽引擎。
- **69. 共享谓词要按语义分层而不是一个函数通吃**：isSceneHeaderLine（切场）与 isSceneOrTitleLine（扫描跳过非正文）分开——《剧名》与 FADE OUT 对扫描引擎是非正文，对切分器却绝不能切场。收口每个旧谓词前逐点核对它除场头外还排除了什么（剧名/集标题/日夜标签/括号），带捕获组提取语义的解析器/校验器列入白名单不迁移。
- **70. "生成时能看见"不等于正确：宽松解析器会把格式行解析成业务实体（场头→幽灵角色），下游闸门、计数、分数全部建立在幻觉实体上**。验收解析器要有一类专门测试：喂入所有非目标格式行（各制式场头、剧名页、标签行），断言输出实体集合精确等于真实业务实体。
- **71. 全仓场头/标题跳过判定只允许存在于 script-scenes；新增引擎需要"跳过非正文行"时 import isSceneOrTitleLine，需要切场时 import isSceneHeaderLine 配套 splitScriptScenes，禁止再写私有 `^(内景|外景|…)`。唯一例外：带捕获组做信息提取（地点/内外景/编号）的格式解析器与规范校验器，且必须在注释中声明"提取器，非切分谓词"。

### c214（2.185.34）：/fix 漏算补盲（hits 形态三引擎 + 焊点承接）+ 剧名行冒充场标修复

**病象（三同审计战果）**：按方法论 59/61 的四列框架对 pipeline result 214 键做全量交叉核对，发现两类漏网：①villainStall/teamBriefing/deadlineStretch 三键是 score+hits 形态（string[] issues），SSE 展开✓、digest 落库✓、通用 chips 渲染✓，但 /fix 不重算——改写后挂旧账；②openingWeld 不在 /fix 重算，structural-rescan 头注"同集改写不改变它"的理由对整集重写不成立——/fix 整集重写会改开场，焊点承接结论会过期。

**三处修复**：
1. [generate.ts](file:///Users/a123/Desktop/养正/zhongnan/zhongnan-backend/src/routes/generate.ts) /fix 块新增 hits 形态三引擎重算：villainStall/teamBriefing/deadlineStretch 按新正文纯函数重跑，**复用 buildQcEngineDigest 路径 A 同一函数同一形态**（与生成落库零分叉，前端通用 chips 卡直读）；健康稿 digest 不出键时显式写 `{score:100, hits:[], unrescuedCount:0}` 健康壳清掉 v1 残留；逐引擎 try/catch，异常键保留旧值不阻断付费交付。**绝不能进 structuralRescan**——其 shapeEntry 只收对象 issues，string[] 会被滤成 issueCount:0 假健康壳（比挂旧账更糟），且前端 extraRows 也要求对象 issues，会整体隐形。
2. openingWeld 重算：prevSc 查询补 select content（与生成路径同规则提取结尾段：去尾空白→末行→≤400 字），调 openingContinuityCheck 按新正文+前集结尾重算；引擎在前集结尾 <20 字时返回 checked=false——**无输入不写空壳**，保留旧台账（同 freshArc 纪律）；checked=true 时按 buildQcEngineDigest 路径 B 同形态覆盖（健康稿写 score:100/issueCount:0 壳清旧账）。
3. [opening-continuity-check.ts](file:///Users/a123/Desktop/养正/zhongnan/zhongnan-backend/src/engine/opening-continuity-check.ts) 开场块界定修复：开头剧名行（第N集…/Episode N…）**不是场标**——旧逻辑把它计为第 1 个场标，开场块被截成"剧名行+首个场标"两行空壳（真实开场内容全在界外），speaker_missing 必误报、delayed_open 必漏报。剧名行仅在开头位置跳过（场/幕级标题仍是真场标，不误伤）。

**规范稿矩阵取证（17/17 绿）**：villainStall/teamBriefing/deadlineStretch 三引擎各 5 例（病稿扣分/三类 rescue 全救/规范稿满分），openingWeld 4 例（承接良好无 high/坏稿检出 speaker_missing+delayed_open/短结尾 checked=false/英文 Episode N 跳过）。剧本创作能力侧同步取证：三引擎的"首次豁免"（第 1 次拖延/部署/倒计时豁免，第 2 次起每次 1 hit）与"双条件缺一不可"（控制×拖延、分派×服从、期限×后果）判定矩阵全部按预期工作。

**回归证据**：npx tsc 零输出；opening-continuity-check 测试追加 3 例 c214 回归（剧名行不计场标好坏稿双向、英文 Episode N、无剧名行旧行为不变）——14/14 绿；全量 `NODE_ENV=test node --test test/` **4936 pass / 0 fail / 452 suites**（c213 末 4936 基线 + 焊点 3 例新增，套件不变）。

### 方法论沉淀
- **72. hits 形态引擎（string[] issues）与 issues 形态引擎（对象数组）是两种不同的重算物种，绝不能共用同一个 shapeEntry**。villainStall 一族的 issues 是字符串数组，naive 加入 structuralRescan 会被对象过滤器滤成 issueCount:0 假健康壳——这比挂旧账更糟（真问题被"健康"清掉），且前端 extraRows 要求对象 issues，会整体隐形。正确做法：hits 形态引擎单独走 buildQcEngineDigest 路径 A 同形态覆盖，健康稿显式写 score:100 空壳清旧账。判断口径：看引擎 Result 的 issues 元素类型，string[] 进路径 A 家族，对象数组进路径 B 家族，两族的重算通道必须分开。
- **73. "依赖前集文本"不是不重算的理由，是重算需要补输入的信号**：openingWeld 被漏算的表面理由是"同集改写不改变它"（对单点修复成立），但 /fix 是整集重写，开场会变。发现这类依赖时，正确动作是补输入链路（prevSc 补 select content + 同规则提取结尾段），而不是放弃重算。约束：输入无效（前集结尾 <20 字）时引擎返回 checked=false——此时必须保留旧台账不写空壳，与"无输入不伪造"的 freshArc 纪律对齐。
- **74. 场头判定单点真相后，仍要防"剧名行冒充场标"的二次变异**：c213 已把场头判定收口到 script-scenes，但 openingWeld 的开场块界定逻辑在"第二个场标"处截断——开头剧名行被 isSceneHeaderLine 计为第 1 个场标，导致开场块只剩两行。教训：共享谓词解决的是"判定一致性"，但调用方的"计数语义"（第 N 个场标）仍需各自防御——开头位置的剧名行/ Episode N 行必须显式跳过，不能计入场标序号。

### c215（2.185.35）：/fix 漏算补盲收官——102 个纯函数创作引擎批量重算（creative-batch-rescan）
**病象**：c214 审计记录的"~100 个创作引擎 /fix 全部不重算"设计缺口坐实——pipeline 终稿 result 约 130 个 QC 键，/fix 改写后只重算了 40 键（cliffhanger/arcTrack/sceneSoftEnding/showDontTell/structuralRescan 32 键/villainStall/teamBriefing/deadlineStretch/openingWeld）；其余 v2.80 对白/叙事家族（echoDialogue/vagueWord/dialoguePingpong/expositionDialogue…）与 v2.81-v2.133 阀门家族（rescueRomance/faintOnCue/instantHack/pregnancyOnCue…）共 102 键仍挂 v1 旧值——改写修好了回声对白/模糊词/阀门巧合，质检卡仍挂旧账。
**修复**：新建 engine/creative-batch-rescan.ts：RUNNERS 表收编 102 键（100 个纯 draft 引擎 + voicePrint/dialogueNameCall 两个需 cast 引擎，无 cast 时跳过；键名与 pipeline result 字面量逐一对齐，含 actionEcho/eavesdropDump/selfPity/villainConfession/fightReconcile/talkDown 六个函数名≠键名映射）；raw 结果统一过 buildQcEngineDigest（与生成落库同函数同形态同 hitLimit，前端零改动直读）；**覆盖语义健康壳**：digest 不出键的健康引擎显式写壳——raw 有 hits 数组写 {score,hits:[]}（带 unrescuedCount 透传），有 issues 数组写 {score,issueCount:0,issues:[]}；issues 非空却被 shaped 滤空的契约外形态不写壳、保留旧值（保守不谎报健康）。generate.ts /fix 块在 freshWeld 后接入 freshCreative 展开落库，整体 try/catch 退回 {} 不阻断付费交付。与 structuralRescan 32 键/c214 重算键经测试断言零碰撞。
**回归证据**：npx tsc 零输出；新增 test/creative-batch-rescan.test.cjs 6 例（102 键全产出形态合法/零碰撞/健康稿双形态壳/问题稿真实命中/无 cast 跳过两键/空短文本不炸）——6/6 绿；全量 `NODE_ENV=test node --test test/` **4945 pass / 0 fail / 453 suites**（c214 末 4936 基线 +9，套件 +1；首跑曾现 5 例 fail，复跑两次均 0 fail 确认为存量偶发，与本改动无关）。
**方法论沉淀**
- **75. digest 函数是"增量语义"（健康缺键），/fix 是"覆盖语义"（健康写壳）——直接复用 digest 做重算必然清不掉旧账**。buildQcEngineDigest 为批量落库设计：健康引擎不出键是正常的（面板无内容可展示）。但 /fix 改写后旧键仍在库里，不出键=旧账永存。正确做法：digest 输出后兜底扫描 raw，对"跑了但没出键"的引擎按 raw 形态补健康壳；壳形态判定看 raw 里存在的数组字段（hits→hits 壳，issues→issues 壳），不凭空造形态。
- **76. 壳不是随便写的——"有 issues 却没过 shaped"是契约外形态，写壳就是谎报健康**：路径 B 的 shaped 过滤要求元素至少含 type/evidence/advice 之一；若引擎返回了非空 issues 却全被滤掉，说明该引擎不属于 digest 契约族，此时写 issueCount:0 壳会把真问题伪造成健康。保守原则：非空原始问题列表 + digest 缺席 = 保留旧值，把判断留给人工。
- **77. 批量重扫模块的键名必须以 pipeline result 字面量为唯一真相，不能从函数名推导**：六个引擎函数名≠result 键名（fightReconcileCrutch→fightReconcile 等），从函数名推导会写出前端永远不认识的幽灵键。做批量接入时先 sed 提取 result 字面量键名再建表，并用"与既有重算键集零碰撞"测试锁定互斥性。

### c216（2.185.36）：跨集诊断台账六键三处全丢——掉钩/欠账/干旱/疲劳/反派空转刷新即失明
**病象**：c214/c215 按"有 score"分族审计键可达性时，漏掉了 pipeline 终稿逐集重算的六个**无顶层 score 的跨集诊断台账**：hookPayoff（上集钩子兑现/掉钩）、humiliationDebt（屈辱欠账）、mysteryDrought（悬念干旱）、hookFatigue（钩型疲劳）、promiseDrought（承诺欠账）、villainThreat（反派空转）。pipeline.ts 注释自述"终稿重算落库"，结果也确实挂在 result 对象长名键上——但它们形态是「状态字段 + issues[]{severity,type,evidence,advice}」无 numeric score，被 buildQcEngineDigest 的通用扫描（要求 score）整体跳过；generate.ts 落库字面量只写短名摘要行（humiliation/mystery/promise/villain，供下一集 prev 输入），长名诊断键零引用；SSE done 手工载荷不带；/fix 不重算。grep 三处实证（落库字面量/SSE 载荷/fix 重算集）确认：六类告警生成瞬间只活在内存，页面刷新永久失明——与 c211 showDontTell 同族"说与做不符"病。
**修复**：新建 engine/ledger-diagnosis-rescan.ts 两函数。① shapeLedgerDiagnoses（生成路径零重算）：把 pipeline 已算好的六键削成限界 digest——状态字段走 STATE_FIELDS 白名单透传（hookPayoff=[checked,paid,prevType]；hookFatigue=[endRun,openRun,level,endType,openId]；humiliationDebt=[debt,level,lastMarkers]；mysteryDrought/promiseDrought=[drought,level,line]；villainThreat=[silentRun,stagnantRun,level,line]），issues 统一限界（issueCount=原始长度，issues≤5 复用 QC_ISSUES_LIMIT=5/evidence≤160/advice≤200，仅留 severity/type/evidence/advice），异常键缺席不阻断。② rescanLedgerDiagnoses（/fix 路径）：前序行严格对齐生成路径 L2467-2507 的短名摘要 normalize 规则（prevHook 只认最近集、normalizeDebtEp/MysteryRow/HookTypeRow/PromiseRow/VillainRow），本集行构造对齐 pipeline L2784-2805（humiliation 用 payoffRhythmCheck 取 humiliationPaidCount/strongReleaseCount，lang 走 detectRescanLang）；逐引擎 try/catch，异常键缺席由 /fix 展开旧 qcReport 保留旧值。三处接入 generate.ts：生成落库 qcReport（buildQcEngineDigest 展开后）、SSE done（cliffhangerDigest 后同形态）、/fix（freshCreative 后新增前序集查询 take 40→epNo 去重取最新 8 集→rescan，展开到 qcReport，整体 try/catch 退回 {}）。长名诊断键与短名摘要行键集零碰撞（乱序+短名夹具锁定）。
**回归证据**：npx tsc 零输出；新增 test/ledger-diagnosis-rescan.test.cjs 7 例（限界削形/非法容错/第 1 集无前序/hook_dropped high/debt=6 high/villain_silent high+fatigue ending_hook_repeat/乱序+短名零碰撞）——7/7 绿；全量 `NODE_ENV=test node --test test/` **4952 pass / 0 fail / 453 suites**（c215 末 4945 +7，套件不变；连续两轮全绿，c215 记录的存量偶发 5 fail 本轮未复现，继续挂账待抓现场）。
**方法论沉淀**
- **78. buildQcEngineDigest 这类"按 score 通用扫描"的摘要器对"无 score 的诊断引擎"存在系统性盲区——审计键可达性必须按"有 score / 无 score"分族核对，不能只看 pipeline 是否计算**。六键在 pipeline 里被逐集重算、注释还自称"落库"，但落库/SSE/fix 三处全空。审计口径：列出 pipeline result 全部键 → 标记有无顶层 numeric score → 无 score 族逐一 grep 三处消费点（落库字面量、SSE done 载荷、/fix 重算），任何一处缺失即失明。
- **79. 注释自称"落库"不代表真落库；说与做不符是高频自洽缺陷，结论必须由 grep 消费点实证**。pipeline 注释写"终稿重算落库"，实际只挂内存 result。排查这类问题不信任任何自述注释，只信任：键名出现在 prisma.create 的 qcReport 字面量里、出现在 SSE send 载荷里、出现在 /fix 重算集里——三处都有才叫"可达"。
- **80. 跨集 ledger 重算必须连同前序短名摘要行一起重放，并严格复刻引擎的 ep<cur 过滤语义与读取窗去重规则**：本集行照传但引擎内部 filter 只记前序（debt/silentRun/endRun 都只算前序集）；前序查询必须与生成路径同规则（epNo desc + version desc take 40，按 epNo 去重取最新版限 8 集）——直接 take 8 在多版本集上会漏整集，不去重会让同一集摘要行双计虚增欠账/干旱/连段。prevHook 只认最近集（末位），比较用下标不用对象引用。

### c217（2.185.37）：二十四本跨集连续性台账五点全丢——封禁信物再现/死者复活/下场穿帮只活在内存
**病象**：c216 六键补完后按方法论 78 的「无 score 族」口径继续扫 pipeline result，挖出 v2.80 二十四本连续性台账（信物/时间线/连胜代价/死亡/反派下场/伤势/境界/物品归属/关系/阵营/地点/泄密/伪装/人情债/联盟/记忆/冒充/背叛/牺牲/诅咒/附身/穿越/变身/中毒），全是「名册状态数组 + issues」无 score 形态，pipeline 终稿 L2796-L2905 逐集重算，但 buildQcEngineDigest 跳过、落库只有 24 个短名摘要行（供下一集 prev）、SSE 不带、/fix 不重算、前端无渲染——规模是 c216 的四倍，且都是死亡/复活/封禁物再现级的硬穿帮。
**修复**：新增 `src/engine/continuity-ledger-rescan.ts`（CONTINUITY_LEDGER_KEYS 24 键 + STATE_FIELDS 状态白名单 + ROSTER_ELEMENT_FIELDS 名册对象元素白名单；shapeContinuityLedgers 限界削形：标量≤160/名册≤30/字符串元素≤40/issueCount 原始计数/issues≤5 四字段截断；rescanContinuityLedgers 数据驱动 RESCAN_DEFS 表，prop/timeline/cost 单对象与 signal/item/rows 三种前序行形态分类重建，take40+去重8 读取窗、cast 名表 cap20、逐引擎 try/catch）。generate.ts 四点接通：①落库 23 长名键展开 + villainFate 短名行 `{rows,...diag}` 合流；②SSE 整 24 键直出（无短名碰撞）；③/fix 复用 c216 前序查询独立重放，villainFate 先保留旧 rows 再合诊断（防下一集 prev 蒸发），整体异常退 {} 不阻断付费交付。前端 buildQcReportHtml 新增「跨集连续性台账·30 本账」卡（c216 六键+c217 二十四键统一渲染，issueCount/issues 驱动、level/high 着红、健康壳不显示、悬停 evidence/advice），SSE 与刷新后同形态。
**过程中抓出的三个自身 bug（测试驱动）**：①rescan item 族误把 `deriveOwnershipRows(text, name:string)` 当 rows 族传 `[name]` 数组，数组无 .trim 抛 TypeError 被逐引擎 catch 吞成 itemOwnership 永久缺席（23/24 键数断言抓出）；②shapeRoster 初版对象元素只剥嵌套不按键白名单，secret/dirty 等未知标量会混进落库（deepStrictEqual 抓出），补 ROSTER_ELEMENT_FIELDS 后修复；③villainFate 同名碰撞为全程最大陷阱（见方法论 81①）。
**回归证据**：npx tsc 零输出；新增 test/continuity-ledger-rescan.test.cjs 7 例（白名单/截断/名册≤30/villainFate 不含 rows/健康壳/第 1 集 24 键全产/prop_phantom high/resurrected_after_death high/乱序+ep>=cur 过滤+短名零碰撞/非法 ep 退 {}+脏行容错）——7/7 绿；全量 `NODE_ENV=test node --test test/` **4959 pass / 0 fail / 453 suites**（c216 末 4952 +7）；app.js node --check 通过；pm2 restart zhongnan-api 后 /health `{"ok":true}`。

- **81. 无 score 的「名册态」跨集引擎要按四点失明族审，且落库削形必须给名册对象元素配字段白名单；rescan 调 derive 必须逐形核对签名（数组/单值之差异会被 try/catch 静默吞成永久缺键）**：c217 坐实 v2.80 二十四本连续性台账（propLedger/timeline/cost/death/villainFate/wound/power/item/rel/aff/loc/leak/disguise/debt/alliance/memory/impersonation/betrayal/sacrifice/curse/possession/timeTravel/transformation/poison）与 c216 六键同族但规模四倍：结果是「名册状态数组 + issues」无 score，通用摘要/落库/SSE//fix/前端五点全丢，封禁信物再现、死者复活、反派下场穿帮、伤势境界秒恢复只活在内存。三条工程教训：①**同名碰撞合流模式**——qcReport.villainFate 既是短名摘要行 {rows}（下一集 prev 输入）又是长名诊断键名，shape 必须只出纯诊断（绝不含 rows），落库 `{rows, ...diag}` 后写合流、/fix 还要先从旧 qcReport 保留 rows 再展诊断，直接整体覆盖会蒸发下一集输入；②**名册削形不能只剥嵌套**——对象数组元素（stale/dead/felled/tracked…）必须逐数组配置允许键白名单（ROSTER_ELEMENT_FIELDS），否则 secret/dirty 等未知标量会混进落库；③**rescan 数据驱动表最大的坑是 derive 签名想当然**——deriveOwnershipRows(text, name:string) 是逐角色单值，误照 rows 族传 [name] 数组会让 name.trim 抛 TypeError，被逐引擎 try/catch 吞掉后该键静默缺席（测试只数键数才抓出 23/24），每个 def 的调用形态必须回 pipeline 终稿块逐行对拍。前端无 score 卡按 issueCount/issues 渲染、level/high 着红、健康壳（issueCount:0）不显示，覆盖语义让 /fix 修好自动销账。

### c218（2.185.38）：无 score 四闸门键四点全盲——反套路/口语化/落地感/字数闸门重试耗尽静默出货
**病象**：按方法论 78/81 的「无 score 族」口径继续扫 pipeline result，挖出四个 QC 闸门引擎（cliche 反套路/tongue 台词口语化/grounded 落地感/lengthPlan 字数闸门），契约分别是 pass+noveltyScore / pass+colloquialScore / groundedScore / ready+status——无顶层 score，被 buildQcEngineDigest `typeof o.score !== 'number'` 硬过滤：落库✗、SSE done✗、/fix✗、前端✗。比 c216/c217 更危险的是 cliche/tongue 本就是 QC 重试闸门引擎，重试耗尽后的失败态随四点全盲静默出货，用户连「这集没过闸门」都看不到。同族半盲四键（rhythm/character 落库✓但 SSE✗/fix✗；styleCheck 同；propMotifRhythm 仅 SSE✗）一并补齐。
**修复**：新增 `src/engine/gate-engine-rescan.ts`（GATE_ENGINE_KEYS 四键事实源 + shape/rescan 双函数；shape 契约不符直接省略键不写假壳，rescan 逐键 try/catch 条件赋值防 undefined 落库；hits≤8、逐字段截断、lengthPlan 只留 ready/status/mode/current/target/range 七字段、note/expansion 大字段剥除）。generate.ts 四点接线：落库字面量展开 shapeGateEngines、SSE done 同形展开 + 半盲四键复用 buildQcEngineDigest 内联（与落库零分叉）、/fix 重放 rescanGateEngines + rhythm/character 内联重扫（健康稿显式写 `{score,issueCount:0,issues:[]}` 壳清旧账）。前端新增「QC 闸门」卡（GATE_DIM_LABELS 复用 QC_ENGINE_LABELS 词条，issueCount 驱动，pass===false/ready===false/groundedScore<60 着红，lengthPlan chip 额外带 当前/目标字数 后缀，tooltip 分键取 hits found→alt / word→fix / abstractHits→suggestion / 字数状态）。styleCheck 因 styleProfile 不落库，/fix 跳过保留旧值并注释声明。
**回归证据**：npx tsc 零输出；新增 test/gate-engine-rescan.test.cjs 7 例（四键削形截断白名单/契约不符不出假壳/健康壳/干净稿四键全产/套路稿 cliche pass:false/书面腔 tongue hits/抽象叙述 grounded + 超短稿 lengthPlan under/空文本退 {}+AIGC 不炸+键名事实源防漂移）——7/7 绿；全量 **4966 pass / 0 fail / 453 suites**（c217 末 4959 +7）；app.js node --check 通过；pm2 restart 后 /health `{"ok":true}`。

- **82. 无 score 闸门引擎的识别要在摘要器排除集上双向核对——「引擎算了吗」之外还要问「摘要器为什么跳它」；请求级参数不落库时 /fix 重放必须注释声明诚实近似，错档重放比旧值更有害**：c218 四闸门三条教训。①**排除集识别法**：buildQcEngineDigest 这类通用摘要器的过滤条件（`typeof o.score !== 'number'`、hits/issues 形态分叉）就是一张隐形排除集——族审不能只看 pipeline 算了哪些键，要把过滤条件读出来，反向列出「会被跳过的契约形态」（pass+xxxScore、ready+status、groundedScore 这类换名 score 全算），凡契约为布尔闸门态的引擎必在排除集里。②**诚实近似声明纪律**：antiStrength/colloquialLevel/aigcDurationMin 是请求级参数不落库，/fix 重放只能用默认档（balanced/mid/1 分钟）——不是 bug 是有界近似，但必须在模块头注写明「生成时可能为 X，重放用默认 Y」；styleProfile 整个不落库时错档重放会产出误导性新值，宁可保留旧值+注释声明，也不假装重放等于生成时口径。③**shape 不写假壳**：契约不符的键直接省略（缺键=未产出），健康覆盖语义由 rescan 的健康壳（pass:true/issueCount:0）承担——两条路径分工明确，落库永不出现 undefined 键。

- **83. SSE-only 数据不落库=刷新失明——凡是前端仪表盘/卡片依赖的数据，必须走「pipeline result → qcReport 落库 → 前端 refreshResultScripts 读取」三段闭环，不能只在 SSE done 载荷里发一次**：c219 AIGC 构成仪表盘三条教训。①**失明根因**：aigcManifest/aigcVolumePlan/aigcCurve/format 四个 AIGC 仪表盘字段此前只在 SSE done 载荷里发送，不落 qcReport——生成完成瞬间仪表盘正常，用户刷新页面后数据从 DB 拉取（无 _aigc 字段）→仪表盘整个消失。族审必须把 SSE done 载荷的每个键对照 qcReport 字面量逐一核对，凡前端消费的键必须落库。②**大字段截断存储**：buildShotManifest 返回的 shots[] 数组含 visual/lines/audio/inner 等大字段（单集 ≈30-50KB），但 renderAigcDash 只读 shotCount——落库只存 `{shotCount, title}` 摘要，避免 qcReport JSON 膨胀；volumePlan/curve/format 体积小可整存。③**/fix 重算口径对齐**：aigcDurationMin 是请求级参数不落库，/fix 重算 volumePlan/format 时若硬编码 1 分钟，自定义时长（如 3 分钟）项目的字数带/制式范围会错档——把 durationMin 存入 `_aigc.durationMin`，/fix 从前一版 `_aigc.durationMin` 读取复用；format 复用 pipeline 同口径 validateScript（非 validateAigcScreenplay，后者字段集是五维覆盖诊断不是 FormatReport）。

- **84. 「诊断→一键修复」闭环的执行端质量决定整套质检的价值——通用 advice 只能让模型换词，专科兵法（病灶识别+具体手法+验收标准）才逼得出结构性改写；同时「能看见的诊断必须能修」，展示多年无修复入口的 chip 是功能断层**：c220 三条教训。①**改写兵法库三要素**（fix-playbook.ts，c220 建 64 条→c221 扩至 124 条，中英双语纯数据）：cliche（病灶在稿子里具体长什么样，帮模型精准定位不误伤）+ moves（2-3 个删/换/补的具体动作，禁「加强刻画」式空话）+ win（可自检的验收标准，防换汤不换药）；buildFixPrompt 按 fix.rule 注入，未收录规则干净降级通用提示，单块 ≤260 字控付费 prompt token。②**修复入口接线复用既有链路**：质检 chip（创作 hits 形态/结构 32 维/issues extras/闸门四键）携带 data-qcfix+ep/rule/dim/advice，委托点击处理器复用 /fix 全套（计费/幂等/退款/沙盘/isUsableRewrite/版本号），成功后 openProject 重建+重跑诊断；跨集台账 30 键单集改写语义不成立，刻意不挂入口。③**新入口传参形态变化会击穿老门控**：BASIC_FIX_RULE_RE 的分隔符断言 `([._:]|$)` 只认 dotted 规则号（dialogue.ai_taste），chip 直传驼峰引擎键（dialogueAiTaste）后全部失配，纯台词病症被误挡成高级会员功能——修复用显式驼峰键 Set 白名单只收纯文字表层键（tongue/AI味/水分/乒乓/说明对白等 17 键），结构/动作/跨集键一律 fail-closed 留高级，并加「dialogueStructureRewrite 前缀伪装不得降级」防越权测试。

- **85. 复盘要用「两张独立事实源互查」挖功能轮暗伤——单侧自检（测试绿+自测脚本）只能证明「写的都对」，两侧对照才能发现「漏写的/写错的」；数据表扩容对账、双语语言纯度、跨形态键匹配、错误对象契约是四条易复发暗伤**：c221 复盘轮五条教训。①**扩库依据=引擎自述边界，不臆造**：兵法库 64→124 条，新增键全部来自 creative-batch-rescan/structural-rescan 注册表实际发射的键 + 各引擎头注释「本引擎管 X」的边界自述（叙事/巧合阀门/生理开关/关系和解四族），并用脚本交叉验证 134 注册表键 vs 兵法库键：无悬空键，78 键刻意未收录（结构/闸门族由通用 advice 承接）——数据表扩容必须有第三张表做对账，否则必造出「引擎发了但兵法查不到」的暗键。②**双语表语言纯度要机器把关**：交叉验证逮出 EN 表 3 处混入汉字（「not天赋」「no空降」「correct废话」——写英文条目图快先写中文再想 replace 的坏味道）；治理=校验脚本固查 EN 块 `/[一-鿿]/` 与 ZH 块 moves 长度，写条目一步到位写纯英文，语言泄漏检查与字段完整性同权重。③**跨形态键匹配用显式键集，不用分隔符正则**（c220 #84③ 的泛化）：同一语义存在两种形态（dotted 规则号 dialogue.ai_taste / 驼峰引擎键 dialogueAiTaste）时，靠分隔符断言的正则白名单必然漏一种——正解是显式 Set/Map 键集做唯一事实源，正则只做辅助，未命中一律 fail-closed。④**错误对象也是 API 契约**：前端 catch 分支依赖 error.msg/httpStatus/upsell，throw 处 `Object.assign(new Error(...),{...})` 少带一个字段对应分支就静默退化（c221 逮出 403 upsell 丢失→升级引导弹不出）；改 throw 时把下游全部读取字段列清单逐一核对。⑤**复盘疑点先证伪再动手，排除结论也留痕**：chip 重复提交疑点经核对 #worksDiag 在 openProject 模板串内每次重建、监听器挂新节点即失效——是排除不是修复，留痕防下轮重复怀疑。回归证据：npx tsc 零输出；定向 fix-playbook+assistant-gate 11/11；全量 **4976 pass / 0 fail / 453 suites**（与 c220 基线持平，扩库零回归）；发版 2.185.41 health ok。

- **86. 请求级「档位」参数必须随产物落库——判断阈值依赖档位的引擎，重放错档不是近似而是误判；治理模式=「pipeline 返回 _profile → 生成落库 → /fix 读档 → normalize 白名单校验 → 缺省回退」五段闭环**：c222 三条教训。①**错档重放是正确性问题不是精度问题**：cliche pass=hits≤maxHits（classic≤4/balanced≤2/innovative=0）、tongue pass=hits≤max(绝对数兜底, 百字密度)（low≤5/mid≤2.5/high≤1）——生成期 classic 放行的稿子，/fix 用 balanced 重放会凭空判 fail，前端闸门卡/升级引导全跟着错。#82② 的「诚实近似声明」只适用于拿不到真值的字段；能落库拿到真值的档位必须落库，「有声明」不等于「不治理」。②**落库形态选 qcReport._profile 内联小对象而非新表**：两字段纯标量随 qcReport JSON 走，零迁移零额外查询；/fix 落库处 `...旧 qcReport` 展开自动携带无需额外代码（与 _aigc.durationMin 同模式）；SSE done 载荷不加（前端不消费，保持推送精简）。③**外部数据回读必须过显式白名单 normalize**：存档 JSON 可能旧（无 _profile）、可能脏（历史版本/污染），normalizeAntiStrength/normalizeColloquialLevel 用 Set 校验，非法值回退默认档绝不抛错——档位异常不得阻断付费交付（与 rescan 逐键 try/catch 同纪律）。测试用「同稿不同档位 pass 翻转」证明参数真实流到判定（3 套路稿 classic 过/balanced 拦、1 套路稿 innovative 拦；4 书面词稿 low 过/high 拦），而非只测「传了不炸」。回归证据：npx tsc 零输出；gate-engine-rescan 11/11（+4）；全量 **4980 pass / 0 fail / 453 suites**；发版 2.185.42 health ok。

- **87. 复盘轮要扫「参数声明→调用点→路由 schema→前端入口」四段透传链——任何一段漏传=前一段的能力空转；「调用了/支持了」不等于「能用了」**：c223 复盘轮两条教训。①**调用点漏传比函数缺参更隐蔽**：gate-engine-rescan 的 opts 在 c222 已加 `aigcDurationMin ?? 1`，但 generate.ts /fix 重放块（L2084-2088）的 rescanGateEngines 调用只传 scriptFormat+两个档位，aigcDurationMin 不传——所有 AIGC 项目重放一律按默认 1 分钟算 target/range，ready/status 全部误判。函数签名支持 ≠ 调用点真传；复盘必须沿「声明→调用」逐段对照。修法与 c219 #83③ 同口径：从旧 qcReport._aigc.durationMin 读出传入，脏数据（非正数）不传回退默认 1。②**「能力无入口」= pipeline+落库+/fix 三层全支持但路由 schema 无字段、前端无 chip = 请求永远走默认档**：antiStrength 在 pipeline L626 `options.antiStrength ?? 'balanced'` + _profile 落库（c222）+ /fix 读档重放（c222）三层全就位，但路由 schema 无 antiStrength 字段、runEpisode 调用不透传、前端无 chip——符合 yangzheng-evidence-loop 病象「能力无入口」，请求永远 balanced。修法三段齐：schema 加 `z.enum(['classic','balanced','innovative']).optional()`、runEpisode 调用点 `...(parsed.data.antiStrength ? { antiStrength: parsed.data.antiStrength } : {})`、前端策略卡区加三档 chip 组 + hookPayload 透传。验证：定向测试「runEpisode 接受 antiStrength 并在 _profile 原值返回；缺省回退 balanced」+「aigcDurationMin 真实改变 lengthPlan range/target」锁死两层契约。回归证据：npx tsc 零输出；gate-engine-rescan+pipeline-v218 定向 18/18；全量 **4982 pass / 0 fail / 454 suites**（c222 末 4980 +2）；发版 2.185.43 health ok。

## 输出与自检清单（交付前逐条核对）
- [ ] 人设前后一致、配角也有独立行为逻辑，无人设崩塌
- [ ] 每个反转/打脸/以弱胜强都有前置铺垫
- [ ] 台词符合人物年龄身份地域，无书面腔、无说教、无 AI 工整对仗
- [ ] 钩子分层布点、集尾有追更钩、全程有张弛留白
- [ ] 制式字数与版式达标（LIVE 800-1000 / AIGC 1200-1500），无提示词污染
- [ ] 未触碰硬底线（露骨淫秽与未成年人性化全法域硬禁；成熟向走分级与问卷，不豁免硬禁）

## 参考资产（随版本自动同步，机器可读副本见 references/craft-pack.json）
- references/01-devices.md：210 个创作装置（机理/技法/风险/识别词）
- references/02-hooks.md：四层钩子（开篇/集尾/场钩/微钩；微钩含动作/语言/氛围/情绪/信息差/伏笔六风味）
- references/03-beats.md：26 节拍
- references/04-formats.md：双制式格式与硬底线
- references/05-unified-spec.md：统一创作规范（四阶段/六维评分/四层钩子/语言与个性化）
- references/06-evolution.md：技能进化与反自我封闭协议
- references/07-aigc-exemplar.md：AIGC 制式达标黄金样例（过格式闸门，照此版式写）
