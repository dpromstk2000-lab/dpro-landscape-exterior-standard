const API_BASE = '/api/landscape/v1';
const SYSTEM_ID = 'dpro_landscape_exterior';
const SYSTEM_VERSION = '1.0.0-g7-shared-bind';
const DEMO_TENANT_ID = 'demo-landscape-001';

const memory = globalThis.__DPRO_LANDSCAPE_MEMORY__ || (globalThis.__DPRO_LANDSCAPE_MEMORY__ = new Map());

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-dpro-system': SYSTEM_ID,
      'x-dpro-version': SYSTEM_VERSION,
      ...extraHeaders,
    },
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get('origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean);
  const allow = allowed.includes(origin) ? origin : (allowed.includes('*') && env.APP_ENV !== 'production' ? '*' : '');
  return {
    ...(allow ? { 'access-control-allow-origin': allow } : {}),
    'access-control-allow-headers': 'authorization, content-type, x-dpro-request-id',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'access-control-max-age': '86400',
    'vary': 'origin',
  };
}

function withCors(response, request, env) {
  const h = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders(request, env))) h.set(k, v);
  return new Response(response.body, { status: response.status, headers: h });
}

function normalizePhone(value = '') {
  let s = String(value).trim().replace(/[\s\-‐‑‒–—―ー－]/g, '');
  s = s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  if (s.startsWith('+81')) s = '0' + s.slice(3);
  return s.replace(/[^0-9]/g, '');
}

function cleanText(value, max = 500) {
  return String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max);
}

function uuid() {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

function demoSeed() {
  const caseId = 'demo-case-001';
  return {
    tenant: { id: DEMO_TENANT_ID, name: 'DPROガーデン デモ店' },
    customers: [{ id: 'demo-customer-001', tenant_id: DEMO_TENANT_ID, name: '山田 花子', phone_normalized: '09012345678', email: 'demo@example.jp' }],
    sites: [{ id: 'demo-site-001', tenant_id: DEMO_TENANT_ID, customer_id: 'demo-customer-001', name: 'ご自宅', address_summary: '福岡県（デモ）', access_note: '駐車スペースあり' }],
    cases: [{
      id: caseId,
      tenant_id: DEMO_TENANT_ID,
      customer_id: 'demo-customer-001',
      site_id: 'demo-site-001',
      title: '玄関まわりの植栽・剪定',
      category: '剪定・植栽',
      status: 'in_progress',
      desired_timing: '9月中',
      customer_request: '玄関横をすっきりさせ、管理しやすい植栽へ。',
      assigned_staff_ids: ['demo-staff-001'],
      next_action: '施工後写真を登録して完了確認へ',
      created_at: '2026-09-01T01:00:00.000Z',
      updated_at: nowIso(),
    }],
    inquiries: [{ id: 'demo-inquiry-001', tenant_id: DEMO_TENANT_ID, case_id: caseId, source: 'line', message: '玄関横の木が伸びてきたので相談したいです。', created_at: '2026-09-01T01:00:00.000Z' }],
    photo_points: [
      { id: 'pp-entrance', tenant_id: DEMO_TENANT_ID, case_id: caseId, name: '玄関横植栽', required_before: true, required_after: true },
      { id: 'pp-path', tenant_id: DEMO_TENANT_ID, case_id: caseId, name: 'アプローチ', required_before: true, required_after: true },
    ],
    photos: [
      { id: 'ph-001', tenant_id: DEMO_TENANT_ID, case_id: caseId, photo_point_id: 'pp-entrance', phase: 'inquiry', url: 'https://placehold.co/800x600?text=Inquiry+Photo', caption: '相談時写真', shared_with_customer: true, created_at: '2026-09-01T01:05:00.000Z' },
      { id: 'ph-002', tenant_id: DEMO_TENANT_ID, case_id: caseId, photo_point_id: 'pp-entrance', phase: 'before', url: 'https://placehold.co/800x600?text=Before+Entrance', caption: '施工前', shared_with_customer: true, created_at: '2026-09-02T00:10:00.000Z' },
      { id: 'ph-003', tenant_id: DEMO_TENANT_ID, case_id: caseId, photo_point_id: 'pp-path', phase: 'before', url: 'https://placehold.co/800x600?text=Before+Path', caption: '施工前', shared_with_customer: true, created_at: '2026-09-02T00:12:00.000Z' },
    ],
    surveys: [{ id: 'survey-001', tenant_id: DEMO_TENANT_ID, case_id: caseId, staff_id: 'demo-staff-001', summary: '既存樹木を剪定し、低管理の下草へ一部入替。搬入経路問題なし。', measurements: { entrance_width_cm: 180 }, created_at: '2026-09-01T03:00:00.000Z' }],
    estimates: [{ id: 'est-001', tenant_id: DEMO_TENANT_ID, case_id: caseId, version_no: 1, status: 'accepted', total_yen: 88000, items: [{ name: '剪定・処分', qty: 1, amount_yen: 44000 }, { name: '植栽・整地', qty: 1, amount_yen: 44000 }], customer_note: '作業範囲と処分費を含みます。', created_at: '2026-09-01T04:00:00.000Z' }],
    schedule_events: [{ id: 'sch-001', tenant_id: DEMO_TENANT_ID, case_id: caseId, type: 'work', start_at: '2026-09-02T09:00:00+09:00', end_at: '2026-09-02T15:00:00+09:00', status: 'confirmed', staff_ids: ['demo-staff-001'] }],
    work_logs: [{ id: 'wl-001', tenant_id: DEMO_TENANT_ID, case_id: caseId, staff_id: 'demo-staff-001', progress: 70, note: '剪定・処分完了。植栽調整中。', created_at: nowIso() }],
    completion_approvals: [{ id: 'ca-001', tenant_id: DEMO_TENANT_ID, case_id: caseId, status: 'draft', requested_at: null, responded_at: null, response_note: '' }],
    followups: [{ id: 'fu-001', tenant_id: DEMO_TENANT_ID, case_id: caseId, category: 'seasonal_check', candidate_date: '2027-03-01', status: 'candidate', owner_approved: false, note: '春の生育前点検候補' }],
    audit_events: [],
  };
}

function ensureDemoStore() {
  if (!memory.has(DEMO_TENANT_ID)) memory.set(DEMO_TENANT_ID, demoSeed());
  return memory.get(DEMO_TENANT_ID);
}

function demoReset() {
  const seeded = demoSeed();
  memory.set(DEMO_TENANT_ID, seeded);
  return seeded;
}

function isDemoEnv(env) {
  return String(env.APP_ENV || 'demo').toLowerCase() !== 'production';
}

function isMutation(method) {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
}

function requireProductionWrite(env) {
  return String(env.PRODUCTION_WRITE_ENABLED || '').toLowerCase() === 'true';
}

const jwksCache = new Map();

function decodeJwtPart(s) {
  try { return JSON.parse(new TextDecoder().decode(base64UrlToBytes(s))); } catch { return null; }
}

async function verifyHs256Jwt(token, secret) {
  if (!token || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  const header = decodeJwtPart(headerB64), payload = decodeJwtPart(payloadB64);
  if (!header || !payload || header.alg !== 'HS256') return null;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('HMAC', key, base64UrlToBytes(sigB64), new TextEncoder().encode(`${headerB64}.${payloadB64}`));
  if (!ok || (payload.exp && Date.now() / 1000 >= payload.exp)) return null;
  return payload;
}

function base64UrlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

function audienceOk(aud) {
  return aud === 'authenticated' || (Array.isArray(aud) && aud.includes('authenticated'));
}

async function fetchJwks(env) {
  const base = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  if (!base) return null;
  const hit = jwksCache.get(base);
  if (hit && hit.expires > Date.now()) return hit.value;
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(`${base}/auth/v1/.well-known/jwks.json`, { signal: ctrl.signal, headers: { accept: 'application/json' } });
    if (!r.ok) return null;
    const value = await r.json();
    if (!value || !Array.isArray(value.keys)) return null;
    jwksCache.set(base, { value, expires: Date.now() + 5 * 60 * 1000 });
    return value;
  } finally { clearTimeout(t); }
}

async function verifyProjectJwt(token, env) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const header = decodeJwtPart(parts[0]), payload = decodeJwtPart(parts[1]);
  if (!header || !payload) return null;
  const expectedIss = `${String(env.SUPABASE_URL || '').replace(/\/$/, '')}/auth/v1`;
  if (!expectedIss || payload.iss !== expectedIss || !audienceOk(payload.aud) || !payload.sub) return null;
  if (payload.exp && Date.now() / 1000 >= payload.exp) return null;
  if (header.alg === 'HS256') {
    if (String(env.DPRO_ALLOW_LEGACY_HS256 || '').toLowerCase() !== 'true') return null;
    return verifyHs256Jwt(token, env.DPRO_AUTH_SECRET || '');
  }
  if (!['ES256','RS256'].includes(header.alg) || !header.kid) return null;
  const jwks = await fetchJwks(env); const jwk = jwks?.keys?.find(k => k.kid === header.kid && k.alg === header.alg);
  if (!jwk) return null;
  const importAlg = header.alg === 'ES256' ? { name:'ECDSA', namedCurve:'P-256' } : { name:'RSASSA-PKCS1-v1_5', hash:'SHA-256' };
  const verifyAlg = header.alg === 'ES256' ? { name:'ECDSA', hash:'SHA-256' } : { name:'RSASSA-PKCS1-v1_5' };
  try {
    const key = await crypto.subtle.importKey('jwk', jwk, importAlg, false, ['verify']);
    const ok = await crypto.subtle.verify(verifyAlg, key, base64UrlToBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    return ok ? payload : null;
  } catch { return null; }
}

async function lookupProductionActor(payload, env) {
  const rows = await supabaseFetch(env, 'landscape_user_access', `?user_id=eq.${encodeURIComponent(payload.sub)}&active=eq.true&select=user_id,tenant_id,dpro_role,customer_id,support_scoped&limit=1`);
  const row = rows?.[0];
  if (!row || !['owner','staff','customer','dpro_admin'].includes(row.dpro_role)) return null;
  return { user_id: row.user_id, role: row.dpro_role, tenant_id: row.tenant_id, customer_id: row.customer_id || null, assigned_case_ids: [], support_scoped: Boolean(row.support_scoped) };
}

async function authenticate(request, env) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (isDemoEnv(env)) {
    const demoTokens = {
      'demo-owner': { user_id: 'demo-owner-001', role: 'owner', tenant_id: DEMO_TENANT_ID },
      'demo-staff': { user_id: 'demo-staff-001', role: 'staff', tenant_id: DEMO_TENANT_ID, assigned_case_ids: ['demo-case-001'] },
      'demo-customer': { user_id: 'demo-customer-001', role: 'customer', tenant_id: DEMO_TENANT_ID, customer_id: 'demo-customer-001' },
      'demo-admin': { user_id: 'demo-admin-001', role: 'dpro_admin', tenant_id: DEMO_TENANT_ID, support_scoped: true },
    };
    if (demoTokens[token]) return demoTokens[token];
    return null;
  }
  const payload = await verifyProjectJwt(token, env);
  if (!payload) return null;
  return lookupProductionActor(payload, env);
}

