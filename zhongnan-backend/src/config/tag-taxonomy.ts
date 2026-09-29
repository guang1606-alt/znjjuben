/**
 * 竖屏短剧标签体系（四级可扩展，当前细到三级、400+叶子）+ 标签能力引擎
 * 数据依据：抖音集团短剧版权中心 2026 真人短剧「四大内容趋势 / 八大优势品类 / 六大AI题材方向」、
 *          品类44→65、红果高热19→36、分账加成规则、30+人群占比等公开口径（2026-05/08）。
 * 能力：O(1)索引毫秒检索、0.4全局频次+0.4市场热度+0.2个人偏好动态排序、互补推荐、
 *       组合自检(未知/重复/互斥/缺维度)、转创作Brief(驱动架构岗)、平台分账扶持测算、成体系随机。
 * 纯函数 + 模块级预建索引，零IO，响应速度为微秒级。
 */

export type DimId =
  | 'genre' | 'protagonist' | 'hook' | 'conflict' | 'emotion' | 'era' | 'scene'
  | 'audience' | 'track' | 'structure' | 'format' | 'style';

export interface TagNode {
  id: string; name: string; dim: DimId; level: 1 | 2 | 3;
  parentId?: string; aliases: string[]; heat: number;      // heat 0-100 市场热度，可由每日采集更新
  boost?: number;                                          // 平台额外分账加成 %（命中八大品类）
  trend?: '情感深度' | '头部爆款' | '系列化' | '差异化';
}
type Leaf = string | [string, { heat?: number; boost?: number; trend?: TagNode['trend']; aliases?: string[] }];
type RawDim = { label: string; subs: Record<string, Leaf[]> };

