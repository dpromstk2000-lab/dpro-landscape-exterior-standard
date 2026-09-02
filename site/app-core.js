import{getAccessToken}from'./auth-client.js';
const CFG=window.DPRO_LANDSCAPE_CONFIG;
export function tokenFor(role){return CFG.demo?(CFG.demoTokens?.[role]||''):''}
function loginRedirect(){const next=encodeURIComponent(location.pathname.split('/').pop()+location.search);location.href=`${CFG.loginPage||'login.html'}?next=${next}`}
export async function api(path,{method='GET',role='customer',body}={}){
  const token=CFG.demo?tokenFor(role):await getAccessToken();
  if(!CFG.demo&&!token){loginRedirect();throw new Error('AUTH_REQUIRED')}
  const headers={'authorization':`Bearer ${token}`};if(body!==undefined)headers['content-type']='application/json';
  const r=await fetch(`${CFG.apiBase}${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  const data=await r.json().catch(()=>({ok:false,error:'INVALID_RESPONSE'}));
  if(r.status===401&&!CFG.demo){loginRedirect();throw Object.assign(new Error('UNAUTHENTICATED'),{status:401,data})}
  if(!r.ok)throw Object.assign(new Error(data.error||`HTTP_${r.status}`),{status:r.status,data});return data;
}
export async function uploadSignedFile(signData,file){
  if(!signData?.signed_url)throw new Error('SIGNED_UPLOAD_URL_MISSING');
  const r=await fetch(signData.signed_url,{method:'PUT',headers:{'content-type':file.type,'x-upsert':'false'},body:file});if(!r.ok)throw new Error(`STORAGE_UPLOAD_${r.status}`);return true;
}
export function isDemo(){return Boolean(CFG.demo)}
export function qs(sel,root=document){return root.querySelector(sel)}
export function esc(v){const d=document.createElement('div');d.textContent=String(v??'');return d.innerHTML}
export function money(v){return new Intl.NumberFormat('ja-JP',{style:'currency',currency:'JPY',maximumFractionDigits:0}).format(v||0)}
export function statusLabel(s){return ({inquiry:'相談受付',survey_planned:'現調予定',surveyed:'現調済',estimate_draft:'見積作成中',estimate_sent:'見積確認中',contracted:'契約済',scheduled:'施工予定',in_progress:'施工中',completion_review:'完了確認中',completed:'完了'})[s]||s}
export function show(el,msg,type='success'){el.className=type;el.textContent=msg;el.hidden=false}