function canAccessCase(actor, c) {
  if (!actor || !c || actor.tenant_id !== c.tenant_id) return false;
  if (actor.role === 'owner') return true;
  if (actor.role === 'customer') return actor.customer_id && actor.customer_id === c.customer_id;
  if (actor.role === 'staff') return (c.assigned_staff_ids || []).includes(actor.user_id) || (actor.assigned_case_ids || []).includes(c.id);
  if (actor.role === 'dpro_admin') return Boolean(actor.support_scoped);
  return false;
}

function requireRole(actor, roles) {
  return actor && roles.includes(actor.role);
}

function audit(db, actor, action, entityType, entityId, detail = {}) {
  if (!db.audit_events) db.audit_events = [];
  db.audit_events.push({ id: uuid(), tenant_id: actor?.tenant_id || DEMO_TENANT_ID, actor_id: actor?.user_id || 'anonymous', role: actor?.role || 'anonymous', action, entity_type: entityType, entity_id: entityId, detail, at: nowIso() });
}

const CASE_TRANSITIONS = {
  inquiry: ['survey_planned'],
  survey_planned: ['surveyed'],
  surveyed: ['estimate_draft'],
  estimate_draft: ['estimate_sent'],
  estimate_sent: ['contracted'],
  contracted: ['scheduled'],
  scheduled: ['in_progress'],
  in_progress: ['completion_review'],
  completion_review: ['completed'],
  completed: [],
};

function validateCaseTransition(from, to) {
  return Boolean(CASE_TRANSITIONS[from]?.includes(to));
}

function publicCase(c) {
  return {
    id: c.id, title: c.title, category: c.category, status: c.status,
    desired_timing: c.desired_timing, next_action: c.next_action, updated_at: c.updated_at,
  };
}

function ownCaseView(db, c, actor) {
  const photos = db.photos.filter(p => p.case_id === c.id && (actor.role !== 'customer' || p.shared_with_customer));
  return {
    ...publicCase(c),
    customer_request: c.customer_request,
    site: db.sites.find(s => s.id === c.site_id) || null,
    photo_points: db.photo_points.filter(p => p.case_id === c.id),
    photos,
    estimates: db.estimates.filter(e => e.case_id === c.id).map(e => actor.role === 'staff' ? { id: e.id, version_no: e.version_no, status: e.status } : e),
    schedule: db.schedule_events.filter(s => s.case_id === c.id),
    work_logs: db.work_logs.filter(w => w.case_id === c.id),
    completion: db.completion_approvals.find(a => a.case_id === c.id) || null,
    followups: actor.role === 'staff' ? [] : db.followups.filter(f => f.case_id === c.id),
  };
}

async function readJson(request) {
  const type = request.headers.get('content-type') || '';
  if (!type.includes('application/json')) throw new Error('JSON_REQUIRED');
  const data = await request.json();
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('JSON_OBJECT_REQUIRED');
  return data;
}

function validatePhotoUrl(url) {
  const s = cleanText(url, 2000);
  return /^https:\/\//i.test(s) || /^data:image\/(jpeg|png|webp);base64,/i.test(s);
}

function completionPhotoStatus(db, caseId) {
  const points = db.photo_points.filter(p => p.case_id === caseId);
  const photos = db.photos.filter(p => p.case_id === caseId);
  const missing = [];
  for (const p of points) {
    if (p.required_before && !photos.some(x => x.photo_point_id === p.id && x.phase === 'before')) missing.push(`${p.name}:before`);
    if (p.required_after && !photos.some(x => x.photo_point_id === p.id && x.phase === 'after')) missing.push(`${p.name}:after`);
  }
  return { ok: missing.length === 0, missing };
}

async function handlePublicInquiry(request, env) {
  if (!isDemoEnv(env) && String(env.PUBLIC_INQUIRY_ENABLED || '').toLowerCase() !== 'true') return json({ ok: false, error: 'PUBLIC_INQUIRY_DISABLED' }, 403);
  const body = await readJson(request);
  const name = cleanText(body.name, 80);
  const phone = normalizePhone(body.phone);
  const message = cleanText(body.message, 1000);
  if (!name || phone.length < 10 || !message) return json({ ok: false, error: 'VALIDATION_ERROR', fields: ['name', 'phone', 'message'] }, 400);
  if (isDemoEnv(env)) {
    const db = ensureDemoStore();
    const id = uuid();
    db.inquiries.push({ id, tenant_id: DEMO_TENANT_ID, case_id: null, source: cleanText(body.source || 'web', 30), message, contact_name: name, phone_normalized: phone, created_at: nowIso() });
    audit(db, null, 'public_inquiry_create', 'inquiry', id, { source: body.source || 'web' });
    return json({ ok: true, inquiry_id: id, mode: 'demo' }, 201);
  }
  const tenantId = cleanText(env.PUBLIC_TENANT_ID, 100);
  if (!tenantId) return json({ ok: false, error: 'PUBLIC_TENANT_NOT_CONFIGURED' }, 503);
  if (String(env.PUBLIC_INQUIRY_GUARD || '').toLowerCase() === 'turnstile') {
    const token = cleanText(body.turnstile_token, 3000);
    if (!token || !env.TURNSTILE_SECRET_KEY) return json({ ok: false, error: 'BOT_CHECK_REQUIRED' }, 400);
    const form = new FormData(); form.set('secret', env.TURNSTILE_SECRET_KEY); form.set('response', token);
    const vr = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method:'POST', body:form });
    const v = await vr.json().catch(()=>({success:false})); if (!v.success) return json({ ok:false, error:'BOT_CHECK_FAILED' }, 403);
  }
  const rows = await supabaseFetch(env, 'landscape_inquiries', '', { method:'POST', body:JSON.stringify([{ tenant_id:tenantId, case_id:null, source:cleanText(body.source || 'web',30), contact_name:name, phone_normalized:phone, message }]) });
  return json({ ok:true, inquiry_id:rows?.[0]?.id || null, mode:'production' }, 201);
}

