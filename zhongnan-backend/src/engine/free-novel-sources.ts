/**
 * 合法免费小说素材来源库（服务 3.4 小说改编模式）
 * 合规底线：只收录三类干净来源，绝不做盗版导航。
 *  - public_domain 公版书：版权已过期，可自由下载、改编、商用
 *  - cc            作者授权（CC/平台作者自愿免费）：可读、可改编但须遵守其授权协议（多为署名/非商用）
 *  - platform_free 平台正版免费区：正版免费阅读，但“可阅读”不等于“可改编”，改编/商用须另行取得授权
 * 每条带来源语言、下载格式、改编权限说明；内置结构自检与盗版域名黑名单。
 */

export type License = 'public_domain' | 'cc' | 'platform_free';
export interface NovelSource {
  id: string;
  name: string;
  url: string;
  langs: string[];
  formats: string[];
  license: License;
  desc: string;
  adapt: boolean;          // 是否可直接用于改编
  adaptNote: string;
}

export const NOVEL_SOURCES: NovelSource[] = [
  { id: 'gutenberg', name: 'Project Gutenberg 古登堡计划', url: 'https://www.gutenberg.org', langs: ['multi', 'en', 'zh', 'fr', 'de', 'es'], formats: ['EPUB', 'MOBI', 'TXT', 'HTML'], license: 'public_domain', desc: '全球最大公版书库，7.5万+本，多语言经典，无DRM免费下载', adapt: true, adaptNote: '公版，可自由改编与商用' },
  { id: 'standard-ebooks', name: 'Standard Ebooks', url: 'https://standardebooks.org', langs: ['en'], formats: ['EPUB'], license: 'public_domain', desc: '精校精排的公版经典，排版质量高', adapt: true, adaptNote: '公版，可自由改编与商用' },
  { id: 'internet-archive', name: 'Internet Archive 互联网档案馆', url: 'https://archive.org/details/texts', langs: ['multi', 'en', 'zh'], formats: ['EPUB', 'PDF', 'TXT'], license: 'public_domain', desc: '海量公版图书与历史文献，部分需注册借阅', adapt: true, adaptNote: '下载公版标记作品可自由改编；借阅区受版权保护不可改编' },
  { id: 'open-library', name: 'Open Library 开放图书馆', url: 'https://openlibrary.org', langs: ['multi', 'en'], formats: ['EPUB', 'PDF'], license: 'public_domain', desc: '互联网档案馆旗下，公版可下载、在版权书可数字借阅', adapt: true, adaptNote: '仅公版可读/可改编，借阅书不可改编' },
  { id: 'manybooks', name: 'ManyBooks', url: 'https://manybooks.net', langs: ['en', 'multi'], formats: ['EPUB', 'MOBI', 'PDF'], license: 'public_domain', desc: '5万+公版与独立作者免费书，分类清晰、可按语言筛选', adapt: true, adaptNote: '公版可自由改编；独立作者免费书需看其单独授权' },
  { id: 'feedbooks-pd', name: 'Feedbooks 公版区', url: 'https://www.feedbooks.com/publicdomain', langs: ['en', 'fr', 'multi'], formats: ['EPUB', 'MOBI'], license: 'public_domain', desc: '公版（Public Domain）专区，多语言经典', adapt: true, adaptNote: '公版，可自由改编与商用' },
  { id: 'wikisource-zh', name: '维基文库 Wikisource（中文）', url: 'https://zh.wikisource.org', langs: ['zh', 'multi'], formats: ['HTML', 'TXT'], license: 'public_domain', desc: '多语言公版文献/古典小说全文，含四大名著等中文公版', adapt: true, adaptNote: '公版文本，可自由改编与商用' },
  { id: 'haodoo', name: '好读 Haodoo', url: 'https://haodoo.net', langs: ['zh'], formats: ['EPUB', 'TXT', 'HTML'], license: 'public_domain', desc: '繁体中文公版小说库，古典与近现代公版作品', adapt: true, adaptNote: '公版，可自由改编与商用' },
  { id: 'aozora', name: '青空文库 Aozora Bunko', url: 'https://www.aozora.gr.jp', langs: ['ja'], formats: ['TXT', 'HTML', 'EPUB'], license: 'public_domain', desc: '日本公版文学权威库，日文经典齐全', adapt: true, adaptNote: '日本著作权过期作品，可自由改编（商用前再核日本版权期）' },
  { id: 'ao3', name: 'Archive of Our Own (AO3)', url: 'https://archiveofourown.org', langs: ['multi', 'en', 'zh'], formats: ['HTML', 'EPUB', 'PDF'], license: 'cc', desc: '作者自愿发布、多为CC授权的原创/同人，多语言', adapt: false, adaptNote: '需逐篇看作者CC协议，多数要求署名且禁商用，改编前必须核对' },
  { id: 'royalroad', name: 'Royal Road', url: 'https://www.royalroad.com', langs: ['en'], formats: ['HTML', 'EPUB'], license: 'cc', desc: '英文网文/奇幻连载平台，作者授权免费阅读', adapt: false, adaptNote: '版权归作者，免费阅读≠可改编，改编须联系作者授权' },
  { id: 'wattpad', name: 'Wattpad', url: 'https://www.wattpad.com', langs: ['multi', 'en', 'zh'], formats: ['HTML', 'APP'], license: 'cc', desc: '全球作者原创免费连载社区，多语言', adapt: false, adaptNote: '版权归作者，改编/商用须取得作者或平台授权' },
  { id: 'douban-free', name: '豆瓣阅读·免费专区', url: 'https://read.douban.com/free', langs: ['zh'], formats: ['EPUB', 'HTML', 'APP'], license: 'platform_free', desc: '正版中文原创免费小说/短篇专区', adapt: false, adaptNote: '正版免费仅限阅读，改编/商用必须另行取得作者或平台授权' },
  { id: 'weread', name: '微信读书（公版书/免费无限卡）', url: 'https://weread.qq.com', langs: ['zh'], formats: ['APP', 'EPUB'], license: 'platform_free', desc: '正版公版书与无限卡免费出版物，中文排版佳', adapt: false, adaptNote: '公版古典可改编；在版权出版物仅授权阅读，严禁改编转载' },
  { id: 'wikisource-en', name: 'Wikisource 维基文库（English）', url: 'https://en.wikisource.org', langs: ['en', 'multi'], formats: ['HTML', 'TXT'], license: 'public_domain', desc: '英文公版原著全文，小说改编可直接引用公版文本', adapt: true, adaptNote: '公版文本，可自由改编与商用' },
  { id: 'wikisource-ko', name: '위키문헌 维基文库（韩国语）', url: 'https://ko.wikisource.org', langs: ['ko', 'multi'], formats: ['HTML', 'TXT'], license: 'public_domain', desc: '韩国语公版古典与近代文学全文', adapt: true, adaptNote: '韩国著作权过期（一般作者逝后70年）作品可自由改编，商用前再核韩国版权期' },
  { id: 'cervantesvirtual', name: 'Biblioteca Virtual Miguel de Cervantes 塞万提斯虚拟图书馆', url: 'https://www.cervantesvirtual.com', langs: ['es', 'multi'], formats: ['PDF', 'HTML'], license: 'public_domain', desc: '西语世界最大公版/开放数字图书馆，西班牙语经典齐全', adapt: true, adaptNote: '公版西语经典可自由改编与商用，开放授权篇目以页面标注为准' },
  { id: 'zeno', name: 'Zeno.org 德文公版文库', url: 'https://www.zeno.org', langs: ['de', 'multi'], formats: ['HTML', 'TXT'], license: 'public_domain', desc: '德语公版文学/哲学全文库，德国经典小说素材丰富', adapt: true, adaptNote: '公版德语文本，可自由改编与商用' },
  { id: 'liberliber', name: 'Liber Liber 意大利自由文库', url: 'https://www.liberliber.it', langs: ['it', 'multi'], formats: ['EPUB', 'PDF', 'HTML'], license: 'public_domain', desc: '意大利公版文学计划，意语经典可下载 EPUB/PDF', adapt: true, adaptNote: '公版意语经典可自由改编与商用' },
  // —— v2.42 扩充：更多语种（法/俄/葡/阿）与中文/英文/日文/韩文干净来源，共 30 个 ——
  { id: 'gallica', name: 'Gallica 法国国家数字图书馆（BnF）', url: 'https://gallica.bnf.fr', langs: ['fr', 'multi'], formats: ['EPUB', 'PDF', 'TXT', 'HTML'], license: 'public_domain', desc: '法国国家图书馆公版书库，法语经典小说海量、可整本下载', adapt: true, adaptNote: '公版法语作品可自由改编与商用，在版权书仅在线阅览' },
  { id: 'hathitrust', name: 'HathiTrust Digital Library', url: 'https://www.hathitrust.org/digital_library', langs: ['en', 'multi'], formats: ['PDF', 'TXT'], license: 'public_domain', desc: '北美大学联盟数字图书馆，公版卷册可全文下载，多语种老书丰富', adapt: true, adaptNote: '仅标记 Public Domain 的卷册可下载改编，in-copyright 仅可检索' },
  { id: 'authorama', name: 'Authorama 公版英文书库', url: 'https://www.authorama.com', langs: ['en'], formats: ['HTML', 'TXT'], license: 'public_domain', desc: '完全免费的英文公版小说全集，页面干净、可直接复制文本', adapt: true, adaptNote: '公版，可自由改编与商用' },
  { id: 'feb-web', name: 'ФЭБ 俄罗斯基础文学文库（普希金之家）', url: 'https://feb-web.ru', langs: ['ru'], formats: ['HTML', 'TXT'], license: 'public_domain', desc: '俄科学院俄罗斯文学研究所主办，普希金/托尔斯泰/陀思妥耶夫斯基等俄文公版全文', adapt: true, adaptNote: '俄罗斯著作权过期作品可自由改编，商用前再核俄联邦版权期（一般作者逝后70年）' },
  { id: 'dominiopublico', name: 'Domínio Público 巴西政府公版文库', url: 'https://www.dominiopublico.gov.br', langs: ['pt', 'multi'], formats: ['PDF', 'TXT'], license: 'public_domain', desc: '巴西教育部官方公版计划，葡语文学/经典文本免费下载', adapt: true, adaptNote: '政府标注公版篇目可自由改编与商用' },
  { id: 'wikisource-ar', name: 'Wikisource 维基文库（العربية）', url: 'https://ar.wikisource.org', langs: ['ar', 'multi'], formats: ['HTML', 'TXT'], license: 'public_domain', desc: '阿拉伯语公版文学与古典故事全文，RTL 文本，适合中东题材取材', adapt: true, adaptNote: '公版阿语文本可自由改编与商用，注意尊重宗教与文化禁忌' },
  { id: 'ndl-dl', name: '国立国会图书馆数字馆藏（日本 NDL）', url: 'https://dl.ndl.go.jp', langs: ['ja'], formats: ['PDF', 'HTML'], license: 'public_domain', desc: '日本国立国会图书馆数字化古典/近代文献，公版书籍可整本阅览下载', adapt: true, adaptNote: '著作权过期资料可自由改编；登录用户下载范围更大' },
  { id: 'gongu', name: '공유마당 韩国著作权委员会共享广场', url: 'https://gongu.copyright.or.kr', langs: ['ko'], formats: ['PDF', 'TXT'], license: 'cc', desc: '韩国官方著作权共享平台，含作者授权免费文学作品', adapt: false, adaptNote: '逐篇看授权标注：公版可自由改编；共享许可作品须按其协议（多需署名/非商用）' },
  { id: 'ctext', name: '中国哲学书电子化计划 ctext.org', url: 'https://ctext.org/zhs', langs: ['zh'], formats: ['HTML', 'TXT'], license: 'public_domain', desc: '全球最大中文古典文献库之一，先秦至明清文本齐全，适合古装/权谋/志怪取材', adapt: true, adaptNote: '中国古典公版文本可自由改编与商用' },
  { id: 'shuge', name: '书格 shuge.org 古籍数字图书馆', url: 'https://new.shuge.org', langs: ['zh'], formats: ['PDF'], license: 'public_domain', desc: '公益中文古籍善本扫描库，版画/刻本视觉参考与公版故事文本', adapt: true, adaptNote: '公版古籍内容可自由改编；善本扫描图版的再使用以站点声明为准' },
  { id: 'bne-bdh', name: 'Biblioteca Digital Hispánica 西班牙国家图书馆数字馆藏', url: 'https://bdh.bne.es', langs: ['es', 'multi'], formats: ['PDF', 'HTML'], license: 'public_domain', desc: '西班牙国家图书馆公版数字化馆藏，西语古典小说与手稿可在线阅览下载', adapt: true, adaptNote: '公版（dominio público）篇目可自由改编与商用，在版权文献仅可阅览' },
];

