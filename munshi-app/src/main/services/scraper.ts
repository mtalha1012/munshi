import { BrowserWindow } from 'electron'

const BASE_URL = 'https://dsjlahore.punjab.gov.pk'
const NAV_TIMEOUT = 40000

export interface LookupResult {
  ok: boolean
  nextHearing: string | null
  allDates: string[]
  stage?: string
  judge?: string
  title?: string
  error?: string
  diagnostics?: Record<string, unknown>
}

interface ListRow {
  caseNo: string
  dateText: string
  href: string
  stage: string
  judge: string
  title: string
}

// Site uses dd-mm-yyyy.
function parseDate(text: string): string | null {
  if (!text) return null
  let m = text.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/)
  if (m) return normalize(+m[3], +m[2], +m[1])
  m = text.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/)
  if (m) return normalize(+m[1], +m[2], +m[3])
  return null
}
function normalize(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null
  const mm = String(mo).padStart(2, '0')
  const dd = String(d).padStart(2, '0')
  return `${y}-${mm}-${dd}`
}
function norm(s: string): string {
  return (s || '').replace(/\s+/g, '').toLowerCase()
}

function fillFormScript(caseNumber: string, district: string): string {
  return `(function(caseNumber, district){
    function txt(el){return (el.textContent||'').trim()}
    var districtSet=false, caseFilled=false, captchaAnswered=false, captchaText='';
    var selects=[].slice.call(document.querySelectorAll('select'));
    var distSel=selects.filter(function(s){
      return [].slice.call(s.options).some(function(o){return /select district/i.test(o.text)});
    })[0];
    if(distSel){
      var opt=[].slice.call(distSel.options).filter(function(o){return o.text.trim().toLowerCase()===district.toLowerCase()})[0]
        || [].slice.call(distSel.options).filter(function(o){return o.text.toLowerCase().indexOf(district.toLowerCase())>-1})[0];
      if(opt){ distSel.value=opt.value; distSel.dispatchEvent(new Event('change',{bubbles:true})); districtSet=true; }
    }
    var caseInput=[].slice.call(document.querySelectorAll('input')).filter(function(i){return /case\\s*no/i.test(i.placeholder||'')})[0];
    if(caseInput){ caseInput.value=caseNumber; caseInput.dispatchEvent(new Event('input',{bubbles:true})); caseFilled=true; }
    var qs=[].slice.call(document.querySelectorAll('*')).filter(function(e){
      return e.children.length===0 && /what is\\s*\\d+\\s*[-+x*]\\s*\\d+/i.test(txt(e));
    });
    if(qs.length){
      var q=qs[qs.length-1]; captchaText=txt(q);
      var m=captchaText.match(/(\\d+)\\s*([-+x*])\\s*(\\d+)/i); var ans=null;
      if(m){var a=+m[1],b=+m[3],op=m[2].toLowerCase(); ans=op==='+'?a+b:(op==='-'?a-b:a*b);}
      var enters=[].slice.call(document.querySelectorAll('input')).filter(function(i){return /enter here/i.test(i.placeholder||'')});
      var box=enters.length?enters[enters.length-1]:null;
      if(box&&ans!=null){ box.value=String(ans); box.dispatchEvent(new Event('input',{bubbles:true})); captchaAnswered=true; }
    }
    return {districtSet:districtSet, caseFilled:caseFilled, captchaAnswered:captchaAnswered, captchaText:captchaText};
  })(${JSON.stringify(caseNumber)}, ${JSON.stringify(district)})`
}

const clickSearchScript = `(function(){
  var els=[].slice.call(document.querySelectorAll('button, input[type=submit], a'));
  var search=els.filter(function(b){
    var t=((b.textContent||b.value||'')+'').trim(); return /^search$/i.test(t);
  })[0];
  if(search){ setTimeout(function(){ search.click(); }, 40); return true; }
  return false;
})()`