function systemCheck(env) {
  const demo = isDemoEnv(env);
  const allowed=String(env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
  const checks = [
    { id:'identity', status:'PASS', detail:`${SYSTEM_ID}@${SYSTEM_VERSION}` },
    { id:'runtime_mode', status:'PASS', detail:demo?'demo/local':'production' },
    { id:'demo_production_guard', status:'PASS', detail:demo?'demo runtime isolated':'demo tokens disabled in production' },
    { id:'production_write_switch', status:demo?'PASS':(requireProductionWrite(env)?'PASS':'FAIL'), detail:demo?'not production':(requireProductionWrite(env)?'explicitly enabled':'PRODUCTION_WRITE_ENABLED is not true') },
    { id:'auth_jwks_config', status:demo?'PASS':(env.SUPABASE_URL?'PASS':'FAIL'), detail:demo?'demo tokens only':'Supabase issuer + JWKS' },
    { id:'supabase_server_secret', status:demo?'PASS':(serverSecret(env)?'PASS':'FAIL'), detail:demo?'memory store':'server-side secret key required' },
    { id:'cors_origin', status:demo?'PASS':(allowed.length&& !allowed.includes('*')?'PASS':'FAIL'), detail:demo?'demo permissive allowed':(allowed.join(',')||'missing') },
    { id:'public_tenant', status:demo?'PASS':(env.PUBLIC_TENANT_ID?'PASS':'FAIL'), detail:demo?DEMO_TENANT_ID:(env.PUBLIC_TENANT_ID||'missing') },
    { id:'line_config', status:demo?'PASS':(env.LINE_CHANNEL_SECRET&&env.LINE_CHANNEL_ACCESS_TOKEN?'PASS':'FAIL'), detail:demo?'not called':'webhook secret + access token required' },
    { id:'public_inquiry_guard', status:demo?'PASS':(String(env.PUBLIC_INQUIRY_ENABLED||'').toLowerCase()!=='true'||(env.TURNSTILE_SECRET_KEY&&String(env.PUBLIC_INQUIRY_GUARD||'').toLowerCase()==='turnstile')?'PASS':'FAIL'), detail:demo?'demo validation':'Turnstile required when public inquiry is enabled' },
  ];
  return { ok: checks.every(c=>c.status==='PASS'), system_id:SYSTEM_ID, version:SYSTEM_VERSION, checks };
}

async function productionSystemCheck(env) {
  const base=systemCheck(env); const live=[];
  try{const jwks=await fetchJwks(env);live.push({id:'auth_jwks_live',status:jwks?.keys?.length?'PASS':'FAIL',detail:jwks?.keys?.length?`${jwks.keys.length} signing key(s)`:'JWKS unavailable'})}catch(e){live.push({id:'auth_jwks_live',status:'FAIL',detail:cleanText(e.message,180)})}
  try{await supabaseFetch(env,'landscape_tenants','?select=id&limit=1');live.push({id:'database_live',status:'PASS',detail:'PostgREST reachable'})}catch(e){live.push({id:'database_live',status:'FAIL',detail:'database unavailable'})}
  try{const bucket=cleanText(env.PHOTO_BUCKET||'dpro-landscape-exterior-private',120);await storageFetch(env,`bucket/${encodeURIComponent(bucket)}`,{method:'GET'});live.push({id:'storage_bucket_live',status:'PASS',detail:bucket})}catch(e){live.push({id:'storage_bucket_live',status:'FAIL',detail:'private photo bucket unavailable'})}
  try{if(!env.LINE_CHANNEL_ACCESS_TOKEN)throw new Error('missing');const r=await fetch('https://api.line.me/v2/bot/info',{headers:{authorization:`Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`}});live.push({id:'line_bot_live',status:r.ok?'PASS':'FAIL',detail:r.ok?'LINE Messaging API reachable':`LINE ${r.status}`})}catch(e){live.push({id:'line_bot_live',status:'FAIL',detail:'LINE bot validation failed'})}
  const checks=[...base.checks,...live];return {...base,ok:checks.every(c=>c.status==='PASS'),checks};
}

async function routeDemo(request, env, pathname) {
  if (pathname !== `${API_BASE}/demo/prepare`) return null;
  if (!isDemoEnv(env)) return json({ ok: false, error: 'DEMO_DISABLED_IN_PRODUCTION' }, 403);
  if (request.method === 'POST') {
    const db = demoReset();
    audit(db, { user_id: 'system', role: 'dpro_admin', tenant_id: DEMO_TENANT_ID }, 'demo_reset', 'tenant', DEMO_TENANT_ID);
    return json({ ok: true, demo_tenant_id: DEMO_TENANT_ID, cases: db.cases.length, prepared_at: nowIso() });
  }
  return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);
}

function getCase(db, caseId) {
  return db.cases.find(c => c.id === caseId && !c.deleted_at);
}

