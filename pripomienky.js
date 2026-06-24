/* PRIPOMIENKY-OVERLAY — zdieľaná anotačná vrstva pre ZORA prototypy (throwaway).
   Tap → číslovaný špendlík → poznámka → „Poslať" poskladá text a otvorí WhatsApp.
   In-memory (žiadny localStorage — WhatsApp browser ho blokuje). Pravidlo 9: žiadne tel./email v kóde. */
(function(){
  var ROLA = window.PRIPOMIENKY_ROLA || 'ZORA prototyp';
  var pins = [];      // {scr, cislo, pozn, x, y, el}
  var zap = false;
  var seq = 0;
  var poslane = false;
  var editPin = null;

  // ---- CSS ----
  var css = ''
    + '#pz-fab{position:fixed;right:14px;bottom:14px;z-index:99999;display:flex;flex-direction:column;align-items:flex-end;gap:10px;}'
    + '#pz-send{display:none;align-items:center;gap:8px;background:#1F7A4D;color:#fff;border:none;border-radius:24px;padding:12px 16px;font-size:14px;font-weight:700;box-shadow:0 4px 14px rgba(0,0,0,.25);min-height:46px;}'
    + '#pz-toggle{display:flex;align-items:center;gap:8px;background:#E8431A;color:#fff;border:none;border-radius:26px;padding:13px 17px;font-size:14px;font-weight:700;box-shadow:0 4px 14px rgba(0,0,0,.3);min-height:48px;}'
    + '#pz-toggle.on{background:#1F1B16;}'
    + '#pz-badge{background:#fff;color:#E8431A;border-radius:20px;font-size:12px;font-weight:800;padding:1px 8px;min-width:20px;text-align:center;}'
    + '#pz-toggle.on #pz-badge{color:#1F1B16;}'
    + '.pz-pin{position:absolute;z-index:9000;width:28px;height:28px;margin-left:-14px;margin-top:-14px;border-radius:50%;background:#E8431A;color:#fff;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;opacity:.92;cursor:pointer;}'
    + '#pz-hint{position:fixed;left:0;right:0;bottom:0;z-index:99998;background:#1F1B16;color:#fff;text-align:center;font-size:13px;padding:10px 14px calc(10px + env(safe-area-inset-bottom));display:none;}'
    + '.pz-back{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.4);display:none;align-items:flex-end;}'
    + '.pz-back.on{display:flex;}'
    + '.pz-sheet{background:#F5F0E8;width:100%;max-width:440px;margin:0 auto;border-radius:16px 16px 0 0;padding:16px 16px calc(16px + env(safe-area-inset-bottom));box-sizing:border-box;}'
    + '.pz-sheet h3{margin:0 0 4px;font-size:16px;color:#1F1B16;}'
    + '.pz-sheet .sub{font-size:12px;color:#857D74;margin-bottom:10px;}'
    + '.pz-sheet textarea{width:100%;border:1px solid #E4DDCF;border-radius:11px;padding:11px;font-size:15px;font-family:inherit;min-height:90px;box-sizing:border-box;color:#1F1B16;background:#fff;}'
    + '.pz-sheet pre{white-space:pre-wrap;word-break:break-word;background:#fff;border:1px solid #E4DDCF;border-radius:11px;padding:11px;font-size:13px;max-height:38vh;overflow:auto;font-family:inherit;color:#1F1B16;}'
    + '.pz-row{display:flex;gap:8px;margin-top:12px;}'
    + '.pz-btn{flex:1;min-height:48px;border-radius:12px;border:1px solid #E4DDCF;background:#fff;color:#1F1B16;font-size:15px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:7px;}'
    + '.pz-btn.primary{background:#E8431A;color:#fff;border-color:#E8431A;}'
    + '.pz-btn.green{background:#1F7A4D;color:#fff;border-color:#1F7A4D;}'
    + '.pz-btn.danger{background:#fff;color:#C0392B;border-color:#E3B5B0;}'
    + 'body.pz-zap{cursor:crosshair;}';
  var st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);

  // ---- DOM ----
  var fab=document.createElement('div'); fab.id='pz-fab';
  fab.innerHTML='<button id="pz-send" type="button">📤 Poslať <span id="pz-send-n">0</span></button>'
    + '<button id="pz-toggle" type="button">✏ Pripomienka <span id="pz-badge">0</span></button>';
  document.body.appendChild(fab);
  var hint=document.createElement('div'); hint.id='pz-hint'; hint.textContent='Ťukni na miesto na obrazovke, ktoré chceš okomentovať.'; document.body.appendChild(hint);
  var back=document.createElement('div'); back.className='pz-back'; document.body.appendChild(back);

  var btnToggle=document.getElementById('pz-toggle');
  var btnSend=document.getElementById('pz-send');

  function aktScr(){ return document.querySelector('.scr.on') || document.querySelector('.scr') || document.body; }
  function scrId(el){ return (el && el.id) || 'obrazovka'; }
  function scrLabel(el){ var t=el && el.querySelector('.hd-t'); return t ? t.textContent.trim() : (el && el.id ? el.id.replace(/^s-/,'') : 'Obrazovka'); }

  function refreshCounts(){ document.getElementById('pz-badge').textContent=pins.length; document.getElementById('pz-send-n').textContent=pins.length; btnSend.style.display=pins.length?'flex':'none'; }

  function umiestniPin(p){
    var scr=document.getElementById(p.scr); if(!scr) return;
    if(getComputedStyle(scr).position==='static') scr.style.position='relative';
    var el=document.createElement('div'); el.className='pz-pin'; el.textContent=p.cislo; el.style.left=p.x+'px'; el.style.top=p.y+'px';
    el.addEventListener('click', function(ev){ ev.stopPropagation(); ev.preventDefault(); otvorBublinu(p); });
    scr.appendChild(el); p.el=el;
  }

  function pridajPin(scr, x, y){ seq++; var p={scr:scrId(scr), cislo:seq, pozn:'', x:x, y:y, el:null}; pins.push(p); umiestniPin(p); refreshCounts(); otvorBublinu(p); }

  // ---- bublina (edit/zmaz jedného špendlíka) ----
  function otvorBublinu(p){
    editPin=p;
    back.innerHTML='<div class="pz-sheet"><h3>Pripomienka '+p.cislo+'</h3><div class="sub">'+scrLabelById(p.scr)+'</div>'
      + '<textarea id="pz-ta" placeholder="napíš krátko čo vadí / čo zmeniť">'+escapeHtml(p.pozn)+'</textarea>'
      + '<div class="pz-row"><button class="pz-btn danger" type="button" data-act="zmaz">🗑 Zmazať</button><button class="pz-btn primary" type="button" data-act="uloz">Uložiť</button></div></div>';
    back.classList.add('on');
    var ta=document.getElementById('pz-ta'); setTimeout(function(){ try{ta.focus();}catch(e){} },50);
  }
  function scrLabelById(id){ var el=document.getElementById(id); return el?scrLabel(el):id; }

  back.addEventListener('click', function(ev){
    if(ev.target===back){ zavri(); return; }
    var b=ev.target.closest('[data-act]'); if(!b) return;
    var act=b.getAttribute('data-act');
    if(act==='uloz'){ if(editPin){ editPin.pozn=(document.getElementById('pz-ta').value||'').trim(); } zavri(); }
    else if(act==='zmaz'){ zmazPin(editPin); zavri(); }
    else if(act==='wa'){ window.open('https://wa.me/?text='+encodeURIComponent(b.getAttribute('data-text')||''),'_blank'); poslane=true; }
    else if(act==='kopi'){ kopiruj(b.getAttribute('data-text')||''); }
    else if(act==='zavri'){ zavri(); }
  });
  function zavri(){ back.classList.remove('on'); back.innerHTML=''; editPin=null; refreshCounts(); }
  function zmazPin(p){ if(!p) return; if(p.el&&p.el.parentNode) p.el.parentNode.removeChild(p.el); var i=pins.indexOf(p); if(i>=0) pins.splice(i,1); refreshCounts(); }

  // ---- skladanie textu + poslanie ----
  function poskladaj(){
    var byScr={}, poradie=[];
    pins.forEach(function(p){ if(!byScr[p.scr]){byScr[p.scr]=[];poradie.push(p.scr);} byScr[p.scr].push(p); });
    var out='📋 '+ROLA+'\n';
    poradie.forEach(function(sid){ out+='\n— '+scrLabelById(sid)+' —\n'; byScr[sid].forEach(function(p){ out+=p.cislo+') '+(p.pozn||'(bez textu)')+'\n'; }); });
    return out.trim();
  }
  function otvorPoslat(){
    if(!pins.length){ alert('Zatiaľ žiadne pripomienky. Zapni „Pripomienka" a ťukni na obrazovku.'); return; }
    var text=poskladaj();
    back.innerHTML='<div class="pz-sheet"><h3>Poslať '+pins.length+' pripomienok</h3><div class="sub">Otvorí WhatsApp s hotovým textom — vyber komu poslať.</div>'
      + '<pre>'+escapeHtml(text)+'</pre>'
      + '<div class="pz-row"><button class="pz-btn green" type="button" data-act="wa" data-text="'+escapeAttr(text)+'">📤 Otvoriť WhatsApp</button></div>'
      + '<div class="pz-row"><button class="pz-btn" type="button" data-act="kopi" data-text="'+escapeAttr(text)+'">📋 Kopírovať</button><button class="pz-btn" type="button" data-act="zavri">Zavrieť</button></div></div>';
    back.classList.add('on');
  }
  function kopiruj(t){ if(navigator.clipboard){ navigator.clipboard.writeText(t).then(function(){ poslane=true; alert('Skopírované — vlož do WhatsApp a pošli.'); }, function(){ prompt('Skopíruj text:', t); }); } else { prompt('Skopíruj text:', t); } }

  // ---- toggle režimu ----
  btnToggle.addEventListener('click', function(ev){ ev.stopPropagation(); zap=!zap; btnToggle.classList.toggle('on',zap); document.body.classList.toggle('pz-zap',zap); hint.style.display=zap?'block':'none'; });
  btnSend.addEventListener('click', function(ev){ ev.stopPropagation(); otvorPoslat(); });

  // ---- zachytenie tapu v režime ZAP (capture, aby neprešiel do navigácie prototypu) ----
  document.addEventListener('click', function(ev){
    if(!zap) return;
    if(ev.target.closest('#pz-fab')||ev.target.closest('.pz-back')||ev.target.closest('.pz-pin')||ev.target.closest('#pz-hint')) return;
    ev.preventDefault(); ev.stopPropagation();
    var scr=aktScr(); var rect=scr.getBoundingClientRect();
    pridajPin(scr, Math.round(ev.clientX-rect.left), Math.round(ev.clientY-rect.top));
  }, true);

  // ---- ochrana pred zatvorením s neodoslanými ----
  window.addEventListener('beforeunload', function(e){ if(pins.length && !poslane){ e.preventDefault(); e.returnValue=''; return ''; } });

  function escapeHtml(s){ return (s==null?'':s).toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function escapeAttr(s){ return escapeHtml(s).replace(/"/g,'&quot;'); }
})();
