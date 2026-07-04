import type { SubtitleBlock, TranslatorSettings, SpeakerProfile } from '../types';

async function translateBatchOllama(
  batch: SubtitleBlock[],
  context: SubtitleBlock[],
  settings: TranslatorSettings,
  speakerProfiles: Record<string, SpeakerProfile>,
  userCorrections: { original: string; aiTranslation: string; userCorrection: string }[],
  fileContext?: string
): Promise<{ index: number; text: string }[]> {
  const url = `${settings.url.trim().replace(/\/$/, '')}/api/chat`;

  const contextData = context.map(block => ({
    index: block.index,
    speaker: block.speaker,
    original: block.text,
    translation: block.translation || ''
  }));

  const batchData = batch.map(block => ({
    index: block.index,
    speaker: block.speaker,
    text: block.text
  }));

  // Filter speaker profiles to only include speakers present in the batch and context
  const activeSpeakers = new Set<string>();
  batch.forEach(b => { if (b.speaker) activeSpeakers.add(b.speaker); });
  context.forEach(c => { if (c.speaker) activeSpeakers.add(c.speaker); });

  const relevantProfiles: Record<string, any> = {};
  activeSpeakers.forEach(sp => {
    if (speakerProfiles && speakerProfiles[sp]) {
      relevantProfiles[sp] = {
        gender: speakerProfiles[sp].gender,
        relation: speakerProfiles[sp].relation
      };
    }
  });

  const userContent = JSON.stringify({
    fileContext: fileContext || undefined,
    pronounStyle: settings.pronounStyle,
    speakerProfiles: Object.keys(relevantProfiles).length > 0 ? relevantProfiles : undefined,
    userCorrections: userCorrections.length > 0 ? userCorrections : undefined,
    contextReference: contextData,
    subtitlesToTranslate: batchData
  }, null, 2);

  const isMyanmar = (settings.targetLanguage || 'Myanmar').toLowerCase() === 'myanmar' || (settings.targetLanguage || 'Myanmar').toLowerCase() === 'burmese';

  let systemPrompt = settings.systemPrompt;
  systemPrompt += `

CRITICAL INSTRUCTIONS:
1. "fileContext" field in the input:
   - You are translating in the context of the overall video/story/topic described in "fileContext". Make sure your translation tone, pronoun choices, and vocabulary align with this overall context.
2. "userCorrections" field:
   - Carefully review the examples of AI translations corrected by the user.
   - Learn the user's preferred vocabulary, spelling, tone, and pronoun choices, and apply these same corrections to the subtitles you are translating now.`;

  if (isMyanmar) {
    systemPrompt += `
3. "pronounStyle" field in the input:
   - "polite": Use polite spoken pronouns (ကျွန်တော် for male, ကျွန်မ for female) and polite ending particles (ပါ, ပါတယ်, ခင်ဗျာ, ရှင်).
   - "casual": Use casual peer pronouns (ငါ, နင်, မင်း) and casual ending particles (တယ်, လား, မလို့, ပေါ့).
   - "omit": Omit subject and object pronouns ("I", "You", etc.) as much as possible, which is the most natural way to speak in Myanmar. Only use them when absolutely necessary for clarity.
4. "speakerProfiles" field:
   - Look up the speaker names in the speakerProfiles to determine their gender (male/female) and their relationship/relation to choose the correct pronouns and ending particles.
   - For example, if a speaker is listed as male, never translate their "I" as "ကျွန်မ". If they are female, never translate their "I" as "ကျွန်တော်".`;
  }

  const payload = {
    model: settings.model,
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: userContent
      }
    ],
    format: 'json',
    options: {
      temperature: settings.temperature,
      num_ctx: 8192
    },
    stream: false
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const messageContent = data.message?.content;

  if (!messageContent) {
    throw new Error('Ollama returned an empty response.');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(messageContent);
  } catch (e) {
    console.error('Failed to parse JSON response from Ollama:', messageContent);
    throw new Error('Ollama response was not valid JSON.');
  }

  if (!parsed || !Array.isArray(parsed.translations)) {
    throw new Error('Ollama response did not match the expected JSON schema (missing "translations" array).');
  }

  return parsed.translations;
}