async function handleAuthedDemo(request, env, pathname, actor) {
  const db = ensureDemoStore();
  if (actor.tenant_id !== DEMO_TENANT_ID) return json({ ok: false, error: 'TENANT_DENIED' }, 403);

  if (pathname === `${API_BASE}/cases` && request.method === 'GET') {
    const rows = db.cases.filter(c => canAccessCase(actor, c) && !c.deleted_at).map(c => publicCase(c));
    return json({ ok: true, cases: rows });
  }

  if (pathname === `${API_BASE}/cases` && request.method === 'POST') {
    if (!requireRole(actor, ['owner'])) return json({ ok: false, error: 'ROLE_DENIED' }, 403);
    const b = await readJson(request);
    const customerId = cleanText(b.customer_id, 100);
    const siteId = cleanText(b.site_id, 100);
    if (!db.customers.some(x => x.id === customerId) || !db.sites.some(x => x.id === siteId && x.customer_id === customerId)) return json({ ok: false, error: 'CUSTOMER_SITE_MISMATCH' }, 400);
    const row = { id: uuid(), tenant_id: actor.tenant_id, customer_id: customerId, site_id: siteId, title: cleanText(b.title, 120), category: cleanText(b.category, 80), status: 'inquiry', desired_timing: cleanText(b.desired_timing, 80), customer_request: cleanText(b.customer_request, 1000), assigned_staff_ids: [], next_action: '現調候補を設定', created_at: nowIso(), updated_at: nowIso() };
    if (!row.title) return json({ ok: false, error: 'TITLE_REQUIRED' }, 400);
    db.cases.push(row); audit(db, actor, 'case_create', 'case', row.id);
    return json({ ok: true, case: publicCase(row) }, 201);
  }

  const caseMatch = pathname.match(new RegExp(`^${API_BASE}/cases/([^/]+)(?:/(.*))?$`));
  if (!caseMatch) return null;
  const caseId = decodeURIComponent(caseMatch[1]);
  const tail = caseMatch[2] || '';
  const c = getCase(db, caseId);
  if (!c) return json({ ok: false, error: 'CASE_NOT_FOUND' }, 404);
  if (!canAccessCase(actor, c)) return json({ ok: false, error: 'CASE_SCOPE_DENIED' }, 403);

  if (!tail && request.method === 'GET') return json({ ok: true, case: ownCaseView(db, c, actor) });

  if (tail === 'transition' && request.method === 'POST') {
    if (!requireRole(actor, ['owner', 'staff'])) return json({ ok: false, error: 'ROLE_DENIED' }, 403);
    const b = await readJson(request);
    const to = cleanText(b.to, 60);
    if (!validateCaseTransition(c.status, to)) return json({ ok: false, error: 'INVALID_TRANSITION', from: c.status, to, allowed: CASE_TRANSITIONS[c.status] || [] }, 409);
    if (actor.role === 'staff' && !['surveyed', 'in_progress', 'completion_review'].includes(to)) return json({ ok: false, error: 'STAFF_TRANSITION_DENIED' }, 403);
    const from = c.status; c.status = to; c.updated_at = nowIso(); c.next_action = cleanText(b.next_action || '', 160);
    audit(db, actor, 'case_transition', 'case', c.id, { from, to });
    return json({ ok: true, case: publicCase(c) });
  }

  if (tail === 'photos' && request.method === 'POST') {
    if (!requireRole(actor, ['owner', 'staff', 'customer'])) return json({ ok: false, error: 'ROLE_DENIED' }, 403);
    const b = await readJson(request);
    const pointId = cleanText(b.photo_point_id, 120);
    const phase = cleanText(b.phase, 30);
    const allowedPhases = actor.role === 'customer' ? ['inquiry'] : ['survey', 'before', 'progress', 'after'];
    if (!db.photo_points.some(p => p.case_id === c.id && p.id === pointId) || !allowedPhases.includes(phase) || !validatePhotoUrl(b.url)) return json({ ok: false, error: 'PHOTO_VALIDATION_ERROR' }, 400);
    const row = { id: uuid(), tenant_id: actor.tenant_id, case_id: c.id, photo_point_id: pointId, phase, url: cleanText(b.url, 2000), caption: cleanText(b.caption, 240), shared_with_customer: actor.role === 'customer' ? true : Boolean(b.shared_with_customer), created_at: nowIso() };
    db.photos.push(row); audit(db, actor, 'photo_create', 'photo', row.id, { case_id: c.id, phase, photo_point_id: pointId });
    return json({ ok: true, photo: row }, 201);
  }

  if (tail === 'survey' && request.method === 'POST') {
    if (!requireRole(actor, ['owner', 'staff'])) return json({ ok: false, error: 'ROLE_DENIED' }, 403);
    const b = await readJson(request);
    const row = { id: uuid(), tenant_id: actor.tenant_id, case_id: c.id, staff_id: actor.user_id, summary: cleanText(b.summary, 2000), measurements: (b.measurements && typeof b.measurements === 'object') ? b.measurements : {}, created_at: nowIso() };
    db.surveys.push(row); audit(db, actor, 'survey_create', 'survey', row.id, { case_id: c.id });
    return json({ ok: true, survey: row }, 201);
  }

  if (tail === 'estimate' && request.method === 'POST') {
    if (!requireRole(actor, ['owner'])) return json({ ok: false, error: 'ROLE_DENIED' }, 403);
    const b = await readJson(request);
    const items = Array.isArray(b.items) ? b.items.slice(0, 50).map(x => ({ name: cleanText(x.name, 120), qty: Number(x.qty || 1), amount_yen: Math.max(0, Math.round(Number(x.amount_yen || 0))), evidence_photo_point_id: cleanText(x.evidence_photo_point_id || '', 120) || null })) : [];
    if (!items.length || items.some(x => !x.name || !Number.isFinite(x.amount_yen) || (x.evidence_photo_point_id && !db.photo_points.some(p => p.case_id === c.id && p.id === x.evidence_photo_point_id)))) return json({ ok: false, error: 'ESTIMATE_ITEMS_REQUIRED' }, 400);
    const existing = db.estimates.filter(e => e.case_id === c.id);
    const row = { id: uuid(), tenant_id: actor.tenant_id, case_id: c.id, version_no: existing.length ? Math.max(...existing.map(e => e.version_no)) + 1 : 1, status: 'draft', total_yen: items.reduce((a, x) => a + x.amount_yen, 0), items, customer_note: cleanText(b.customer_note, 1000), created_at: nowIso() };
    db.estimates.push(row); audit(db, actor, 'estimate_version_create', 'estimate', row.id, { version_no: row.version_no });
    return json({ ok: true, estimate: row }, 201);
  }

  const estimateRespond = tail.match(/^estimate\/([^/]+)\/respond$/);
  if (estimateRespond && request.method === 'POST') {
    if (!requireRole(actor, ['customer'])) return json({ ok: false, error: 'ROLE_DENIED' }, 403);
    const e = db.estimates.find(x => x.id === estimateRespond[1] && x.case_id === c.id);
    if (!e || !['sent'].includes(e.status)) return json({ ok: false, error: 'ESTIMATE_NOT_RESPONDABLE' }, 409);
    const b = await readJson(request); const decision = cleanText(b.decision, 20);
    if (!['accepted', 'returned'].includes(decision)) return json({ ok: false, error: 'DECISION_INVALID' }, 400);
    e.status = decision; e.response_note = cleanText(b.note, 600); e.responded_at = nowIso();
    audit(db, actor, 'estimate_respond', 'estimate', e.id, { decision });
    return json({ ok: true, estimate: e });
  }

  const estimateSend = tail.match(/^estimate\/([^/]+)\/send$/);
  if (estimateSend && request.method === 'POST') {
    if (!requireRole(actor, ['owner'])) return json({ ok: false, error: 'ROLE_DENIED' }, 403);
    const e = db.estimates.find(x => x.id === estimateSend[1] && x.case_id === c.id);
    if (!e || e.status !== 'draft') return json({ ok: false, error: 'ESTIMATE_NOT_SENDABLE' }, 409);
    e.status = 'sent'; e.sent_at = nowIso(); audit(db, actor, 'estimate_send', 'estimate', e.id);
    return json({ ok: true, estimate: e });
  }

  if (tail === 'schedule' && request.method === 'POST') {
    if (!requireRole(actor, ['owner'])) return json({ ok: false, error: 'ROLE_DENIED' }, 403);
    const b = await readJson(request);
    const start = cleanText(b.start_at, 80), end = cleanText(b.end_at, 80);
    if (!start || !end || Number.isNaN(Date.parse(start)) || Number.isNaN(Date.parse(end)) || Date.parse(end) <= Date.parse(start)) return json({ ok: false, error: 'SCHEDULE_TIME_INVALID' }, 400);
    const row = { id: uuid(), tenant_id: actor.tenant_id, case_id: c.id, type: cleanText(b.type || 'work', 30), start_at: start, end_at: end, status: 'confirmed', staff_ids: Array.isArray(b.staff_ids) ? b.staff_ids.slice(0, 20).map(x => cleanText(x, 100)) : [], created_at: nowIso() };
    db.schedule_events.push(row); c.assigned_staff_ids = [...new Set([...(c.assigned_staff_ids || []), ...row.staff_ids])];
    audit(db, actor, 'schedule_create', 'schedule_event', row.id, { case_id: c.id });
    return json({ ok: true, schedule: row }, 201);
  }

  if (tail === 'work-log' && request.method === 'POST') {
    if (!requireRole(actor, ['owner', 'staff'])) return json({ ok: false, error: 'ROLE_DENIED' }, 403);
    const b = await readJson(request);
    const progress = Math.max(0, Math.min(100, Math.round(Number(b.progress || 0))));
    const row = { id: uuid(), tenant_id: actor.tenant_id, case_id: c.id, staff_id: actor.user_id, progress, note: cleanText(b.note, 1500), created_at: nowIso() };
    db.work_logs.push(row); audit(db, actor, 'work_log_create', 'work_log', row.id, { progress });
    return json({ ok: true, work_log: row }, 201);
  }

  if (tail === 'completion/submit' && request.method === 'POST') {
    if (!requireRole(actor, ['owner', 'staff'])) return json({ ok: false, error: 'ROLE_DENIED' }, 403);
    const check = completionPhotoStatus(db, c.id);
    if (!check.ok) return json({ ok: false, error: 'REQUIRED_PHOTOS_MISSING', missing: check.missing }, 409);
    const approval = db.completion_approvals.find(a => a.case_id === c.id) || { id: uuid(), tenant_id: actor.tenant_id, case_id: c.id, status: 'draft' };
    approval.status = 'pending'; approval.requested_at = nowIso();
    if (!db.completion_approvals.some(a => a.id === approval.id)) db.completion_approvals.push(approval);
    const from = c.status; if (from === 'in_progress') c.status = 'completion_review'; c.updated_at = nowIso();
    audit(db, actor, 'completion_submit', 'completion_approval', approval.id, { case_id: c.id });
    return json({ ok: true, approval, case: publicCase(c) });
  }

  if (tail === 'completion/respond' && request.method === 'POST') {
    if (!requireRole(actor, ['customer'])) return json({ ok: false, error: 'ROLE_DENIED' }, 403);
    const approval = db.completion_approvals.find(a => a.case_id === c.id);
    if (!approval || !['pending'].includes(approval.status)) return json({ ok: false, error: 'COMPLETION_NOT_RESPONDABLE' }, 409);
    const b = await readJson(request); const decision = cleanText(b.decision, 20);
    if (!['approved', 'returned'].includes(decision)) return json({ ok: false, error: 'DECISION_INVALID' }, 400);
    approval.status = decision; approval.responded_at = nowIso(); approval.response_note = cleanText(b.note, 1000);
    if (decision === 'approved') { c.status = 'completed'; c.next_action = '季節アフター候補を確認'; c.updated_at = nowIso(); }
    audit(db, actor, 'completion_respond', 'completion_approval', approval.id, { decision });
    return json({ ok: true, approval, case: publicCase(c) });
  }

  if (tail === 'followup' && request.method === 'POST') {
    if (!requireRole(actor, ['owner'])) return json({ ok: false, error: 'ROLE_DENIED' }, 403);
    const b = await readJson(request);
    const row = { id: uuid(), tenant_id: actor.tenant_id, case_id: c.id, category: cleanText(b.category || 'seasonal_check', 60), candidate_date: cleanText(b.candidate_date, 20), status: 'candidate', owner_approved: false, note: cleanText(b.note, 500) };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.candidate_date)) return json({ ok: false, error: 'FOLLOWUP_DATE_INVALID' }, 400);
    db.followups.push(row); audit(db, actor, 'followup_candidate_create', 'followup', row.id);
    return json({ ok: true, followup: row }, 201);
  }

  if (tail === 'delete' && request.method === 'POST') {
    if (!requireRole(actor, ['owner'])) return json({ ok: false, error: 'ROLE_DENIED' }, 403);
    const b = await readJson(request);
    if (cleanText(b.confirm, 40) !== `DELETE:${c.id}`) return json({ ok: false, error: 'DESTRUCTIVE_CONFIRM_REQUIRED' }, 409);
    c.deleted_at = nowIso(); c.deleted_by = actor.user_id; audit(db, actor, 'case_soft_delete', 'case', c.id);
    return json({ ok: true, deleted: 'soft', case_id: c.id });
  }

  return null;
}

async function supabaseFetch(env, table, query = '', init = {}) {
  if (!env.SUPABASE_URL || !(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY)) throw new Error('SUPABASE_NOT_CONFIGURED');
  const url = `${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${table}${query}`;
  const method = String(init.method || 'GET').toUpperCase();
  const schema = String(env.SUPABASE_SCHEMA || 'dpro_landscape_exterior').trim();
  const headers = {
    apikey: (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY),
    authorization: `Bearer ${(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY)}`,
    'content-type': 'application/json',
    prefer: 'return=representation',
    ...(method === 'GET' || method === 'HEAD' ? { 'accept-profile': schema } : { 'content-profile': schema }),
    ...(init.headers || {}),
  };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, { ...init, headers, signal: ctrl.signal });
    const text = await r.text();
    let body = null; try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
    if (!r.ok) throw new Error(`SUPABASE_${r.status}:${JSON.stringify(body)}`);
    return body;
  } finally { clearTimeout(t); }
}

function encPath(path) {
  return String(path || '').split('/').filter(Boolean).map(encodeURIComponent).join('/');
}

function serverSecret(env) {
  return env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '';
}

async function storageFetch(env, path, init = {}) {
  if (!env.SUPABASE_URL || !serverSecret(env)) throw new Error('SUPABASE_NOT_CONFIGURED');
  const url = `${String(env.SUPABASE_URL).replace(/\/$/, '')}/storage/v1/${path}`;
  const headers = {
    apikey: serverSecret(env),
    authorization: `Bearer ${serverSecret(env)}`,
    ...(init.headers || {}),
  };
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(url, { ...init, headers, signal: ctrl.signal });
    const type = r.headers.get('content-type') || '';
    const body = type.includes('application/json') ? await r.json().catch(()=>null) : await r.text().catch(()=>null);
    if (!r.ok) throw new Error(`STORAGE_${r.status}:${JSON.stringify(body)}`);
    return body;
  } finally { clearTimeout(t); }
}

