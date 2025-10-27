import fetch from 'node-fetch';
import cheerio from 'cheerio';

export async function scrapeBetOfficial(url){
  try{
    const resp = await fetch(url, { timeout: 15000 });
    if(!resp.ok) throw new Error('target unreachable ' + resp.status);
    const html = await resp.text();
    const $ = cheerio.load(html);
    const title = $('title').text().trim();
    // try to extract JSON blob in scripts
    const scripts = $('script').map((i,el)=> $(el).html()).get();
    // search for common initial state patterns
    let initial = null;
    for(const s of scripts){
      if(!s) continue;
      const lower = s.toLowerCase();
      if(lower.includes('window.__') || lower.includes('initial_state') || lower.includes('aviator')){
        const idx = s.indexOf('{');
        const last = s.lastIndexOf('}');
        if(idx>=0 && last>idx){
          const candidate = s.slice(idx, last+1);
          try{ initial = JSON.parse(candidate); break; }catch(e){}
        }
      }
    }
    return { source:url, title, initial_state: initial, htmlLength: html.length };
  }catch(err){
    console.error('scrape err', err);
    throw err;
  }
}