async function translateBatchGemini(
  batch: SubtitleBlock[],
  context: SubtitleBlock[],
  settings: TranslatorSettings,
  speakerProfiles: Record<string, SpeakerProfile>,
  userCorrections: { original: string; aiTranslation: string; userCorrection: string }[],
  fileContext?: string,
  retryCount: number = 0
): Promise<{ index: number; text: string }[]> {
  const apiKeys = settings.geminiApiKey
    .split(/[\n,]+/)
    .map(k => k.trim())
    .filter(k => k.length > 0);

  if (apiKeys.length === 0) {
    throw new Error('Gemini API Key is missing. Please enter it in the sidebar settings.');
  }

  // Rotate keys based on the batch index and retry count to distribute request load
  const batchStartIndex = batch[0]?.index || 0;
  const keyIndex = (batchStartIndex + retryCount) % apiKeys.length;
  const apiKey = apiKeys[keyIndex];
  console.log(`[Gemini Translator] Batch starting at index ${batchStartIndex} is using API Key #${keyIndex + 1} of ${apiKeys.length} (Attempt retry offset: ${retryCount})`);

  const model = settings.geminiModel || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const contextData = context.map(block => ({
    index: block.index,
    speaker: block.speaker,
    original: block.text,
    translation: block.translation || ''
  }));

  const batchData = batch.map(block => ({
    index: block.index,
    speaker: block.speaker,
    text: block.text
  }));

  // Filter speaker profiles to only include speakers present in the batch and context
  const activeSpeakers = new Set<string>();
  batch.forEach(b => { if (b.speaker) activeSpeakers.add(b.speaker); });
  context.forEach(c => { if (c.speaker) activeSpeakers.add(c.speaker); });

  const relevantProfiles: Record<string, any> = {};
  activeSpeakers.forEach(sp => {
    if (speakerProfiles && speakerProfiles[sp]) {
      relevantProfiles[sp] = {
        gender: speakerProfiles[sp].gender,
        relation: speakerProfiles[sp].relation
      };
    }
  });

  const userContent = JSON.stringify({
    fileContext: fileContext || undefined,
    pronounStyle: settings.pronounStyle,
    speakerProfiles: Object.keys(relevantProfiles).length > 0 ? relevantProfiles : undefined,
    userCorrections: userCorrections.length > 0 ? userCorrections : undefined,
    contextReference: contextData,
    subtitlesToTranslate: batchData
  }, null, 2);

  const isMyanmar = (settings.targetLanguage || 'Myanmar').toLowerCase() === 'myanmar' || (settings.targetLanguage || 'Myanmar').toLowerCase() === 'burmese';

  let systemPrompt = settings.systemPrompt;
  systemPrompt += `

CRITICAL INSTRUCTIONS:
1. "fileContext" field in the input:
   - You are translating in the context of the overall video/story/topic described in "fileContext". Make sure your translation tone, pronoun choices, and vocabulary align with this overall context.
2. "userCorrections" field:
   - Carefully review the examples of AI translations corrected by the user.
   - Learn the user's preferred vocabulary, spelling, tone, and pronoun choices, and apply these same corrections to the subtitles you are translating now.`;

  if (isMyanmar) {
    systemPrompt += `
3. "pronounStyle" field in the input:
   - "polite": Use polite spoken pronouns (ကျွန်တော် for male, ကျွန်မ for female) and polite ending particles (ပါ, ပါတယ်, ခင်ဗျာ, ရှင်).
   - "casual": Use casual peer pronouns (ငါ, နင်, မင်း) and casual ending particles (တယ်, လား, မလို့, ပေါ့).
   - "omit": Omit subject and object pronouns ("I", "You", etc.) as much as possible, which is the most natural way to speak in Myanmar. Only use them when absolutely necessary for clarity.
4. "speakerProfiles" field:
   - Look up the speaker names in the speakerProfiles to determine their gender (male/female) and their relationship/relation to choose the correct pronouns and ending particles.
   - For example, if a speaker is listed as male, never translate their "I" as "ကျွန်မ". If they are female, never translate their "I" as "ကျွန်တော်".`;
  }

  const payload = {
    systemInstruction: {
      parts: [
        {
          text: systemPrompt
        }
      ]
    },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: userContent
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: settings.temperature
    }
  };

  const maskedKey = apiKey.length > 8 ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : 'short_key';

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  } catch (netErr: any) {
    throw new Error(`Connection failed using Key #${keyIndex + 1} [${maskedKey}]: ${netErr.message}`);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error?.message || response.statusText;
    throw new Error(`Gemini API error using Key #${keyIndex + 1} [${maskedKey}]: ${response.status} - ${errorMessage}`);
  }

  const data = await response.json();
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textContent) {
    throw new Error('Gemini returned an empty response.');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(textContent);
  } catch (e) {
    console.error('Failed to parse JSON response from Gemini:', textContent);
    throw new Error('Gemini response was not valid JSON.');
  }

  if (!parsed || !Array.isArray(parsed.translations)) {
    throw new Error('Gemini response did not match the expected JSON schema (missing "translations" array).');
  }

  return parsed.translations;
}

