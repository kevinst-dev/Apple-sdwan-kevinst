/* SD-WAN Dashboard per Android - (c) 2026 Kevin Staiola. Tutti i diritti riservati. Software proprietario.
   Sul telefono non c'e' un server: le chiamate /api/... della pagina vengono servite qui, dalla stessa logica Python del
   programma per PC che gira dentro l'app (Pyodide). Il file Excel scelto si legge e si scrive con il componente nativo
   FileExcel (selettore file di Android: OneDrive, Download, Drive...). */
(function(){
'use strict';
// I componenti nativi si agganciano al primo uso (il collegamento con Android puo' arrivare dopo il caricamento della pagina).
let _fe=null,_app;
function cap(){return window.Capacitor}
function nativo(nome){const C=cap();if(!C||typeof C.registerPlugin!=='function')return null;return C.registerPlugin(nome)}
const FE=new Proxy({},{get:(_,m)=>(...a)=>{
 if(!_fe)_fe=window.__FE_FINTO||nativo('FileExcel');
 if(!_fe||typeof _fe[m]!=='function')return Promise.reject(new Error('componente del telefono non disponibile (riapri l’app; se continua, reinstallala)'));
 return _fe[m](...a)}});
function APPN_(){if(_app===undefined){const C=cap();_app=window.__APP_FINTA||(C&&C.isNativePlatform&&C.isNativePlatform()?nativo('App'):null)}return _app}
const MEMO='tim_file_v1';
let py=null,P=null,PERC=null,MOD=null,DIM=null,SOLO_LETTURA='',CONTROLLO=0;
const fetchOrig=window.fetch.bind(window);

/* ---------- utilita' ---------- */
function daB64(s){const b=atob(s||''),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u}
function aB64(u){let s='';const k=0x8000;for(let i=0;i<u.length;i+=k)s+=String.fromCharCode.apply(null,u.subarray(i,i+k));return btoa(s)}
function uguali(a,b){if(!a||!b||a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true}
function memo(){try{return JSON.parse(localStorage.getItem(MEMO)||'null')}catch(e){return null}}
function salvaMemo(m){try{m?localStorage.setItem(MEMO,JSON.stringify(m)):localStorage.removeItem(MEMO)}catch(e){}}
function avviso(t,k){try{if(window.toast)window.toast(t,k)}catch(e){}}
function leggiFS(p){try{return py.FS.readFile(p)}catch(e){return null}}
function persisti(){return new Promise(r=>{try{py.FS.syncfs(false,()=>r())}catch(e){r()}})}
function msgErr(e){return String((e&&(e.message||e.errorMessage))||e||'errore sconosciuto').slice(0,200)}
let CODA=Promise.resolve();
function inCoda(fn){const p=CODA.then(fn,fn);CODA=p.catch(()=>{});return p}
function risposta(code,body){return new Response(JSON.stringify(body),{status:code,headers:{'Content-Type':'application/json'}})}
function py_(nome,...a){const r=P[nome](...a);return typeof r==='string'?JSON.parse(r):r}

/* ---------- copertina di avvio ---------- */
function copertina(testo,errore){const c=document.getElementById('m-avvio');if(!c)return;
 if(testo===null){c.classList.add('via');setTimeout(()=>c.remove(),400);return}
 c.querySelector('p').textContent=testo;c.classList.toggle('err',!!errore)}

/* ---------- file originale <-> copia di lavoro ---------- */
async function infoOrigine(m){try{return await FE.info({uri:m.uri})}catch(e){return null}}
// rilegge l'originale; se e' cambiato aggiorna la copia di lavoro e ricarica. Ritorna true se e' cambiato.
async function sincronizza(forza){const m=memo();if(!m||!PERC)return false;
 const inf=await infoOrigine(m);
 if(!forza&&inf&&inf.modificato&&inf.modificato===MOD&&inf.dimensione===DIM&&!SOLO_LETTURA)return false;
 let dati;
 try{dati=daB64((await FE.leggi({uri:m.uri})).dati)}
 catch(e){SOLO_LETTURA=window.__MSG_NON_RAGG||('Il file originale non è raggiungibile ('+msgErr(e)+'): mostro l’ultima copia letta, le modifiche sono sospese.');throw new Error(SOLO_LETTURA)}
 SOLO_LETTURA='';if(inf){MOD=inf.modificato;DIM=inf.dimensione}
 const cur=leggiFS(PERC);if(uguali(cur,dati))return false;
 py.FS.writeFile(PERC,dati);P.ricarica();await persisti();return true}

async function scriviOrigine(){const m=memo();const b=leggiFS(PERC);
 await FE.scrivi({uri:m.uri,dati:aB64(b)});
 const inf=await infoOrigine(m);if(inf){MOD=inf.modificato;DIM=inf.dimensione}}

async function scegli(){let r;
 try{r=await FE.scegli()}catch(e){return {code:400,body:{ok:false,error:'Non riesco ad aprire la scelta dei file: '+msgErr(e)}}}
 if(!r||r.annullato||!r.uri)return {code:200,body:{ok:true,annullato:true,state:py_('richiesta','GET','/api/state','').body}};
 let dati;try{dati=daB64((await FE.leggi({uri:r.uri})).dati)}
 catch(e){return {code:400,body:{ok:false,error:'Non riesco a leggere il file scelto: '+msgErr(e)}}}
 const perc=P.percorso_lavoro(r.nome||'Calendario.xlsx');py.FS.writeFile(perc,dati);
 const j=py_('apri',perc,r.nome||'',r.dove||'',true);
 if(j.code===200){PERC=perc;SOLO_LETTURA='';salvaMemo({uri:r.uri,nome:r.nome||'',dove:r.dove||''});
  const inf=await infoOrigine({uri:r.uri});MOD=inf?inf.modificato:null;DIM=inf?inf.dimensione:null;await persisti();
  if(r.scrivibile===false&&!window.__SOLA_CONSULTAZIONE)setTimeout(()=>avviso('Questo file si può solo leggere: per modificarlo sceglilo da un’app che consente la scrittura (es. OneDrive o Download).','err'),900)}
 return j}

const SCRITTURE=new Set(['/api/add','/api/edit','/api/remove','/api/undo']);
async function gestisci(metodo,url,corpo){await PRONTO;
 if(!P)return {code:500,body:{ok:false,error:'Il motore dell’app non è partito.'}};
 const path=new URL(url,location.href).pathname,q=url.slice(url.indexOf(path));
 if(metodo==='GET'&&path==='/api/state'&&Date.now()-CONTROLLO>15000&&!document.hidden){CONTROLLO=Date.now();try{await sincronizza(false)}catch(e){}}
 if(metodo==='POST'&&path==='/api/file'){let d={};try{d=JSON.parse(corpo||'{}')}catch(e){}
  if(d.azione==='scegli')return scegli();return py_('richiesta','POST',q,corpo||'{}')}
 if(metodo==='POST'&&path==='/api/refresh'&&memo()&&PERC){CONTROLLO=Date.now();
  try{await sincronizza(true)}catch(e){return {code:400,body:{ok:false,error:SOLO_LETTURA}}}}
 if(metodo==='POST'&&SCRITTURE.has(path)){
  if(!memo()||!PERC)return {code:400,body:{ok:false,error:'Prima scegli il file Excel.'}};
  try{await sincronizza(!!SOLO_LETTURA)}catch(e){return {code:400,body:{ok:false,error:SOLO_LETTURA}}}
  const prima=leggiFS(PERC);const j=py_('richiesta','POST',q,corpo||'{}');
  if(j.code===200&&!uguali(prima,leggiFS(PERC))){
   try{await scriviOrigine()}
   catch(e){py.FS.writeFile(PERC,prima);P.dimentica_annulla();P.ricarica();await persisti();
    return {code:400,body:{ok:false,error:'Non riesco a salvare nel file originale ('+msgErr(e)+'). Nessuna modifica è stata fatta: riprova o scegli il file da un’app che consente la scrittura.'}}}}
  await persisti();return j}
 return py_('richiesta',metodo,q,corpo||'')}

window.fetch=function(input,opt){const url=typeof input==='string'?input:(input&&input.url)||'';
 let path='';try{path=new URL(url,location.href).pathname}catch(e){}
 if(!path.startsWith('/api/'))return fetchOrig(input,opt);
 opt=opt||{};const metodo=(opt.method||'GET').toUpperCase();
 return inCoda(()=>gestisci(metodo,url,opt.body)).then(r=>risposta(r.code,r.body),e=>risposta(500,{ok:false,error:'Errore imprevisto: '+msgErr(e)}))};

/* ---------- avvio del motore ---------- */
const PRONTO=(async()=>{try{
 copertina('Avvio del motore…');
 py=await loadPyodide({indexURL:new URL('pyodide/',location.href).href,stdout:t=>console.log(t),stderr:t=>console.warn(t)});
 py.FS.mkdirTree('/dati');
 try{py.FS.mount(py.FS.filesystems.IDBFS,{},'/dati');await new Promise(r=>py.FS.syncfs(true,()=>r()))}catch(e){console.warn('memoria persistente non disponibile',e)}
 const zip=new Uint8Array(await (await fetchOrig(new URL('py/app.zip',location.href).href)).arrayBuffer());
 py.FS.mkdirTree('/app');py.unpackArchive(zip,'zip',{extractDir:'/app'});
 py.runPython("import sys\nsys.path.insert(0,'/app')\nimport ponte");
 P=py.pyimport('ponte');
 const m=memo();
 if(m){copertina('Apro «'+(m.nome||'file Excel')+'»…');
  const perc=P.percorso_lavoro(m.nome||'Calendario.xlsx');let letto=false;
  try{const d=daB64((await FE.leggi({uri:m.uri})).dati);py.FS.writeFile(perc,d);letto=true;
   const inf=await infoOrigine(m);MOD=inf?inf.modificato:null;DIM=inf?inf.dimensione:null}
  catch(e){SOLO_LETTURA=window.__MSG_NON_RAGG||('Il file originale non è raggiungibile ('+msgErr(e)+'): mostro l’ultima copia letta, le modifiche sono sospese.')}
  if(letto||leggiFS(perc)){PERC=perc;py_('apri',perc,m.nome||'',m.dove||'',false);await persisti();
   if(SOLO_LETTURA)setTimeout(()=>avviso(SOLO_LETTURA,'err'),1200)}
  else{P.senza_file('Il file «'+(m.nome||'')+'» non è più raggiungibile: sceglilo di nuovo con «Cambia file Excel…».')}}
 else P.senza_file('');
 copertina(null)}
 catch(e){console.error(e);copertina('Avvio non riuscito: '+msgErr(e),true)}})();

/* ---------- link esterni (Teams), download (CSV, .txt), tasto Indietro ---------- */
document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('a[href]');if(!a||a.hasAttribute('download'))return;
 const h=a.getAttribute('href')||'';if(/^(https?:|msteams:|mailto:|tel:)/i.test(h)){e.preventDefault();e.stopPropagation();
  FE.apriLink({url:a.href}).catch(err=>avviso('Non riesco ad aprire il link: '+msgErr(err),'err'))}},true);
const clickOrig=HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click=function(){const h=this.href||'';
 if(this.hasAttribute('download')&&h.startsWith('blob:')){const nome=this.getAttribute('download')||'file';
  fetchOrig(h).then(r=>r.blob()).then(async b=>{const u=new Uint8Array(await b.arrayBuffer());
   const r=await FE.salva({nome,mime:b.type||'application/octet-stream',dati:aB64(u)});
   if(r&&!r.annullato)avviso('Salvato «'+nome+'»')}).catch(err=>avviso('Salvataggio non riuscito: '+msgErr(err),'err'));return}
 return clickOrig.call(this)};
function aperta(){return [...document.querySelectorAll('.mod')].some(m=>!m.hidden)}
function agganciaApp(){const APPN=APPN_();if(!APPN)return;
 APPN.addListener('backButton',()=>{
  if(aperta()||document.querySelector('.sp:not([hidden])')){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return}
  const nav=document.querySelector('#nav button.on');if(nav&&nav.dataset.view!=='dash'){const d=document.querySelector('#nav [data-view="dash"]');if(d){d.click();return}}
  APPN.minimizeApp().catch(()=>APPN.exitApp())});
 APPN.addListener('resume',()=>{CONTROLLO=0;try{window.poll&&window.poll()}catch(e){}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',agganciaApp);else agganciaApp();
window.__TIM_MOBILE={sincronizza,stato:()=>({PERC,MOD,DIM,SOLO_LETTURA,memo:memo()}),pronto:()=>PRONTO};
})();