// —— 12 维度原始数据（二级子类 → 三级细分标签）——
const RAW: Record<DimId, RawDim> = {
  genre: { label: '题材品类', subs: {
    现代家庭: ['婆媳关系','翁婿矛盾','重男轻女','二胎三胎','啃老与反哺','黄昏恋','重组家庭','家产争夺','隔代亲','全职妈妈困境','家庭冷暴力','妯娌博弈','返乡尽孝','亲子叛逆','中年婚姻危机','上门赘婿家庭','积怨旧账层层翻','代际立场双面','烟火日常承载','血缘与个体边界','被亲人误解翻案','饭桌群像冲突','和解分步有代价','隐忍到总爆发','去狗血现实冲突'],
    现代爱情: ['先婚后爱','破镜重圆','契约婚姻','暗恋成真','姐弟恋','双向奔赴','替嫁新娘','隐婚豪门','追妻火葬场','闪婚','豪门婚恋','职场恋情','异地恋','年下恋','替身情人','高甜撒糖','虐恋情深','黄昏之恋','带娃恋爱','生死绝恋','暮年情书'],
    逆袭成长: ['草根逆袭','废柴翻身','职场晋升','学霸逆袭','落魄千金归来','打工人翻身','创业逆袭','学渣翻盘','复仇式成长','女性觉醒','小人物崛起','负债翻身','单亲妈妈逆袭','退伍军人创业'],
    古风民国: ['古装甜宠','宫斗权谋','仙侠虐恋','古风探案','将门嫡女','王爷王妃','古风重生复仇','江湖武侠','古风种田','古风经商','和离再嫁','公主驸马','师徒虐恋','权谋夺嫡','世家宅斗'],
    都市世情: ['人情世故','街坊邻里','市井百态','世态炎凉','亲戚攀比','小城故事','城中村','人情债','饭局江湖','中年危机','北漂沪漂','回乡体面'],
    都市日常: ['治愈慢生活','美食日常','职场日常','养宠日常','租房生活','通勤人生','摆摊生活','便利店人生','日常双向救赎','烟火气','退休生活','带娃日常'],
    民国历史: ['民国虐恋','民国谍战','军阀少帅','乱世商战','抗战烽火','名门望族','租界风云','红色谍影','年代奋斗','家国情怀'],
    悬疑: ['悬疑推理','刑侦破案','密室反转','心理悬疑','社会派悬疑','无限流','规则怪谈','悬疑志怪','复仇悬疑','高能反转','法医刑侦','民间怪谈','悬疑爱情','不在场证明诡计','叙述性诡计','身份替换迷局','多重反转套娃','罗生门多视角','倒计时破案','伏线公平回收','安乐椅推理','规则字面陷阱','隐藏规则试错','破局线索公平','违规代价梯度','副本单元闭环','副本难度阶梯','规则下人心博弈','循环回档规则化','副本主线碎片牵引'],
    玄幻仙侠: ['修仙升级','东方玄幻','洪荒封神','妖族情缘','剑修','宗门争霸','渡劫飞升','万妖图录','境界阶梯对照','突破代价与瓶颈','金手指规则限制','战力标尺一致','机缘多方争夺','宗门势力生态','打脸铺垫节奏','道心心性考验','设定自洽圣经','升级爽点兑付'],
    跨时空脑洞: ['穿越古代','穿越现代','穿书','穿成炮灰','穿成反派','穿成白月光','快穿','灵魂穿越','肉身穿越','双穿','反穿现代','无限流穿越','平行世界','镜像世界','时间循环','时间倒流','灵魂互换','重生回到过去','历史错位','梦境穿越','穿越带系统','穿成动物物品','打破次元壁','年代穿越','穿回七十年代','穿回八十年代','穿回九十年代','时代信息差','年代红利逆袭','原著剧情惯性','原著flag回收','读者上帝视角','书中NPC觉醒','穿书脱离条件','恶毒女配洗白','替身白月光错位','快穿小世界结算','现代知识金手指','剧情修正力对抗'],
    都市高武: ['都市异能','隐世高手','兵王回归','国术武道','超凡觉醒','都市修真','高手下山'],
    科幻未来: ['末世求生','星际文明','赛博朋克','AI觉醒','航天科幻','时空科技','机甲','废土世界'],
    // v2.22 科幻末世/废土求生深挖：与 apocalypse-craft 十装置呼应
    末世废土: ['末世设定圣经','稀缺资源驱动','安全假象破防','威胁阶梯升级','据点养成线','极端道德两难','小队职能互补','希望锚点牵引','科幻反转讲机理','世界观有序收束','丧尸尸潮','异变兽群','极寒末世','洪涝末世','迷雾末世','幸存者营地','末世囤货','重生回末日前'],
    // v2.23 军旅特战深挖：与 military-craft 十装置呼应
    军旅特战: ['军令层级真实','战友情群像','任务简报闭环','战术动作可信','训练伏笔回收','群众纪律军民情','新兵成长弧','专业对手博弈','牺牲有重量','家国情具体选择','特种兵小队','边境巡逻','反恐突击','抗洪救灾','退伍不褪色','军校青春'],
    // v2.23 游戏电竞/体育竞技深挖：与 esports-craft 十装置呼应
    电竞竞技: ['规则数据内行','训练量可视化','宿敌镜像','位置哲学配合','逆风翻盘曲线','关键操作铺垫','版本战术博弈','心态伤病压力','赛场外生态底线','梦想有价兑现','职业战队','青训选拔','让一追三','篮球热血','足球少年','格斗擂台','赛车竞速'],
    // v2.25 刑侦法医深挖：与 investigation-craft 十装置呼应
    刑侦法医: ['证据链闭环','公平推理前置','法医程序可信','红鲱鱼误导','时间线诡计','动机人性前史','侦探有局限','翻案层层递进','程序正义边界','罪案社会温度','连环旧案','法医视角','专案组群像','审讯心理博弈','冷案重启','技侦电子证据'],
    // v2.25 萌宝银发/亲情治愈深挖：与 tender-craft 十装置呼应
    萌宝银发: ['儿童言行适龄','长辈尊严有欲求','先立伤口再治愈','生活流烟火气','羁绊分台阶','双向共同成长','软冲突观念差','泪中带笑节奏','现实议题轻落地','小约定温暖回收','单亲奶爸','隔代带娃','祖孙情','银发再就业','职场妈妈','二胎家庭'],
    // v2.26 乡村乡土深挖：与 rural-craft 十装置呼应
    乡村乡土: ['方言点染克制','熟人关系网','生计账驱动','民俗考据','城乡双向理解','乡土幽默智慧','基层治理真实','务工留守牵挂','农时节律结构','根与归属','合作社致富','乡村电商','返乡创业','赶集庙会','宗族人情','驻村帮扶'],
    // v2.26 女性群像/女性互助深挖：与 sisterhood-craft 十装置呼应
    她力量群像: ['群像戏份均衡','各有欲望声口','互助分台阶','结构性困境','事业线可信','非爱情关系深度','拒绝零和雌竞','爱情是选项','身体年龄友好','困境保有主体性','姐妹合伙创业','母女和解','女徒传承','女性对手可敬','不婚自洽','她力量成长'],
    // v2.30 国运秘境/全民觉醒深挖：与 nation-craft 十装置呼应
    国运秘境: ['副本规则即引擎','国运联动结算','代表选拔正当','资源台账取舍','多国博弈棋盘','全民直播围观','觉醒职业克制环','规则漏洞智斗','代价阶梯加压','文化根脉解题','全民转职觉醒','异兽入侵前线','秘境开荒首通','国家屏障守护','跨服赛场博弈','候补选手逆袭'],
    冒险逃生: ['极限求生','荒野逃生','灾难逃生','密室逃脱','探险寻宝','古墓探险'],
    行业职场: ['医疗职场','律政职场','金融职场','互联网大厂','餐饮创业','教师职业','空乘','警察职业','消防救援','媒体记者','销售江湖','建筑工程','电竞职业','新农人主播'],
    // 校园青春：高考/毕业/开学等时令节点强相关，补齐长期缺失的校园赛道
    校园青春剧: ['校园青春','高考陪考','毕业遗憾','青春暗恋','初入职场','师生情谊','学霸学渣','操场告白','宿舍友情','毕业十年重逢'],
    乡村现实: ['乡村振兴','脱贫致富','宅基地纠纷','新农人','回乡创业','乡村教师','非遗村寨','乡土人情'],
    军旅谍战: ['现代军旅','特种兵','抗战题材','谍战风云','反恐','缉毒行动'],
    // v2.21 年代谍战/民国潜伏深挖：与 spy-craft 十装置一一呼应，立项即可勾选到机制层
    谍战潜伏: ['身份面具双层','信息差反讽','接头暗号流程','死信箱情报传递','审讯双向博弈','内鬼疑云','阵营反转有据','信任背叛代价','高压任务时限','情报伏笔回收','信仰人性灰度','撤离预案','策反与反策反','电报密码战','乱世潜伏情感'],
    古装历史: ['历史正剧','权谋朝堂','历史人物传奇','大明风华','大唐盛世','大清权谋','古代发明'],
    // 历史脑洞 What-if：锚定真实历史常识 + 一个离谱变量，反差推演（《历史的另一种（离谱）可能》方向）
    历史脑洞: ['历史WhatIf','历史事件反转','历史人物现代错位','平行历史','离谱历史演绎','假如历史跑偏','古人空降现代','历史小人物逆袭'],
    公路群像: ['公路旅途','旅途奇遇','公路群像戏','女性联盟','多主角叙事'],
    新兴稀缺: ['反腐','体育竞技','萌宝亲子','非遗传承','文旅风光','银发养老','女性创业','二次元','律政先锋','医疗急救','短故事改编','银发纯爱','非血缘亲情','男性情感叙事','遗物整理师','AI恋人题材','失败者叙事','素人英雄','标准流程专业感','行话落地不堆砌','职业伦理两难','师徒传承带教','高压时间窗','专业失误与复盘','多岗位协作链','病例案情层层反转','职业侵入私人生活','专业硬本事爽点'],
    // 喜剧大类深挖：子类型 × 喜剧机制（解压是竖屏刚需，单独成类便于成体系立项）
    喜剧搞笑: ['沙雕解压','无厘头恶搞','反差萌喜剧','职场情景喜剧','家庭欢喜冤家','东北方言喜剧','川渝方言喜剧','误会连环套','错位人生喜剧','大型社死现场','吐槽役主角','反套路喜剧','冷幽默荒诞','讽刺喜剧','霸总喜剧','萌宠搞笑','童言无忌','塑料闺蜜兄弟','冤家路窄','坑爹系统','摆烂主角','装X翻车现场','灵魂互换搞笑','性别错位喜剧','天降横祸','一本正经胡说','反派罢工喜剧','赘婿翻身喜剧','相亲名场面','翻车后逆袭','预期违背包袱','三翻四抖递进','CallBack回扣','一本正经胡说八道','信息差误会升级','反差人设对撞','社死名场面','包袱节奏留白'],
    // 高概念设定：一句话能讲清的“处境/世界观”创意（区别于 hook 维度的个人能力金手指）
    高概念设定: ['时间循环困局','全世界只有我没超能力','可见寿命倒计时','NPC觉醒','反派觉醒自我意识','弹幕剧透人生','死亡回档','和死对头命运绑定','影子有自己想法','谎言会成真','每天随机身份','被困同一天','游戏规则降临现实','抽卡决定人生','副本世界求生','我的嘴开过光','好感度可视化','梦境连通现实','万物可退换','人生读档重来','全城直播我的人生','交换人生24小时','我是小说里的路人甲','被规则支配的世界'],
    // 强关系设定：短剧立项核心——用人物关系结构驱动（区别于“现代爱情”的具体桥段）
    强关系设定: ['契约假情侣','隐婚夫妻','冲喜联姻','上下级隐恋','合租室友变恋人','宿敌变恋人','契约兄妹','带球跑重逢','师徒禁忌之恋','欢喜冤家','联姻对象是死对头','假扮情侣见家长','异地网恋奔现','救命之恩以身相许','主仆身份错位','养女与亲儿子','青梅竹马重逢','契约父女关系','死对头被迫同居','榜一大哥与主播'],
    // 文旅短剧：剧情+城市/非遗/美食/景区，兼具文旅局合作与城市营销变现（B端/G端价值）
    文旅短剧: ['城市文旅打卡','非遗文旅','美食文旅','乡村文旅','景区悬疑文旅','国风文旅','文旅治愈公路','历史名人文旅','文旅探店轻喜','民宿文旅','古镇情缘文旅','边塞风光文旅','地标入戏情节','非遗技艺机关','美食情绪锚点','方言烟火气','地方传说新编','景区动线叙事','民宿客栈群像','风物道具伏笔','返乡创业文旅'],
  }},
  protagonist: { label: '主角设定', subs: {
    叙事视角: ['大女主','大男主','双女主','双男主','多人群像','女性互助','男性视角','第一人称'],
    身份起点: ['豪门继承人','落魄千金','上门赘婿','隐藏富豪','特种兵王','神医','学霸','学渣','打工人','单亲妈妈','全职太太','退伍军人','农村青年','海归精英','娱乐圈艺人','网红主播','外卖骑手','护士','教师','警察','律师','医生','程序员','销售','厨师','司机','保安','保姆','学生','退休老人'],
    人设反差: ['扮猪吃虎','表面废柴实为大佬','多重马甲大佬','黑化逆袭','冷面热心','痞气英雄','高智商低情商','柔弱实则刚强','反派洗白','落魄贵族'],
    年龄层: ['少年少女','青年二十加','而立三十加','中年四十加','银发五十加','跨代对手戏'],
    成长弧光: ['原生家庭创伤','社恐突破','自卑到自信','放下复仇执念','与自己和解','从利己到担当','在创伤中治愈'],
  }},
  hook: { label: '金手指设定', subs: {
    系统流: ['签到系统','选择系统','反派系统','神医系统','抽奖系统','直播系统','积分商城系统'],
    重生流: ['重生复仇','重生弥补遗憾','重生带记忆','重生改命'],
    穿越流: ['魂穿','身穿','穿书成炮灰','快穿任务者'],
    特殊能力: ['读心术','预知未来','透视眼','过目不忘','时间静止','随身空间','阴阳眼','医术通天','武功盖世','顶级黑客'],
    身份错位: ['隐藏身份','多重马甲','扮穷考验','微服私访','真假千金'],
    能力代价: ['能力有反噬','每日限次','完成任务才解锁','用能力折损寿命'],
  }},
  conflict: { label: '冲突爽点', subs: {
    打脸逆袭: ['打脸渣男','打脸恶婆婆','打脸势利亲戚','同学会打脸','职场打脸','扮猪吃虎打脸','马甲分层揭露','打脸阶梯递进','压抑释放节奏','弱者尊严锚点','围观见证放大','羞辱者仰望兑现','反派逐级加码','集尾打脸强钩'],
    复仇线: ['复仇虐渣','商战复仇','为亲人复仇','职场复仇'],
    甜宠互动: ['壁咚','英雄救美','吃醋护短','宠溺偏爱','双向奔赴撒糖','误会撒糖','心动阶梯递进','极限拉扯','误会不过夜','暗恋视角差','糖刀配比','虐点三拍','肢体微进度','HE情绪兑付','破镜重圆修复'],
    虐心点: ['误会错过','生离死别','身份阻碍','疾病困境','爱而不得'],
    权谋博弈: ['夺嫡之争','商战博弈','朝堂斗争','职场站队','反间计','势力关系棋盘','信息差设局','证据链反杀','蛰伏蓄力','绵里藏针对白','女性同盟群像','复仇账本清算','礼制规则博弈','胜负有代价'],
    生存危机: ['生命威胁','被追杀','破产危机','绝境翻盘'],
    节奏钩子: ['黄金三秒开场','三集一反转','集集留钩子','逆风翻盘','扬眉吐气','片尾大悬念'],
    情感共鸣: ['亲情和解','兄弟义气','家国大义','治愈救赎','平凡温暖','乡土情结','跨越生死的思念','迟来的信笺','意难平','双向救赎','破防瞬间','人间值得','无声的偏爱'],
  }},
  emotion: { label: '情感基调', subs: {
    基调: ['高爽感','高甜','虐心','治愈','烧脑','紧张刺激','轻松搞笑','黑色幽默','热血高燃','温情','惊悚','压抑后爆发','励志','松弛感','慢节奏细腻','电影感'],
    // 高泪点/高情绪浓度「情绪原型」：不是形容词，而是可复用的情感母题引擎，选中即指明催泪/破防的结构来源
    遗憾错过: ['子欲养而亲不待','最后一面','迟到半生的道歉','到站才懂的爱','错过就是一生','没说出口的谢谢','差一点就圆满'],
    跨越生死: ['遗物里的秘密','替逝者完成心愿','阴阳两隔的约定','一封走了一生的信','重逢只在梦里','亡者留下的线索','墓碑前的真相'],
    隐藏牺牲: ['被嫌弃者默默扛下','他装穷供你富贵','沉默的靠山','替你顶罪','为你放弃一生','最后一次保护','无名者的成全'],
    身份反转催泪: ['至亲竟是恩人','仇人原来是亲人','乞丐是隐姓恩人','父母的谎言','失散多年的重逢','亲子鉴定结果','恩人就在身边'],
    平凡微光: ['父亲的记账本','母亲留了一辈子的东西','一顿等了很久的饭','旧物里的深情','小人物的体面','底层人的英雄时刻','雨天的一把伞'],
    和解救赎: ['与缺席的父母和解','宿敌迟来的和解','施与受的反转','迟来的认可','恶人向善的一瞬','被原谅的自己','救赎当年的自己'],
    时代群像共情: ['老兵寻亲','离散重逢','故土难离','一群陌生人的善意','被时代辜负的人','接力完成的遗愿'],
    // 「情绪手法」：怎么调动观众情绪的可执行手段（突破性：把“催泪/燃的技法”做成可检索、可驱动创作的标签）
    情绪手法: ['先甜后刀','以乐写哀','笑着笑着就哭了','喜丧','温柔刀','细节杀','留白杀','物是人非','反差催泪','倒计时情感','群像接力催泪','旁观者视角共情','情绪延迟引爆','糖里藏刀','破防只在一瞬','压抑后的情感决堤'],
  }},
  era: { label: '时代背景', subs: {
    古代: ['先秦','汉唐','宋代','明代','清代','架空古代'],
    民国年代: ['北洋民国','抗战时期','解放战争'],
    怀旧年代: ['五六十年代','七八十年代知青','九十年代下海','千禧年怀旧','七十年代生产队','八十年代个体户','九十年代下岗潮'],
    当代: ['现代都市','当下2020s','近未来'],
    未来: ['近未来科幻','星际时代','末世','赛博都市'],
    海外: ['欧美背景','东南亚','日韩背景','中东背景','海外唐人街'],
  }},
  scene: { label: '场景地域', subs: {
    地域: ['一线城市','小县城','乡村田野','东北','西北','江南水乡','岭南','川渝','海岛','海外场景'],
    典型场域: ['豪门大宅','写字楼','医院','学校','警局','商场','工厂','直播间','影视片场','酒店','菜市场','胡同弄堂','古镇','军营','皇宫','宗门','末世基地','星际飞船','公路沿途'],
  }},
  audience: { label: '受众人群', subs: {
    女频: ['现言女频','古言女频','女性成长向','宝妈向','职场女性向','银发女性向'],
    男频: ['玄幻男频','都市男频','军旅男频','科幻男频'],
    年龄段: ['Z世代','年轻白领25_35','中年35_50','银发50加'],
    市场层级: ['下沉市场','一二线精品','出海ReelShort','出海DramaBox','大众通吃'],
  }},
  track: { label: '平台扶持赛道', subs: {
    四大趋势: [
      ['现实主义', { trend: '差异化' }],['公路题材', { trend: '差异化' }],['都市群像', { trend: '差异化' }],
      ['头部精品冲击', { trend: '头部爆款' }],['季播系列剧', { trend: '系列化' }],['衍生剧', { trend: '系列化' }],['单元剧', { trend: '系列化' }],
      ['强情感深度', { trend: '情感深度' }],['细腻人物关系', { trend: '情感深度' }],
    ],
    差异化稀缺: ['非遗文化扶持','文旅题材扶持','乡村振兴扶持','行业职场剧扶持','女性群像','谍战赛道','反腐题材扶持','武侠赛道','航天科幻赛道','银发题材','真人结合AI'],
    IP来源: ['番茄IP改编','短故事IP改编','原创剧本','爆款逆向改编','同人衍生'],
  }},
  structure: { label: '结构结局', subs: {
    结局: ['HE圆满','BE虐心','开放式结局','多结局','隐藏结局','结局大反转'],
    叙事结构: ['线性逆袭','三幕式','单元剧结构','季播系列','多线并行','循环叙事','互动分支','无限流副本','戏中戏元叙事','剧中剧反转','嵌套套层叙事','剧本照进现实','片场真假双线','排练与真相互文','观众即角色','旁观者复盘结构','伪纪录片式','多季分季结构','季终大钩子','跨季伏笔账本','主角团成长谱系','IP世界观扩容','多IP联动宇宙','系列反派阶梯','系列记忆点回扣','单季可入坑'],
    集数节奏: ['快节奏60_80集','精品短集20_40集','中长篇80_100集','边写边更'],
    // v2.24 戏中戏/元叙事结构深挖：与 meta-craft 十装置呼应（结构型，可叠加任意题材）
    元叙事戏中戏: ['双层地图清晰','双层镜像互文','边界渗漏反讽','选角即命运','道具穿层伏笔','排练即铺垫','第四堵墙规则','嵌套高潮同频','转层信号统一','主题折叠归一','戏里戏外双时间线','假戏真做'],
  }},
  format: { label: '形式平台', subs: {
    制作形式: ['真人实拍','AIGC漫剧','真人加AI','动画','动态漫'],
    投放平台: ['红果','抖音原生','微信小程序','快手','海外ReelShort','海外DramaBox','长视频平台'],
    画幅: ['竖屏','横屏精品','互动短剧'],
  }},
  style: { label: '风格流派', subs: {
    流派: ['爽文逆袭风','都市情感风','古装权谋风','悬疑烧脑风','港式短剧风','东北乡土风','南方市井风','都市白领风','电影质感风','写实纪录感','二次元动漫风','黑色幽默风','治愈日系风','美剧快节奏风'],
  }},
};

