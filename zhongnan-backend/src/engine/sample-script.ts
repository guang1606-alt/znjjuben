/**
 * 离线达标样例合成器
 * 作用：1) 未配置大模型时的兜底，新用户也能立刻看到一集成品；
 *       2) 知识/技能迭代的“黄金测试样例”（PRD 5.2 转化预校验）；
 * 硬约束：产出必须被 validateScript 判为合格——标准格式、字数达标、无提示词污染。
 * 注意：这是结构化样例，不是伪装成大模型创作；接入模型后由七岗管线接管，本模块退为兜底与回归基线。
 */
import { ScriptMode } from './script-format';

const LIVE_SCRIPT = `《离婚当天，我继承了亿万家产》 第1集

内景 老旧出租屋·夜
△ 灯管嗡嗡地闪，墙角皮泡起一块，窗台上搁着半碗没吃完的泡面，汤都凝住了。林晚蹲在地上，把男式衬衫一件件叠好往纸箱里塞，动作慢得像在数日子。
△ 结婚三年，她能从这个家带走的，就脚边这一个旧箱子。
△ 门“砰”地被踹开，陈凯搂着个染黄头发的女人进来，皮鞋踩着她刚拖干净的地，一路踩出黑印子。
陈凯（不耐烦）：还没滚蛋？就你这磨叽样，我妈当初真是瞎了眼才让你进门。
女人（掩嘴笑）：凯哥，这就是你养了三年的黄脸婆？啧，还挺能忍。
林晚（没抬头）：忍不忍的，过了今晚，都跟我没关系了。
女人（撇嘴）：哟，嘴还挺硬。凯哥你听听，她这是咒咱俩呢。
林晚（把最后一件衬衫抚平）：鞋柜上的钥匙留下，别的，你随便。
陈凯：哟，窝囊了三年，今天倒硬气上了？我把话搁这儿——出了这门，你林晚睡桥洞，都没人肯多看一眼。
△ 他从兜里甩出一张纸拍在桌上，纸角翘起来，是早就找律师拟好的离婚协议。
陈凯：签。房子我婚前买的，存款是我挣的，你净身出户，一分钱别想分。
△ 林晚拿起笔，盯着自己的名字看了半秒，一笔一划，签得很稳。
林晚（很轻）：陈凯，话别说太满。你，别后悔。
陈凯（笑出声）：后悔？我回头就得买挂鞭炮，从村口一路放到你娘家。
△ 她拖着箱子往门口走，路过那碗泡面停了一下，到底没收拾。

内景 老楼楼道·夜
△ 声控灯坏了一盏，她一级一级往下挪箱子，影子在台阶上被拉得老长。

外景 巷口·夜
△ 起风了，吹得小卖部的塑料帘子哗啦响。手机在兜里震，屏幕跳着两个字：管家。
△ 林晚盯着那两个字看了好几眼，掐掉，又响。她到底还是接了。
管家（电话音，发颤）：大小姐，老爷子……老爷子今早走了。律师团刚清点完遗产，您名下，三十七亿，外加三家公司。
△ 林晚站住，箱子轮子“咔”地卡进砖缝，她没去提。
林晚（沉默两秒）：……大爷，你打错了，我赶时间。
管家：没打错！您是林家失散二十年唯一的骨肉。车，已经到您楼下了，您回头看一眼。
△ 巷口两束远光慢慢压过来，一辆黑色迈巴赫静静停在风里，穿黑西装的男人下车，躬身拉开后门，手搭在门框上。
△ 陈凯本来举着手机追下楼，想拍她落魄的样子发朋友圈，一看见这车，举着的手僵在半空。
陈凯（结巴）：晚、晚晚，这、这车……是来接你的？
林晚（回头，笑了一下，眼眶有点红）：桥洞我就不去睡了。你回去，替我跟阿姨说声——那挂鞭炮，省着点放。
△ 她弯下腰，把攥了一路的家门钥匙轻轻搁进垃圾桶，没再回头。
△ 车门合上，隔开两个世界。陈凯脸上的笑一点点僵住，手机“啪”地掉在地上。（本集完）`;

