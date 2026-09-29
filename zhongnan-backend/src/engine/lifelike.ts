/**
 * 生活化细节注入引擎（PRD 2.1.5 治“细节空洞/悬浮”）
 *  - 按场景类型提供真实可感的环境/动作/道具/音效细节，反“奢华水晶灯”式悬浮
 *  - 检测抽象空洞叙述（他很生气/气氛尴尬），倒逼改成可拍摄的具体动作
 * 铁律：每个细节要么推进剧情、要么显露人物，绝不堆砌凑字。
 */

export interface SceneDetail { env: string[]; action: string[]; prop: string[]; sound: string[] }

/** 高频短剧场景的“烟火气”细节库（可持续被学习中心扩充） */
export const DETAIL_BANK: Record<string, SceneDetail> = {
  出租屋: {
    env: ['墙皮被梅雨泡得起皮', '窗式空调嗡嗡作响还滴水', '电磁炉旁贴着褪色的缴费单'],
    action: ['蹲在小板凳上就着电饭锅吃饭', '把工服叠好压在枕头底下', '用袖口擦了擦唯一的马克杯'],
    prop: ['掉漆的不锈钢盆', '充一次用三天的充电宝', '夹在镜框边的老家车票'],
    sound: ['楼上拖椅子的闷响', '楼下收废品的喇叭', '水龙头滴水声'],
  },
  厨房: {
    env: ['抽油烟机嗡嗡响，围裙蹭上油渍', '案板上还摊着没切完的葱花', '高压锅哧哧冒气'],
    action: ['一边颠勺一边用胳膊肘蹭汗', '把多的那块肉默默扒到孩子碗里', '关火后又回身把灶台擦了一遍'],
    prop: ['磕出坑的不锈钢盆', '用了十年的木铲', '贴在冰箱上的超市小票'],
    sound: ['油锅噼啪', '菜刀剁砧板的笃笃声', '水壶鸣笛'],
  },
  办公室: {
    env: ['工位隔板贴着便签和外卖红包', '打印机卡纸的红灯一闪一闪', '会议室玻璃上全是指纹'],
    action: ['飞快把招聘页面最小化', '用马克杯挡住工牌上的名字', '趁领导转身翻了个白眼'],
    prop: ['凉透的美式', '缠了胶带的数据线', '写满批注的打印稿'],
    sound: ['钉钉连响', '中央空调风声', '键盘敲得格外用力'],
  },
  医院: {
    env: ['消毒水味混着走廊尽头的泡面味', '叫号屏跳字', '住院部楼下有人蹲着抽烟'],
    action: ['攥着缴费单的指节发白', '把检查报告折了又展开', '签字时笔在半空停了三秒'],
    prop: ['卷边的病历本', '装着片子的塑料袋', '凉了的保温桶'],
    sound: ['平车滚轮声', '监护仪滴滴', '走廊压低的哭声'],
  },
  菜市场: {
    env: ['地上湿乎乎垫着纸壳', '卤味摊热气往上冒', '红塑料筐摞得老高'],
    action: ['掐了掐青菜看新不新鲜', '为五毛钱和摊主拌嘴又笑着付钱', '顺手揪了颗葡萄尝'],
    prop: ['断了根提手的布袋', '老式弹簧秤', '沾着水的零钱'],
    sound: ['剁肉声', '喇叭循环喊特价', '电动车铃'],
  },
  豪车: {
    env: ['车内香氛是冷杉味', '抬头显映着限速', '后排脚垫一尘不染'],
    action: ['手指无意识敲着真皮扶手', '降下车窗又升起，像在犹豫', '把名片夹在遮阳板后'],
    prop: ['没拆封的矿泉水', '定制袖扣', '静音的手机屏幕反复亮起'],
    sound: ['车门沉闷的合上声', '转向灯哒哒', ' Bose 音响低鸣'],
  },
  高档餐厅: {
    env: ['刀叉摆得能照出人影', '钢琴声盖不过邻座的窃窃私语', '侍者倒水只倒七分'],
    action: ['把餐巾铺在腿上又攥紧', '看不懂菜单却点得很快', '用余光扫对方的戒指'],
    prop: ['凝水珠的水杯', '没点燃的蜡烛', '压在盘底的黑卡'],
    sound: ['刀叉轻碰瓷盘', '冰块撞杯', '压低的笑'],
  },
  // v2.91 场景库扩充：补 15 个高频短剧场景，覆盖校园/职场/通勤/家庭/公共空间/特殊空间
  教室: {
    env: ['黑板上还留着上一节的板书', '窗台上摞着没人认领的水壶', '电风扇摇头晃脑地吹着卷子'],
    action: ['用修正带涂掉错字又涂重了', '把手机塞进课桌肚又掏出来瞄一眼', '低头在草稿纸上画小人'],
    prop: ['磨花的透明垫板', '卷了边的错题本', '笔帽被咬出牙印的中性笔'],
    sound: ['椅腿蹭水磨石地面', '隔壁桌翻书的哗啦声', '走廊里的眼保健操广播'],
  },
  宿舍: {
    env: ['上铺扶手挂着一串钥匙', '桌面上摞着泡面桶和参考书', '阳台晾着没拧干的T恤'],
    action: ['盘腿坐床上啃苹果刷剧', '把舍友的闹钟按掉又眯过去', '蹲在地上用插线板给三个设备充电'],
    prop: ['缠成团的充电线', '贴满贴纸的笔记本电脑', '床头夹着的小风扇'],
    sound: ['上下铺的吱呀声', '隔壁寝室的游戏音效', '楼道里拖鞋的啪嗒声'],
  },
  工地: {
    env: ['脚手架挂满灰', '钢筋堆旁的矿泉水瓶压成饼', '临时厕所飘出消毒水味'],
    action: ['把安全帽当坐垫坐地上吃饭', '用沾灰的袖子抹汗又继续绑钢筋', '蹲在阴影里给家里打视频'],
    prop: ['磨破指头的劳保手套', '插着吸管的两升装冰茶', '绑在钢筋上的塑料袋'],
    sound: ['塔吊卷扬机的嗡嗡', '钢筋砸地的哐当', '远处切割机的尖啸'],
  },
  网吧: {
    env: ['烟味混着泡面味', '机位之间隔板磨得发亮', '荧光屏倒映在油性脸上'],
    action: ['一边按键盘一边叼着烟歪头', '把可乐罐捏扁塞进垃圾袋', '凌晨三点趴在键盘上眯一会儿'],
    prop: ['缠着胶带的耳机', '吃剩一半的泡面桶', '皱巴巴的会员卡'],
    sound: ['键盘噼里啪啦', '队友语音的爆音', '主机风扇的轰鸣'],
  },
  健身房: {
    env: ['镜子上印着汗手印', '瑜伽垫边角翘起', '饮水机下接满了半杯蛋白粉'],
    action: ['把毛巾搭脖子上下一个深蹲', '边举哑铃边看手机视频', '对着镜子调整姿势又侧身'],
    prop: ['掉漆的哑铃', '缠着绷带的握力器', '喝了一半的运动饮料'],
    sound: ['铁片撞铁片的哐当', '跑步机的嗡嗡', '教练压低的"再来一组"'],
  },
  地铁: {
    env: ['扶手杆上都是指印', '车厢连接处闪着黄灯', '玻璃窗映着疲惫的脸'],
    action: ['一只手抓扶手一只手刷手机', '把包换到另一边肩膀挡住让座的人', '低头假装没看到熟面孔'],
    prop: ['挂在外套带上的口罩', '没喝完的半杯奶茶', '磨花的交通卡'],
    sound: ['报站的"下一站"', '刹车的吱呀', '隔壁外放短视频的笑声'],
  },
  公园: {
    env: ['长椅掉漆露木茬', '健身器材转盘咯吱响', '落叶堆在台阶缝里'],
    action: ['一只手牵着孩子一只手提着水壶', '坐在长椅上刷手机又抬头张望', '小跑着追飞走的羽毛球'],
    prop: ['褪色的野餐垫', '咬了一口的苹果', '绑在童车上的铃铛'],
    sound: ['广场舞音响的低频', '孩子追跑的尖叫', '远处车流的轰鸣'],
  },
  商场: {
    env: ['地砖反光能照人影', '试衣间帘子没拉严', '促销海报被空调吹得翘边'],
    action: ['把衣服在身前比了又比', '趁导购转身偷拍价签', '蹲在童装区给孩子系鞋带'],
    prop: ['拎了一路的购物袋', '荧光灯下显色的口红', '优惠券叠的小方块'],
    sound: ['广播的促销循环', '扶梯电机的嗡嗡', '隔壁奶茶店的音乐'],
  },
  美容院: {
    env: ['镜前灯一圈圈亮着', '化妆台上摆着半瓶卸妆水', '理发椅液压杆咯吱响'],
    action: ['仰头让人家洗头又眯一会儿', '对着镜子补眉毛又擦掉重画', '把围布撩开看手机'],
    prop: ['夹子夹着的发票', '一次性拖鞋的薄塑料', '毛巾叠的方块'],
    sound: ['吹风机的嗡嗡', '剪刀的咔嚓', '隔壁顾客压低的八卦'],
  },
  KTV: {
    env: ['沙发皮磨得起毛球', '点歌屏上粘着糖渍', '茶几上摆着没开瓶的洋酒'],
    action: ['一只手举话筒一只手挥荧光棒', '窝在角落低头刷手机等散场', '把瓜子壳堆在杯垫上'],
    prop: ['撕开一半的果盘', '掉漆的麦克风', '揉皱的歌单'],
    sound: ['音响震到耳膜的低频', '隔壁包厢的跑调合唱', '点歌提示音的叮咚'],
  },
  银行: {
    env: ['取号屏跳字', 'atm隔间里飘着空调冷风', '防弹玻璃后柜员低头敲键盘'],
    action: ['攥着身份证和银行卡反复看', '把密码按了又删重来', '在叫号单上写写画画'],
    prop: ['卷边的存折', '装着发票的塑料袋', '磨花的银行卡'],
    sound: ['叫号广播', '点钞机的哗啦', '玻璃隔层的闷响'],
  },
  法庭: {
    env: ['旁听席木椅磨得发亮', '审判席的国徽反光', '空调出风口嗡嗡响'],
    action: ['把诉状翻来翻去找那一页', '攥着笔又抬头看法官', '转身给律师使眼色'],
    prop: ['卷角的案卷', '盖着红章的传票', '法院门口的安检牌'],
    sound: ['法槌的闷响', '空调的嗡嗡', '书记员敲键盘的嗒嗒'],
  },
  寺庙: {
    env: ['香炉积着香灰', '蒲团磨得发亮', '屋檐角挂着铜铃'],
    action: ['合掌闭眼又偷瞄一眼旁边的人', '把香举过头鞠了三个躬', '跪在蒲团上嘴唇微动'],
    prop: ['皱巴巴的签文', '红绳系着的平安符', '功德箱里的零钱'],
    sound: ['木鱼的笃笃', '远处钟声', '诵经的低吟'],
  },
  老宅: {
    env: ['堂屋挂着褪色的全家福', '八仙桌掉漆露木茬', '灶台贴着发黄的灶神像'],
    action: ['把蒲扇摇得格外慢', '蹲在井边打水又停下喘口气', '掀开缸盖舀咸菜又盖上'],
    prop: ['豁口的青花碗', '缠着铁丝的搪瓷缸', '挂落灰的算盘'],
    sound: ['老座钟的报时', '远处狗吠', '井绳拽水的吱呀'],
  },
  弄堂: {
    env: ['晾衣杆横在头顶滴水', '青砖墙皮起鼓', '石库门铜环磨得发亮'],
    action: ['侧身让过自行车又低头', '蹲在门口摘菜又跟邻居搭话', '把煤球炉端到弄堂口扇'],
    prop: ['豁口的塑料盆', '挂了锁的木信箱', '贴在墙上的电费单'],
    sound: ['自行车铃', '楼上收衣服的竹竿声', '收废品的吆喝'],
  },
  高铁: {
    env: ['行李架上塞满行李箱', '小桌板放倒一半', '车窗外的田野一片片飞过'],
    action: ['把座椅调直又往后靠', '一手撑下巴看窗外一手刷手机', '起身让座又坐下'],
    prop: ['撕开一半的零食袋', '磨花的护照夹', '手机支架夹着充电宝'],
    sound: ['车厢连接处的"叮咚"', '空调的嗡嗡', '邻座压低的通话'],
  },
};

