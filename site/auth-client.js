const CFG = window.DPRO_LANDSCAPE_CONFIG || {};
const SESSION_KEY = 'dpro_landscape_supabase_session_v1';
function base(){return String(CFG.supabaseUrl||'').replace(/\/$/,'')}
function key(){return String(CFG.supabasePublishableKey||'')}
function read(){try{return JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null')}catch{return null}}
function write(v){if(v)sessionStorage.setItem(SESSION_KEY,JSON.stringify(v));else sessionStorage.removeItem(SESSION_KEY)}
async function authFetch(path,body){
  if(!base()||!key()||base().includes('__')||key().includes('__'))throw new Error('PRODUCTION_AUTH_NOT_BOUND');
  const r=await fetch(`${base()}/auth/v1/${path}`,{method:'POST',headers:{apikey:key(),'content-type':'application/json'},body:JSON.stringify(body)});
  const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error_description||d.msg||d.message||`AUTH_${r.status}`);return d;
}
export async function signInWithPassword(email,password){const s=await authFetch('token?grant_type=password',{email,password});write(s);return s}
export async function refreshSession(){const s=read();if(!s?.refresh_token)return null;try{const n=await authFetch('token?grant_type=refresh_token',{refresh_token:s.refresh_token});write(n);return n}catch{write(null);return null}}
export async function getAccessToken(){if(CFG.demo)return '';let s=read();if(!s)return null;const exp=Number(s.expires_at||0);if(exp&&Date.now()/1000>exp-60)s=await refreshSession();else if(!exp&&s.expires_in&&s.access_token){const payload=(()=>{try{return JSON.parse(atob(s.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))}catch{return null}})();if(payload?.exp&&Date.now()/1000>payload.exp-60)s=await refreshSession()}return s?.access_token||null}
export function signOut(){write(null)}
export function hasSession(){return Boolean(read()?.access_token)}
