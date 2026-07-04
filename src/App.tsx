import { useState, useRef, useEffect } from 'react';
import type { SubtitleBlock, TranslatorSettings, SpeakerProfile } from './types';
import { parseSRT, compileSRT, parseASS, compileASS } from './utils/srtParser';
import { translateBatch } from './utils/translationClient';
import { analyzeFileContext } from './utils/contextAnalyzer';

export function getSystemPrompt(tone: string, targetLanguage: string): string {
  const isMyanmar = targetLanguage.toLowerCase() === 'myanmar' || targetLanguage.toLowerCase() === 'burmese';
  
  if (isMyanmar) {
    if (tone === 'polite') {
      return `You are a professional English-to-Myanmar subtitle translator.
Translate the English subtitles to Myanmar (Burmese) language naturally.

Target Style: Polite Spoken (ယဉ်ကျေး/ဖော်ရွေသော စကားပြော)
Rules:
1. Sentence Structure: Focus on natural polite spoken phrasing, suitable for educational videos, public speeches, or formal characters in a dialogue.
2. Verb Endings: Avoid Stiff written particles like "သည်" or "၏". Use polite conversational ending particles: "ပါ", "ပါတယ်", "ပါသလဲ", "ပါရစေ", "ဦးနော်"။
3. Pronouns: Keep pronouns polite and respectful. Use "ကျွန်တော်" (male "I"), "ကျွန်မ" (female "I"), "ခင်ဗျာ" (male ending politeness), "ရှင်/ရှင့်" (female ending politeness). Avoid informal pronouns like "မင်း" if the conversation is highly formal; refer to titles or names instead.
4. Addressing Terms (bro, brother, sis, sister): Translate politely based on relative age or roles, using "อစ်ကို" (elder brother), "ညီလေး" (younger brother), "အစ်မ" (elder sister), "ညီမလေး" (younger sister), or titles. Avoid raw slang like "ဘရို" or "ဟေ့ရောင်".
5. Flow: Ensure the tone is warm, professional, and respectful.
6. Formatting Tags: Keep any subtitle styling/formatting tags (e.g. ASS curly brace tags like {\\i1}, {\\pos(x,y)}, or SRT HTML tags like <i>, <b>) in their original relative positions in the Myanmar translation. Do NOT translate, omit, or alter these tags.

JSON Schema to return:
{
  "translations": [
    { "index": number, "text": "Myanmar translation here" }
  ]
}`;
    } else if (tone === 'technical') {
      return `You are a professional English-to-Myanmar subtitle translator.
Translate the English subtitles to Myanmar (Burmese) language naturally.

Target Style: Technical / Educational (နည်းပညာ/သင်ခန်းစာ)
Rules:
1. Sentence Structure: Translate instructions and explanations clearly and concisely for tutorials or training videos.
2. Technical Nouns: Keep software, coding, and technical terms in English (e.g., "React", "Vite", "Docker", "Ollama", "API", "database", "git", "web", "server"). Do NOT translate technical nouns into Myanmar literally.
3. Action Prompts: Translate user actions politely and clearly (e.g. "Click the button" -> "ခလုတ်ကို နှိပ်ပါ", "Install the package" -> "Package ကို install လုပ်ပါ", "Run this command" -> "ဒီ command ကို run ပါ").
4. Verb Endings: Use clear, instructive ending particles like "ပါ", "ပါတယ်"။
5. Formatting Tags: Keep any subtitle styling/formatting tags (e.g. ASS curly brace tags like {\\i1}, {\\pos(x,y)}, or SRT HTML tags like <i>, <b>) in their original relative positions in the Myanmar translation. Do NOT translate, omit, or alter these tags.

JSON Schema to return:
{
  "translations": [
    { "index": number, "text": "Myanmar translation here" }
  ]
}`;
    } else {
      return `You are a professional English-to-Myanmar subtitle translator.
Translate the English subtitles to Myanmar (Burmese) language naturally.

Target Style: Casual Spoken Dialogue (စကားပြော - ရုပ်ရှင်/နေ့စဉ်သုံး)
Rules:
1. Sentence Structure: Myanmar language uses Subject-Object-Verb (SOV) order. Focus on natural spoken Myanmar phrasing. Strictly avoid formal written verb endings like "သည်" (thi), "ပါသည်" (par thi), "သနည်း" (tha nee), "ပါသနည်း" (par tha nee), "၏" (ei), "အံ့" (ant).
2. Spoken Ending Particles: Always use natural conversational endings like "တယ်" (tal), "မလို့" (ma lo), "လဲ" (lae), "လား" (lar), "မယ်" (mal), "နော်" (naw), "ပေါ့" (pawt), "ဦး" (oo), "လို့" (lo).
3. Pronouns & Omissions: Omit subject and object pronouns ("I", "You", "We", "They") when they are obvious from context to make the dialogue flow naturally. Never translate "You" as "သင်" (thin) or "I" as "ကျွန်ုပ်" (kyanoke) in casual dialogue.
4. Addressing Terms (bro, brother, sis, sister): Do NOT translate them literally (like "ညီအစ်ကို" or "ညီအစ်မ").
   - 'bro' / 'brother': translate based on context to friendly/casual address terms like "အစ်ကို" (if older/polite), "ညီလေး" (if younger), "ဟေ့ရောင်" (very informal male-to-male), or modern colloquial slang "ဘရို"။ Often, it is best to omit the addressing term entirely and just use friendly spoken particles.
   - 'sis' / 'sister': translate based on context to "အစ်မ", "ညီမလေး", "မမ", or modern colloquial slang "ဆစ်"။
5. Exclamations: Keep sound effects or exclamations natural (e.g. "Oh my god!" -> "ဘုရားရေ!" or "အမလေး!", "Hey!" -> "ฮေ့!" or "ဟေး!").
6. Context Alignment: Keep pronouns, tone, and relationships consistent with the previous lines in contextReference.
7. Formatting Tags: Keep any subtitle styling/formatting tags (e.g. ASS curly brace tags like {\\i1}, {\\pos(x,y)}, or SRT HTML tags like <i>, <b>) in their original relative positions in the Myanmar translation. Do NOT translate, omit, or alter these tags.

JSON Schema to return:
{
  "translations": [
    { "index": number, "text": "Myanmar translation here" }
  ]
}`;
    }
  } else {
    // Non-Myanmar target languages
    let toneInstruction = '';
    if (tone === 'polite') {
      toneInstruction = `Target Style: Polite / Formal Spoken language. Use formal/polite pronouns and ending conjugations suitable for polite interactions, tutorials, or public speeches.`;
    } else if (tone === 'technical') {
      toneInstruction = `Target Style: Technical / Educational instruction. Keep technical nouns (e.g. software, coding terms, APIs) in English if they are standard in IT/industry, and explain actions clearly.`;
    } else {
      toneInstruction = `Target Style: Casual spoken dialogue. Translate in a natural, colloquial spoken tone suitable for movies or daily chats.`;
    }
    
    return `You are a professional English-to-${targetLanguage} subtitle translator.
Translate the English subtitles to ${targetLanguage} language naturally.

${toneInstruction}

General Rules:
1. Sentence Flow: Ensure the translation is natural spoken dialogue in the target language. Do not translate word-for-word.
2. Context Alignment: Keep styling, terms, pronouns, and relationships consistent with preceding dialog blocks provided in contextReference.
3. Formatting Tags: Keep any subtitle styling/formatting tags (e.g. ASS curly brace tags like {\\i1}, {\\pos(x,y)}, or SRT HTML tags like <i>, <b>) in their original relative positions. Do NOT translate, omit, or alter these tags.

JSON Schema to return:
{
  "translations": [
    { "index": number, "text": "${targetLanguage} translation here" }
  ]
}`;
  }
}

