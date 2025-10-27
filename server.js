import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import dotenv from 'dotenv';
import { generatePredictionFromML } from './predictor.js';
import { scrapeBetOfficial } from './scraper.js';
import fs from 'fs';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(process.cwd(),'public')));

const upload = multer({ dest: path.join(process.cwd(),'uploads') });
const TARGET = process.env.TARGET_URL || 'https://bet261.mg/instant-games/em/aviator-spribe';
const ML_URL = process.env.ML_SERVICE_URL || 'http://ml-service:5000';

let latestPrediction = null;

// Fetch game state by scraping official target via server-side (authorized)
app.get('/api/fetch-game', async (req, res) => {
  try{
    const state = await scrapeBetOfficial(TARGET);
    return res.json(state);
  }catch(err){
    console.error('fetch-game err', err);
    return res.status(500).json({ error: 'fetch failed', detail: err.message });
  }
});

// Predict endpoint: calls ML service for real prediction (no simulation)
app.post('/api/predict', async (req, res) => {
  try{
    const { mode, input, round } = req.body;
    // fetch latest external data (scraper)
    const external = await scrapeBetOfficial(TARGET);
    // build payload for ML
    const payload = { mode: mode || 'time', input: input || '', external };
    // call ML service
    const mlResp = await fetch((process.env.ML_SERVICE_URL || 'http://ml-service:5000') + '/predict', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    const mlJson = await mlResp.json();
    latestPrediction = { ts: new Date().toISOString(), mode, input, prediction: mlJson };
    return res.json(latestPrediction);
  }catch(err){
    console.error('predict err', err);
    return res.status(500).json({ error: 'predict failed', detail: err.message });
  }
});

app.get('/api/prediction/latest', (req, res) => {
  if(!latestPrediction) return res.status(404).json({ error: 'No prediction yet' });
  return res.json(latestPrediction);
});

app.post('/api/predict-screenshot', upload.single('screenshot'), async (req, res) => {
  try{
    const code = req.body.code;
    if(code !== 'andrian') return res.status(403).json({ error: 'Invalid code' });
    // file is saved in uploads; you can pass it to ML service for OCR/analysis
    const filePath = req.file.path;
    // For now, send placeholder to ML
    const payload = { mode: 'screenshot', input: filePath };
    const mlResp = await fetch((process.env.ML_SERVICE_URL || 'http://ml-service:5000') + '/predict', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    const mlJson = await mlResp.json();
    // cleanup uploaded file
    try{ fs.unlinkSync(filePath); }catch(e){}
    return res.json({ prediction: mlJson });
  }catch(err){
    console.error('predict-screenshot err', err);
    return res.status(500).json({ error: 'screenshot analysis failed', detail: err.message });
  }
});

// AI assistant proxy to OpenAI (server-side). Requires OPENAI_KEY in env
app.post('/api/ask', async (req, res) => {
  try{
    const msg = req.body.message;
    if(!process.env.OPENAI_KEY) return res.status(500).json({ error: 'OpenAI key not configured' });
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${process.env.OPENAI_KEY}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role:'system', content:'You are Luciano Offpred assistant.' }, { role:'user', content: msg }], max_tokens:400 })
    });
    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content || JSON.stringify(data);
    return res.json({ reply });
  }catch(err){
    console.error('ask err', err);
    return res.status(500).json({ error: 'ask failed', detail: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log('Backend listening on', PORT));