async function translateBatchOpenRouter(
  batch: SubtitleBlock[],
  context: SubtitleBlock[],
  settings: TranslatorSettings,
  speakerProfiles: Record<string, SpeakerProfile>,
  userCorrections: { original: string; aiTranslation: string; userCorrection: string }[],
  fileContext?: string,
  retryCount: number = 0
): Promise<{ index: number; text: string }[]> {
  const apiKeys = settings.openrouterApiKey
    .split(/[\n,]+/)
    .map(k => k.trim())
    .filter(k => k.length > 0);

  if (apiKeys.length === 0) {
    throw new Error('OpenRouter API Key is missing. Please enter it in the sidebar settings.');
  }

  // Rotate keys based on the batch index and retry count to distribute request load
  const batchStartIndex = batch[0]?.index || 0;
  const keyIndex = (batchStartIndex + retryCount) % apiKeys.length;
  const apiKey = apiKeys[keyIndex];
  console.log(`[OpenRouter Translator] Batch starting at index ${batchStartIndex} is using API Key #${keyIndex + 1} of ${apiKeys.length} (Attempt retry offset: ${retryCount})`);

  const model = settings.openrouterModel || 'google/gemma-2-9b-it:free';
  const url = 'https://openrouter.ai/api/v1/chat/completions';

  const contextData = context.map(block => ({
    index: block.index,
    speaker: block.speaker,
    original: block.text,
    translation: block.translation || ''
  }));

  const batchData = batch.map(block => ({
    index: block.index,
    speaker: block.speaker,
    text: block.text
  }));

  // Filter speaker profiles to only include speakers present in the batch and context
  const activeSpeakers = new Set<string>();
  batch.forEach(b => { if (b.speaker) activeSpeakers.add(b.speaker); });
  context.forEach(c => { if (c.speaker) activeSpeakers.add(c.speaker); });

  const relevantProfiles: Record<string, any> = {};
  activeSpeakers.forEach(sp => {
    if (speakerProfiles && speakerProfiles[sp]) {
      relevantProfiles[sp] = {
        gender: speakerProfiles[sp].gender,
        relation: speakerProfiles[sp].relation
      };
    }
  });

  const userContent = JSON.stringify({
    fileContext: fileContext || undefined,
    pronounStyle: settings.pronounStyle,
    speakerProfiles: Object.keys(relevantProfiles).length > 0 ? relevantProfiles : undefined,
    userCorrections: userCorrections.length > 0 ? userCorrections : undefined,
    contextReference: contextData,
    subtitlesToTranslate: batchData
  }, null, 2);

  const isMyanmar = (settings.targetLanguage || 'Myanmar').toLowerCase() === 'myanmar' || (settings.targetLanguage || 'Myanmar').toLowerCase() === 'burmese';

  let systemPrompt = settings.systemPrompt;
  systemPrompt += `

CRITICAL INSTRUCTIONS:
1. "fileContext" field in the input:
   - You are translating in the context of the overall video/story/topic described in "fileContext". Make sure your translation tone, pronoun choices, and vocabulary align with this overall context.
2. "userCorrections" field:
   - Carefully review the examples of AI translations corrected by the user.
   - Learn the user's preferred vocabulary, spelling, tone, and pronoun choices, and apply these same corrections to the subtitles you are translating now.`;

  if (isMyanmar) {
    systemPrompt += `
3. "pronounStyle" field in the input:
   - "polite": Use polite spoken pronouns (ကျွန်တော် for male, ကျွန်မ for female) and polite ending particles (ပါ, ပါတယ်, ခင်ဗျာ, ရှင်).
   - "casual": Use casual peer pronouns (ငါ, နင်, မင်း) and casual ending particles (တယ်, လား, မလို့, ပေါ့).
   - "omit": Omit subject and object pronouns ("I", "You", etc.) as much as possible, which is the most natural way to speak in Myanmar. Only use them when absolutely necessary for clarity.
4. "speakerProfiles" field:
   - Look up the speaker names in the speakerProfiles to determine their gender (male/female) and their relationship/relation to choose the correct pronouns and ending particles.
   - For example, if a speaker is listed as male, never translate their "I" as "ကျွန်မ". If they are female, never translate their "I" as "ကျွန်တော်".`;
  }

  const payload = {
    model: model,
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: userContent
      }
    ],
    response_format: {
      type: 'json_object'
    },
    temperature: settings.temperature
  };

  const maskedKey = apiKey.length > 8 ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : 'short_key';

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'Nadi SRT Translator'
      },
      body: JSON.stringify(payload)
    });
  } catch (netErr: any) {
    throw new Error(`Connection failed using Key #${keyIndex + 1} [${maskedKey}]: ${netErr.message}`);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error?.message || response.statusText;
    throw new Error(`OpenRouter API error using Key #${keyIndex + 1} [${maskedKey}]: ${response.status} - ${errorMessage}`);
  }

  const data = await response.json();
  const textContent = data.choices?.[0]?.message?.content;

  if (!textContent) {
    throw new Error('OpenRouter returned an empty response.');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(textContent);
  } catch (e) {
    console.error('Failed to parse JSON response from OpenRouter:', textContent);
    throw new Error('OpenRouter response was not valid JSON.');
  }

  if (!parsed || !Array.isArray(parsed.translations)) {
    throw new Error('OpenRouter response did not match the expected JSON schema (missing "translations" array).');
  }

  return parsed.translations;
}

export async function translateBatch(
  batch: SubtitleBlock[],
  context: SubtitleBlock[],
  settings: TranslatorSettings,
  speakerProfiles: Record<string, SpeakerProfile>,
  userCorrections: { original: string; aiTranslation: string; userCorrection: string }[],
  fileContext?: string,
  retryCount: number = 0
): Promise<{ index: number; text: string }[]> {
  try {
    if (settings.apiSource === 'cloud') {
      return await translateBatchGemini(batch, context, settings, speakerProfiles, userCorrections, fileContext, retryCount);
    } else if (settings.apiSource === 'openrouter') {
      return await translateBatchOpenRouter(batch, context, settings, speakerProfiles, userCorrections, fileContext, retryCount);
    } else {
      return await translateBatchOllama(batch, context, settings, speakerProfiles, userCorrections, fileContext);
    }
  } catch (err: any) {
    console.error('Translation error:', err);
    throw err;
  }
}