// v2.91 抽象空洞标记同步扩充：从 14 个增至 32 个，覆盖更多 AI 套话与抽象叙述
const ABSTRACT_MARKERS = [
  // 原 14 个
  '气氛尴尬', '空气凝固', '十分生气', '非常愤怒', '很伤心', '无比激动', '豪华', '奢华',
  '金碧辉煌', '美若天仙', '气质非凡', '一言难尽', '心中五味杂陈', '说不出的感觉',
  // v2.91 新增 18 个：覆盖更多 AI 套话与抽象叙述
  '气氛一度十分尴尬', '空气仿佛静止', '心中百感交集', '内心五味杂陈', '顿时火冒三丈',
  '瞬间泪流满面', '顿时热血沸腾', '瞬间心灰意冷', '美若天人', '宛如仙子下凡',
  '气宇轩昂', '不怒自威', '颇具气势', '富丽堂皇', '装修豪华',
  '气氛一度凝固', '瞬间陷入死寂', '顿时鸦雀无声',
];

export interface GroundedResult { abstractHits: string[]; groundedScore: number; suggestions: string[] }

/** 检测抽象空洞叙述：分数越高越“可拍摄、有烟火气” */
export function groundedScan(text: string): GroundedResult {
  const abstractHits = ABSTRACT_MARKERS.filter((m) => text.includes(m));
  // 具体动作行（△）与具体名词密度作为正向信号
  const actionLines = (text.match(/△/g) || []).length;
  const groundedScore = Math.max(0, Math.min(100, 100 - abstractHits.length * 14 + actionLines * 3));
  const suggestions = abstractHits.map((m) => `“${m}”是抽象叙述，换成一个能拍出来的动作/道具/神态`);
  return { abstractHits, groundedScore, suggestions };
}