// 八大优势品类 → 平台额外分账加成（2026 公开规则：四品类+10%，四品类+20%）
const BOOST_10 = new Set(['现代家庭', '现代爱情', '逆袭成长', '都市日常']);
const BOOST_20 = new Set(['古风民国', '都市世情', '民国历史', '悬疑']);

const DIM_LABEL: Record<DimId, string> = Object.fromEntries(
  (Object.keys(RAW) as DimId[]).map((d) => [d, RAW[d].label]),
) as Record<DimId, string>;

function build(): TagNode[] {
  const nodes: TagNode[] = [];
  (Object.keys(RAW) as DimId[]).forEach((dim, di) => {
    nodes.push({ id: `${dim}`, name: RAW[dim].label, dim, level: 1, aliases: [], heat: 0 });
    const subs = Object.keys(RAW[dim].subs);
    subs.forEach((sub, si) => {
      const subId = `${dim}.${si}`;
      const boost = BOOST_10.has(sub) ? 10 : BOOST_20.has(sub) ? 20 : undefined;
      nodes.push({ id: subId, name: sub, dim, level: 2, parentId: dim, aliases: [], heat: boost ? 80 : 50, boost });
      RAW[dim].subs[sub].forEach((leaf, li) => {
        const obj: TagNode = { id: `${subId}.${li}`, name: typeof leaf === 'string' ? leaf : leaf[0], dim, level: 3, parentId: subId, aliases: [], heat: 50 };
        if (typeof leaf !== 'string') {
          const o = leaf[1];
          if (o.heat != null) obj.heat = o.heat;
          if (o.boost != null) obj.boost = o.boost;
          if (o.trend) obj.trend = o.trend;
          if (o.aliases) obj.aliases = o.aliases;
        }
        nodes.push(obj);
      });
    });
    void di;
  });
  return nodes;
}

