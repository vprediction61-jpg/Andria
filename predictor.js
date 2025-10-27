import fetch from 'node-fetch';

export async function generatePredictionFromML({ mode, input, external }){
  const mlUrl = process.env.ML_SERVICE_URL || 'http://ml-service:5000';
  try{
    const resp = await fetch(mlUrl + '/predict', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({mode, input, external}) , timeout: 15000 });
    if(!resp.ok) throw new Error('ml service error ' + resp.status);
    const json = await resp.json();
    return json;
  }catch(err){
    // fallback deterministic pseudo-predictor (no simulation claim)
    const seed = String(input || '') + JSON.stringify(external || {});
    let h = 0; for(let i=0;i<seed.length;i++) h = (h*31 + seed.charCodeAt(i)) & 0xffffffff;
    const multiplier = (1 + (h % 100)/100).toFixed(2);
    const confidence = 40 + (h % 60);
    return { fallback: true, multiplier, confidence, note: 'ml-unavailable' };
  }
}
