export interface SubtitleBlock {
  index: number;
  start: string;
  end: string;
  text: string;
  translation?: string;
  status: 'idle' | 'translating' | 'done' | 'error';
  errorMsg?: string;
  rawAssPrefix?: string;
  rawAssLineIndex?: number;
  speaker?: string;
  rawAiTranslation?: string;
}

export interface SpeakerProfile {
  name: string;
  gender: 'male' | 'female' | 'unknown';
  relation: 'polite' | 'casual' | 'lover' | 'omit';
}

export interface TranslatorSettings {
  apiSource: 'local' | 'cloud' | 'openrouter';
  url: string;
  model: string;
  geminiApiKey: string;
  geminiModel: string;
  openrouterApiKey: string;
  openrouterModel: string;
  batchSize: number;
  temperature: number;
  systemPrompt: string;
  tone: string;
  pronounStyle: 'polite' | 'casual' | 'omit';
  targetLanguage: string;
}


