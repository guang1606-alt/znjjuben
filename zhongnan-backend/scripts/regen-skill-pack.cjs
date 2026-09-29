// 一次性重生成内置创作技能包（双 root 活副本 + zip 由系统 zip 另打）
const fs = require('fs');
const path = require('path');
const SP = require('../dist/engine/skill-pack.js');
const V = require('../package.json').version;

const pack = SP.buildBuiltinSkillPack(V);
const audit = SP.auditSkillPack(pack);
if (!audit.ok) { console.error('AUDIT FAIL', audit.problems); process.exit(1); }
const bundle = SP.buildSkillBundle(pack);
const roots = [
  path.resolve(__dirname, '../../.user_skills/zhongnan-shortdrama-craft'),
  path.resolve(__dirname, '../../zhongnan-shortdrama-craft'),
];
for (const root of roots) {
  fs.rmSync(root, { recursive: true, force: true });
  for (const [rel, content] of Object.entries(bundle)) {
    const fp = path.join(root, rel);
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, content);
  }
  console.log('written', root);
}
console.log('version', V, 'files', Object.keys(bundle).length);