const DEFAULT_SETTINGS: TranslatorSettings = {
  apiSource: 'local',
  url: 'http://localhost:11434',
  model: 'gemma4:latest',
  geminiApiKey: '',
  geminiModel: 'gemini-2.5-flash',
  openrouterApiKey: '',
  openrouterModel: 'google/gemma-2-9b-it:free',
  batchSize: 5,
  temperature: 0.2,
  tone: 'casual',
  systemPrompt: '',
  pronounStyle: 'casual',
  targetLanguage: 'Myanmar'
};

DEFAULT_SETTINGS.systemPrompt = getSystemPrompt('casual', 'Myanmar');

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

const SAMPLE_SRT = `1
00:00:01,000 --> 00:00:03,500
Hello! How are you doing today?

2
00:00:03,600 --> 00:00:05,800
I'm doing well, thanks. What about you?

3
00:00:05,900 --> 00:00:08,200
Not bad. I'm just working on a project.

4
00:00:08,300 --> 00:00:10,500
Is it the AI translator project?

5
00:00:10,600 --> 00:00:13,200
Yes, it is! We are translating SRT files.

6
00:00:13,300 --> 00:00:15,600
That sounds amazing. Let's test it out!`;

export default function App() {
  const [subtitles, setSubtitles] = useState<SubtitleBlock[]>(() => {
    const saved = localStorage.getItem('srt_translator_subtitles');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback
      }
    }
    return [];
  });
  const [settings, setSettings] = useState<TranslatorSettings>(() => {
    const saved = localStorage.getItem('srt_translator_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed
        };
      } catch (e) {
        // Fallback
      }
    }
    return DEFAULT_SETTINGS;
  });

  const [isTranslating, setIsTranslating] = useState(false);
  const [isPaused, setIsPaused] = useState((() => {
    const savedSubtitles = localStorage.getItem('srt_translator_subtitles');
    if (savedSubtitles) {
      try {
        const parsed = JSON.parse(savedSubtitles);
        const hasDone = parsed.some((s: any) => s.status === 'done');
        const hasPending = parsed.some((s: any) => s.status === 'idle' || s.status === 'error');
        return hasDone && hasPending;
      } catch (e) {}
    }
    return false;
  })());
  const [fileName, setFileName] = useState<string>(() => {
    return localStorage.getItem('srt_translator_filename') || 'subtitles.srt';
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [localModels, setLocalModels] = useState<string[]>([]);
  const [elapsedTime, setElapsedTime] = useState<number>(() => {
    const saved = localStorage.getItem('srt_translator_elapsed_time');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [isAss, setIsAss] = useState<boolean>(() => {
    return localStorage.getItem('srt_translator_is_ass') === 'true';
  });
  const [assRawLines, setAssRawLines] = useState<string[]>(() => {
    const saved = localStorage.getItem('srt_translator_ass_raw_lines');
    return saved ? JSON.parse(saved) : [];
  });
  const [speakerProfiles, setSpeakerProfiles] = useState<Record<string, SpeakerProfile>>(() => {
    const saved = localStorage.getItem('srt_translator_speaker_profiles');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback
      }
    }
    return {};
  });
  const [fileContext, setFileContext] = useState<string>(() => {
    return localStorage.getItem('srt_translator_file_context') || '';
  });
  const [isAnalyzingContext, setIsAnalyzingContext] = useState<boolean>(false);
  const [isFetchingModels, setIsFetchingModels] = useState<boolean>(false);

  const timerIntervalRef = useRef<any>(null);

  const startTimer = () => {
    if (timerIntervalRef.current) return;
    timerIntervalRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  // Sync elapsedTime to localStorage
  useEffect(() => {
    localStorage.setItem('srt_translator_elapsed_time', elapsedTime.toString());
  }, [elapsedTime]);

  // Auto-scroll to currently translating row
  useEffect(() => {
    if (isTranslating) {
      const activeSub = subtitles.find(s => s.status === 'translating');
      if (activeSub) {
        const element = document.getElementById(`row-${activeSub.index}`);
        if (element) {
          element.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
      }
    }
  }, [subtitles, isTranslating]);

  // Sync subtitles, filename, and ASS status to localStorage
  useEffect(() => {
    if (subtitles.length > 0) {
      localStorage.setItem('srt_translator_subtitles', JSON.stringify(subtitles));
      localStorage.setItem('srt_translator_filename', fileName);
      localStorage.setItem('srt_translator_is_ass', isAss.toString());
      localStorage.setItem('srt_translator_ass_raw_lines', JSON.stringify(assRawLines));
    } else {
      localStorage.removeItem('srt_translator_subtitles');
      localStorage.removeItem('srt_translator_filename');
      localStorage.removeItem('srt_translator_is_ass');
      localStorage.removeItem('srt_translator_ass_raw_lines');
    }
  }, [subtitles, fileName, isAss, assRawLines]);

  // Sync speaker profiles to localStorage
  useEffect(() => {
    if (Object.keys(speakerProfiles).length > 0) {
      localStorage.setItem('srt_translator_speaker_profiles', JSON.stringify(speakerProfiles));
    } else {
      localStorage.removeItem('srt_translator_speaker_profiles');
    }
  }, [speakerProfiles]);

  // Sync file context to localStorage
  useEffect(() => {
    if (fileContext) {
      localStorage.setItem('srt_translator_file_context', fileContext);
    } else {
      localStorage.removeItem('srt_translator_file_context');
    }
  }, [fileContext]);

  const fetchLocalModels = async (quiet = false) => {
    if (settings.apiSource !== 'local') return;
    if (!quiet) setIsFetchingModels(true);
    try {
      const baseUrl = settings.url.trim().replace(/\/$/, '');
      const res = await fetch(`${baseUrl}/api/tags`);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.models)) {
          const names = data.models.map((m: any) => m.name);
          setLocalModels(names);
          
          // Auto-select first model if nothing is selected or if using old default
          if (names.length > 0) {
            if (!settings.model || settings.model === 'gemma4:latest' || settings.model === 'qwen3.5:9b') {
              if (names.includes('gemma4:latest')) {
                setSettings(prev => ({ ...prev, model: 'gemma4:latest' }));
              } else {
                setSettings(prev => ({ ...prev, model: names[0] }));
              }
            }
          }
        } else {
          setLocalModels([]);
        }
      } else {
        setLocalModels([]);
      }
    } catch (e) {
      console.error('Failed to fetch local Ollama models:', e);
      setLocalModels([]);
    } finally {
      if (!quiet) setIsFetchingModels(false);
    }
  };

  // Fetch local Ollama models on URL or source change
  useEffect(() => {
    fetchLocalModels(true);
  }, [settings.url, settings.apiSource]);
  
  // Refs to prevent stale closures in the translation loop
  const subtitlesRef = useRef<SubtitleBlock[]>([]);
  subtitlesRef.current = subtitles;

  const settingsRef = useRef<TranslatorSettings>(settings);
  settingsRef.current = settings;

  const isTranslatingRef = useRef(false);
  const isPausedRef = useRef(false);

  // Save settings to localStorage on change
  useEffect(() => {
    localStorage.setItem('srt_translator_settings', JSON.stringify(settings));
  }, [settings]);

  // Clean up translation ref and timer on unmount
  useEffect(() => {
    return () => {
      isTranslatingRef.current = false;
      isPausedRef.current = false;
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  const scanSpeakers = (blocks: SubtitleBlock[]) => {
    const uniqueSpeakers = Array.from(new Set(
      blocks.map(b => b.speaker).filter((sp): sp is string => sp !== undefined && sp.trim() !== '')
    ));
    
    setSpeakerProfiles(prev => {
      const updated = { ...prev };
      let changed = false;
      uniqueSpeakers.forEach(sp => {
        if (!updated[sp]) {
          updated[sp] = {
            name: sp,
            gender: 'unknown',
            relation: 'casual'
          };
          changed = true;
        }
      });
      return changed ? updated : prev;
    });
  };

  const handleFileUpload = (content: string, name: string) => {
    try {
      if (name.endsWith('.json')) {
        const parsedProject = JSON.parse(content);
        if (parsedProject.subtitles && Array.isArray(parsedProject.subtitles)) {
          setSubtitles(parsedProject.subtitles);
          setFileName(parsedProject.fileName || 'subtitles.srt');
          setIsAss(!!parsedProject.isAss);
          setAssRawLines(parsedProject.assRawLines || []);
          if (parsedProject.speakerProfiles) {
            setSpeakerProfiles(parsedProject.speakerProfiles);
          } else {
            setSpeakerProfiles({});
          }
          if (parsedProject.fileContext) {
            setFileContext(parsedProject.fileContext);
          } else {
            setFileContext('');
          }
          setErrorMessage(null);
          setElapsedTime(parsedProject.elapsedTime || 0);
          stopTimer();
        } else {
          throw new Error('Invalid translation project file structure.');
        }
      } else {
        const isAssFile = name.toLowerCase().endsWith('.ass') || content.includes('[Script Info]');
        setFileContext('');
        if (isAssFile) {
          const { subtitles: parsed, rawLines } = parseASS(content);
          if (parsed.length === 0) {
            throw new Error('No valid ASS dialogue blocks found. Please check file format.');
          }
          setSubtitles(parsed);
          setFileName(name);
          setIsAss(true);
          setAssRawLines(rawLines);
          scanSpeakers(parsed);
          setErrorMessage(null);
          setElapsedTime(0);
          stopTimer();
        } else {
          const parsed = parseSRT(content);
          if (parsed.length === 0) {
            throw new Error('No valid SRT subtitle blocks found. Please check file format.');
          }
          setSubtitles(parsed);
          setFileName(name);
          setIsAss(false);
          setAssRawLines([]);
          scanSpeakers(parsed);
          setErrorMessage(null);
          setElapsedTime(0);
          stopTimer();
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to parse file.');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) handleFileUpload(text, file.name);
      };
      reader.readAsText(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) handleFileUpload(text, file.name);
      };
      reader.readAsText(file);
    }
  };

  const loadSampleSRT = () => {
    handleFileUpload(SAMPLE_SRT, 'sample_english.srt');
  };

  const updateSubtitleTranslation = (index: number, text: string) => {
    setSubtitles(prev => prev.map(sub => {
      if (sub.index === index) {
        return { ...sub, translation: text, status: 'done' };
      }
      return sub;
    }));
  };

  const getUserCorrections = () => {
    return subtitlesRef.current
      .filter(sub => 
        sub.status === 'done' && 
        sub.translation && 
        sub.rawAiTranslation && 
        sub.translation.trim() !== sub.rawAiTranslation.trim()
      )
      .slice(-10)
      .map(sub => ({
        original: sub.text,
        aiTranslation: sub.rawAiTranslation || '',
        userCorrection: sub.translation || ''
      }));
  };

  const startTranslation = async () => {
    if (isTranslating) return;
    
    // Check if starting fresh
    let currentIndex = subtitlesRef.current.findIndex(sub => sub.status !== 'done');
    if (currentIndex === -1 || currentIndex === 0) {
      setElapsedTime(0);
    }

    isTranslatingRef.current = true;
    isPausedRef.current = false;
    setIsTranslating(true);
    setIsPaused(false);
    setErrorMessage(null);
    startTimer();

    // Run loop
    await runTranslationLoop();
  };

  const runTranslationLoop = async () => {
    const currentSettings = settingsRef.current;
    
    // Find index of first subtitle block to translate
    let currentIndex = subtitlesRef.current.findIndex(sub => sub.status !== 'done');
    if (currentIndex === -1) {
      // If all are already translated, start from the beginning
      currentIndex = 0;
      setSubtitles(prev => prev.map(s => ({ ...s, status: 'idle', translation: undefined })));
      // Give React a tick to update state
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    const batchSize = currentSettings.batchSize;
    const currentSubtitles = subtitlesRef.current;
    
    // Partition work into batches
    const batches: SubtitleBlock[][] = [];
    let tempIndex = currentIndex;
    while (tempIndex < currentSubtitles.length) {
      const batch = currentSubtitles
        .slice(tempIndex, tempIndex + batchSize)
        .filter(sub => sub.status !== 'done');
      if (batch.length > 0) {
        batches.push(batch);
      }
      tempIndex += batchSize;
    }

    if (batches.length === 0) {
      isTranslatingRef.current = false;
      setIsTranslating(false);
      return;
    }

    // Determine concurrency based on API source (Local Ollama = 1 worker to avoid overloading, Cloud APIs = 4 workers)
    const concurrency = currentSettings.apiSource === 'local' ? 1 : 4;
    let nextBatchIndex = 0;

    const processNextBatch = async (): Promise<void> => {
      // Keep fetching and processing batches until there are none left, or we are paused/stopped
      while (
        nextBatchIndex < batches.length && 
        isTranslatingRef.current && 
        !isPausedRef.current
      ) {
        const currentBatch = batches[nextBatchIndex++];
        if (!currentBatch) continue;
        
        // Gather context (nearest 3 completed blocks preceding this batch)
        const firstIndexInBatch = currentBatch[0].index;
        const context = subtitlesRef.current
          .filter(sub => sub.index < firstIndexInBatch && sub.status === 'done')
          .slice(-3);

        let success = false;
        let retries = 0;
        const maxRetries = 3;

        while (!success && isTranslatingRef.current && !isPausedRef.current) {
          try {
            // Mark translating
            setSubtitles(prev => prev.map(sub => {
              const isInBatch = currentBatch.some(b => b.index === sub.index);
              return isInBatch 
                ? { 
                    ...sub, 
                    status: 'translating', 
                    errorMsg: retries > 0 ? `Retry attempt ${retries}/${maxRetries}...` : undefined 
                  } 
                : sub;
            }));

            const userCorrections = getUserCorrections();
            const results = await translateBatch(
              currentBatch,
              context,
              currentSettings,
              speakerProfiles,
              userCorrections,
              fileContext,
              retries
            );

            // Update state with results
            setSubtitles(prev => prev.map(sub => {
              const matchedResult = results.find(r => r.index === sub.index);
              const isInBatch = currentBatch.some(b => b.index === sub.index);
              
              if (matchedResult) {
                return { 
                  ...sub, 
                  translation: matchedResult.text, 
                  rawAiTranslation: matchedResult.text,
                  status: 'done',
                  errorMsg: undefined
                };
              } else if (isInBatch) {
                return { 
                  ...sub, 
                  status: 'error', 
                  errorMsg: 'Model omitted this block from the response JSON.' 
                };
              }
              return sub;
            }));
            
            success = true;
          } catch (err: any) {
            console.error(`Batch translation failed (Attempt ${retries + 1}/${maxRetries + 1}):`, err);
            retries++;

            if (retries <= maxRetries && isTranslatingRef.current && !isPausedRef.current) {
              // Wait a bit before retrying (e.g. 1.5 seconds) to allow rate limits to cool down
              const delay = currentSettings.apiSource === 'local' ? 2000 : 1500;
              await new Promise(resolve => setTimeout(resolve, delay));
            } else {
              // Mark batch as error
              setSubtitles(prev => prev.map(sub => {
                const isInBatch = currentBatch.some(b => b.index === sub.index);
                return isInBatch ? { ...sub, status: 'error', errorMsg: err.message || 'API request failed.' } : sub;
              }));

              // Automatically pause on error to avoid endless loop
              pauseTranslation();
              setErrorMessage(`Translation paused due to error: ${err.message || 'Failed connection to API'}`);
              break;
            }
          }
        }

        if (!success) {
          // If a batch failed completely, stop the outer loop
          break;
        }

        // Only delay for local Ollama, cloud calls can proceed immediately
        if (currentSettings.apiSource === 'local') {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    };

    // Spin up concurrent worker threads
    const workers: Promise<void>[] = [];
    const numWorkers = Math.min(concurrency, batches.length);
    for (let i = 0; i < numWorkers; i++) {
      workers.push(processNextBatch());
    }

    await Promise.all(workers);

    isTranslatingRef.current = false;
    setIsTranslating(false);
    stopTimer();
  };

  const pauseTranslation = () => {
    isPausedRef.current = true;
    setIsPaused(true);
    stopTimer();
  };

  const resumeTranslation = async () => {
    isPausedRef.current = false;
    setIsPaused(false);
    isTranslatingRef.current = true;
    setIsTranslating(true);
    setErrorMessage(null);
    startTimer();
    await runTranslationLoop();
  };

  const resetTranslation = () => {
    isTranslatingRef.current = false;
    isPausedRef.current = false;
    setIsTranslating(false);
    setIsPaused(false);
    setSubtitles([]);
    setErrorMessage(null);
    stopTimer();
    setElapsedTime(0);
    setIsAss(false);
    setAssRawLines([]);
    setSpeakerProfiles({});
    setFileContext('');
    localStorage.removeItem('srt_translator_elapsed_time');
    localStorage.removeItem('srt_translator_is_ass');
    localStorage.removeItem('srt_translator_ass_raw_lines');
    localStorage.removeItem('srt_translator_speaker_profiles');
    localStorage.removeItem('srt_translator_file_context');
  };

  const exportTranslatedFile = () => {
    let content = '';
    let mimeType = '';
    let newName = '';
    const langSuffix = '_' + (settings.targetLanguage || 'translation').toLowerCase().replace(/[^a-z0-9]/g, '');
    
    if (isAss) {
      content = compileASS(subtitles, assRawLines);
      mimeType = 'text/x-ass;charset=utf-8';
      newName = fileName.replace(/\.ass$/i, '') + langSuffix + '.ass';
    } else {
      content = compileSRT(subtitles);
      mimeType = 'text/srt;charset=utf-8';
      newName = fileName.replace(/\.srt$/i, '') + langSuffix + '.srt';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = newName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportProject = () => {
    const projectData = {
      fileName,
      subtitles,
      elapsedTime,
      isAss,
      assRawLines,
      speakerProfiles,
      fileContext
    };
    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const extRegex = isAss ? /\.ass$/i : /\.srt$/i;
    const cleanName = fileName.replace(extRegex, '');
    const projectFileName = cleanName + '_translation_project.json';
    link.download = projectFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Stats calculation
  const totalCount = subtitles.length;
  const translatedCount = subtitles.filter(s => s.status === 'done').length;
  const translatingCount = subtitles.filter(s => s.status === 'translating').length;
  const errorCount = subtitles.filter(s => s.status === 'error').length;
  const progressPercent = totalCount > 0 ? Math.round((translatedCount / totalCount) * 100) : 0;
  const successRate = translatedCount > 0 ? Math.round((translatedCount / (translatedCount + errorCount)) * 100) : 100;

  const isCustomOllamaModel = settings.model !== '' && !localModels.includes(settings.model);

  const isCustomGeminiModel = settings.geminiModel !== 'gemini-2.5-flash' && 
                               settings.geminiModel !== 'gemini-2.5-pro' && 
                               settings.geminiModel !== 'gemini-1.5-flash' && 
                               settings.geminiModel !== 'gemini-1.5-pro';

  const isCustomOpenRouterModel = settings.openrouterModel !== 'google/gemma-2-9b-it:free' &&
                                   settings.openrouterModel !== 'google/gemma-2-27b-it:free' &&
                                   settings.openrouterModel !== 'meta-llama/llama-3-8b-instruct:free' &&
                                   settings.openrouterModel !== 'openchat/openchat-7b:free' &&
                                   settings.openrouterModel !== 'qwen/qwen-2.5-72b-instruct' &&
                                   settings.openrouterModel !== 'google/gemini-2.5-flash' &&
                                   settings.openrouterModel !== 'anthropic/claude-3.5-sonnet';

  return (
    <div className="app-container">
      {/* Sidebar: Settings & Stats */}
      <aside className="sidebar">
        <div>
          <div className="app-title-container" style={{ marginBottom: '1.5rem' }}>
            <h1 className="app-title">AI Subtitle Translator</h1>
            <span 
              className="app-tag" 
              style={{ 
                background: settings.apiSource === 'cloud' ? 'var(--color-info-bg)' : settings.apiSource === 'openrouter' ? 'var(--color-warning-bg)' : 'var(--color-success-bg)', 
                color: settings.apiSource === 'cloud' ? 'var(--color-info)' : settings.apiSource === 'openrouter' ? 'var(--color-warning)' : 'var(--color-success)', 
                borderColor: settings.apiSource === 'cloud' ? 'rgba(59, 130, 246, 0.2)' : settings.apiSource === 'openrouter' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)' 
              }}
            >
              {settings.apiSource === 'cloud' ? 'Gemini' : settings.apiSource === 'openrouter' ? 'OpenRouter' : 'Local'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* API Source Segmented Selector */}
            <div className="form-group">
              <label className="form-label">API Source</label>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0.25rem', 
                background: 'rgba(255, 255, 255, 0.03)', 
                padding: '0.25rem', 
                borderRadius: 'var(--radius-sm)', 
                border: '1px solid rgba(255, 255, 255, 0.08)' 
              }}>
                <button
                  type="button"
                  style={{
                    padding: '0.45rem',
                    fontSize: '0.75rem',
                    background: settings.apiSource === 'local' ? 'var(--color-primary)' : 'transparent',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    transition: 'var(--transition-fast)'
                  }}
                  onClick={() => setSettings(prev => ({ ...prev, apiSource: 'local' }))}
                  disabled={isTranslating}
                >
                  Local
                </button>
                <button
                  type="button"
                  style={{
                    padding: '0.45rem',
                    fontSize: '0.75rem',
                    background: settings.apiSource === 'cloud' ? 'var(--color-primary)' : 'transparent',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    transition: 'var(--transition-fast)'
                  }}
                  onClick={() => setSettings(prev => ({ ...prev, apiSource: 'cloud' }))}
                  disabled={isTranslating}
                >
                  Gemini
                </button>
                <button
                  type="button"
                  style={{
                    padding: '0.45rem',
                    fontSize: '0.75rem',
                    background: settings.apiSource === 'openrouter' ? 'var(--color-primary)' : 'transparent',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    transition: 'var(--transition-fast)'
                  }}
                  onClick={() => setSettings(prev => ({ ...prev, apiSource: 'openrouter' }))}
                  disabled={isTranslating}
                >
                  Router
                </button>
              </div>
            </div>

            {/* Local Ollama Settings */}
            {settings.apiSource === 'local' && (
              <>
                <div className="form-group">
                  <label className="form-label">Ollama Host URL</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settings.url}
                    onChange={e => setSettings(prev => ({ ...prev, url: e.target.value }))}
                    disabled={isTranslating}
                  />
                </div>

                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>Model Name</label>
                    <button
                      type="button"
                      onClick={() => fetchLocalModels(false)}
                      disabled={isTranslating || isFetchingModels}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-secondary)',
                        cursor: 'pointer',
                        fontSize: '0.725rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        padding: '2px 4px',
                        borderRadius: '4px',
                        opacity: isTranslating ? 0.5 : 1
                      }}
                      title="Reload local models"
                    >
                      <span style={{ display: 'inline-block', animation: isFetchingModels ? 'spin 1s linear infinite' : 'none' }}>
                        🔄
                      </span>
                      {isFetchingModels ? 'Loading...' : 'Reload'}
                    </button>
                  </div>
                  <select
                    className="form-select"
                    value={isCustomOllamaModel ? 'custom' : settings.model}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === 'custom') {
                        setSettings(prev => ({ ...prev, model: '' }));
                      } else {
                        setSettings(prev => ({ ...prev, model: val }));
                      }
                    }}
                    disabled={isTranslating}
                  >
                    {localModels.length === 0 ? (
                      <option value="">No local models detected</option>
                    ) : (
                      <>
                        <option value="">Select a local model...</option>
                        {localModels.map(modelName => (
                          <option key={modelName} value={modelName}>{modelName}</option>
                        ))}
                      </>
                    )}
                    <option value="custom">Custom Model Name...</option>
                  </select>
                  {localModels.length === 0 && (
                    <div style={{ fontSize: '0.65rem', color: 'var(--color-danger)', marginTop: '0.35rem', lineHeight: '1.2' }}>
                      Could not connect to Ollama. Make sure Ollama is running (`ollama serve`) and accessible.
                    </div>
                  )}
                </div>

                {isCustomOllamaModel && (
                  <div className="form-group">
                    <label className="form-label">Enter Custom Model Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. gemma:2b"
                      value={settings.model}
                      onChange={e => setSettings(prev => ({ ...prev, model: e.target.value }))}
                      disabled={isTranslating}
                    />
                  </div>
                )}
              </>
            )}

            {/* Cloud Gemini Settings */}
            {settings.apiSource === 'cloud' && (
              <>
                <div className="form-group">
                  <label className="form-label">
                    <span>Gemini API Key</span>
                    <button
                      type="button"
                      style={{ background: 'transparent', border: 'none', color: 'var(--color-secondary)', cursor: 'pointer', fontSize: '0.75rem' }}
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? 'Hide' : 'Show'}
                    </button>
                  </label>
                  <textarea
                    className="form-textarea"
                    style={{ height: '60px', resize: 'vertical', WebkitTextSecurity: showApiKey ? 'none' : 'disc' } as any}
                    placeholder="Enter API keys (one per line)..."
                    value={settings.geminiApiKey}
                    onChange={e => setSettings(prev => ({ ...prev, geminiApiKey: e.target.value }))}
                    disabled={isTranslating}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Gemini Model</label>
                  <select
                    className="form-select"
                    value={isCustomGeminiModel ? 'custom' : settings.geminiModel}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === 'custom') {
                        setSettings(prev => ({ ...prev, geminiModel: '' }));
                      } else {
                        setSettings(prev => ({ ...prev, geminiModel: val }));
                      }
                    }}
                    disabled={isTranslating}
                  >
                    <option value="gemini-2.5-flash">gemini-2.5-flash (Recommended & Fast)</option>
                    <option value="gemini-2.5-pro">gemini-2.5-pro (High Quality)</option>
                    <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                    <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                    <option value="custom">Custom Gemini Model...</option>
                  </select>
                </div>

                {isCustomGeminiModel && (
                  <div className="form-group">
                    <label className="form-label">Enter Custom Gemini Model</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. gemini-2.0-flash-exp"
                      value={settings.geminiModel}
                      onChange={e => setSettings(prev => ({ ...prev, geminiModel: e.target.value }))}
                      disabled={isTranslating}
                    />
                  </div>
                )}
              </>
            )}

            {/* Cloud OpenRouter Settings */}
            {settings.apiSource === 'openrouter' && (
              <>
                <div className="form-group">
                  <label className="form-label">
                    <span>OpenRouter API Key</span>
                    <button
                      type="button"
                      style={{ background: 'transparent', border: 'none', color: 'var(--color-secondary)', cursor: 'pointer', fontSize: '0.75rem' }}
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? 'Hide' : 'Show'}
                    </button>
                  </label>
                  <textarea
                    className="form-textarea"
                    style={{ height: '60px', resize: 'vertical', WebkitTextSecurity: showApiKey ? 'none' : 'disc' } as any}
                    placeholder="Enter API keys (one per line)..."
                    value={settings.openrouterApiKey || ''}
                    onChange={e => setSettings(prev => ({ ...prev, openrouterApiKey: e.target.value }))}
                    disabled={isTranslating}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">OpenRouter Model</label>
                  <select
                    className="form-select"
                    value={isCustomOpenRouterModel ? 'custom' : settings.openrouterModel}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === 'custom') {
                        setSettings(prev => ({ ...prev, openrouterModel: '' }));
                      } else {
                        setSettings(prev => ({ ...prev, openrouterModel: val }));
                      }
                    }}
                    disabled={isTranslating}
                  >
                    <option value="google/gemma-2-9b-it:free">Gemma 2 9B IT (Free)</option>
                    <option value="google/gemma-2-27b-it:free">Gemma 2 27B IT (Free)</option>
                    <option value="meta-llama/llama-3-8b-instruct:free">Llama 3 8B IT (Free)</option>
                    <option value="openchat/openchat-7b:free">OpenChat 7B (Free)</option>
                    <option value="qwen/qwen-2.5-72b-instruct">Qwen 2.5 72B Instruct</option>
                    <option value="google/gemini-2.5-flash">Gemini 2.5 Flash</option>
                    <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                    <option value="custom">Custom Model Name...</option>
                  </select>
                </div>

                {isCustomOpenRouterModel && (
                  <div className="form-group">
                    <label className="form-label">Enter Custom Model Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. meta-llama/llama-3.1-405b-instruct"
                      value={settings.openrouterModel}
                      onChange={e => setSettings(prev => ({ ...prev, openrouterModel: e.target.value }))}
                      disabled={isTranslating}
                    />
                  </div>
                )}
              </>
            )}

            <div className="form-group">
              <label className="form-label">Target Language</label>
              <select
                className="form-select"
                value={
                  settings.targetLanguage === 'Myanmar' ||
                  settings.targetLanguage === 'Spanish' ||
                  settings.targetLanguage === 'French' ||
                  settings.targetLanguage === 'Japanese' ||
                  settings.targetLanguage === 'German' ||
                  settings.targetLanguage === 'Thai' ||
                  settings.targetLanguage === 'Chinese' ||
                  settings.targetLanguage === 'Korean' ||
                  settings.targetLanguage === 'Vietnamese'
                    ? settings.targetLanguage
                    : 'custom'
                }
                onChange={e => {
                  const val = e.target.value;
                  if (val === 'custom') {
                    setSettings(prev => ({
                      ...prev,
                      targetLanguage: '',
                      systemPrompt: getSystemPrompt(prev.tone, '')
                    }));
                  } else {
                    setSettings(prev => ({
                      ...prev,
                      targetLanguage: val,
                      systemPrompt: getSystemPrompt(prev.tone, val)
                    }));
                  }
                }}
                disabled={isTranslating}
              >
                <option value="Myanmar">Myanmar (Burmese)</option>
                <option value="Spanish">Spanish</option>
                <option value="French">French</option>
                <option value="Japanese">Japanese</option>
                <option value="German">German</option>
                <option value="Thai">Thai</option>
                <option value="Chinese">Chinese</option>
                <option value="Korean">Korean</option>
                <option value="Vietnamese">Vietnamese</option>
                <option value="custom">Custom...</option>
              </select>
            </div>

            {settings.targetLanguage !== 'Myanmar' &&
              settings.targetLanguage !== 'Spanish' &&
              settings.targetLanguage !== 'French' &&
              settings.targetLanguage !== 'Japanese' &&
              settings.targetLanguage !== 'German' &&
              settings.targetLanguage !== 'Thai' &&
              settings.targetLanguage !== 'Chinese' &&
              settings.targetLanguage !== 'Korean' &&
              settings.targetLanguage !== 'Vietnamese' && (
                <div className="form-group">
                  <label className="form-label">Enter Custom Target Language</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Italian"
                    value={settings.targetLanguage}
                    onChange={e => {
                      const val = e.target.value;
                      setSettings(prev => ({
                        ...prev,
                        targetLanguage: val,
                        systemPrompt: getSystemPrompt(prev.tone, val)
                      }));
                    }}
                    disabled={isTranslating}
                  />
                </div>
              )}

            <div className="form-group">
              <label className="form-label">Translation Tone / Style</label>
              <select
                className="form-select"
                value={settings.tone}
                onChange={e => {
                  const newTone = e.target.value;
                  setSettings(prev => ({
                    ...prev,
                    tone: newTone,
                    systemPrompt: getSystemPrompt(newTone, prev.targetLanguage)
                  }));
                }}
                disabled={isTranslating}
              >
                <option value="casual">Casual Dialogue</option>
                <option value="polite">Polite Speech</option>
                <option value="technical">Technical / Tutorial</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Default Pronoun Style (Myanmar Only)</label>
              <select
                className="form-select"
                value={settings.pronounStyle}
                onChange={e => {
                  const newStyle = e.target.value as any;
                  setSettings(prev => ({
                    ...prev,
                    pronounStyle: newStyle
                  }));
                }}
                disabled={isTranslating || (settings.targetLanguage.toLowerCase() !== 'myanmar' && settings.targetLanguage.toLowerCase() !== 'burmese')}
              >
                <option value="casual">Casual Peer (ငါ / နင် / မင်း)</option>
                <option value="polite">Polite Spoken (ကျွန်တော် / ကျွန်မ)</option>
                <option value="omit">Neutral / Omit Pronouns (ချန်လှပ်ခြင်း)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                <span>Batch Size</span>
                <span style={{ color: 'var(--color-secondary)' }}>{settings.batchSize} lines</span>
              </label>
              <input
                type="range"
                min="1"
                max="30"
                step="1"
                style={{ width: '100%' }}
                value={settings.batchSize}
                onChange={e => setSettings(prev => ({ ...prev, batchSize: parseInt(e.target.value, 10) }))}
                disabled={isTranslating}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <span>Temperature</span>
                <span style={{ color: 'var(--color-secondary)' }}>{settings.temperature}</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                style={{ width: '100%' }}
                value={settings.temperature}
                onChange={e => setSettings(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                disabled={isTranslating}
              />
            </div>

            <div className="form-group">
              <label className="form-label">System Instruction Prompt</label>
              <textarea
                className="form-textarea"
                style={{ height: '140px', fontSize: '0.75rem' }}
                value={settings.systemPrompt}
                onChange={e => setSettings(prev => ({ ...prev, systemPrompt: e.target.value }))}
                disabled={isTranslating}
              />
            </div>
          </div>
        </div>

        {/* Story & Context Analysis Card */}
        {totalCount > 0 && (
          <div className="glass-panel sidebar-card" style={{ marginTop: '1rem', padding: '1rem 1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>📖</span> Story & Context
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.25rem', height: 'auto', background: 'rgba(255, 255, 255, 0.05)' }}
                onClick={async () => {
                  setIsAnalyzingContext(true);
                  try {
                    const summary = await analyzeFileContext(subtitles, settings);
                    setFileContext(summary);
                  } catch (e: any) {
                    alert(`Failed to analyze context: ${e.message}`);
                  } finally {
                    setIsAnalyzingContext(false);
                  }
                }}
                disabled={isTranslating || isAnalyzingContext}
              >
                {isAnalyzingContext ? (
                  <>
                    <span className="spinner" style={{ width: '10px', height: '10px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', margin: 0, display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }}></span>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <span>🔍</span> Analyze
                  </>
                )}
              </button>
            </h3>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.50rem' }}>
              Provide overall context (genre, setting, plot) to improve the AI's pronoun and tone choices.
            </p>
            <textarea
              className="form-input"
              style={{
                width: '100%',
                height: '80px',
                fontSize: '0.75rem',
                padding: '0.4rem',
                resize: 'vertical',
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                lineHeight: '1.4'
              }}
              placeholder="e.g. John and Mary are friendly classmates discussing a project. The tone should be casual peer spoken Myanmar."
              value={fileContext}
              onChange={e => setFileContext(e.target.value)}
              disabled={isTranslating || isAnalyzingContext}
            />
          </div>
        )}

        {/* Speaker Profiles Card */}
        {totalCount > 0 && Object.keys(speakerProfiles).length > 0 && (
          <div className="glass-panel sidebar-card" style={{ marginTop: '1rem', padding: '1rem 1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>👥</span> Speaker Profiles & Relations
            </h3>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
              Configure character genders and relationship tones so the AI outputs correct pronouns.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '0.25rem' }}>
              {Object.values(speakerProfiles).map(profile => (
                <div key={profile.name} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }} title={profile.name}>
                      {profile.name}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '0.4rem' }}>
                    <select
                      className="form-select"
                      style={{ padding: '0.25rem 0.4rem', fontSize: '0.75rem', height: 'auto' }}
                      value={profile.gender}
                      onChange={e => {
                        const newGender = e.target.value as any;
                        setSpeakerProfiles(prev => ({
                          ...prev,
                          [profile.name]: { ...prev[profile.name], gender: newGender }
                        }));
                      }}
                      disabled={isTranslating}
                    >
                      <option value="unknown">Gender: ?</option>
                      <option value="male">Male (ကျား)</option>
                      <option value="female">Female (မ)</option>
                    </select>
                    <select
                      className="form-select"
                      style={{ padding: '0.25rem 0.4rem', fontSize: '0.75rem', height: 'auto' }}
                      value={profile.relation}
                      onChange={e => {
                        const newRelation = e.target.value as any;
                        setSpeakerProfiles(prev => ({
                          ...prev,
                          [profile.name]: { ...prev[profile.name], relation: newRelation }
                        }));
                      }}
                      disabled={isTranslating}
                    >
                      <option value="casual">Casual (ငါ/နင်)</option>
                      <option value="polite">Polite (ကျွန်တော်/ကျွန်မ)</option>
                      <option value="lover">Lover (ကိုယ်/မောင်/မမ)</option>
                      <option value="omit">Omit (နာမ်စားချန်)</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Translation Stats Card */}
        {totalCount > 0 && (
          <div className="glass-panel" style={{ marginTop: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Translation Statistics</h3>
            
            <div className="translation-stats" style={{ gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div className="stat-card" style={{ padding: '0.5rem' }}>
                <span className="stat-label">Total</span>
                <span className="stat-value" style={{ fontSize: '1rem' }}>{totalCount}</span>
              </div>
              <div className="stat-card" style={{ padding: '0.5rem' }}>
                <span className="stat-label">Translated</span>
                <span className="stat-value" style={{ fontSize: '1rem', color: 'var(--color-success)' }}>{translatedCount}</span>
              </div>
              <div className="stat-card" style={{ padding: '0.5rem' }}>
                <span className="stat-label">Active</span>
                <span className="stat-value" style={{ fontSize: '1rem', color: 'var(--color-secondary)' }}>{translatingCount}</span>
              </div>
              <div className="stat-card" style={{ padding: '0.5rem' }}>
                <span className="stat-label">Errors</span>
                <span className="stat-value" style={{ fontSize: '1rem', color: errorCount > 0 ? 'var(--color-danger)' : 'var(--text-muted)' }}>{errorCount}</span>
              </div>
            </div>

            {translatedCount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.725rem', color: 'var(--text-secondary)' }}>
                <span>Success Rate:</span>
                <span style={{ fontWeight: 600, color: successRate > 85 ? 'var(--color-success)' : 'var(--color-warning)' }}>{successRate}%</span>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* Main Workspace Area */}
      <main className="main-content">
        {/* Top Header */}
        <header className="app-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.25rem' }}>🎬</span>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{settings.targetLanguage || 'Translation'} Workspace</h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {totalCount > 0 ? `Active File: ${fileName}` : 'Upload a subtitle file to start translating'}
              </p>
            </div>
          </div>

          {totalCount > 0 && (
            <div className="control-buttons">
              {!isTranslating && !isPaused && (
                <button className="btn btn-primary" onClick={startTranslation}>
                  <span>▶</span> Start Translation
                </button>
              )}

              {isTranslating && !isPaused && (
                <button className="btn btn-secondary" onClick={pauseTranslation}>
                  <span>⏸</span> Pause
                </button>
              )}

              {isPaused && (
                <button className="btn btn-primary" onClick={resumeTranslation}>
                  <span>▶</span> Resume
                </button>
              )}

              <button className="btn btn-secondary" onClick={exportProject}>
                <span>💾</span> Save Project (.json)
              </button>

              <button className="btn btn-secondary" onClick={exportTranslatedFile} disabled={translatedCount === 0}>
                <span>📥</span> {isAss ? 'Export Translated ASS' : 'Export Translated SRT'}
              </button>

              <button className="btn btn-secondary" style={{ color: 'var(--color-danger)' }} onClick={resetTranslation}>
                Reset
              </button>
            </div>
          )}
        </header>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="glass-panel" style={{ background: 'var(--color-danger-bg)', borderColor: 'rgba(239, 68, 68, 0.2)', padding: '0.75rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--color-danger)', fontSize: '0.85rem', fontWeight: 500 }}>⚠️ {errorMessage}</span>
            <button style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '1rem' }} onClick={() => setErrorMessage(null)}>×</button>
          </div>
        )}

        {totalCount === 0 ? (
          /* Empty / Upload View */
          <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div
              className="upload-container"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept=".srt,.ass,.json"
                style={{ display: 'none' }}
                onChange={handleFileInput}
              />
              <div className="upload-icon" style={{ fontSize: '3rem' }}>📂</div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>Drag & Drop Subtitles or Project</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem', maxWidth: '380px', marginInline: 'auto' }}>
                Select or drag a SubRip (.srt), Advanced SubStation Alpha (.ass), or a saved translation project (.json) from your local computer to start.
              </p>
              <button className="btn btn-secondary" onClick={(e) => { e.stopPropagation(); document.getElementById('file-input')?.click(); }}>
                Browse Files
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginTop: '2rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No SRT files on hand?</span>
              <button className="btn btn-secondary" style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }} onClick={loadSampleSRT}>
                Load Sample Subtitles
              </button>
            </div>
          </div>
        ) : (
          /* Main Workspace Dashboard */
          <>
            {/* Progress Panel */}
            <div className="glass-panel" style={{ padding: '1rem 1.25rem' }}>
              <div className="progress-container">
                <div className="progress-header">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {isTranslating && <span className="spinner"></span>}
                      {progressPercent === 100 && totalCount > 0 && !isTranslating && <span style={{ fontSize: '1rem' }}>🎉</span>}
                      <span style={{ fontWeight: 600 }}>
                        {isTranslating 
                          ? 'AI is translating...' 
                          : progressPercent === 100 && totalCount > 0
                            ? 'Translation Completed!'
                            : isPaused 
                              ? 'Translation Paused' 
                              : 'Ready'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      <span>Status: {progressPercent === 100 && totalCount > 0 ? 'Done' : isTranslating ? 'In Progress' : isPaused ? 'Paused' : 'Idle'}</span>
                      {elapsedTime > 0 && (
                        <>
                          <span style={{ color: 'var(--text-muted)' }}>|</span>
                          <span style={{ fontWeight: 500, color: isTranslating ? 'var(--color-secondary)' : 'var(--text-secondary)' }}>
                            Time: {formatDuration(elapsedTime)}
                          </span>
                        </>
                      )}
                    </div>
                    {isPaused && !isTranslating && (
                      <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        ℹ️ Job progress saved. You can change settings/model in the sidebar and click Resume.
                      </span>
                    )}
                  </div>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>{progressPercent}% Complete</span>
                </div>
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
                </div>
              </div>
            </div>

            {/* Unified Side-by-Side Workspace */}
            <div className="workspace-column" style={{ flex: 1 }}>
              <div className="column-header">
                <div style={{ display: 'grid', gridTemplateColumns: '60px 130px 1fr 1fr', width: '100%', paddingRight: '20px' }}>
                  <span>#</span>
                  <span>Timing</span>
                  <span>Original (English)</span>
                  <span style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{settings.targetLanguage || 'Target'} Translation</span>
                    <span style={{ color: 'var(--color-success)', fontSize: '0.8rem' }}>{translatedCount}/{totalCount} Done</span>
                  </span>
                </div>
              </div>
              <div className="column-body" style={{ overflowY: 'auto' }}>
                <div className="subtitles-list">
                  {subtitles.map((sub) => (
                    <div 
                      key={`row-${sub.index}`} 
                      id={`row-${sub.index}`}
                      className={`subtitle-row ${sub.status === 'translating' ? 'translating' : sub.status === 'error' ? 'error' : ''}`}
                    >
                      <div className="cell-index">{sub.index}</div>
                      <div className="cell-time">
                        <span>{sub.start}</span>
                        <span style={{ color: 'var(--text-muted)' }}>➔</span>
                        <span>{sub.end}</span>
                      </div>
                      <div className="cell-text">{sub.text}</div>
                      <div className="cell-text translation-cell" style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.03)' }}>
                        <textarea
                          className="cell-text-input"
                          value={sub.translation || ''}
                          placeholder={sub.status === 'translating' ? 'Translating...' : 'Awaiting translation...'}
                          onChange={(e) => updateSubtitleTranslation(sub.index, e.target.value)}
                        />
                        {sub.status !== 'idle' && (
                          <span 
                            className={`status-badge ${sub.status}`}
                            title={sub.errorMsg}
                          >
                            {sub.status === 'translating' ? 'Translating' : sub.status === 'error' ? 'Error' : 'Done'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