// AIGC 制作版（v2.33 Z-AIGC 流畅制作本）：流畅自然段承载五维细节，自然括号承载内心/音效，
// 不出现【景别】【运镜】标签堆叠；景别/运镜由机器层 buildShotManifest 自动推断。
const AV_BLOCKS = [
  '镜头贴着她叠衬衫的手起，指尖把每一道折痕压得平平整整，再慢慢退成中景，扫过起泡的墙皮和那碗凝住的泡面。冷白灯管一闪一闪，半边脸埋在青色阴影里，她越平静，后面那口气憋得越足。（音效：灯管电流滋滋作响，纸箱蹭着水泥地，一下，又一下。）门“砰”地被踹开时画面跟着轻轻一晃，走廊暖光斜切进来，在地上拖出两道人影，皮鞋声由远及近。黄发女人往门框上一靠，眼神慢慢扫过整间屋子，像在清点战利品，嘴角那点笑全是施舍。',
  '昏黄的声控灯一明一灭，台阶上的阴影一格一格压下来，她一级一级往下挪箱子，影子被拉得老长。镜头跟在她身后慢慢后退，最后停在拐角，空楼道里多留半拍，远处一声狗吠，把她的孤衬得扎扎实实。（音效：行李箱轮子磕在台阶上的钝响，声控灯啪地亮起又熄灭。）她没哭，也没摔门，只在下一级台阶前轻轻吸了口气，指尖在拉杆上收紧又松开。林晚（很轻，像对自己说）：走慢点，别回头，过了今晚谁也别想再踩我一脚。',
  '先用远景定场，巷口两束远光慢慢压过来，车灯逆光给人影勾出一圈毛边，深夜的冷蓝里，迈巴赫的暖黄车灯划出另一个世界。风掀起小卖部的塑料帘子，镜头缓缓横移，最后停在车门合上的一瞬。西装男人躬身等着，手搭在门框上，礼数越周全，对比越扎心。（音效：塑料帘哗啦、手机震动、引擎低鸣、车门沉闷合拢。）她把钥匙搁进垃圾桶时给了指尖一个近景，金属碰撞声清脆，像这一集的句点；陈凯举着的手缓缓垂下，手机啪地落地，黑屏，钩子吊在下一集。',
];

