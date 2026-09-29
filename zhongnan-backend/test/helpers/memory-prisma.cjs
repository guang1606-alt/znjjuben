/**
 * 内存 Prisma 桩：实现 HTTP 层测试所需的模型面，语义对齐 Prisma（findUnique/findFirst/count/create/update/$transaction）。
 * 不依赖真实数据库；withBillingTransaction 走 $transaction，桩的 tx 上带 pointsAccount/ledgerEntry/$queryRaw。
 */
let seq = 0;
function createMemoryPrisma() {
  const users = new Map();      // id -> user
  const byPhone = new Map();
  const byInvite = new Map();
  const accounts = new Map();   // userId -> account
  const projects = new Map();   // id -> project
  const invitations = [];
  const ledgers = [];
  const scripts = [];
  const tasks = new Map();
  const callLogs = [];

  const pointsAccount = {
    async findUnique({ where }) { return accounts.get(where.userId) ?? null; },
    async create({ data }) { const a = { balance: 0, frozen: 0, bonusGranted: 0, ...data }; accounts.set(data.userId, a); return a; },
    async update({ where, data }) {
      const a = accounts.get(where.userId) ?? { balance: 0, frozen: 0, bonusGranted: 0 };
      Object.keys(data).forEach((k) => { if (data[k] !== undefined) a[k] = data[k]; });
      accounts.set(where.userId, a); return a;
    },
  };
  const ledgerEntry = {
    async findUnique({ where }) { return ledgers.find((l) => l.idempotencyKey === where.idempotencyKey) ?? null; },
    // c201：支持 orderBy:{id:'desc'} 与 take（积分流水明细接口需要），其他用法保持原行为
    async findMany({ where = {}, orderBy, take } = {}) {
      let rows = ledgers.filter((l) => Object.entries(where).every(([k, v]) => l[k] === v));
      if (orderBy && orderBy.id === 'desc') rows = rows.slice().sort((a, b) => ((b.id > a.id) ? 1 : (b.id < a.id) ? -1 : 0));
      if (take) rows = rows.slice(0, take);
      return rows;
    },
    async create({ data }) { const row = { id: ++seq, ...data }; ledgers.push(row); return row; },
  };
  const user = {
    async findUnique({ where }) {
      if (where.phone) return byPhone.get(where.phone) ?? null;
      if (where.inviteCode) return byInvite.get(where.inviteCode) ?? null;
      if (where.id) return users.get(where.id) ?? null;
      return null;
    },
    async create({ data }) {
      const id = data.id || `u_${++seq}`;
      const u = { id, level: 'FREE', banned: false, ...data };
      users.set(id, u); byPhone.set(u.phone, u); byInvite.set(u.inviteCode, u);
      accounts.set(id, { userId: id, balance: 0, frozen: 0, bonusGranted: 0 });
      return u;
    },
    async update({ where, data }) { const u = users.get(where.id); if (!u) throw new Error('USER_NOT_FOUND'); Object.assign(u, data); return u; },
    async findFirst({ where = {} } = {}) { for (const u of users.values()) { if (where.id && u.id !== where.id) continue; return u; } return null; },
    async findMany() { return [...users.values()]; }, // 后台用户列表：全量，过滤/分页在路由层
  };
  const storageObjects = [];
  const storageObject = {
    async create({ data }) { const row = { id: `so_${++seq}`, deletedAt: null, ...data }; storageObjects.push(row); return row; },
    async aggregate({ where = {}, _sum } = {}) {
      const r = storageObjects.filter((o) => (!where.userId || o.userId === where.userId) && (where.deletedAt === undefined || o.deletedAt === where.deletedAt));
      const out = {}; for (const k of Object.keys(_sum || {})) out[k] = r.reduce((a, o) => a + (o[k] || 0), 0);
      return { _sum: out };
    },
  };
  const invitation = { async create({ data }) { const row = { id: ++seq, ...data }; invitations.push(row); return row; } };
  const project = {
    async findFirst({ where }) {
      for (const p of projects.values()) if ((!where.id || p.id === where.id) && (!where.userId || p.userId === where.userId)) return p;
      return null;
    },
    async create({ data }) {
      const id = data.id || `p_${++seq}`;
      const p = { id, bible: null, ...data, createdAt: data.createdAt ?? new Date() };
      projects.set(id, p); return p;
    },
    async update({ where, data }) { const p = projects.get(where.id); Object.assign(p, data); return p; },
    async findMany({ where = {}, orderBy, take } = {}) {
      let r = [...projects.values()].filter((p) => !where.userId || p.userId === where.userId);
      const ob = Array.isArray(orderBy) ? orderBy : (orderBy ? [orderBy] : [{ createdAt: 'desc' }]);
      r.sort((a, b) => { for (const o of ob) { const k = Object.keys(o)[0]; const dir = o[k] === 'asc' ? 1 : -1; const av = a[k] ?? 0, bv = b[k] ?? 0; if (av < bv) return -1 * dir; if (av > bv) return 1 * dir; } return 0; });
      return typeof take === 'number' ? r.slice(0, take) : r;
    },
  };
  const script = {
    async count({ where }) {
      if (!where) return scripts.length;
      if (where.projectId) return scripts.filter((s) => s.projectId === where.projectId).length;
      if (where.project && where.project.userId) // 跨项目、按作者计数（测试内均为当日，日期条件从略）
        return scripts.filter((s) => projects.get(s.projectId)?.userId === where.project.userId).length;
      return scripts.length;
    },
    async create({ data }) {
      const row = { id: `s_${++seq}`, ...data, version: data.version ?? 1, createdAt: data.createdAt ?? new Date() };
      scripts.push(row); return row;
    },
    async findUnique({ where }) { return scripts.find((s) => s.id === where.id) ?? null; },
    async findFirst({ where = {}, include, orderBy } = {}) {
      let r = scripts.filter((x) => (!where.id || x.id === where.id) && (!where.projectId || x.projectId === where.projectId));
      if (orderBy) { // v2.151 角色资产沉淀按 epNo desc 取最近成稿；无 orderBy 保持插入序首个（兼容既有测试）
        const keys = Array.isArray(orderBy) ? orderBy : [orderBy];
        r = [...r].sort((a, b) => { for (const o of keys) { const k = Object.keys(o)[0]; const dir = o[k] === 'desc' ? -1 : 1; const c = cmp(a[k], b[k]); if (c !== 0) return c * dir; } return 0; });
      }
      const s = r[0] ?? null;
      if (s && include?.project) s.project = projects.get(s.projectId) ?? null;
      return s;
    },
    async findMany({ where = {}, orderBy, take } = {}) {
      // v2.186：通用 where 过滤，支持 Prisma 操作符 lt/lte/gt/gte/in/not/equals
      const matchOp = (val, op) => {
        if (op == null) return val == null;
        if (typeof op === 'object' && !Array.isArray(op)) {
          for (const [k, v] of Object.entries(op)) {
            switch (k) {
              case 'lt': if (!(val < v)) return false; break;
              case 'lte': if (!(val <= v)) return false; break;
              case 'gt': if (!(val > v)) return false; break;
              case 'gte': if (!(val >= v)) return false; break;
              case 'in': if (!Array.isArray(v) || !v.includes(val)) return false; break;
              case 'not': if (matchOp(val, v)) return false; break; // not 反向
              case 'equals': if (val !== v) return false; break;
              default: break; // 未知操作符放行
            }
          }
          return true;
        }
        return val === op;
      };
      let r = scripts.filter((x) => Object.entries(where).every(([k, v]) => {
        if (k === 'NOT') return true; // 简化：测试场景不走 NOT
        return matchOp(x[k], v);
      }));
      const ob = Array.isArray(orderBy) ? orderBy : (orderBy ? [orderBy] : [{ epNo: 'asc' }]);
      r = [...r].sort((a, b) => { for (const o of ob) { const k = Object.keys(o)[0]; const dir = o[k] === 'desc' ? -1 : 1; if ((a[k] ?? 0) < (b[k] ?? 0)) return -1 * dir; if ((a[k] ?? 0) > (b[k] ?? 0)) return 1 * dir; } return 0; });
      return typeof take === 'number' ? r.slice(0, take) : r;
    },
  };
  const generationTask = {
    async create({ data }) { const id = `t_${++seq}`; const t = { id, createdAt: new Date(), ...data }; tasks.set(id, t); return t; },
    async update({ where, data }) { Object.assign(tasks.get(where.id), data); return tasks.get(where.id); },
    async findMany({ where = {} } = {}) { return [...tasks.values()].filter((t) => Object.entries(where).every(([k, v]) => t[k] === v)); },
    async count({ where = {} } = {}) {
      return [...tasks.values()].filter((t) => {
        if (where.projectId && t.projectId !== where.projectId) return false;
        if (where.project?.userId && projects.get(t.projectId)?.userId !== where.project.userId) return false;
        if (where.status) {
          const want = Array.isArray(where.status.in) ? where.status.in : [where.status];
          if (!want.includes(t.status)) return false;
        }
        if (where.createdAt?.gte && !(new Date(t.createdAt) >= new Date(where.createdAt.gte))) return false;
        return true;
      }).length;
    },
  };
  const modelCallLog = { async create({ data }) { const row = { id: `c_${++seq}`, ...data }; callLogs.push(row); return row; } };
  const feedbacks = [];
  const pickUser = (u, select) => {
    if (!u || !select) return u ?? null;
    const out = {}; Object.keys(select).forEach((k) => { out[k] = u[k]; }); return out;
  };
  const cmp = (a, b) => {
    if (a === b) return 0;
    const av = a instanceof Date ? a.getTime() : (a === true ? 1 : a === false ? 0 : a);
    const bv = b instanceof Date ? b.getTime() : (b === true ? 1 : b === false ? 0 : b);
    return av > bv ? 1 : -1;
  };
  const feedback = {
    async create({ data }) {
      const row = { id: `fb_${++seq}`, status: 'PENDING', reply: null, urgent: false, createdAt: new Date(), ...data };
      feedbacks.push(row); return row;
    },
    async findUnique({ where, include }) {
      const f = feedbacks.find((x) => x.id === where.id) ?? null;
      if (f && include?.user) return { ...f, user: pickUser(users.get(f.userId), include.user?.select) };
      return f;
    },
    async findMany({ where = {}, include, orderBy, take } = {}) {
      let r = feedbacks.filter((f) => Object.entries(where).every(([k, v]) => f[k] === v));
      if (orderBy) {
        const keys = Array.isArray(orderBy) ? orderBy : [orderBy];
        r = [...r].sort((a, b) => {
          for (const o of keys) {
            const k = Object.keys(o)[0]; const dir = o[k] === 'asc' ? 1 : -1;
            const c = cmp(a[k], b[k]); if (c !== 0) return c * dir;
          }
          return 0;
        });
      }
      if (take) r = r.slice(0, take);
      return include?.user ? r.map((f) => ({ ...f, user: pickUser(users.get(f.userId), include.user?.select) })) : r;
    },
    async update({ where, data }) {
      const f = feedbacks.find((x) => x.id === where.id);
      if (!f) throw new Error('feedback not found');
      Object.assign(f, data); return f;
    },
  };
  // —— 订单/支付/会员订阅（发货链路）——
  const orders = []; const payments = []; const memberships = [];
  const order = {
    async create({ data }) { const o = { id: `ord_${++seq}`, status: 'PENDING', points: 0, level: null, ...data }; orders.push(o); return o; },
    async findUnique({ where }) { return orders.find((o) => o.id === where.id) ?? null; },
    async findMany({ where = {} } = {}) { return orders.filter((o) => Object.entries(where).every(([k, v]) => o[k] === v)); },
    async findFirst({ where = {}, orderBy } = {}) {
      let r = orders.filter((o) => Object.entries(where).every(([k, v]) => o[k] === v));
      const key = orderBy && typeof orderBy === 'object' ? Object.keys(orderBy)[0] : null;
      if (key) r = [...r].sort((a, b) => new Date(b[key]) - new Date(a[key]));
      return r[0] ?? null;
    },
    async updateMany({ where, data }) {
      let count = 0;
      orders.forEach((o) => { if ((!where.id || o.id === where.id) && (!where.status || o.status === where.status)) { Object.assign(o, data); count += 1; } });
      return { count };
    },
  };
  const payment = { async create({ data }) { const row = { id: `pay_${++seq}`, ...data }; payments.push(row); return row; } };
  const membership = {
    async create({ data }) { const row = { id: `ms_${++seq}`, startedAt: new Date(), quotaUsed: 0, ...data }; memberships.push(row); return row; },
    async findFirst({ where = {}, orderBy } = {}) {
      let r = memberships.filter((m) =>
        (!where.userId || m.userId === where.userId) &&
        (!where.level || m.level === where.level) &&
        (!where.expireAt?.gt || new Date(m.expireAt) > where.expireAt.gt));
      if (orderBy?.expireAt === 'desc') r = [...r].sort((a, b) => new Date(b.expireAt) - new Date(a.expireAt));
      return r[0] ?? null;
    },
    async updateMany({ where = {}, data } = {}) {
      let n = 0;
      for (const m of memberships) {
        if (where.id && m.id !== where.id) continue;
        if (where.quotaUsed?.lt != null && !(m.quotaUsed < where.quotaUsed.lt)) continue;
        if (where.quotaUsed?.gt != null && !(m.quotaUsed > where.quotaUsed.gt)) continue;
        if (data.quotaUsed?.increment) m.quotaUsed += data.quotaUsed.increment;
        else if (data.quotaUsed?.decrement) m.quotaUsed = Math.max(0, m.quotaUsed - data.quotaUsed.decrement);
        else Object.assign(m, data);
        n++;
      }
      return { count: n };
    },
  };
  // —— 社区帖子 ——
  const posts = [];
  // 点赞记录：模拟 (userId,postId) 唯一约束
  const postLikes = [];
  const postLike = {
    async create({ data }) {
      if (postLikes.some((l) => l.userId === data.userId && l.postId === data.postId)) {
        const e = new Error('Unique constraint failed on PostLike');
        e.code = 'P2002'; e.meta = { target: ['userId', 'postId'] };
        throw e;
      }
      const row = { id: `pl_${++seq}`, createdAt: new Date(), ...data };
      postLikes.push(row); return row;
    },
    async findFirst({ where = {} } = {}) {
      return postLikes.find((l) => Object.entries(where).every(([k, v]) => l[k] === v)) ?? null;
    },
    async count({ where = {} } = {}) {
      return postLikes.filter((l) => Object.entries(where).every(([k, v]) => l[k] === v)).length;
    },
  };
  const post = {
    async create({ data }) { const p = { id: `post_${++seq}`, likes: 0, hidden: false, createdAt: new Date(), ...data }; posts.push(p); return p; },
    async findUnique({ where }) { return posts.find((p) => p.id === where.id) ?? null; },
    async update({ where, data }) { const p = posts.find((x) => x.id === where.id); if (!p) throw new Error('POST_NOT_FOUND'); Object.assign(p, data); return p; },
    async findMany({ where = {}, orderBy, take, select } = {}) {
      let r = posts.filter((p) => Object.entries(where).every(([k, v]) => p[k] === v));
      if (orderBy) {
        const keys = Array.isArray(orderBy) ? orderBy : [orderBy];
        r = [...r].sort((a, b) => { for (const o of keys) { const k = Object.keys(o)[0]; const dir = o[k] === 'asc' ? 1 : -1; const c = cmp(a[k], b[k]); if (c !== 0) return c * dir; } return 0; });
      }
      if (take) r = r.slice(0, take);
      if (select) return r.map((p) => {
        const o = {};
        Object.keys(select).forEach((k) => { o[k] = k === 'user' ? pickUser(users.get(p.userId), select.user?.select) : p[k]; });
        return o;
      });
      return r;
    },
    async updateMany({ where, data }) {
      let count = 0;
      posts.forEach((p) => {
        if ((!where.id || p.id === where.id) && (!where.hidden || p.hidden === where.hidden)) {
          Object.entries(data).forEach(([k, v]) => { p[k] = (v && typeof v === 'object' && 'increment' in v) ? (p[k] ?? 0) + v.increment : v; });
          count += 1;
        }
      });
      return { count };
    },
  };
  const posters = []; const pkBattles = [];
  const poster = { async create({ data }) { const row = { id: `poster_${++seq}`, ...data }; posters.push(row); return row; } };
  const pkBattle = {
    async create({ data }) { const row = { id: `pk_${++seq}`, createdAt: new Date(), ...data }; pkBattles.push(row); return row; },
    async findMany({ where = {}, orderBy } = {}) {
      let r = pkBattles.filter((x) => Object.entries(where).every(([k, v]) => x[k] === v));
      const ob = Array.isArray(orderBy) ? orderBy : (orderBy ? [orderBy] : [{ createdAt: 'desc' }]);
      return [...r].sort((a, b) => { for (const o of ob) { const k = Object.keys(o)[0]; const dir = o[k] === 'asc' ? 1 : -1; const av = a[k] instanceof Date ? a[k].getTime() : a[k]; const bv = b[k] instanceof Date ? b[k].getTime() : b[k]; if ((av ?? 0) < (bv ?? 0)) return -1 * dir; if ((av ?? 0) > (bv ?? 0)) return 1 * dir; } return 0; });
    },
  };
  // —— 编剧室（选题会/围读）：findUnique 同时支持 id 与 inviteCode ——
  const writersRooms = []; const roomMessages = [];
  const teardownRecords = []; const adverts = [];
  const writersRoom = {
    async create({ data }) { const row = { id: `wr_${++seq}`, createdAt: new Date(), updatedAt: new Date(), state: 'OPEN', participantIds: [], pointsCost: 0, payload: null, readMode: null, scriptId: null, scriptText: null, ...data }; writersRooms.push(row); return row; },
    async findUnique({ where }) { return writersRooms.find((x) => (where.id ? x.id === where.id : where.inviteCode ? x.inviteCode === where.inviteCode : false)) ?? null; },
    async findMany(arg = {}) {
      let r = writersRooms.filter((x) => matchWhere(x, arg.where));
      const ob = arg.orderBy && (arg.orderBy.updatedAt || arg.orderBy.createdAt);
      if (ob) r = [...r].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      if (arg.take) r = r.slice(0, arg.take);
      return arg.select ? r.map((x) => projectRow(x, arg.select)) : r;
    },
    async update({ where, data }) { const x = writersRooms.find((y) => y.id === where.id); if (!x) throw new Error('WR_NOT_FOUND'); Object.assign(x, data); x.updatedAt = new Date(); return x; },
  };
  // —— 采访式创作会话（v2.92）：多轮采访 + 四维记忆空间 ——
  const interviewSessions = [];
  const interviewSession = {
    async create({ data }) { const row = { id: `iv_${++seq}`, title: '', lang: 'zh', status: 'ACTIVE', turnCount: 0, materials: {}, transcript: [], createdAt: new Date(), updatedAt: new Date(), ...data }; interviewSessions.push(row); return row; },
    async findUnique({ where }) { return interviewSessions.find((x) => x.id === where.id) ?? null; },
    async findMany(arg = {}) {
      let r = interviewSessions.filter((x) => matchWhere(x, arg.where));
      if (arg.orderBy && arg.orderBy.updatedAt) r = [...r].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      if (arg.take) r = r.slice(0, arg.take);
      return r;
    },
    async update({ where, data }) { const x = interviewSessions.find((y) => y.id === where.id); if (!x) throw new Error('IV_NOT_FOUND'); Object.assign(x, data, { updatedAt: new Date() }); return x; },
  };

  // 通用 where 匹配（支持 OR/in/has/contains/lt/not 与等值）、排序、select 投影（含一层关联）
  const matchWhere = (row, where = {}) => Object.entries(where).every(([k, cond]) => {
    if (k === 'OR') return Array.isArray(cond) && cond.some((sub) => matchWhere(row, sub));
    if (cond && typeof cond === 'object') {
      if ('in' in cond) return cond.in.includes(row[k]);
      if ('has' in cond) return Array.isArray(row[k]) && row[k].includes(cond.has);
      if ('contains' in cond) return String(row[k] ?? '').includes(cond.contains);
      if ('lt' in cond) return row[k] < cond.lt;
      if ('not' in cond) return row[k] !== cond.not;
      return true;
    }
    return row[k] === cond;
  });
  const projectRow = (x, select) => {
    const o = {};
    Object.keys(select).forEach((k) => {
      o[k] = (select[k] && typeof select[k] === 'object' && select[k].select)
        ? pickUser(users.get(x[`${k}Id`]), select[k].select) : x[k];
    });
    return o;
  };
  const crud = (arr, idPrefix, defaults = {}) => ({
    async create({ data }) { const row = { id: `${idPrefix}_${++seq}`, createdAt: new Date(), ...defaults, ...data }; arr.push(row); return row; },
    async findMany(arg = {}) {
      let r = arr.filter((x) => matchWhere(x, arg.where));
      if (arg.orderBy) {
        const keys = Array.isArray(arg.orderBy) ? arg.orderBy : [arg.orderBy];
        r = [...r].sort((a, b) => { for (const o of keys) { const k = Object.keys(o)[0]; const dir = o[k] === 'asc' ? 1 : -1; const c = cmp(a[k], b[k]); if (c !== 0) return c * dir; } return 0; });
      }
      if (arg.take) r = r.slice(0, arg.take);
      return arg.select ? r.map((x) => projectRow(x, arg.select)) : r;
    },
    async findUnique({ where }) { return arr.find((x) => x.id === where.id) ?? null; },
    async findFirst({ where = {} }) { return arr.find((x) => matchWhere(x, where)) ?? null; },
    async count({ where = {} } = {}) { return arr.filter((x) => matchWhere(x, where)).length; },
    async update({ where, data }) { const x = arr.find((y) => y.id === where.id); if (!x) throw new Error('not found'); Object.entries(data).forEach(([k, v]) => { x[k] = (v && typeof v === 'object' && 'increment' in v) ? (x[k] ?? 0) + v.increment : v; }); return x; },
    async updateMany({ where = {}, data }) {
      let c = 0;
      arr.forEach((x) => { if (matchWhere(x, where)) { Object.entries(data).forEach(([k, v]) => { x[k] = (v && typeof v === 'object' && 'increment' in v) ? (x[k] ?? 0) + v.increment : v; }); c += 1; } });
      return { count: c };
    },
  });
  const knowledgeItems = []; const listings = []; const purchases = []; const learningReports = [];
  // 全局加密单行配置（id=global 模型密钥；v2.43 起 id=handoff 接续档案，多行 Map 语义对齐 Prisma）
  const modelConfigRows = new Map();
  const modelConfig = {
    async findUnique({ where }) { const r = modelConfigRows.get(where.id); return r ? { ...r } : null; },
    async upsert({ where, create, update }) {
      const data = modelConfigRows.has(where.id) ? update : create;
      const prev = modelConfigRows.get(where.id);
      const row = { id: where.id, updatedAt: new Date(), ...prev, ...data };
      modelConfigRows.set(where.id, row);
      return { ...row };
    },
  };
  // 全局合规规则覆写（单行 id=global，payload 为明文 JSON，结构同 SafetyOverrides）
  let safetyConfigRow = null;
  const safetyConfig = {
    async findUnique({ where }) { return (where.id === 'global' && safetyConfigRow) ? { ...safetyConfigRow } : null; },
    async upsert({ where, create, update }) {
      const data = safetyConfigRow ? update : create;
      safetyConfigRow = { id: where.id, updatedAt: new Date(), ...safetyConfigRow, ...data };
      return { ...safetyConfigRow };
    },
  };
  const knowledgeItem = crud(knowledgeItems, 'ki', { status: 'PENDING', conflictNote: null });
  const learningReport = crud(learningReports, 'lr', {});
  // v2.186 工具优化弹窗铁律：announcement 模型，承载"每次改动+上传仓库即向用户弹公告"的契约
  // 字段：id/version(唯一)/titleZh/titleEn/bodyZh/bodyEn/pinned(bool)/createdAt/createdById
  // 唯一约束：同 version 拒绝重复创建——create 内查重后抛 P2002（与 postLike 行为对齐）
  const announcements = [];
  const announcementCrud = crud(announcements, 'an', { pinned: false, titleEn: null, bodyEn: null });
  const announcement = {
    ...announcementCrud,
    async create({ data }) {
      if (announcements.some((a) => a.version === data.version)) {
        const e = new Error('Unique constraint failed on Announcement.version');
        e.code = 'P2002'; e.meta = { target: ['version'] };
        throw e;
      }
      return announcementCrud.create({ data });
    },
  };
  const listing = crud(listings, 'ls', { status: 'ON_SHELF', sample: '' });
  const purchase = crud(purchases, 'pu', { status: 'ESCROW' });
  const roomMessage = crud(roomMessages, 'rm', {});
  const teardownRecord = crud(teardownRecords, 'td', { pickedTags: [], report: null, outline: null, state: 'ANALYZED', pointsCost: 0 });
  const advert = crud(adverts, 'ad', { active: true, sort: 0, clicks: 0, priceFenDay: 0 });
  // —— v2.151 角色资产库（L3"角色可资产化"）：crud 面 + delete + updatedAt 时间戳（列表按 updatedAt desc）——
  const characterAssets = [];
  const characterAssetCrud = crud(characterAssets, 'ca', { usedCount: 0, voice: null, visualAnchor: null, voicePrint: null, signatureLines: [], tags: [], sourceProjectId: null, sourceProjectTitle: null });
  const characterAsset = {
    ...characterAssetCrud,
    async create(arg) { const row = await characterAssetCrud.create(arg); row.updatedAt = new Date(); return row; },
    async update(arg) { const row = await characterAssetCrud.update(arg); row.updatedAt = new Date(); return row; },
    async delete({ where }) { const i = characterAssets.findIndex((x) => x.id === where.id); if (i < 0) throw new Error('CA_NOT_FOUND'); return characterAssets.splice(i, 1)[0]; },
  };
  // —— v2.159 道具资产库（L3"道具可资产化"）：crud 面 + delete + updatedAt 时间戳（与 characterAsset 家族同构）——
  const propAssets = [];
  const propAssetCrud = crud(propAssets, 'pa', { usedCount: 0, taboo: null, visualAnchor: null, eps: [], closedEps: [], tags: [], sourceProjectId: null, sourceProjectTitle: null });
  const propAsset = {
    ...propAssetCrud,
    async create(arg) { const row = await propAssetCrud.create(arg); row.updatedAt = new Date(); return row; },
    async update(arg) { const row = await propAssetCrud.update(arg); row.updatedAt = new Date(); return row; },
    async delete({ where }) { const i = propAssets.findIndex((x) => x.id === where.id); if (i < 0) throw new Error('PA_NOT_FOUND'); return propAssets.splice(i, 1)[0]; },
  };
  // —— v2.161 场景资产库（L3"场景可资产化"第三家族）：crud 面 + delete + updatedAt 时间戳（与 propAsset 家族同构）——
  const sceneAssets = [];
  const sceneAssetCrud = crud(sceneAssets, 'sa', { usedCount: 0, mood: null, taboo: null, visualAnchor: null, eps: [], tags: [], sourceProjectId: null, sourceProjectTitle: null });
  const sceneAsset = {
    ...sceneAssetCrud,
    async create(arg) { const row = await sceneAssetCrud.create(arg); row.updatedAt = new Date(); return row; },
    async update(arg) { const row = await sceneAssetCrud.update(arg); row.updatedAt = new Date(); return row; },
    async delete({ where }) { const i = sceneAssets.findIndex((x) => x.id === where.id); if (i < 0) throw new Error('SA_NOT_FOUND'); return sceneAssets.splice(i, 1)[0]; },
  };
  user.update = async ({ where, data }) => { const u = users.get(where.id); if (!u) throw new Error('user not found'); Object.assign(u, data); return u; };
  // —— X剧本成年分级授权（mature-gating）——
  const consents = [];
  const matureConsent = {
    async create({ data }) { const row = { id: `mc_${++seq}`, revokedAt: null, ...data }; consents.push(row); return row; },
    async findFirst({ where = {}, orderBy } = {}) {
      let r = consents.filter((c) => Object.entries(where).every(([k, v]) => c[k] === v));
      const key = orderBy && typeof orderBy === 'object' ? Object.keys(orderBy)[0] : null;
      if (key) r = [...r].sort((a, b) => new Date(b[key]) - new Date(a[key]));
      return r[0] ?? null;
    },
    async updateMany({ where = {}, data }) {
      let n = 0;
      consents.forEach((c) => { if ((!where.userId || c.userId === where.userId) && (!where.revokedAt || c.revokedAt === where.revokedAt)) { Object.assign(c, data); n++; } });
      return { count: n };
    },
  };
  // 行锁 SELECT ... FOR UPDATE 在内存实现里为空操作（单线程测试无并发竞争）
  const $queryRaw = async () => [];
  const tx = { user, invitation, pointsAccount, storageObject, ledgerEntry, project, script, generationTask, modelCallLog, feedback, order, payment, membership, post, postLike, poster, pkBattle, knowledgeItem, learningReport, announcement, modelConfig, safetyConfig, listing, purchase, writersRoom, roomMessage, teardownRecord, advert, characterAsset, propAsset, sceneAsset, matureConsent, interviewSession, $queryRaw };
  return {
    user, invitation, pointsAccount, ledgerEntry, project, script, generationTask, modelCallLog, feedback,
    order, payment, membership, post, postLike, poster, pkBattle, knowledgeItem, learningReport, announcement, modelConfig, safetyConfig, listing, purchase, storageObject, writersRoom, roomMessage, teardownRecord, advert, characterAsset, propAsset, sceneAsset, matureConsent, interviewSession,
    async $transaction(fn) { return fn(tx); },
    _users: users, _accounts: accounts, _projects: projects, _scripts: scripts, _tasks: tasks, _ledgers: ledgers,
    _orders: orders, _payments: payments, _memberships: memberships, _posts: posts, _postLikes: postLikes, _posters: posters, _pkBattles: pkBattles,
    _knowledgeItems: knowledgeItems, _listings: listings, _purchases: purchases, _writersRooms: writersRooms, _roomMessages: roomMessages, _teardownRecords: teardownRecords, _adverts: adverts, _consents: consents, _interviewSessions: interviewSessions, _characterAssets: characterAssets, _propAssets: propAssets, _sceneAssets: sceneAssets, _announcements: announcements,
    _setBanned(phone, banned) { const u = byPhone.get(phone); if (u) u.banned = banned; },
    /** 测试便捷：直接造一个指定等级/积分余额的用户 */
    _seedUser({ id, level = 'FREE', balance = 0, phone, penName = null, role = 'OP', isAdmin = false, nickname = null, avatarUrl = null, bio = null, region = null, ageBand = null, gender = null, personalized = true } = {}) {
      const uid = id || `u_${++seq}`;
      const u = { id: uid, phone: phone || `13${String(100000000 + seq)}`, level, banned: false, passwordHash: null, inviteCode: `IV${seq}`, penName, role, isAdmin, nickname, avatarUrl, bio, region, ageBand, gender, personalized };
      users.set(uid, u); byPhone.set(u.phone, u); byInvite.set(u.inviteCode, u);
      accounts.set(uid, { userId: uid, balance, frozen: 0, bonusGranted: 0 });
      return u;
    },
  };
}
module.exports = { createMemoryPrisma };