async function storageSignedUpload(env, storagePath) {
  const bucket = cleanText(env.PHOTO_BUCKET || 'dpro-landscape-exterior-private', 120);
  const base = `${String(env.SUPABASE_URL).replace(/\/$/, '')}/storage/v1`;
  const data = await storageFetch(env, `object/upload/sign/${encodeURIComponent(bucket)}/${encPath(storagePath)}`, {
    method: 'POST', headers: { 'content-type':'application/json', 'x-upsert':'false' }, body: '{}'
  });
  if (!data?.url) throw new Error('STORAGE_SIGN_UPLOAD_INVALID');
  return { signed_url: new URL(data.url, base + '/').toString(), token: new URL(data.url, base + '/').searchParams.get('token') || null };
}

async function storageSignedDownload(env, storagePath, expiresIn = 900) {
  if (!storagePath) return null;
  const bucket = cleanText(env.PHOTO_BUCKET || 'dpro-landscape-exterior-private', 120);
  const base = `${String(env.SUPABASE_URL).replace(/\/$/, '')}/storage/v1`;
  const data = await storageFetch(env, `object/sign/${encodeURIComponent(bucket)}/${encPath(storagePath)}`, {
    method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ expiresIn })
  });
  if (!data?.signedURL) return null;
  return new URL(data.signedURL, base + '/').toString();
}

async function storageUploadBinary(env, storagePath, bytes, contentType) {
  const bucket = cleanText(env.PHOTO_BUCKET || 'dpro-landscape-exterior-private', 120);
  return storageFetch(env, `object/${encodeURIComponent(bucket)}/${encPath(storagePath)}`, {
    method:'POST', headers:{'content-type':contentType, 'cache-control':'max-age=3600', 'x-upsert':'false'}, body:bytes
  });
}

async function auditProduction(env, actor, action, entityType, entityId, detail = {}) {
  if (!actor?.tenant_id) return;
  await supabaseFetch(env, 'landscape_audit_events', '', { method:'POST', body:JSON.stringify([{
    tenant_id:actor.tenant_id, actor_id:actor.user_id || null, actor_role:actor.role || 'unknown', action,
    entity_type:entityType, entity_id:String(entityId || ''), detail
  }]) });
}

async function getProductionCase(env, actor, caseId) {
  const rows = await supabaseFetch(env, 'landscape_cases', `?id=eq.${encodeURIComponent(caseId)}&tenant_id=eq.${encodeURIComponent(actor.tenant_id)}&deleted_at=is.null&limit=1`);
  const c = rows?.[0];
  if (!c) return { error: json({ ok:false, error:'CASE_NOT_FOUND' },404) };
  if (!canAccessCase(actor, c)) return { error: json({ ok:false, error:'CASE_SCOPE_DENIED' },403) };
  return { case: c };
}

async function productionCaseView(env, c, actor) {
  const q = encodeURIComponent(c.id);
  const [sites, points, photosRaw, surveys, estimatesRaw, schedule, workLogs, completionRows, followups] = await Promise.all([
    supabaseFetch(env,'landscape_sites',`?id=eq.${encodeURIComponent(c.site_id)}&tenant_id=eq.${encodeURIComponent(actor.tenant_id)}&limit=1`),
    supabaseFetch(env,'landscape_photo_points',`?case_id=eq.${q}&tenant_id=eq.${encodeURIComponent(actor.tenant_id)}&order=sort_order.asc`),
    supabaseFetch(env,'landscape_photos',`?case_id=eq.${q}&tenant_id=eq.${encodeURIComponent(actor.tenant_id)}&deleted_at=is.null&order=created_at.asc&limit=200`),
    supabaseFetch(env,'landscape_surveys',`?case_id=eq.${q}&tenant_id=eq.${encodeURIComponent(actor.tenant_id)}&order=created_at.asc`),
    supabaseFetch(env,'landscape_estimates',`?case_id=eq.${q}&tenant_id=eq.${encodeURIComponent(actor.tenant_id)}&order=version_no.asc`),
    supabaseFetch(env,'landscape_schedule_events',`?case_id=eq.${q}&tenant_id=eq.${encodeURIComponent(actor.tenant_id)}&order=start_at.asc`),
    supabaseFetch(env,'landscape_work_logs',`?case_id=eq.${q}&tenant_id=eq.${encodeURIComponent(actor.tenant_id)}&order=created_at.asc`),
    supabaseFetch(env,'landscape_completion_approvals',`?case_id=eq.${q}&tenant_id=eq.${encodeURIComponent(actor.tenant_id)}&limit=1`),
    actor.role === 'staff' ? Promise.resolve([]) : supabaseFetch(env,'landscape_followups',`?case_id=eq.${q}&tenant_id=eq.${encodeURIComponent(actor.tenant_id)}&order=candidate_date.asc`),
  ]);
  const visiblePhotos = (photosRaw || []).filter(p => actor.role !== 'customer' || p.shared_with_customer);
  const photos = await Promise.all(visiblePhotos.map(async p => ({ ...p, url: await storageSignedDownload(env, p.storage_path, 900) })));
  let estimates = estimatesRaw || [];
  if (actor.role === 'staff') estimates = estimates.map(e => ({id:e.id,version_no:e.version_no,status:e.status}));
  else if (estimates.length) {
    const ids = estimates.map(e=>e.id).filter(Boolean);
    const items = ids.length ? await supabaseFetch(env,'landscape_estimate_items',`?estimate_id=in.(${ids.map(encodeURIComponent).join(',')})&tenant_id=eq.${encodeURIComponent(actor.tenant_id)}&order=sort_order.asc`) : [];
    estimates = estimates.map(e => ({...e,items:(items||[]).filter(i=>i.estimate_id===e.id).map(i=>({name:i.item_name,qty:i.qty,unit:i.unit,amount_yen:i.amount_yen,evidence_photo_point_id:i.evidence_photo_point_id}))}));
  }
  return {
    ...publicCase(c), customer_request:c.customer_request, site:sites?.[0] || null, photo_points:points || [], photos,
    surveys: actor.role === 'customer' ? [] : (surveys || []), estimates, schedule:schedule || [], work_logs:workLogs || [],
    completion:completionRows?.[0] || null, followups:followups || []
  };
}

async function productionCompletionStatus(env, c, actor) {
  const q=encodeURIComponent(c.id);
  const [points,photos] = await Promise.all([
    supabaseFetch(env,'landscape_photo_points',`?case_id=eq.${q}&tenant_id=eq.${encodeURIComponent(actor.tenant_id)}`),
    supabaseFetch(env,'landscape_photos',`?case_id=eq.${q}&tenant_id=eq.${encodeURIComponent(actor.tenant_id)}&deleted_at=is.null&select=photo_point_id,phase`)
  ]);
  const missing=[];
  for(const p of points||[]){
    if(p.required_before && !(photos||[]).some(x=>x.photo_point_id===p.id&&x.phase==='before')) missing.push(`${p.name}:before`);
    if(p.required_after && !(photos||[]).some(x=>x.photo_point_id===p.id&&x.phase==='after')) missing.push(`${p.name}:after`);
  }
  return {ok:missing.length===0,missing};
}

async function customerLineRef(env, tenantId, customerId) {
  if (!customerId) return null;
  const rows=await supabaseFetch(env,'landscape_customers',`?id=eq.${encodeURIComponent(customerId)}&tenant_id=eq.${encodeURIComponent(tenantId)}&deleted_at=is.null&select=line_user_id&limit=1`);
  return rows?.[0]?.line_user_id || null;
}

