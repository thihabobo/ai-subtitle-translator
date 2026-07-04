import type { SubtitleBlock, TranslatorSettings } from '../types';

export async function analyzeFileContext(
  blocks: SubtitleBlock[],
  settings: TranslatorSettings
): Promise<string> {
  if (blocks.length === 0) return '';

  // Take a representative sample of up to 80 subtitle lines
  const sampleText = blocks
    .slice(0, 80)
    .map(b => `${b.speaker ? b.speaker + ': ' : ''}${b.text}`)
    .join('\n');

  const systemInstruction = `You are a professional subtitle context analyzer. 
Analyze the provided subtitle dialogue sample and extract:
1. The Genre/Topic of the video (e.g. Casual movie, programming tutorial, business meeting).
2. The Overall Plot/Situation (e.g. John is teaching Mary React coding; they are friendly peers).
3. The Tone of dialogue (e.g. friendly, professional, casual, tense).

Write your analysis as a concise summary in English (2-3 sentences max). Do not include lists or formatting, just a plain paragraph.`;

  const userContent = `Here is the sample of subtitles:\n\n${sampleText}`;

  if (settings.apiSource === 'cloud') {
    // Gemini API call
    const apiKeys = settings.geminiApiKey
      .split(/[\n,]+/)
      .map(k => k.trim())
      .filter(k => k.length > 0);
    if (apiKeys.length === 0) throw new Error('Gemini API Key is missing. Please check your settings.');
    
    // Use first key for context analysis
    const apiKey = apiKeys[0];
    const model = settings.geminiModel || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const payload = {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: userContent }] }],
      generationConfig: { temperature: 0.2 }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`Gemini API error: ${res.status} ${res.statusText}`);
    const data = await res.json();
    return (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
    
  } else if (settings.apiSource === 'openrouter') {
    // OpenRouter call
    const apiKeys = settings.openrouterApiKey
      .split(/[\n,]+/)
      .map(k => k.trim())
      .filter(k => k.length > 0);
    if (apiKeys.length === 0) throw new Error('OpenRouter API Key is missing. Please check your settings.');
    
    const apiKey = apiKeys[0];
    const model = settings.openrouterModel || 'google/gemma-2-9b-it:free';
    const url = 'https://openrouter.ai/api/v1/chat/completions';

    const payload = {
      model: model,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userContent }
      ],
      temperature: 0.2
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'Nadi SRT Translator'
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`OpenRouter API error: ${res.status} ${res.statusText}`);
    const data = await res.json();
    return (data.choices?.[0]?.message?.content || '').trim();

  } else {
    // Local Ollama call
    const url = `${settings.url.trim().replace(/\/$/, '')}/api/chat`;
    const payload = {
      model: settings.model,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userContent }
      ],
      options: { temperature: 0.2 },
      stream: false
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`Ollama API error: ${res.status} ${res.statusText}`);
    const data = await res.json();
    return (data.message?.content || '').trim();
  }
}