// AIGC 英文制作版（Z-AIGC flowing production script）：与中文版同故事同标准——
// 流畅自然段承载五维、(SFX:/MUSIC:) 承载声音、台词独立行、无任何技术标签；720-900 英文词（汉字当量 1200-1500）。
const AIGC_SCRIPT_EN = `EP1 The Divorce Day Inheritance

INT. CRAMPED RENTAL ROOM - NIGHT
The cold-white ceiling lamp buzzes and flickers, throwing half her face into blue-grey shadow; the wall paint bubbles at one corner, and a half bowl of cold noodles sits on the windowsill, the soup already skinned over. Lin Wan crouches on the floor, folding a man's shirts one by one into a cardboard box, pressing every crease flat with her fingertips, her stare quiet, her lips pressed into a tight line, her movements slow as if counting off days. (SFX: electric hum from the lamp, the box scraping the concrete floor, once, then again.) The door slams open and warm hallway light cuts across the floor; two shadows stretch long. Chen Kai steps in with a yellow-haired woman on his arm, his leather shoes marking the tiles she just mopped, and she leans against the doorframe, her eyes sweeping the room, smiling like someone counting winnings.
Chen Kai (irritated): Still not gone? With your dragging pace, my mother must have been blind to let you marry into this family.
Lily (giggling): Kai, is this the worn-out wife you fed for three years? My, she really can endure.
Lin Wan (not raising her eyes): Endure or not, after tonight none of it has anything to do with me.
Chen Kai: Sign it. The house was mine before marriage, the savings were mine, you walk out clean.
She picks up the pen, pauses on her own name for half a second, and signs with a steady hand, her face calm and pale.

INT. STAIRWELL OF THE OLD BUILDING - NIGHT
The sound-activated lamp is half dead, bright and dim by turns, as grid after grid of shadow presses down the stairs. She bumps the suitcase down step by step, her shadow pulled long on the stone; the corridor behind her is empty and cold. She does not cry, she does not slam the door; before the next step she breathes in softly, her fingers tightening on the handle, then loosening again. (SFX: suitcase wheels knocking against the steps, the lamp clicking on and dying, a dog barking far away.) At the corner she glances back once at the shut door, swallows the sigh rising in her throat, and turns into the wind coming up the stairwell.
Lin Wan (very quietly, to herself): Walk slowly. Do not look back. After tonight, nobody gets to step on me again.

EXT. ALLEY MOUTH - NIGHT
The wind rises and flips the plastic curtain of the corner shop with a clatter; the street is dark blue and empty under the dim neon sign, cold air carrying fried-oil smell from the kitchen vent. The phone vibrates in her pocket and the screen shows one word: Butler. She stares at it, cancels the call, and it rings again, until at last she grips it and answers. Two beams of light drift slowly in at the alley mouth, backlighting her against the deep-blue night, and a black sedan glides up and rests inside a pool of warm yellow from a streetlamp. A man in a dark suit steps out, bows, and pulls the rear door open, one hand resting on the frame. (SFX: the plastic curtain snapping, a phone buzzing, a low engine purr, the heavy dull thud of a car door.)
Butler (V.O., trembling): Young mistress, the old master passed away this morning. The lawyers have finished the inventory: under your name, thirty-seven hundred million, plus three companies.
Lin Wan (silent for two seconds): Sir, you have the wrong number. I am in a hurry.
Butler: No mistake. You are the Lin family's only blood child, lost for twenty years. The car is already downstairs. Turn around and look.

EXT. ALLEY MOUTH - CONTINUOUS
Chen Kai had chased downstairs with his phone raised, meaning to film her disgrace for his feed; at the sight of the sedan his lifted arm freezes in mid-air, his grin stiffening, his jaw hanging loose. Lin Wan bends down and lays the house key she has gripped all night into the trash bin, the metal giving one small clear clink; then she straightens and gives him one backward glance, her eyes red-rimmed, a faint wobbly smile on her lips. Behind him the yellow-haired woman stops laughing and bites her lip. The car door closes between the two worlds like a lid shutting, and Chen Kai's face drains pale behind the dark glass; his phone slips from his fingers and cracks on the ground. (MUSIC: a single low cello note rising slowly. SFX: the phone clattering on stone, the sedan pulling away into the rain-wet street.)
Lin Wan (turning back, smiling faintly): I will not be sleeping under the bridge after all. Tell your mother to save that string of firecrackers.`;

export function buildSampleScript(mode: ScriptMode = 'LIVE', lang: 'zh' | 'en' = 'zh'): string {
  if (lang === 'en') {
    // 英文沙盘：LIVE 用管线内置 SANDBOX_DRAFT_EN（pipeline 维护），AIGC 用本流畅样例
    if (mode === 'AIGC') return AIGC_SCRIPT_EN;
    return AIGC_SCRIPT_EN; // 兜底（调用方对 LIVE 有专用稿时优先用专用稿）
  }
  if (mode === 'LIVE') return LIVE_SCRIPT;
  let idx = 0;
  return LIVE_SCRIPT.split('\n').map((line) => {
    // AIGC 流畅本：去掉 △ 动作标记，改为自然段；每场场标后注入一段五维丰满的流畅叙述
    const clean = line.replace(/^△\s*/, '');
    if (/^(内景|外景)\s/.test(line) && idx < AV_BLOCKS.length) {
      return `${clean}\n${AV_BLOCKS[idx++]}`;
    }
    return clean;
  }).join('\n');
}
