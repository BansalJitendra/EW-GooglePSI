import DA_SDK from 'https://da.live/nx/utils/sdk.js';

const $ = (id) => document.getElementById(id);
const state = { report: null, filter: 'author', context: null };
const PSI_API = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const CACHE_TTL_MS = 30 * 60 * 1000;
const cachePrefix = 'pagespeed-coach-report-v3:';
// Separate keyed and anonymous caches without storing or hashing API key values.
function authMode() { return $('api-key').value.trim() ? 'keyed' : 'keyless'; }
let inFlight = false;
function cacheKey(url, strategy) { return cachePrefix + authMode() + ':' + encodeURIComponent(url) + ':' + strategy; }
function getCached(url, strategy) { try { const entry = JSON.parse(localStorage.getItem(cacheKey(url, strategy)) || 'null'); return entry && Date.now() - entry.savedAt < CACHE_TTL_MS ? entry : null; } catch { return null; } }
function saveCached(url, strategy, report) { try { localStorage.setItem(cacheKey(url, strategy), JSON.stringify({ savedAt: Date.now(), report })); } catch {} }
function showFallback(url, strategy) { const link = $('fallback-link'); link.href = 'https://pagespeed.web.dev/analysis?url=' + encodeURIComponent(url) + '&form_factor=' + encodeURIComponent(strategy); $('fallback').hidden = false; }