export const ALL_TAGS: TagNode[] = build();
const BY_ID = new Map(ALL_TAGS.map((t) => [t.id, t]));
const BY_NAME = new Map<string, TagNode>();
ALL_TAGS.forEach((t) => { BY_NAME.set(t.name, t); t.aliases.forEach((a) => BY_NAME.set(a, t)); });
const LEAVES = ALL_TAGS.filter((t) => t.level === 3);
const LEAVES_BY_DIM: Record<DimId, TagNode[]> = Object.fromEntries(
  (Object.keys(RAW) as DimId[]).map((d) => [d, LEAVES.filter((t) => t.dim === d)]),
) as Record<DimId, TagNode[]>;

export const DIMENSIONS = (Object.keys(RAW) as DimId[]).map((d) => ({ id: d, label: DIM_LABEL[d], count: LEAVES_BY_DIM[d].length }));
export function leafCount(): number { return LEAVES.length; }
export function childrenOf(parentId: string): TagNode[] { return ALL_TAGS.filter((t) => t.parentId === parentId); }
export function ancestorChain(id: string): TagNode[] {
  const out: TagNode[] = []; let cur = BY_ID.get(id);
  while (cur?.parentId) { cur = BY_ID.get(cur.parentId)!; out.unshift(cur); }
  return out;
}
/** 名称/别名毫秒级检索，按热度降序 */
export function searchTags(query: string, limit = 20): TagNode[] {
  if (!query) return [];
  const q = query.trim();
  return LEAVES.filter((t) => t.name.includes(q) || t.aliases.some((a) => a.includes(q)))
    .sort((a, b) => b.heat - a.heat).slice(0, limit);
}
export function findTagByName(name: string): TagNode | undefined { return BY_NAME.get(name); }

