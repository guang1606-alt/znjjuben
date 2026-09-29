const { describe, it } = require('node:test');
const assert = require('node:assert');
const K = require('../dist/engine/knowledge-directive.js');

describe('buildKnowledgeDirective 知识库指令构建', () => {
  it('空输入返回空串', () => {
    assert.strictEqual(K.buildKnowledgeDirective(null, 'zh'), '');
    assert.strictEqual(K.buildKnowledgeDirective([], 'zh'), '');
    assert.strictEqual(K.buildKnowledgeDirective(undefined, 'zh'), '');
  });

  it('正常知识条目产出带分类标签的指令串', () => {
    const hints = [
      { title: '集尾信息差', content: '在观众比角色多知道一条关键信息的瞬间切断，制造追更', category: 'plot' },
      { title: '口语化处理', content: '台词要更口语，避免书面语', category: 'dialogue' },
    ];
    const dir = K.buildKnowledgeDirective(hints, 'zh');
    assert.ok(dir.includes('知识库创作指引'));
    assert.ok(dir.includes('剧情'));
    assert.ok(dir.includes('台词'));
    assert.ok(dir.includes('集尾信息差'));
    assert.ok(dir.includes('口语化处理'));
  });

  it('合规类知识标注必须遵守前缀', () => {
    const hints = [
      { title: '平台尺度新规', content: '平台审核规则更新，涉及尺度要求', category: 'compliance' },
    ];
    const dir = K.buildKnowledgeDirective(hints, 'zh');
    assert.ok(dir.includes('必须遵守'));
    assert.ok(dir.includes('合规'));
  });

  it('英文链路零中文', () => {
    const hints = [
      { title: 'Hook technique', content: 'A proven cliffhanger method', category: 'plot' },
    ];
    const dir = K.buildKnowledgeDirective(hints, 'en');
    assert.ok(dir.includes('Knowledge-base'));
    assert.ok(dir.includes('Plot'));
    // 不应包含中文标签
    assert.ok(!dir.includes('剧情'));
    assert.ok(!dir.includes('知识库创作指引'));
  });

  it('单条截断300字防止提示词膨胀', () => {
    const longContent = 'A'.repeat(500);
    const hints = [{ title: 'Long', content: longContent, category: 'plot' }];
    const dir = K.buildKnowledgeDirective(hints, 'en');
    // 截断后不应包含完整的500个A
    assert.ok(!dir.includes('A'.repeat(500)));
    assert.ok(dir.includes('A'.repeat(100))); // 至少包含部分内容
  });
});

describe('rankByRelevance 相关性排序', () => {
  it('按关键词命中数排序', () => {
    const hints = [
      { title: '无关内容', content: 'something completely unrelated', category: 'plot' },
      { title: '都市逆袭', content: '被家族抛弃的私生子凭商业天赋夺回一切', category: 'plot' },
    ];
    const ranked = K.rankByRelevance(hints, '都市逆袭 私生子 商业');
    assert.strictEqual(ranked.length, 1);
    assert.strictEqual(ranked[0].title, '都市逆袭');
  });

  it('合规类知识加10分权重', () => {
    const hints = [
      { title: '普通技巧', content: '都市逆袭叙事节奏', category: 'plot' },
      { title: '合规规则', content: '平台审核规则', category: 'compliance' },
    ];
    const ranked = K.rankByRelevance(hints, '平台审核');
    assert.strictEqual(ranked[0].title, '合规规则');
  });

  it('最多返回8条', () => {
    const hints = Array.from({ length: 15 }, (_, i) => ({
      title: `技巧${i}`, content: `都市逆袭内容${i}`, category: 'plot',
    }));
    const ranked = K.rankByRelevance(hints, '都市逆袭');
    assert.ok(ranked.length <= 8);
  });
});
