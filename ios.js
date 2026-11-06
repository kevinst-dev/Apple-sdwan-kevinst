/* SD-WAN Dashboard per iPhone/iPad (app web) - (c) 2026 Kevin Staiola. Tutti i diritti riservati.
   Senza account sviluppatore Apple non si puo' installare un'app vera: questa e' la stessa dashboard come app web.
   Il file Excel si sceglie dall'app File (OneDrive compreso) e si legge soltanto: su iPhone una pagina web non puo'
   riscrivere il file originale, quindi la dashboard e' in sola consultazione. Nessun dato lascia il telefono. */
(function(){
'use strict';
window.__SOLA_CONSULTAZIONE=true;
window.__MSG_NON_RAGG='Mostro i dati dell’ultima lettura: per aggiornarli premi «Aggiorna» e scegli di nuovo il file.';
let FILE=null,ATTESA=null;   // ATTESA: scelta del file aperta direttamente dal tocco (Safari lo richiede)
const b64=u=>{let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s)};
function chiedi(){return new Promise(res=>{const i=document.createElement('input');i.type='file';
 i.accept='.xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12';
 i.style.cssText='position:fixed;left:-9999px;opacity:0';document.body.appendChild(i);let fatto=false;
 const fine=f=>{if(fatto)return;fatto=true;setTimeout(()=>i.remove(),0);res(f)};
 i.addEventListener('change',()=>fine(i.files&&i.files[0]||null));i.addEventListener('cancel',()=>setTimeout(()=>fine(i.files&&i.files[0]||null),500));
 window.addEventListener('focus',()=>setTimeout(()=>{if(!i.files||!i.files.length)fine(null)},1500),{once:true});
 i.click()})}
window.__FE_FINTO={
 async scegli(){const f=await (ATTESA||chiedi());ATTESA=null;if(!f)return {annullato:true};FILE=f;
  return {uri:'web:'+f.name,nome:f.name,dove:'',scrivibile:false}},
 async leggi(){if(!FILE)throw new Error('serve scegliere di nuovo il file');return {dati:b64(new Uint8Array(await FILE.arrayBuffer())),dimensione:FILE.size}},
 async info(){if(!FILE)throw new Error('file da riscegliere');return {nome:FILE.name,dimensione:FILE.size,modificato:FILE.lastModified}},
 async scrivi(){throw new Error('su iPhone la dashboard è in sola consultazione')},
 async salva({nome,mime,dati}){const bin=atob(dati),u=new Uint8Array(bin.length);for(let k=0;k<bin.length;k++)u[k]=bin.charCodeAt(k);
  const f=new File([u],nome,{type:mime||'application/octet-stream'});
  if(navigator.canShare&&navigator.canShare({files:[f]})){try{await navigator.share({files:[f],title:nome});return {}}catch(e){if(e&&e.name==='AbortError')return {annullato:true}}}
  const url=URL.createObjectURL(f);window.open(url,'_blank');setTimeout(()=>URL.revokeObjectURL(url),60000);return {}},
 async apriLink({url}){window.open(url,'_blank','noopener');return {}}};
// «Aggiorna» su iPhone = scegliere di nuovo il file (e' l'unico modo per rileggerlo)
document.addEventListener('click',e=>{const el=e.target.closest&&e.target;if(!el)return;
 if(el.closest('[data-act="pickfile"],#f-browse')){ATTESA=chiedi();return}
 const r=el.closest('#refresh,[data-act="retry"]');
 if(r&&typeof window.scegliFile==='function'){e.preventDefault();e.stopImmediatePropagation();ATTESA=chiedi();window.scegliFile()}},true);
})();