/** 动态排序：0.4 全局使用频次 + 0.4 市场热度 + 0.2 个人偏好（权重与PRD一致，分值0-100） */
export function rankTags(dim: DimId, freq: Record<string, number> = {}, pref: Record<string, number> = {}): TagNode[] {
  const norm = (m: Record<string, number>) => {
    const vs = Object.values(m); const mx = vs.length ? Math.max(...vs, 1) : 1; return (id: string) => (m[id] ?? 0) / mx * 100;
  };
  const f = norm(freq || {}), p = norm(pref || {});
  return [...LEAVES_BY_DIM[dim]].map((t) => ({
    t, score: 0.4 * f(t.id) + 0.4 * t.heat + 0.2 * p(t.id),
  })).sort((a, b) => b.score - a.score).map((x) => x.t);
}

// 互斥标签对（按标签名；生成时不可同时成立）
const MUTEX_NAME: [string, string][] = [
  ['HE圆满', 'BE虐心'], ['HE圆满', '开放式结局'], ['大女主', '大男主'], ['现言女频', '玄幻男频'],
  ['真人实拍', 'AIGC漫剧'], ['甜宠', '虐心'],
];
// 必备维度：缺了无法立项
const REQUIRED_DIM: DimId[] = ['genre', 'protagonist', 'conflict'];
const RECOMMENDED_DIM: DimId[] = ['audience', 'era', 'emotion'];
/** 某标签是否与一组已选标签构成互斥（供智能选片/前端校验复用，规则单一来源避免各处各写一套） */
export function mutexConflict(name: string, existing: string[]): boolean {
  return MUTEX_NAME.some(([a, b]) =>
    (name === a && existing.includes(b)) || (name === b && existing.includes(a)));
}