/** v2.00 英文场景细节库（按英文关键词命中；与中文 DETAIL_BANK 平行，默认中文逻辑不变） */
const DETAIL_BANK_EN: Record<string, { keys: string[] } & SceneDetail> = {
  rental: {
    // v2.91: 移除 'dorm' 避免与新增的 dorm 场景抢匹配；rental 偏向"廉价出租屋"，dorm 偏向"学生宿舍"
    keys: ['rental', 'studio apartment', 'tenement', 'shabby flat', 'cramped rental'],
    env: ['peeling wallpaper bloated by damp', 'a window AC unit rattling and dripping', 'a faded utility bill stuck by the hot plate'],
    action: ['eating rice off the rice cooker while crouched on a stool', 'folding the work uniform and tucking it under the pillow', 'wiping the only mug with a sleeve'],
    prop: ['a chipped stainless-steel basin', 'a power bank that lasts three days', 'a hometown bus ticket wedged in the mirror frame'],
    sound: ['the dull scrape of a chair upstairs', 'a scrap-collector’s horn below', 'a dripping faucet'],
  },
  kitchen: {
    keys: ['kitchen', 'cooking', 'stove', 'wok'],
    env: ['the range hood humming, grease on the apron', 'chopped scallion left half-done on the board', 'a pressure valve hissing steam'],
    action: ['wiping sweat with an elbow while tossing the wok', 'silently scooping the bigger piece of meat into the child’s bowl', 'turning back to wipe the stove after the flame is off'],
    prop: ['a dented steel basin', 'a ten-year-old wooden spatula', 'a supermarket receipt on the fridge'],
    sound: ['oil crackling', 'the cleaver knocking the board', 'the kettle whistling'],
  },
  office: {
    keys: ['office', 'cubicle', 'workplace', 'meeting room', 'desk'],
    env: ['sticky notes and takeout coupons on the divider', 'the printer’s jam light blinking red', 'fingerprints all over the meeting-room glass'],
    action: ['instantly minimizing the job-hunting tab', 'covering the name on the badge with a mug', 'rolling the eyes the moment the boss turns away'],
    prop: ['a lukewarm Americano', 'a cable wound with tape', 'a printout covered in margin notes'],
    sound: ['chat pings in a row', 'the central AC hum', 'keys struck unusually hard'],
  },
  hospital: {
    keys: ['hospital', 'ward', 'clinic', 'emergency room'],
    env: ['disinfectant mixing with instant-noodle smell down the hall', 'the queue screen flipping numbers', 'someone squatting and smoking below the ward'],
    action: ['knuckles whitening around the payment slip', 'folding and unfolding the test report', 'the pen hovering three seconds before signing'],
    prop: ['a dog-eared medical record', 'a plastic bag holding the scans', 'a gone-cold thermos'],
    sound: ['gurney wheels', 'the monitor beeping', 'muffled crying in the corridor'],
  },
  market: {
    keys: ['market', 'stall', 'vendor', 'grocer', 'bazaar'],
    env: ['wet cardboard laid on the damp ground', 'steam rising off the braised-food stall', 'red crates stacked high'],
    action: ['pinching the greens to check freshness', 'haggling over fifty cents then paying with a smile', 'plucking a grape to sample'],
    prop: ['a cloth bag with a broken handle', 'an old spring scale', 'damp change'],
    sound: ['chopping meat', 'a speaker looping the daily special', 'an e-bike bell'],
  },
  luxurycar: {
    keys: ['limo', 'luxury car', 'back seat of the', 'chauffeur', 'maybach', 'rolls-royce', 'sports car'],
    env: ['fir-scented cabin fragrance', 'the heads-up display showing the speed limit', 'spotless rear floor mats'],
    action: ['fingers drumming the leather armrest unconsciously', 'lowering then raising the window, as if hesitating', 'tucking a card behind the sun visor'],
    prop: ['an unopened bottle of water', 'custom cufflinks', 'a silenced phone screen lighting up again and again'],
    sound: ['the muted thunk of the door closing', 'turn-signal ticks', 'a low Bose hum'],
  },
  restaurant: {
    // v2.91: 移除 'private room' 避免与新增的 ktv 场景抢匹配；restaurant 偏向"高档餐厅"，ktv 偏向"卡拉OK包厢"
    keys: ['restaurant', 'fine dining', 'dinner table', 'banquet'],
    env: ['cutlery polished enough to reflect a face', 'piano barely covering the neighboring whispers', 'the waiter pouring water to seven-tenths'],
    action: ['spreading the napkin on the lap then clenching it', 'ordering fast while unable to read the menu', 'glancing at the other’s ring from the corner of the eye'],
    prop: ['a glass beading with condensation', 'an unlit candle', 'a black card tucked under the plate'],
    sound: ['silverware touching porcelain', 'ice clinking the glass', 'a lowered laugh'],
  },
  // v2.91 英文场景库同步补 15 个，键/细节与中文 DETAIL_BANK 一一对应
  classroom: {
    keys: ['classroom', 'school', 'lesson', 'blackboard', 'desk'],
    env: ['last period’s chalk notes still on the board', 'unclaimed water bottles piled on the windowsill', 'a fan wagging exam papers on the desk'],
    action: ['over-correcting with the tape again', 'slipping the phone into the desk and sneaking a glance', 'doodling stick figures on scratch paper'],
    prop: ['a scratched transparent pad', 'a dog-eared mistake book', 'a pen cap dented with bite marks'],
    sound: ['chair legs scraping terrazzo', 'the rustle of next desk flipping pages', 'the eye-exercise broadcast from the hall'],
  },
  dorm: {
    keys: ['dorm', 'dormitory', 'bunk bed', 'student room'],
    env: ['a key ring hanging on the upper bunk rail', 'instant-noodle buckets stacked on the desk', 'a T-shirt not wrung out drying on the balcony'],
    action: ['sitting cross-legged on the bed eating an apple and watching a show', 'killing a roommate’s alarm and snoozing on', 'crouching to charge three devices off one strip'],
    prop: ['a tangle of charging cables', 'a laptop plastered with stickers', 'a small fan clamped to the headboard'],
    sound: ['the creak of the upper bunk', 'game sound effects from next door', 'flip-flops slapping in the corridor'],
  },
  construction: {
    keys: ['construction', 'site', 'scaffold', 'rebar'],
    env: ['scaffolding layered in dust', 'flattened mineral-water bottles by the rebar pile', 'disinfectant drifting from the portable toilet'],
    action: ['sitting on a hard hat to eat lunch', 'wiping sweat with a dusty sleeve and going back to tying rebar', 'crouching in the shade to video-call home'],
    prop: ['work gloves with blown-out fingers', 'a two-liter iced tea with a straw', 'a plastic bag tied to the rebar'],
    sound: ['the hum of the tower-crane winch', 'the clang of rebar hitting the ground', 'the distant whine of a cut-off saw'],
  },
  internetcafe: {
    keys: ['internet cafe', 'cybercafe', 'pc bang', 'gaming den'],
    env: ['cigarette smoke layered with instant-noodle smell', 'cubicle dividers polished shiny', 'fluorescent screens reflected on oily faces'],
    action: ['typing one-handed with a cigarette dangling from the mouth', 'crushing a cola can and stuffing it in the bin', 'dozing on the keyboard at 3 a.m.'],
    prop: ['a headset taped at the joint', 'a half-eaten noodle cup', 'a crinkled membership card'],
    sound: ['the clatter of keys', ' teammates’ clipped voice chat', 'the hum of chassis fans'],
  },
  gym: {
    keys: ['gym', 'fitness', 'treadmill', 'dumbbell', 'weight room'],
    env: ['sweaty handprints on the mirror', 'a yoga mat with peeling corners', 'a shaker half-filled with protein powder under the fountain'],
    action: ['a squat with the towel draped over the neck', 'curling a dumbbell while watching a phone video', 'adjusting form sideways in the mirror'],
    prop: ['a chipped dumbbell', 'a grip trainer wrapped in bandage', 'a half-finished sports drink'],
    sound: ['the clang of plates', 'the hum of the treadmill', 'a coach muttering "one more set"'],
  },
  subway: {
    keys: ['subway', 'metro', 'train car', 'platform'],
    env: ['fingerprints all over the grab pole', 'a yellow light blinking at the car joint', 'a tired face mirrored in the window glass'],
    action: ['one hand on the pole, the other scrolling the phone', 'switching the bag to the other shoulder to hide from the seat-giver', 'pretending not to notice a familiar face'],
    prop: ['a mask dangling from the coat strap', 'a half-finished milk tea', 'a worn transit card'],
    sound: ['the "next station" announcement', 'the screech of brakes', 'a neighbor’s short video on speaker'],
  },
  park: {
    keys: ['park', 'bench', 'playground', 'square'],
    env: ['a long bench with chipped paint and bare wood', 'a fitness-disc rotating with a squeak', 'leaves piled in the step cracks'],
    action: ['one hand holding the child, the other a water bottle', 'scrolling the phone on a bench then looking up', 'jogging after a stray shuttlecock'],
    prop: ['a faded picnic mat', 'an apple with one bite out of it', 'a bell tied to a stroller'],
    sound: ['the low thump of square-dance speakers', 'children chasing and shrieking', 'the roar of distant traffic'],
  },
  mall: {
    keys: ['mall', 'shopping', 'fitting room', 'promotional'],
    env: ['floor tiles that mirror a silhouette', 'a fitting-room curtain half-drawn', 'promo posters curling under the AC vent'],
    action: ['holding a garment in front of the body again and again', 'sneaking a photo of the price tag when the clerk turns', 'crouching in the kids’ section to tie a shoe'],
    prop: ['a shopping bag carried all the way', 'a lipstick shade the fluorescent light picks out', 'a coupon folded into a small square'],
    sound: ['the looping promo broadcast', 'the hum of the escalator motor', 'music from the neighboring tea shop'],
  },
  salon: {
    keys: ['salon', 'hairdresser', 'barber', 'beauty parlor'],
    env: ['ring-lights lit in circles', 'a half-bottle of makeup remover on the vanity', 'a hydraulic chair squeaking'],
    action: ['tilting the head back for a wash and dozing off', 'touching up the brow, wiping it, redrawing', 'flipping the cape aside to check the phone'],
    prop: ['an invoice clipped with a clip', 'flimsy plastic for the disposable slippers', 'a folded towel square'],
    sound: ['the hum of the hairdryer', 'the snip of scissors', 'a neighboring customer’s hushed gossip'],
  },
  ktv: {
    keys: ['ktv', 'karaoke', 'private room', 'lounge'],
    env: ['sofa leather pilling', 'sticky sugar stains on the touch screen', 'an unopened bottle of spirits on the table'],
    action: ['one hand on the mic, the other waving a glow stick', 'hiding in the corner scrolling the phone until the session ends', 'piling sunflower shells on the coaster'],
    prop: ['a half-torn fruit platter', 'a chipped microphone', 'a crumpled song list'],
    sound: ['a low frequency vibrating the eardrums', 'the off-key chorus from the next room', 'the bing of the song-picker'],
  },
  bank: {
    keys: ['bank', 'counter', 'atm', 'teller'],
    env: ['a number screen flipping digits', 'AC cold drifting from the ATM booth', 'a teller behind bulletproof glass typing head-down'],
    action: ['clutching the ID and bank card, re-reading them', 'keying the password, deleting, re-keying', 'doodling on the queue ticket'],
    prop: ['a dog-eared passbook', 'a plastic bag of receipts', 'a worn bank card'],
    sound: ['the number-call broadcast', 'the clatter of the cash counter', 'the muffled thud through the glass partition'],
  },
  court: {
    keys: ['court', 'tribunal', 'trial', 'bench'],
    env: ['worn wooden benches in the gallery', 'the national emblem reflecting light above the bench', 'a humming AC vent'],
    action: ['flipping the complaint back and forth to find a page', 'clutching the pen, looking up at the judge', 'turning to signal the lawyer'],
    prop: ['a dog-eared case file', 'a summons stamped in red', 'a security-check sign at the entrance'],
    sound: ['the thud of the gavel', 'the hum of the AC', 'the clerk typing on a keyboard'],
  },
  temple: {
    keys: ['temple', 'monastery', 'shrine', 'incense'],
    env: ['a censer layered with ash', 'worn prayer cushions', 'a bronze bell hung at the eaves'],
    action: ['palms together, eyes closed, peeking at the neighbor', 'raising incense above the head and bowing three times', 'kneeling on the cushion, lips moving silently'],
    prop: ['a crumpled fortune slip', 'a charm tied with a red cord', 'coins in the donation box'],
    sound: ['the tap of the wooden fish', 'a distant bell', 'the low drone of chanting'],
  },
  oldhouse: {
    keys: ['old house', 'ancestral home', 'courtyard', 'village house'],
    env: ['a faded family portrait in the hall', 'an Eight Immortals table with chipped paint', 'a yellowed kitchen-god print above the stove'],
    action: ['fanning a palm-leaf fan very slowly', 'crouching by the well to draw water, pausing to catch breath', 'lifting the jar lid for pickled greens, putting it back'],
    prop: ['a chipped blue-and-white bowl', 'an enamel mug wired with iron', 'a dusty abacus on the wall'],
    sound: ['the strike of the grandfather clock', 'a distant dog bark', 'the creak of the well rope'],
  },
  alley: {
    keys: ['alley', 'lane', 'longtang', 'hutong', 'backstreet'],
    env: ['laundry poles dripping overhead', 'green brick wall blistering', 'a shikumen brass door-ring polished shiny'],
    action: ['sidling past a bicycle, head down', 'crouching by the door to prep vegetables, chatting with the neighbor', 'hauling the coal stove to the alley mouth to fan it'],
    prop: ['a chipped plastic basin', 'a wooden mail box with a padlock', 'an electric bill pasted on the wall'],
    sound: ['a bicycle bell', 'the clatter of bamboo poles fetching laundry upstairs', 'the scrap-collector’s call'],
  },
  highspeed: {
    keys: ['high-speed rail', 'train', 'cabin', 'aisle seat', 'carriage'],
    env: ['overhead bins crammed with suitcases', 'a tray table half-folded', 'fields flying past the window'],
    action: ['adjusting the seat upright, then reclining again', 'one hand on the chin watching the scenery, the other scrolling the phone', 'getting up to let someone pass, then sitting back down'],
    prop: ['a half-torn snack bag', 'a worn passport sleeve', 'a phone mount clipped to a power bank'],
    sound: ['the "ding-dong" at the car joint', 'the hum of the AC', 'a neighbor’s hushed phone call'],
  },
};
/** 为润色师生成场景细节注入指令（只注入相关场景，避免无关堆砌；v2.00 中英双语，默认中文逐字不变） */
export function lifeDetailDirective(sceneText: string, lang: 'zh' | 'en' = 'zh'): string {
  if (lang === 'en') {
    const text = sceneText.toLowerCase();
    const hit = Object.values(DETAIL_BANK_EN).find((b) => b.keys.some((k) => text.includes(k)));
    if (!hit) return 'Add 1-2 concrete environment/action/prop/sound details to heighten realism; every detail must serve plot or character—never pile them on.';
    return `This scene leans on a recurring setting; pick 1-2 of the most emotionally fitting real details below (do not stack them all): setting[${hit.env.join('; ')}]; small actions[${hit.action.join('; ')}]; props[${hit.prop.join('; ')}]; sound[${hit.sound.join('; ')}]. Every detail must earn its place.`;
  }
  const hit = Object.keys(DETAIL_BANK).find((k) => sceneText.includes(k));
  if (!hit) return '用1-2个具体的环境/动作/道具/音效细节增强真实感，细节必须服务剧情或人物，不许堆砌。';
  const d = DETAIL_BANK[hit];
  return `场景偏“${hit}”，从下列真实细节里挑1-2个最贴合情绪的用（不许全堆上）：环境[${d.env.join('；')}]；小动作[${d.action.join('；')}]；道具[${d.prop.join('；')}]；音效[${d.sound.join('；')}]。每个细节都要有用。`;
}