// 已知盗版/侵权高风险域名黑名单，永远不得收录
export const PIRACY_BLACKLIST = ['z-lib', 'zlibrary', 'libgen', '123freebook', 'pdfdrive', 'annas-archive', 'anna.s', 'bqg', 'biquge', 'shuquge'];

export function listSources(): NovelSource[] { return NOVEL_SOURCES; }
export function filterByLang(lang: string): NovelSource[] {
  return NOVEL_SOURCES.filter((s) => s.langs.includes(lang) || s.langs.includes('multi'));
}
export function adaptableSources(): NovelSource[] {
  return NOVEL_SOURCES.filter((s) => s.license === 'public_domain');
}

export interface Validation { ok: boolean; count: number; languages: string[]; errors: string[] }

export function validateSources(): Validation {
  const errors: string[] = [];
  const ids = new Set<string>();
  const urls = new Set<string>();
  for (const s of NOVEL_SOURCES) {
    if (ids.has(s.id)) errors.push(`id重复:${s.id}`);
    ids.add(s.id);
    if (urls.has(s.url)) errors.push(`url重复:${s.url}`);
    urls.add(s.url);
    if (!/^https:\/\//.test(s.url)) errors.push(`${s.id} 非https`);
    if (!s.langs.length) errors.push(`${s.id} 缺语言标注`);
    if (!s.formats.length) errors.push(`${s.id} 缺格式标注`);
    if (!s.adaptNote) errors.push(`${s.id} 缺改编权限说明`);
    if (s.license === 'public_domain' && !s.adapt) errors.push(`${s.id} 公版应允许改编`);
    if (s.license === 'platform_free' && s.adapt) errors.push(`${s.id} 平台免费区不得默认可改编`);
    const low = s.url.toLowerCase();
    if (PIRACY_BLACKLIST.some((b) => low.includes(b))) errors.push(`${s.id} 命中盗版黑名单`);
  }
  const languages = Array.from(new Set(NOVEL_SOURCES.flatMap((s) => s.langs))).filter((l) => l !== 'multi');
  return { ok: errors.length === 0, count: NOVEL_SOURCES.length, languages, errors };
}