export interface ComboReport {
  ok: boolean; completeness: number;
  errors: string[]; warnings: string[];
  matchedDim: DimId[]; missingRequired: DimId[];
  boostPct: number; boostedGenres: string[]; trends: TagNode['trend'][];
}
/** 标签组合自检：未知/重复/互斥/缺维度 + 平台扶持与趋势契合 */
export function validateCombo(names: string[]): ComboReport {
  const errors: string[] = []; const warnings: string[] = [];
  const resolved: TagNode[] = [];
  const seen = new Set<string>();
  for (const n of names) {
    if (seen.has(n)) { warnings.push(`标签重复：${n}`); continue; }
    seen.add(n);
    const t = BY_NAME.get(n);
    if (!t) { errors.push(`未知标签：${n}`); continue; }
    if (t.level === 3) resolved.push(t);
  }
  for (const [a, b] of MUTEX_NAME) if (names.includes(a) && names.includes(b)) errors.push(`互斥标签不能并存：${a} / ${b}`);
  const matchedDim = Array.from(new Set(resolved.map((t) => t.dim)));
  const missingRequired = REQUIRED_DIM.filter((d) => !matchedDim.includes(d));
  if (missingRequired.length) errors.push(`缺少必备维度：${missingRequired.map((d) => DIM_LABEL[d]).join('、')}`);
  const missingRec = RECOMMENDED_DIM.filter((d) => !matchedDim.includes(d));
  missingRec.forEach((d) => warnings.push(`建议补充：${DIM_LABEL[d]}`));
  if (resolved.length > 14) warnings.push('标签过多(>14)，主线可能发散');
  // 平台扶持：命中八大品类二级祖先
  const boostedGenres: string[] = []; let boostPct = 0; const trends = new Set<TagNode['trend']>();
  resolved.forEach((t) => {
    ancestorChain(t.id).forEach((a) => { if (a.boost) { boostPct = Math.max(boostPct, a.boost); if (!boostedGenres.includes(a.name)) boostedGenres.push(a.name); } });
    if (t.trend) trends.add(t.trend);
  });
  const allDim = new Set([...REQUIRED_DIM, ...RECOMMENDED_DIM, ...matchedDim]);
  const completeness = Math.round((matchedDim.filter((d) => allDim.has(d)).length / (REQUIRED_DIM.length + RECOMMENDED_DIM.length)) * 100);
  return { ok: errors.length === 0, completeness: Math.min(completeness, 100), errors, warnings, matchedDim, missingRequired, boostPct, boostedGenres, trends: [...trends] };
}

