#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# auto-pipeline.sh — 剧本工具项目的"自动能力适配管道"
# 每次任务开始时跑一次：route → auto-load → 缺口 discover → check → install → refresh
#
# 用法: ./scripts/auto-pipeline.sh "<任务摘要>" [--max-load 3] [--auto-install]
#   --max-load N      最多自动加载前 N 个技能（默认 3，防止一次加载太多）
#   --auto-install    发现缺口时自动 discover + check + install（默认只提示，等 Agent 决策）
#
# 输出: JSON 到 stdout（供 Agent 直接消费）
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

REGISTRY="$HOME/.trae-cn/capability-registry"
QUERY="${1:-}"
MAX_LOAD="${MAX_LOAD:-3}"
AUTO_INSTALL="${AUTO_INSTALL:-false}"
shift || true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --max-load) MAX_LOAD="$2"; shift 2 ;;
    --auto-install) AUTO_INSTALL=true; shift ;;
    *) shift ;;
  esac
done

if [[ -z "$QUERY" ]]; then
  echo '{"error": "missing task summary argument"}' >&2
  exit 1
fi

echo "## auto-pipeline: $QUERY" >&2

# ── 1. 路由 ──────────────────────────────────────────────────────────
ROUTE_JSON=$(node "$REGISTRY/route.mjs" "$QUERY" --json --top 15 2>/dev/null || echo '{"categories":[],"skills":[],"plugins":[],"mcps":[]}')

# 安全解析（兜底非法 JSON）
ROUTE_JSON=$(echo "$ROUTE_JSON" | node -e "
  let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{
    try { console.log(JSON.stringify(JSON.parse(d))); }
    catch { console.log(JSON.stringify({categories:[],skills:[],plugins:[],mcps:[]})); }
  });
" 2>/dev/null)

# 提取前 MAX_LOAD 个候选技能名（route JSON: skills 是对象数组，字段是 id/type/path）
LOAD_LIST=$(echo "$ROUTE_JSON" | node -e "
  let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{
    try {
      const j=JSON.parse(d);
      const names=[];
      (j.skills||[]).slice(0,${MAX_LOAD}).forEach(s=>{if(s&&s.id)names.push(s.id);});
      console.log(JSON.stringify(names));
    } catch { console.log('[]'); }
  });
")

# ── 2. 缺口检测 ──────────────────────────────────────────────────────
# 取第一个分类的命中词（hits）或分类名里的关键词
CATEGORY_KEYS=$(echo "$ROUTE_JSON" | node -e "
  let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{
    try {
      const j=JSON.parse(d);
      const cat=(j.categories||[])[0];
      const keys=[];
      if(cat){
        (cat.hits||[]).slice(0,3).forEach(h=>keys.push(h));
        // 从 skills 字段名里挑前两个
        (cat.skills||[]).slice(0,2).forEach(s=>keys.push(s));
      }
      console.log(keys.join(','));
    } catch { console.log(''); }
  });
")

DISCOVER_JSON="[]"
if [[ -n "$CATEGORY_KEYS" ]]; then
  FIRST_KEY=$(echo "$CATEGORY_KEYS" | cut -d',' -f1)
  echo "## discover: $FIRST_KEY" >&2
  DISCOVER_RAW=$(node "$REGISTRY/discover.mjs" "$FIRST_KEY" --json 2>/dev/null || true)
  if [[ -n "$DISCOVER_RAW" ]]; then
    DISCOVER_JSON=$(echo "$DISCOVER_RAW" | node -e "
      let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{
        const lines=d.trim().split('\n').filter(l=>l.trim());
        const arr=[];lines.forEach(l=>{try{arr.push(JSON.parse(l));}catch{}});
        console.log(JSON.stringify(arr));
      });
    ")
  fi
fi

# ── 3. 自动安装（可选） ─────────────────────────────────────────────
INSTALLED_JSON="[]"
if [[ "$AUTO_INSTALL" == "true" && "$DISCOVER_JSON" != "[]" ]]; then
  # 取候选：优先 pack === "skill" 的（discover 已核验根目录有 SKILL.md/skills/），
  # 都没有才退回首候选 —— 原实现无脑取 arr[0]，no-skill 候选白占 check 配额
  FIRST_CANDIDATE=$(echo "$DISCOVER_JSON" | node -e "
    let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{
      try {
        const arr=JSON.parse(d);
        const skill=arr.find(x=>x&&x.pack==='skill');
        const pick=skill||arr[0];
        if(pick) console.log(pick.repo || '');
        else console.log('');
      } catch { console.log(''); }
    });
  ")
  if [[ -n "$FIRST_CANDIDATE" ]]; then
    echo "## check+install: $FIRST_CANDIDATE" >&2
    CHECK_OUT=$(node "$REGISTRY/check-repo.mjs" "$FIRST_CANDIDATE" 2>&1 || true)
    CONCLUSION=$(echo "$CHECK_OUT" | grep -oE '结论[：:][^ ]+' | cut -d'：' -f2 | cut -d':' -f1 || echo "fail")
    if [[ "$CONCLUSION" == "pass" || "$CONCLUSION" == "warn" ]]; then
      node "$REGISTRY/check-repo.mjs" "$FIRST_CANDIDATE" --install >&2 2>&1 || true
      node "$REGISTRY/build-index.mjs" --stats >&2 2>&1 || true
      INSTALLED_JSON=$(echo "[$(printf '%s' "$FIRST_CANDIDATE" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const repo=(''+d).trim();console.log(JSON.stringify({repo,conclusion:'$CONCLUSION'}));});")]")
    else
      echo "## check skipped (conclusion=$CONCLUSION)" >&2
    fi
  fi
fi

# ── 4. 最终输出 ─────────────────────────────────────────────────────
FINAL=$(echo "$ROUTE_JSON" | node -e "
  let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{
    try {
      const route=JSON.parse(d);
      const loadNames=($LOAD_LIST);
      const discover=$DISCOVER_JSON;
      const installed=$INSTALLED_JSON;
      const result={
        task: process.argv[1],
        generatedAt: new Date().toISOString(),
        topCategory: (route.categories||[])[0]?.title || '',
        loadNow: loadNames,
        skills: (route.skills||[]).slice(0, ${MAX_LOAD}).map(s=>({id:s.id,score:s.score,path:s.path||'',description:s.description||''})),
        plugins: (route.plugins||[]).slice(0,5).map(p=>({id:p.id,score:p.score,description:p.description||''})),
        discoverCandidates: discover,
        autoInstalled: installed,
        advice: loadNames.length>0
          ? ('\u6309 loadNow \u7528 Skill \u5de5\u5177\u52a0\u8f7d\u524d\u51e0\u4e2a\u3002\u53d1\u73b0 discoverCandidates \u53ef\u7528 check-repo.mjs \u68c0\u67e5\u3002')
          : '\u65e0\u547d\u4e2d\uff0c\u76f4\u63a5\u5f00\u59cb\u4efb\u52a1'
      };
      console.log(JSON.stringify(result, null, 2));
    } catch(e) { console.log(JSON.stringify({error:e.message})); }
  });
" "$QUERY")

echo "$FINAL"
