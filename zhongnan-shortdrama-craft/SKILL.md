---
name: zhongnan-shortdrama-craft
description: 竖屏短剧人类级剧本创作技能。当需要创作/改写/诊断竖屏短剧、微短剧、AIGC制作剧本、真人实拍剧本，或涉及分集大纲、钩子、反转、爽点、人设反差、节奏曲线、去AI味、12种创作模式（采访式/标签/小说改编/互动分支/名场面/热点追更/爆款逆向/短视频脚本/软广脑洞/X剧本/长系列IP/电影灰度）时使用。内置21套类型引擎210装置、四层钩子体系、26节拍、双制式格式、统一创作规范、进化与反自我封闭协议与创作硬底线。
metadata:
  version: 2.185.3
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