const parseListScript = `(function(){
  function headers(t){ return [].slice.call(t.querySelectorAll('th')).map(function(th){return (th.textContent||'').trim().toLowerCase()}); }
  function idxOf(hs,words){ for(var i=0;i<hs.length;i++){ for(var j=0;j<words.length;j++){ if(hs[i].indexOf(words[j])>-1) return i; } } return -1; }
  function text(td){ return td ? (td.textContent||'').replace(/\\s+/g,' ').trim() : ''; }
  function judgeName(td){
    if(!td) return '';
    var div=td.querySelector('div'), full=(td.textContent||''), desig=div?(div.textContent||''):'';
    return (desig?full.replace(desig,''):full).replace(/\\s+/g,' ').trim();
  }
  var tables=[].slice.call(document.querySelectorAll('table'));
  for(var k=0;k<tables.length;k++){
    var t=tables[k], hs=headers(t);
    var dateIdx=idxOf(hs,['next hearing','decision date','hearing/decision']);
    if(dateIdx<0) continue;
    var caseIdx=idxOf(hs,['case no']);
    var stageIdx=idxOf(hs,['stage']);
    var judgeIdx=idxOf(hs,['judge']);
    var titleIdx=idxOf(hs,['case title','title']);
    var rows=[].slice.call(t.querySelectorAll('tbody tr')), out=[];
    for(var r=0;r<rows.length;r++){
      var tds=[].slice.call(rows[r].querySelectorAll('td'));
      if(tds.length<=dateIdx) continue;
      var link=rows[r].querySelector('a[href*="casedetail"]');
      out.push({
        caseNo: (caseIdx>=0 && tds[caseIdx]) ? (tds[caseIdx].textContent||'').trim() : '',
        dateText: (tds[dateIdx].textContent||'').trim(),
        href: link ? link.href : '',
        stage: stageIdx>=0 ? text(tds[stageIdx]) : '',
        judge: judgeIdx>=0 ? judgeName(tds[judgeIdx]) : '',
        title: (titleIdx>=0 && tds[titleIdx]) ? text(tds[titleIdx]) : ''
      });
    }
    if(out.length) return {found:true, rows:out};
  }
  return {found:false, rows:[]};
})()`

const parseDetailScript = `(function(){
  var tables=[].slice.call(document.querySelectorAll('table'));
  for(var k=0;k<tables.length;k++){
    var t=tables[k];
    var hs=[].slice.call(t.querySelectorAll('th')).map(function(th){return (th.textContent||'').trim().toLowerCase()});
    var dIdx=-1,sIdx=-1;
    for(var i=0;i<hs.length;i++){ if(hs[i].indexOf('proceeding date')>-1) dIdx=i; if(hs[i].indexOf('stage')>-1) sIdx=i; }
    if(dIdx<0) continue;
    var rows=[].slice.call(t.querySelectorAll('tr')), out=[], curJudge='';
    for(var r=0;r<rows.length;r++){
      var row=rows[r];
      if((row.className||'').indexOf('trow-color')>-1){
        var h5=row.querySelector('h5');
        if(h5) curJudge=(h5.textContent||'').replace(/\\s+/g,' ').trim().split(',')[0].trim();
        continue;
      }
      var tds=[].slice.call(row.querySelectorAll('td'));
      if(tds.length>dIdx){
        out.push({
          date:(tds[dIdx].textContent||'').trim(),
          stage:(sIdx>=0&&tds[sIdx])?(tds[sIdx].textContent||'').replace(/\\s+/g,' ').trim():'',
          judge:curJudge
        });
      }
    }
    if(out.length) return {rows:out};
  }
  return {rows:[]};
})()`

export class ScraperSession {
  private win: BrowserWindow | null = null

  async init(): Promise<void> {
    this.win = new BrowserWindow({
      show: false,
      width: 1400,
      height: 1000,
      webPreferences: { offscreen: false, nodeIntegration: false, contextIsolation: true }
    })
  }

  close(): void {
    if (this.win && !this.win.isDestroyed()) this.win.destroy()
    this.win = null
  }

  private wc() {
    if (!this.win || this.win.isDestroyed()) throw new Error('Scraper window not initialised.')
    return this.win.webContents
  }