const auditNames = { performance: 'Performance', accessibility: 'Accessibility', 'best-practices': 'Best practices', seo: 'SEO' };
const rules = [
  { ids: ['modern-image-formats', 'uses-optimized-images', 'uses-responsive-images', 'image-delivery-insight', 'uses-text-compression'], owner: 'author', title: 'Review image delivery and asset size', guidance: 'Check hero and content images for oversized files. Replace with appropriately sized, optimized assets. Compression of HTML itself is developer-owned.' },
  { ids: ['offscreen-images', 'lazy-load-insight'], owner: 'author', title: 'Review below-the-fold images', guidance: 'Avoid loading large nonessential images early. Do not lazy-load the main hero/LCP image.' },
  { ids: ['largest-contentful-paint-element', 'lcp-discovery-insight', 'lcp-request-discovery'], owner: 'author', title: 'Review the main visible content', guidance: 'Check the hero image and top-of-page layout. If resource prioritization is needed, share the diagnostic with developers.' },
  { ids: ['layout-shifts', 'cls-culprits-insight', 'unsized-images'], owner: 'author', title: 'Investigate shifting images or embeds', guidance: 'Review recently added media and embeds. Developers may need to reserve dimensions or adjust CSS.' },
  { ids: ['third-party-summary', 'third-parties-insight'], owner: 'developer', title: 'Review third-party scripts', guidance: 'Ask developers to assess script loading, consent tools and third-party embeds.' },
  { ids: ['render-blocking-resources', 'render-blocking-insight'], owner: 'developer', title: 'Remove render-blocking resources', guidance: 'Requires investigation of CSS/JavaScript loading and critical rendering path.' },
  { ids: ['unused-javascript', 'legacy-javascript', 'bootup-time', 'mainthread-work-breakdown'], owner: 'developer', title: 'Reduce JavaScript cost', guidance: 'Developers can reduce unused JavaScript and main-thread work.' },
  { ids: ['server-response-time', 'document-latency-insight'], owner: 'developer', title: 'Investigate server response time', guidance: 'Check hosting, CDN and origin performance.' },
];
function normalizeURL(raw) {
  const u = new URL(raw);
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('Enter a public HTTP(S) page URL.');
  if (u.username || u.password) throw new Error('Credentials in URLs are not allowed.');
  if (['localhost', '127.0.0.1', '::1'].includes(u.hostname)) throw new Error('Use a publicly reachable published URL, not localhost.');
  u.hash = '';
  return u.href;
}
function guessPublishedURL(context) {
  if (!context?.org || !context?.repo || !context?.path) return '';
  // EDS default domain; for custom domains, authors can replace this URL.
  const path = String(context.path).replace(/\.html$/i, '').replace(/^\/+/, '');
  return `https://main--${encodeURIComponent(context.repo)}--${encodeURIComponent(context.org)}.aem.live/${path}`;
}
function setStatus(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error', error); }
function scoreClass(value) { return value >= 90 ? 'good' : value >= 50 ? 'warn' : 'bad'; }
function scoreNumber(value) { return typeof value === 'number' ? Math.round(value * 100) : null; }
function auditValue(audits, id) { const a = audits?.[id]; return a?.displayValue || (Number.isFinite(a?.numericValue) ? String(Math.round(a.numericValue)) : 'N/A'); }
function extractIssues(audits) {
  return rules.flatMap(rule => {
    const matching = rule.ids.map(id => ({ id, audit: audits?.[id] })).filter(({ audit }) => audit && audit.score !== null && audit.score !== undefined && audit.score < 0.9);
    if (!matching.length) return [];
    const worst = matching.sort((a,b) => (a.audit.score ?? 1) - (b.audit.score ?? 1))[0];
    return [{ ...rule, detail: worst.audit.title || worst.id, savings: worst.audit.displayValue || '', auditId: worst.id }];
  });
}
function metric(label, value) { const e = document.createElement('div'); e.className = 'metric'; const a=document.createElement('span');a.textContent=label;const b=document.createElement('b');b.textContent=value;e.append(a,b);return e; }
function render() {
  const { report } = state; if (!report) return;
  $('results').hidden = false;
  $('scores').replaceChildren();
  Object.entries(auditNames).forEach(([key,label]) => {
    const n = scoreNumber(report.lighthouseResult?.categories?.[key]?.score);
    const box = document.createElement('div');box.className='score';
    const title=document.createElement('span');title.textContent=label;
    const val=document.createElement('strong');val.className=n===null?'':scoreClass(n);val.textContent=n??'—';
    box.append(title,val);$('scores').append(box);
  });
  const audits=report.lighthouseResult?.audits || {};
  $('metrics').replaceChildren(metric('LCP (lab)',auditValue(audits,'largest-contentful-paint')),metric('CLS (lab)',auditValue(audits,'cumulative-layout-shift')),metric('INP (field)',report.loadingExperience?.metrics?.INTERACTION_TO_NEXT_PAINT?.percentile ? `${report.loadingExperience.metrics.INTERACTION_TO_NEXT_PAINT.percentile} ms` : 'N/A'));
  const issues=extractIssues(audits).filter(i=>i.owner===state.filter);
  $('issue-count').textContent=`${issues.length} issue(s)`;
  $('issues').replaceChildren();
  if (!issues.length) {const p=document.createElement('p');p.className='muted';p.textContent='No matching actionable diagnostics were reported for this category.';$('issues').append(p);}
  issues.forEach(issue => {
    const el=document.createElement('article');el.className='issue';
    const tag=document.createElement('span');tag.className='tag';tag.textContent=issue.owner==='author'?'Author review':'Developer review';
    const h=document.createElement('h3');h.textContent=issue.title;
    const detail=document.createElement('p');detail.textContent=`Google finding: ${issue.detail}${issue.savings ? ` (${issue.savings})` : ''}`;
    const guidance=document.createElement('p');guidance.textContent=issue.guidance;
    const btn=document.createElement('button');btn.className='secondary';btn.textContent='Copy finding';btn.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(`${issue.title}\n${issue.detail}\n${issue.guidance}\nPage: ${report.id || $('page-url').value}`);btn.textContent='Copied';setTimeout(()=>btn.textContent='Copy finding',1600);}catch{setStatus('Clipboard unavailable. Copy from the report manually.',true);}});
    el.append(tag,h,detail,guidance,btn);$('issues').append(el);
  });
  const date=report.analysisUTCTimestamp; $('audited-at').textContent=date ? new Date(date).toLocaleString() : 'Just now';
  $('psi-link').href=`https://pagespeed.web.dev/analysis?url=${encodeURIComponent($('page-url').value)}&form_factor=${$('device').value}`;
}
async function analyze() {
  if (inFlight) return;
  let target;
  try { target = normalizeURL($('page-url').value.trim()); } catch (e) { setStatus(e.message, true); return; }
  $('page-url').value = target;
  const strategy = $('device').value;
  const cached = getCached(target, strategy);
  if (cached) {
    state.report = cached.report;
    state.report._strategy = strategy;
    state.report._url = target;
    render();
    $('comparison').hidden = true;
    $('fallback').hidden = true;
    setStatus(`Showing a cached audit from ${new Date(cached.savedAt).toLocaleString()}.`);
    return;
  }
  inFlight = true;
  $('analyze').disabled = true;
  $('fallback').hidden = true;
  const apiKey = $('api-key').value.trim();
  setStatus(`Running ${apiKey ? 'authenticated' : 'keyless'} Google PageSpeed Insights audit (typically 20–60 seconds)…`);
  try {
    const url = new URL(PSI_API);
    url.searchParams.set('url', target);
    url.searchParams.set('strategy', strategy);
    if (apiKey) url.searchParams.set('key', apiKey);
    ['performance', 'accessibility', 'best-practices', 'seo'].forEach(category => url.searchParams.append('category', category));
    const response = await fetch(url.href, { headers: { Accept: 'application/json' } });
    let data;
    try { data = await response.json(); } catch { throw new Error(`Google returned a non-JSON response (HTTP ${response.status}).`); }
    if (!response.ok || data.error) {
      const message = data.error?.message || `HTTP ${response.status}`;
      if (response.status === 429 || /quota exceeded|queries per day|rate limit|resource exhausted/i.test(message)) {
        throw new Error(apiKey ? 'Google rejected the request due to the API project quota. Check the PageSpeed Insights API quota and restrictions for your key. Repeated clicks will not bypass the limit.' : 'Google’s keyless PageSpeed API quota is exhausted (possibly set to zero). Add your own API key under Google API key, or use the free Google website below.');
      }
      if (apiKey && (response.status === 400 || response.status === 403) && /api key|api_key|credential|permission|access not configured|not enabled|referer|referrer|blocked/i.test(message)) throw new Error('Google rejected the API key. Confirm that the PageSpeed Insights API is enabled and the key restrictions allow requests from this plugin host. Google says: ' + message);
      throw new Error(`Google PageSpeed API: ${message}`);
    }
    if (!data.lighthouseResult?.categories) throw new Error('No Lighthouse results were returned. Verify that the page is publicly reachable.');
    state.report = data;
    state.report._strategy = strategy;
    state.report._url = target;
    saveCached(target, strategy, data);
    render();
    $('comparison').hidden = true;
    setStatus('Audit complete. Results are cached for 30 minutes to reduce API requests.');
  } catch (e) {
    showFallback(target, strategy);
    setStatus(`Analysis failed: ${e.message}`, true);
  } finally {
    inFlight = false;
    $('analyze').disabled = false;
  }
}
function baselineKey() {return `pagespeed-coach-baseline:${$('page-url').value}:${$('device').value}`;}
function snapshot() {const cats=state.report.lighthouseResult.categories;return {url:state.report._url,strategy:state.report._strategy,date:new Date().toISOString(),scores:Object.fromEntries(Object.keys(auditNames).map(k=>[k,scoreNumber(cats[k]?.score)]))};}
function saveBaseline(){if(!state.report){setStatus('Run an audit first.',true);return;}try{localStorage.setItem(baselineKey(),JSON.stringify(snapshot()));setStatus('Baseline saved in this browser for this URL and device.');}catch{setStatus('Browser storage unavailable.',true);}}
function compare(){if(!state.report){setStatus('Run an audit first.',true);return;}let old;try{old=JSON.parse(localStorage.getItem(baselineKey())||'null');}catch{}if(!old){setStatus('No baseline for this URL/device. Save one first.',true);return;}const current=snapshot();const panel=$('comparison');panel.replaceChildren();const heading=document.createElement('h3');heading.textContent='Compared with saved baseline';panel.append(heading);Object.entries(auditNames).forEach(([key,label])=>{const p=document.createElement('div');const before=old.scores[key],after=current.scores[key];const diff=Number.isFinite(before)&&Number.isFinite(after)?after-before:null;p.textContent=`${label}: ${before??'—'} → ${after??'—'} (${diff===null?'N/A':`${diff>0?'+':''}${diff}`} points)`;panel.append(p);});const note=document.createElement('p');note.className='hint';note.textContent=`Baseline: ${new Date(old.date).toLocaleString()}. Lighthouse scores vary between runs; comparison is directional, not proof of causation.`;panel.append(note);panel.hidden=false;}
$('analyze').addEventListener('click',analyze);
$('toggle-key').addEventListener('click', () => { const input = $('api-key'); const visible = input.type === 'password'; input.type = visible ? 'text' : 'password'; $('toggle-key').textContent = visible ? 'Hide' : 'Show'; $('toggle-key').setAttribute('aria-label', visible ? 'Hide API key' : 'Show API key'); });
$('clear-key').addEventListener('click', () => { $('api-key').value = ''; $('api-key').type = 'password'; $('toggle-key').textContent = 'Show'; $('toggle-key').setAttribute('aria-label', 'Show API key'); setStatus('API key cleared. Future requests will use keyless mode.'); });
$('save-baseline').addEventListener('click',saveBaseline);
$('compare').addEventListener('click',compare);
document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>{state.filter=tab.dataset.filter;document.querySelectorAll('.tab').forEach(t=>{t.classList.toggle('active',t===tab);t.setAttribute('aria-selected',String(t===tab));});render();}));

(async()=>{try{const sdk=await Promise.race([DA_SDK,new Promise((_,reject)=>setTimeout(()=>reject(new Error('SDK timeout')),5000))]);state.context=sdk.context;const guess=guessPublishedURL(sdk.context);if(guess){$('page-url').value=guess;$('context-hint').textContent='Detected from Workspace. Confirm the published URL (especially if using a custom domain).';}else{$('context-hint').textContent='Enter the public URL to analyze.';}}catch{$('context-hint').textContent='Workspace context unavailable. Enter the published URL manually.';}})();