/** 基于已选标签推荐互补标签：优先补齐空缺维度、高热度、规避互斥/重复 */
export function recommendNext(names: string[], n = 8): TagNode[] {
  const used = new Set(names);
  const report = validateCombo(names);
  const dimOrder = [...report.missingRequired, ...RECOMMENDED_DIM.filter((d) => !report.matchedDim.includes(d)),
    ...(Object.keys(RAW) as DimId[]).filter((d) => !report.matchedDim.includes(d as DimId))];
  const out: TagNode[] = [];
  const PER_DIM_CAP = 2; // 每维度最多取2个，轮转覆盖更多缺失维度
  const orderedDim = [...new Set(dimOrder)] as DimId[];
  while (out.length < n) {
    let progressed = false;
    for (const dim of orderedDim) {
      if (out.length >= n) break;
      const have = out.filter((t) => t.dim === dim).length;
      if (have >= PER_DIM_CAP) continue;
      const cand = [...LEAVES_BY_DIM[dim]].sort((a, b) => b.heat - a.heat)
        .filter((t) => !used.has(t.name) && !out.some((o) => o.id === t.id)
          && !MUTEX_NAME.some(([a, b]) => (names.includes(a) && t.name === b) || (names.includes(b) && t.name === a)));
      const pick = cand[have];
      if (pick) { out.push(pick); progressed = true; }
    }
    if (!progressed) break;
  }
  return out;
}

/** 标签组合 → 结构化创作 Brief（直接喂剧情架构师，让标签真正驱动创作） */
export function comboToBrief(names: string[]): { title: string; lines: string[]; raw: string } {
  const byDim = new Map<DimId, string[]>();
  names.map((n) => BY_NAME.get(n)).filter((t): t is TagNode => !!t && t.level === 3).forEach((t) => {
    if (!byDim.has(t.dim)) byDim.set(t.dim, []); byDim.get(t.dim)!.push(t.name);
  });
  const lines: string[] = [];
  (Object.keys(RAW) as DimId[]).forEach((d) => { if (byDim.has(d)) lines.push(`【${DIM_LABEL[d]}】${byDim.get(d)!.join('、')}`); });
  const r = validateCombo(names);
  if (r.boostedGenres.length) lines.push(`【平台扶持】命中优势品类${r.boostedGenres.join('、')}，预计额外分账+${r.boostPct}%`);
  if (r.trends.length) lines.push(`【趋势契合】${r.trends.join('、')}`);
  return { title: '标签创作简报', lines, raw: lines.join('\n') };
}