  private loadAndWait(url: string): Promise<void> {
    const wc = this.wc()
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup()
        reject(new Error(`Timed out loading ${url}`))
      }, NAV_TIMEOUT)
      const onDone = (): void => {
        cleanup()
        resolve()
      }
      const onFail = (_e: unknown, code: number, desc: string): void => {
        // -3 is ERR_ABORTED, which fires on normal redirects.
        if (code === -3) return
        cleanup()
        reject(new Error(`Failed to load ${url}: ${desc} (${code})`))
      }
      const cleanup = (): void => {
        clearTimeout(timer)
        wc.removeListener('did-finish-load', onDone)
        wc.removeListener('did-fail-load', onFail)
      }
      wc.once('did-finish-load', onDone)
      wc.on('did-fail-load', onFail)
      wc.loadURL(url).catch(() => {
      })
    })
  }

  private waitForNavigation(): Promise<void> {
    const wc = this.wc()
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        cleanup()
        resolve()
      }, NAV_TIMEOUT)
      const onDone = (): void => {
        cleanup()
        resolve()
      }
      const cleanup = (): void => {
        clearTimeout(timer)
        wc.removeListener('did-finish-load', onDone)
      }
      wc.once('did-finish-load', onDone)
    })
  }

  async lookup(caseNumber: string, district: string): Promise<LookupResult> {
    try {
      await this.loadAndWait(BASE_URL + '/')
      const wc = this.wc()

      const fill = (await wc.executeJavaScript(fillFormScript(caseNumber, district))) as {
        caseFilled: boolean
        districtSet: boolean
        captchaAnswered: boolean
        captchaText: string
      }
      if (!fill.caseFilled) {
        return { ok: false, nextHearing: null, allDates: [], error: 'Case No. field not found on the site.', diagnostics: fill }
      }
      await new Promise((r) => setTimeout(r, 1500))

      const navP = this.waitForNavigation()
      const clicked = (await wc.executeJavaScript(clickSearchScript)) as boolean
      if (!clicked) {
        return { ok: false, nextHearing: null, allDates: [], error: 'Search button not found.', diagnostics: fill }
      }
      await navP
      await new Promise((r) => setTimeout(r, 800))

      const list = (await wc.executeJavaScript(parseListScript)) as { found: boolean; rows: ListRow[] }
      if (list.found && list.rows.length) {
        const chosen =
          list.rows.find((row) => norm(row.caseNo) === norm(caseNumber)) || list.rows[0]
        const allDates = list.rows
          .map((r) => parseDate(r.dateText))
          .filter((d): d is string => !!d)
        const picked = parseDate(chosen.dateText)
        if (picked) {
          return {
            ok: true,
            nextHearing: picked,
            allDates: Array.from(new Set(allDates)),
            stage: chosen.stage || undefined,
            judge: chosen.judge || undefined,
            title: chosen.title || undefined
          }
        }
        if (chosen.href) {
          const detail = await this.readDetail(chosen.href)
          if (detail) return detail
        }
      }

      const href = (await wc.executeJavaScript(
        `(function(){var a=document.querySelector('a[href*="casedetail"]');return a?a.href:''})()`
      )) as string
      if (href) {
        const detail = await this.readDetail(href)
        if (detail) return detail
      }

      return {
        ok: false,
        nextHearing: null,
        allDates: [],
        error: 'No hearing date found. The case number/district may be wrong, or the site layout changed.',
        diagnostics: { captchaText: fill.captchaText }
      }
    } catch (e) {
      return { ok: false, nextHearing: null, allDates: [], error: (e as Error).message }
    }
  }

  // Latest proceeding date is the upcoming hearing.
  private async readDetail(href: string): Promise<LookupResult | null> {
    await this.loadAndWait(href)
    await new Promise((r) => setTimeout(r, 600))
    const res = (await this.wc().executeJavaScript(parseDetailScript)) as {
      rows: { date: string; stage: string; judge: string }[]
    }
    const parsed = res.rows
      .map((row) => ({ ...row, iso: parseDate(row.date) }))
      .filter((row): row is typeof row & { iso: string } => !!row.iso)
    if (!parsed.length) return null
    const allDates = Array.from(new Set(parsed.map((r) => r.iso)))
    const latest = parsed.reduce((a, b) => (b.iso > a.iso ? b : a))
    return {
      ok: true,
      nextHearing: latest.iso,
      allDates,
      stage: latest.stage || undefined,
      judge: latest.judge || undefined
    }
  }
}

export async function lookupOnce(caseNumber: string, district: string): Promise<LookupResult> {
  const session = new ScraperSession()
  try {
    await session.init()
    return await session.lookup(caseNumber, district)
  } finally {
    session.close()
  }
}