async function queueLineNotification(env, actor, c, eventKey, text) {
  const ref=await customerLineRef(env,actor.tenant_id,c.customer_id);
  if(!ref) return {queued:false,reason:'NO_LINE_USER'};
  try {
    const rows=await supabaseFetch(env,'landscape_notifications','?on_conflict=tenant_id,event_key',{method:'POST',headers:{prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify([{
      tenant_id:actor.tenant_id,case_id:c.id,channel:'line',event_key:eventKey,status:'queued',recipient_ref:ref,payload:{type:'text',text:cleanText(text,1000)}
    }])});
    return {queued:Boolean(rows?.length)};
  } catch { return {queued:false,reason:'QUEUE_FAILED'}; }
}

function mimeExt(mime) {
  return ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'})[String(mime||'').toLowerCase()] || null;
}

async function sendLinePush(env, recipient, text) {
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) throw new Error('LINE_NOT_CONFIGURED');
  const r=await fetch('https://api.line.me/v2/bot/message/push',{method:'POST',headers:{authorization:`Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,'content-type':'application/json'},body:JSON.stringify({to:recipient,messages:[{type:'text',text:cleanText(text,1000)}]})});
  if(!r.ok) throw new Error(`LINE_${r.status}`);
  return r.headers.get('x-line-request-id') || null;
}

async function processNotifications(env, actor) {
  if(!requireRole(actor,['owner','dpro_admin'])) return json({ok:false,error:'ROLE_DENIED'},403);
  const rows=await supabaseFetch(env,'landscape_notifications',`?tenant_id=eq.${encodeURIComponent(actor.tenant_id)}&channel=eq.line&status=eq.queued&order=created_at.asc&limit=10`);
  const results=[];
  for(const n of rows||[]){
    await supabaseFetch(env,'landscape_notifications',`?id=eq.${encodeURIComponent(n.id)}&tenant_id=eq.${encodeURIComponent(actor.tenant_id)}`,{method:'PATCH',body:JSON.stringify({status:'sending',attempt_count:Number(n.attempt_count||0)+1,updated_at:nowIso()})});
    try{
      const providerId=await sendLinePush(env,n.recipient_ref,n.payload?.text||'DPROからのお知らせです。');
      await supabaseFetch(env,'landscape_notifications',`?id=eq.${encodeURIComponent(n.id)}`,{method:'PATCH',body:JSON.stringify({status:'sent',provider_message_id:providerId,updated_at:nowIso(),last_error:null})});
      results.push({id:n.id,status:'sent'});
    }catch(e){
      await supabaseFetch(env,'landscape_notifications',`?id=eq.${encodeURIComponent(n.id)}`,{method:'PATCH',body:JSON.stringify({status:'failed',updated_at:nowIso(),last_error:cleanText(e.message,500)})});
      results.push({id:n.id,status:'failed'});
    }
  }
  return json({ok:true,processed:results});
}

async function verifyLineSignature(raw, signature, secret) {
  if(!raw || !signature || !secret) return false;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const sig=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(raw)));
  let bin=''; for(const b of sig) bin+=String.fromCharCode(b);
  return btoa(bin)===signature;
}

async function downloadLineImage(env,messageId) {
  if(!env.LINE_CHANNEL_ACCESS_TOKEN) throw new Error('LINE_NOT_CONFIGURED');
  const r=await fetch(`https://api-data.line.me/v2/bot/message/${encodeURIComponent(messageId)}/content`,{headers:{authorization:`Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`}});
  if(!r.ok) throw new Error(`LINE_CONTENT_${r.status}`);
  const mime=(r.headers.get('content-type')||'').split(';')[0].toLowerCase(); const ext=mimeExt(mime);
  if(!ext) throw new Error('LINE_IMAGE_TYPE_DENIED');
  const bytes=await r.arrayBuffer(); if(bytes.byteLength>12582912) throw new Error('LINE_IMAGE_TOO_LARGE');
  return {bytes,mime,ext};
}

async function handleLineWebhook(request, env) {
  if(isDemoEnv(env)) return json({ok:false,error:'LINE_WEBHOOK_DISABLED_IN_DEMO'},403);
  if(!env.LINE_CHANNEL_SECRET || !env.PUBLIC_TENANT_ID) return json({ok:false,error:'LINE_NOT_CONFIGURED'},503);
  const raw=await request.text(); const sig=request.headers.get('x-line-signature')||'';
  if(!await verifyLineSignature(raw,sig,env.LINE_CHANNEL_SECRET)) return json({ok:false,error:'LINE_SIGNATURE_INVALID'},401);
  const body=JSON.parse(raw); const events=Array.isArray(body.events)?body.events:[]; const tenantId=cleanText(env.PUBLIC_TENANT_ID,100); const out=[];
  for(const ev of events){
    const eventId=cleanText(ev.webhookEventId||'',200); if(!eventId){out.push({status:'ignored'});continue}
    const prior=await supabaseFetch(env,'landscape_integration_events',`?provider=eq.line&external_event_id=eq.${encodeURIComponent(eventId)}&select=id,status&limit=1`);
    if(prior?.[0]?.status==='processed'){out.push({event_id:eventId,status:'duplicate'});continue}
    if(!prior?.length) await supabaseFetch(env,'landscape_integration_events','',{method:'POST',body:JSON.stringify([{tenant_id:tenantId,provider:'line',external_event_id:eventId,event_type:cleanText(ev.type||'unknown',80),status:'received',detail:{message_type:ev.message?.type||null}}])});
    try{
      if(ev.type==='message' && ['text','image'].includes(ev.message?.type)){
        let message=ev.message.type==='text'?cleanText(ev.message.text,1000):'LINEから画像相談を受信しました。'; let attachmentPaths=[];
        if(ev.message.type==='image'){
          const img=await downloadLineImage(env,ev.message.id); const path=`${tenantId}/inquiries/${eventId}/${cleanText(ev.message.id,120)}.${img.ext}`;
          await storageUploadBinary(env,path,img.bytes,img.mime); attachmentPaths=[path];
        }
        await supabaseFetch(env,'landscape_inquiries','',{method:'POST',body:JSON.stringify([{tenant_id:tenantId,case_id:null,source:'line',contact_name:null,phone_normalized:null,external_user_ref:cleanText(ev.source?.userId||ev.source?.groupId||'',200)||null,message,attachment_paths:attachmentPaths}])});
      }
      await supabaseFetch(env,'landscape_integration_events',`?provider=eq.line&external_event_id=eq.${encodeURIComponent(eventId)}`,{method:'PATCH',body:JSON.stringify({status:'processed',processed_at:nowIso()})}); out.push({event_id:eventId,status:'processed'});
    }catch(e){
      await supabaseFetch(env,'landscape_integration_events',`?provider=eq.line&external_event_id=eq.${encodeURIComponent(eventId)}`,{method:'PATCH',body:JSON.stringify({status:'failed',processed_at:nowIso(),detail:{error:cleanText(e.message,500),message_type:ev.message?.type||null}})}); out.push({event_id:eventId,status:'failed'});
    }
  }
  return json({ok:true,events:out});
}

async function handleProduction(request, env, pathname, actor) {
  if (isMutation(request.method) && !requireProductionWrite(env)) return json({ ok: false, error: 'PRODUCTION_WRITE_GUARD', message: 'PRODUCTION_WRITE_ENABLED=true is required for mutations.' }, 423);

  if(pathname===`${API_BASE}/notifications/process` && request.method==='POST') return processNotifications(env,actor);

  if (pathname === `${API_BASE}/cases` && request.method === 'GET') {
    let query = `?tenant_id=eq.${encodeURIComponent(actor.tenant_id)}&deleted_at=is.null&select=id,tenant_id,customer_id,site_id,title,category,status,desired_timing,next_action,assigned_staff_ids,updated_at&order=updated_at.desc`;
    if (actor.role === 'customer') query += `&customer_id=eq.${encodeURIComponent(actor.customer_id || '')}`;
    const rows = await supabaseFetch(env, 'landscape_cases', query);
    const filtered = actor.role === 'staff' ? (rows||[]).filter(c => canAccessCase(actor, c)) : (rows||[]);
    return json({ ok: true, cases: filtered.map(publicCase) });
  }

  if(pathname===`${API_BASE}/cases` && request.method==='POST'){
    if(!requireRole(actor,['owner'])) return json({ok:false,error:'ROLE_DENIED'},403);
    const b=await readJson(request); const customerId=cleanText(b.customer_id,100),siteId=cleanText(b.site_id,100);
    const pair=await supabaseFetch(env,'landscape_sites',`?id=eq.${encodeURIComponent(siteId)}&customer_id=eq.${encodeURIComponent(customerId)}&tenant_id=eq.${encodeURIComponent(actor.tenant_id)}&deleted_at=is.null&select=id&limit=1`);
    if(!pair?.length) return json({ok:false,error:'CUSTOMER_SITE_MISMATCH'},400);
    const title=cleanText(b.title,120); if(!title) return json({ok:false,error:'TITLE_REQUIRED'},400);
    const rows=await supabaseFetch(env,'landscape_cases','',{method:'POST',body:JSON.stringify([{tenant_id:actor.tenant_id,customer_id:customerId,site_id:siteId,title,category:cleanText(b.category,80)||'外構',status:'inquiry',desired_timing:cleanText(b.desired_timing,80),customer_request:cleanText(b.customer_request,1000),assigned_staff_ids:[],next_action:'現調候補を設定'}])});
    const c=rows?.[0]; await auditProduction(env,actor,'case_create','case',c?.id,{}); return json({ok:true,case:publicCase(c)},201);
  }

  const caseMatch = pathname.match(new RegExp(`^${API_BASE}/cases/([^/]+)(?:/(.*))?$`));
  if(!caseMatch) return json({ok:false,error:'NOT_FOUND'},404);
  const caseId=decodeURIComponent(caseMatch[1]); const tail=caseMatch[2]||''; const loaded=await getProductionCase(env,actor,caseId); if(loaded.error) return loaded.error; const c=loaded.case;
  if(!tail && request.method==='GET') return json({ok:true,case:await productionCaseView(env,c,actor)});

  if(tail==='transition'&&request.method==='POST'){
    if(!requireRole(actor,['owner','staff'])) return json({ok:false,error:'ROLE_DENIED'},403); const b=await readJson(request); const to=cleanText(b.to,60);
    if(!validateCaseTransition(c.status,to)) return json({ok:false,error:'INVALID_TRANSITION',from:c.status,to,allowed:CASE_TRANSITIONS[c.status]||[]},409);
    if(actor.role==='staff'&&!['surveyed','in_progress','completion_review'].includes(to)) return json({ok:false,error:'STAFF_TRANSITION_DENIED'},403);
    const rows=await supabaseFetch(env,'landscape_cases',`?id=eq.${encodeURIComponent(c.id)}&tenant_id=eq.${encodeURIComponent(actor.tenant_id)}&status=eq.${encodeURIComponent(c.status)}`,{method:'PATCH',body:JSON.stringify({status:to,next_action:cleanText(b.next_action||'',160),updated_at:nowIso()})});
    if(!rows?.length) return json({ok:false,error:'STATE_CONFLICT'},409); await auditProduction(env,actor,'case_transition','case',c.id,{from:c.status,to}); return json({ok:true,case:publicCase(rows[0])});
  }

  if(tail==='photos/sign-upload'&&request.method==='POST'){
    if(!requireRole(actor,['owner','staff','customer'])) return json({ok:false,error:'ROLE_DENIED'},403); const b=await readJson(request); const pointId=cleanText(b.photo_point_id,120),phase=cleanText(b.phase,30),ext=mimeExt(b.mime_type);
    const allowed=actor.role==='customer'?['inquiry']:['survey','before','progress','after']; if(!ext||!allowed.includes(phase)) return json({ok:false,error:'PHOTO_VALIDATION_ERROR'},400);
    const points=await supabaseFetch(env,'landscape_photo_points',`?id=eq.${encodeURIComponent(pointId)}&case_id=eq.${encodeURIComponent(c.id)}&tenant_id=eq.${encodeURIComponent(actor.tenant_id)}&select=id&limit=1`); if(!points?.length)return json({ok:false,error:'PHOTO_POINT_NOT_FOUND'},404);
    const storagePath=`${actor.tenant_id}/cases/${c.id}/${pointId}/${phase}/${uuid()}.${ext}`; const signed=await storageSignedUpload(env,storagePath); return json({ok:true,storage_path:storagePath,mime_type:String(b.mime_type).toLowerCase(),expires_in:7200,...signed});
  }

  if(tail==='photos'&&request.method==='POST'){
    if(!requireRole(actor,['owner','staff','customer'])) return json({ok:false,error:'ROLE_DENIED'},403); const b=await readJson(request); const pointId=cleanText(b.photo_point_id,120),phase=cleanText(b.phase,30),storagePath=cleanText(b.storage_path,1200);
    const allowed=actor.role==='customer'?['inquiry']:['survey','before','progress','after']; const prefix=`${actor.tenant_id}/cases/${c.id}/${pointId}/${phase}/`;
    if(!allowed.includes(phase)||!storagePath.startsWith(prefix)) return json({ok:false,error:'PHOTO_VALIDATION_ERROR'},400);
    const points=await supabaseFetch(env,'landscape_photo_points',`?id=eq.${encodeURIComponent(pointId)}&case_id=eq.${encodeURIComponent(c.id)}&tenant_id=eq.${encodeURIComponent(actor.tenant_id)}&select=id&limit=1`); if(!points?.length)return json({ok:false,error:'PHOTO_POINT_NOT_FOUND'},404);
    const rows=await supabaseFetch(env,'landscape_photos','',{method:'POST',body:JSON.stringify([{tenant_id:actor.tenant_id,case_id:c.id,photo_point_id:pointId,phase,storage_path:storagePath,caption:cleanText(b.caption,240),shared_with_customer:actor.role==='customer'?true:Boolean(b.shared_with_customer),created_by:actor.user_id}])});
    const row=rows?.[0]; await auditProduction(env,actor,'photo_create','photo',row?.id,{case_id:c.id,phase,photo_point_id:pointId}); return json({ok:true,photo:{...row,url:await storageSignedDownload(env,storagePath,900)}},201);
  }

  if(tail==='survey'&&request.method==='POST'){
    if(!requireRole(actor,['owner','staff'])) return json({ok:false,error:'ROLE_DENIED'},403); const b=await readJson(request); const rows=await supabaseFetch(env,'landscape_surveys','',{method:'POST',body:JSON.stringify([{tenant_id:actor.tenant_id,case_id:c.id,staff_id:actor.user_id,summary:cleanText(b.summary,2000),measurements:(b.measurements&&typeof b.measurements==='object'&&!Array.isArray(b.measurements))?b.measurements:{}}])}); const row=rows?.[0]; await auditProduction(env,actor,'survey_create','survey',row?.id,{case_id:c.id}); return json({ok:true,survey:row},201);
  }

  if(tail==='estimate'&&request.method==='POST'){
    if(!requireRole(actor,['owner'])) return json({ok:false,error:'ROLE_DENIED'},403); const b=await readJson(request); const items=Array.isArray(b.items)?b.items.slice(0,50).map((x,i)=>({name:cleanText(x.name,120),qty:Number(x.qty||1),unit:cleanText(x.unit||'',30)||null,amount_yen:Math.max(0,Math.round(Number(x.amount_yen||0))),evidence_photo_point_id:cleanText(x.evidence_photo_point_id||'',120)||null,sort_order:i})):[];
    if(!items.length||items.some(x=>!x.name||!Number.isFinite(x.amount_yen))) return json({ok:false,error:'ESTIMATE_ITEMS_REQUIRED'},400);
    for(const x of items.filter(x=>x.evidence_photo_point_id)){const pp=await supabaseFetch(env,'landscape_photo_points',`?id=eq.${encodeURIComponent(x.evidence_photo_point_id)}&case_id=eq.${encodeURIComponent(c.id)}&tenant_id=eq.${encodeURIComponent(actor.tenant_id)}&select=id&limit=1`);if(!pp?.length)return json({ok:false,error:'ESTIMATE_EVIDENCE_POINT_INVALID'},400)}
    const existing=await supabaseFetch(env,'landscape_estimates',`?case_id=eq.${encodeURIComponent(c.id)}&tenant_id=eq.${encodeURIComponent(actor.tenant_id)}&select=version_no&order=version_no.desc&limit=1`); const version=(existing?.[0]?.version_no||0)+1;
    const erows=await supabaseFetch(env,'landscape_estimates','',{method:'POST',body:JSON.stringify([{tenant_id:actor.tenant_id,case_id:c.id,version_no:version,status:'draft',total_yen:items.reduce((a,x)=>a+x.amount_yen,0),customer_note:cleanText(b.customer_note,1000)}])}); const e=erows?.[0];
    try{await supabaseFetch(env,'landscape_estimate_items','',{method:'POST',body:JSON.stringify(items.map(x=>({tenant_id:actor.tenant_id,estimate_id:e.id,item_name:x.name,qty:x.qty,unit:x.unit,amount_yen:x.amount_yen,evidence_photo_point_id:x.evidence_photo_point_id,sort_order:x.sort_order})))})}catch(err){await supabaseFetch(env,'landscape_estimates',`?id=eq.${encodeURIComponent(e.id)}`,{method:'DELETE'}).catch(()=>{});throw err}
    await auditProduction(env,actor,'estimate_version_create','estimate',e.id,{version_no:version}); return json({ok:true,estimate:{...e,items}},201);
  }

  const estimateSend=tail.match(/^estimate\/([^/]+)\/send$/); if(estimateSend&&request.method==='POST'){
    if(!requireRole(actor,['owner'])) return json({ok:false,error:'ROLE_DENIED'},403); const rows=await supabaseFetch(env,'landscape_estimates',`?id=eq.${encodeURIComponent(estimateSend[1])}&case_id=eq.${encodeURIComponent(c.id)}&tenant_id=eq.${encodeURIComponent(actor.tenant_id)}&status=eq.draft`,{method:'PATCH',body:JSON.stringify({status:'sent',sent_at:nowIso()})}); if(!rows?.length)return json({ok:false,error:'ESTIMATE_NOT_SENDABLE'},409); await auditProduction(env,actor,'estimate_send','estimate',rows[0].id,{}); const notification=await queueLineNotification(env,actor,c,`estimate_sent:${rows[0].id}`,`「${c.title}」のお見積りをご確認ください。`); return json({ok:true,estimate:rows[0],notification});
  }

  const estimateRespond=tail.match(/^estimate\/([^/]+)\/respond$/); if(estimateRespond&&request.method==='POST'){
    if(!requireRole(actor,['customer']))return json({ok:false,error:'ROLE_DENIED'},403); const b=await readJson(request),decision=cleanText(b.decision,20); if(!['accepted','returned'].includes(decision))return json({ok:false,error:'DECISION_INVALID'},400); const rows=await supabaseFetch(env,'landscape_estimates',`?id=eq.${encodeURIComponent(estimateRespond[1])}&case_id=eq.${encodeURIComponent(c.id)}&tenant_id=eq.${encodeURIComponent(actor.tenant_id)}&status=eq.sent`,{method:'PATCH',body:JSON.stringify({status:decision,response_note:cleanText(b.note,600),responded_at:nowIso()})}); if(!rows?.length)return json({ok:false,error:'ESTIMATE_NOT_RESPONDABLE'},409); await auditProduction(env,actor,'estimate_respond','estimate',rows[0].id,{decision}); return json({ok:true,estimate:rows[0]});
  }

  if(tail==='schedule'&&request.method==='POST'){
    if(!requireRole(actor,['owner']))return json({ok:false,error:'ROLE_DENIED'},403); const b=await readJson(request),start=cleanText(b.start_at,80),end=cleanText(b.end_at,80); if(!start||!end||Number.isNaN(Date.parse(start))||Number.isNaN(Date.parse(end))||Date.parse(end)<=Date.parse(start))return json({ok:false,error:'SCHEDULE_TIME_INVALID'},400); const staff=Array.isArray(b.staff_ids)?b.staff_ids.slice(0,20).map(x=>cleanText(x,100)).filter(Boolean):[]; const rows=await supabaseFetch(env,'landscape_schedule_events','',{method:'POST',body:JSON.stringify([{tenant_id:actor.tenant_id,case_id:c.id,type:cleanText(b.type||'work',30),start_at:start,end_at:end,status:'confirmed',staff_ids:staff}])}); const assigned=[...new Set([...(Array.isArray(c.assigned_staff_ids)?c.assigned_staff_ids:[]),...staff])]; await supabaseFetch(env,'landscape_cases',`?id=eq.${encodeURIComponent(c.id)}`,{method:'PATCH',body:JSON.stringify({assigned_staff_ids:assigned,updated_at:nowIso()})}); await auditProduction(env,actor,'schedule_create','schedule_event',rows?.[0]?.id,{case_id:c.id}); return json({ok:true,schedule:rows?.[0]},201);
  }

  if(tail==='work-log'&&request.method==='POST'){
    if(!requireRole(actor,['owner','staff']))return json({ok:false,error:'ROLE_DENIED'},403); const b=await readJson(request),progress=Math.max(0,Math.min(100,Math.round(Number(b.progress||0)))); const rows=await supabaseFetch(env,'landscape_work_logs','',{method:'POST',body:JSON.stringify([{tenant_id:actor.tenant_id,case_id:c.id,staff_id:actor.user_id,progress,note:cleanText(b.note,1500)}])}); await auditProduction(env,actor,'work_log_create','work_log',rows?.[0]?.id,{progress}); return json({ok:true,work_log:rows?.[0]},201);
  }

  if(tail==='completion/submit'&&request.method==='POST'){
    if(!requireRole(actor,['owner','staff']))return json({ok:false,error:'ROLE_DENIED'},403); const check=await productionCompletionStatus(env,c,actor); if(!check.ok)return json({ok:false,error:'REQUIRED_PHOTOS_MISSING',missing:check.missing},409); const rows=await supabaseFetch(env,'landscape_completion_approvals','?on_conflict=case_id',{method:'POST',headers:{prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify([{tenant_id:actor.tenant_id,case_id:c.id,status:'pending',requested_at:nowIso()}])}); let caseRow=c; if(c.status==='in_progress'){const cr=await supabaseFetch(env,'landscape_cases',`?id=eq.${encodeURIComponent(c.id)}&status=eq.in_progress`,{method:'PATCH',body:JSON.stringify({status:'completion_review',updated_at:nowIso()})});caseRow=cr?.[0]||c} await auditProduction(env,actor,'completion_submit','completion_approval',rows?.[0]?.id,{case_id:c.id}); const notification=await queueLineNotification(env,actor,c,`completion_pending:${c.id}`,`「${c.title}」の施工後写真と完了内容をご確認ください。`); return json({ok:true,approval:rows?.[0],case:publicCase(caseRow),notification});
  }

  if(tail==='completion/respond'&&request.method==='POST'){
    if(!requireRole(actor,['customer']))return json({ok:false,error:'ROLE_DENIED'},403); const b=await readJson(request),decision=cleanText(b.decision,20);if(!['approved','returned'].includes(decision))return json({ok:false,error:'DECISION_INVALID'},400);const rows=await supabaseFetch(env,'landscape_completion_approvals',`?case_id=eq.${encodeURIComponent(c.id)}&tenant_id=eq.${encodeURIComponent(actor.tenant_id)}&status=eq.pending`,{method:'PATCH',body:JSON.stringify({status:decision,responded_at:nowIso(),response_note:cleanText(b.note,1000)})});if(!rows?.length)return json({ok:false,error:'COMPLETION_NOT_RESPONDABLE'},409);let caseRow=c;if(decision==='approved'){const cr=await supabaseFetch(env,'landscape_cases',`?id=eq.${encodeURIComponent(c.id)}`,{method:'PATCH',body:JSON.stringify({status:'completed',next_action:'季節アフター候補を確認',updated_at:nowIso()})});caseRow=cr?.[0]||c}await auditProduction(env,actor,'completion_respond','completion_approval',rows[0].id,{decision});return json({ok:true,approval:rows[0],case:publicCase(caseRow)});
  }

  if(tail==='followup'&&request.method==='POST'){
    if(!requireRole(actor,['owner']))return json({ok:false,error:'ROLE_DENIED'},403);const b=await readJson(request),date=cleanText(b.candidate_date,20);if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return json({ok:false,error:'FOLLOWUP_DATE_INVALID'},400);const rows=await supabaseFetch(env,'landscape_followups','',{method:'POST',body:JSON.stringify([{tenant_id:actor.tenant_id,case_id:c.id,category:cleanText(b.category||'seasonal_check',60),candidate_date:date,status:'candidate',owner_approved:false,note:cleanText(b.note,500)}])});await auditProduction(env,actor,'followup_candidate_create','followup',rows?.[0]?.id,{});return json({ok:true,followup:rows?.[0]},201);
  }

  const followApprove=tail.match(/^followup\/([^/]+)\/approve$/);if(followApprove&&request.method==='POST'){
    if(!requireRole(actor,['owner']))return json({ok:false,error:'ROLE_DENIED'},403);const rows=await supabaseFetch(env,'landscape_followups',`?id=eq.${encodeURIComponent(followApprove[1])}&case_id=eq.${encodeURIComponent(c.id)}&tenant_id=eq.${encodeURIComponent(actor.tenant_id)}&status=eq.candidate`,{method:'PATCH',body:JSON.stringify({status:'approved',owner_approved:true})});if(!rows?.length)return json({ok:false,error:'FOLLOWUP_NOT_APPROVABLE'},409);await auditProduction(env,actor,'followup_approve','followup',rows[0].id,{});const notification=await queueLineNotification(env,actor,c,`followup_approved:${rows[0].id}`,`「${c.title}」の次回点検候補日（${rows[0].candidate_date}）をご案内します。`);return json({ok:true,followup:rows[0],notification});
  }

  if(tail==='delete'&&request.method==='POST'){
    if(!requireRole(actor,['owner']))return json({ok:false,error:'ROLE_DENIED'},403);const b=await readJson(request);if(cleanText(b.confirm,80)!==`DELETE:${c.id}`)return json({ok:false,error:'DESTRUCTIVE_CONFIRM_REQUIRED'},409);const rows=await supabaseFetch(env,'landscape_cases',`?id=eq.${encodeURIComponent(c.id)}&tenant_id=eq.${encodeURIComponent(actor.tenant_id)}&deleted_at=is.null`,{method:'PATCH',body:JSON.stringify({deleted_at:nowIso(),deleted_by:actor.user_id,updated_at:nowIso()})});await auditProduction(env,actor,'case_soft_delete','case',c.id,{});return json({ok:true,deleted:'soft',case_id:c.id,row:rows?.[0]||null});
  }

  return json({ok:false,error:'NOT_FOUND'},404);
}

async function handle(request, env = {}) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  if (pathname === `${API_BASE}/health` && request.method === 'GET') return withCors(json({ ok: true, system_id: SYSTEM_ID, version: SYSTEM_VERSION, environment: isDemoEnv(env) ? 'demo' : 'production' }), request, env);
  if (pathname === `${API_BASE}/line/webhook` && request.method === 'POST') { try { return withCors(await handleLineWebhook(request, env), request, env); } catch (e) { return withCors(json({ ok:false, error:'LINE_WEBHOOK_ERROR' },500),request,env); } }
  if (pathname === `${API_BASE}/inquiries` && request.method === 'POST') {
    try { return withCors(await handlePublicInquiry(request, env), request, env); } catch (e) { return withCors(json({ ok: false, error: e.message === 'JSON_REQUIRED' ? 'JSON_REQUIRED' : 'BAD_REQUEST' }, 400), request, env); }
  }

  const demoResult = await routeDemo(request, env, pathname);
  if (demoResult) return withCors(demoResult, request, env);

  let actor=null; try { actor = await authenticate(request, env); } catch (e) { return withCors(json({ok:false,error:'AUTH_BACKEND_UNAVAILABLE'},503),request,env); }
  if (!actor) return withCors(json({ ok: false, error: 'UNAUTHENTICATED' }, 401), request, env);

  if (pathname === `${API_BASE}/system-check` && request.method === 'GET') {
    if (!requireRole(actor, ['owner', 'dpro_admin'])) return withCors(json({ ok: false, error: 'ROLE_DENIED' }, 403), request, env);
    const check=isDemoEnv(env)?systemCheck(env):await productionSystemCheck(env); return withCors(json(check, check.ok ? 200 : 503), request, env);
  }

  try {
    const result = isDemoEnv(env) ? await handleAuthedDemo(request, env, pathname, actor) : await handleProduction(request, env, pathname, actor);
    if (result) return withCors(result, request, env);
    return withCors(json({ ok: false, error: 'NOT_FOUND' }, 404), request, env);
  } catch (e) {
    const safe = String(e?.message || 'INTERNAL_ERROR').startsWith('SUPABASE_') ? 'UPSTREAM_DATABASE_ERROR' : 'INTERNAL_ERROR';
    return withCors(json({ ok: false, error: safe, request_id: request.headers.get('x-dpro-request-id') || null }, 500), request, env);
  }
}

export { handle, normalizePhone, validateCaseTransition, completionPhotoStatus, demoReset, ensureDemoStore, systemCheck, productionSystemCheck, verifyProjectJwt, authenticate, verifyLineSignature, storageSignedUpload, storageSignedDownload };
export default { fetch: handle };