/** 成体系随机：每个指定维度按热度加权抽 1 个，避免无关联乱凑 */
export function randomCombo(dims: DimId[] = (Object.keys(RAW) as DimId[]), rng: () => number = Math.random): string[] {
  const weighted = (arr: TagNode[]) => {
    const sum = arr.reduce((s, t) => s + t.heat, 0); let r = rng() * sum;
    for (const t of arr) { r -= t.heat; if (r <= 0) return t; }
    return arr[arr.length - 1];
  };
  return dims.map((d) => weighted(LEAVES_BY_DIM[d]).name);
}

// —— 智能随机：懂市场(热度/频次) + 懂用户(偏好/已选主题聚合)，且不造成选择困难、绝不产出互斥/重复 ——
export interface SmartRandomOpts {
  dims?: DimId[];                 // 默认=必备3维+推荐3维，清爽6个起步
  seed?: string[];                // 用户已锚定的标签，围绕其同子类做主题聚合，避免乱凑
  freq?: Record<string, number>;  // 全局使用频次 id->次数
  pref?: Record<string, number>;  // 用户个人偏好 id->次数（历史创作）
  perDim?: number;                // 每维度抽几个，默认1
  maxTags?: number;               // 总数上限（防选择困难），默认9
  rng?: () => number;
}
export function smartRandomCombo(opts: SmartRandomOpts = {}): string[] {
  const {
    dims = [...REQUIRED_DIM, ...RECOMMENDED_DIM], seed = [],
    freq = {}, pref = {}, perDim = 1, maxTags = 9, rng = Math.random,
  } = opts;
  const norm = (m: Record<string, number>) => {
    const vs = Object.values(m); const mx = vs.length ? Math.max(...vs, 1) : 1;
    return (id: string) => (m[id] ?? 0) / mx * 100;
  };
  const f = norm(freq || {}), p = norm(pref || {});
  const seedParent = new Set(seed.map((n) => BY_NAME.get(n)).filter((t): t is TagNode => !!t).map((t) => t.parentId));
  const out: string[] = []; const used = new Set<string>();
  const conflicts = (name: string) => MUTEX_NAME.some(([a, b]) => (used.has(a) && name === b) || (used.has(b) && name === a));
  // 加权抽样（保底极小正权重，避免零概率/除零）
  const weightedPick = <X,>(arr: X[], scoreOf: (x: X) => number): X => {
    const ss = arr.map((x) => ({ x, s: Math.max(scoreOf(x), 1e-4) }));
    const sum = ss.reduce((a, z) => a + z.s, 0);
    let r = rng() * sum;
    for (const z of ss) { r -= z.s; if (r <= 0) return z.x; }
    return arr[arr.length - 1];
  };
  let budget = maxTags;
  for (const dim of dims) {
    if (budget <= 0) break;
    const pool = LEAVES_BY_DIM[dim];
    if (!pool || !pool.length) continue;
    // 按二级子类（创作方向）分组
    const groups = new Map<string, TagNode[]>();
    pool.forEach((t) => { const key = t.parentId ?? ''; if (!groups.has(key)) groups.set(key, []); groups.get(key)!.push(t); });
    for (let k = 0; k < perDim && budget > 0; k++) {
      const availGroups = [...groups.values()].filter((g) => g.some((t) => !used.has(t.name) && !conflicts(t.name)));
      if (!availGroups.length) break;
      // 阶段1 选方向：0.4市场均热+0.4频次聚合+0.2偏好聚合；强偏好方向乘性增益(最高×8，越用越懂你，子类目录变大后仍能强倾斜)；seed同主题×1.3
      const groupScore = (g: TagNode[]) => {
        const heat = g.reduce((s, t) => s + t.heat, 0) / g.length;
        const fr = g.reduce((s, t) => s + f(t.id), 0) / g.length;
        const pr = Math.max(...g.map((t) => p(t.id)));
        const base = 0.4 * heat + 0.4 * fr + 0.2 * pr + 1;
        const prefBoost = 1 + 7 * (pr / 100);
        const themeBoost = seedParent.has(g[0].parentId) ? 1.3 : 1;
        return base * prefBoost * themeBoost;
      };
      const g = weightedPick(availGroups, groupScore);
      // 阶段2 在该方向内按 0.4市场+0.4频次+0.2偏好 选具体标签
      const cand = g.filter((t) => !used.has(t.name) && !conflicts(t.name));
      const pick = weightedPick(cand, (t) => 0.4 * t.heat + 0.4 * f(t.id) + 0.2 * p(t.id) + 1);
      out.push(pick.name); used.add(pick.name); budget--;
    }
  }
  return out;
}
