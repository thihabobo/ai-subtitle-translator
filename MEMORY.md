# MEMORY

* **2026-07-05**: Added browser-side MKV subtitle extraction feature.
  * Installed `matroska-subtitles` library and configured Vite resolve alias for lightweight browser-safe execution.
  * Added `src/utils/mkvExtractor.ts` using binary FileReader slicing to read large MKV files in 10MB chunks.
  * Implemented beautiful glassmorphic UI modals for subtitle track selection and extraction progress tracking.
  * Supported parsing of both SRT and ASS tracks embedded inside MKV containers, automatically loading them into the workspace.
  * Committed and pushed to GitHub main branch.

* **2026-07-04**: Added dynamic Target Language Selection and rebranded the app to "AI Subtitle Translator".
  * Added `targetLanguage: string` config to `TranslatorSettings` in `types.ts`.
  * Rebranded UI titles, headers, and window titles to "AI Subtitle Translator".
  * Replaced static prompt templates with `getSystemPrompt(tone, targetLanguage)` function, allowing custom prompts per language.
  * Added "Target Language" dropdown settings card supporting Myanmar, Spanish, French, Japanese, German, Thai, Chinese, Korean, Vietnamese, or custom input.
  * Dynamically updated export filenames based on the target language (e.g. `_spanish.srt` or `_myanmar.ass`).
  * Created a complete English `README.md` in the project root containing dynamic settings, setup guides, and Ollama/Gemini integration instructions.
  * Confirmed TypeScript compilation (`npx tsc --noEmit`) and verified prompt mappings using test scripts.
  * Initialized local Git repository, created `main` branch, linked remote origin to `https://github.com/thihabobo/ai-subtitle-translator.git`, and created the initial commit.

* **2026-06-30**: Implemented Pre-Translation Context Analysis and Dynamic Model Listing/Reloading.
  * Created `src/utils/contextAnalyzer.ts` helper to generate a global context summary.
  * Integrated `fileContext` into API payload structures and system prompts for Ollama, Gemini, and OpenRouter.
  * Added a new "Story & Context" UI panel in the settings sidebar with an "Auto-Analyze" button and editable context textarea.
  * Removed hardcoded Ollama models, loading installed models dynamically on startup.
  * Added a manual "Reload" (🔄) button next to "Model Name" to update the local model list dynamically.
  * Added localStorage sync and project file integration for `fileContext`.

* **2026-06-29**: Implemented Pronoun Styles, Speaker Profiles, and In-Context Learning.
  * Added `SpeakerProfile` interface, `pronounStyle` settings, and subtitle block metadata (`speaker` and `rawAiTranslation`).
  * Upgraded `parseSRT` and `parseASS` to scan and detect speaker names from files.
  * Created a "Speakers & Pronouns" panel in the sidebar UI to configure each character's gender and relation tone.
  * Added a dynamic learning loop (`getUserCorrections()`) to track user edits and feed them back to LLM requests as in-context learning references.
  * Updated API payloads and system instructions for Ollama, Gemini, and OpenRouter to conform to the pronoun styles, speaker profiles, and user corrections.
  * Confirmed TypeScript compilation (`npx tsc --noEmit`) and verified parsing logic using programmatic tests.

* **2026-06-25**: Implemented full ASS subtitle format support.
  * Added `rawAssPrefix` and `rawAssLineIndex` properties to `SubtitleBlock` in `types.ts`.
  * Wrote `parseASS` and `compileASS` parser/compiler utilities in `src/utils/srtParser.ts`.
  * Integrated format auto-detection in `App.tsx` handleFileUpload to support `.ass` files seamlessly.
  * Updated translation system prompt templates (Casual, Polite, Technical) to explicitly instruct models to preserve ASS style tags (e.g. `{\i1}`) in their relative positions.
  * Updated file export and project load/save states to support ASS.
  * Verified full type safety with `npx tsc --noEmit` and programmatically validated parsing correctness using a new `sample.ass` test file.

## Project Context
* **Project Name**: Natural Myanmar Subtitle Translator Web Application
* **Stack**: React (Vite + TypeScript), Vanilla CSS
* **Translators**: Local Ollama (with gemma4:latest), Cloud Gemini API (gemini-2.5-flash/gemini-1.5-pro), OpenRouter API
* **Current Goal**: Add support for parsing, translating, and exporting `.ass` (Advanced SubStation Alpha) subtitle files while preserving their formatting, styles, and headers.

## Architectural Decisions
1. **Context-Aware Translation**: Group subtitles into batches (default 5, adjustable up to 30) and include the preceding 3 translated blocks as reference context for natural pronoun resolution and conversational particle choice in Myanmar translation.
2. **Local Persistence**: Save subtitle state, translation progress, and configurations to `localStorage` automatically to support auto-resume.
3. **Project File format**: Export and import workspace backups as `.json` project files.
4. **ASS Support Architecture**: 
   * Parse ASS files by splitting into lines (`assRawLines`).
   * Match lines starting with `Dialogue:`. Parse start/end times and extract text by splitting at the 9th comma.
   * Store `rawAssPrefix` and the original line index `rawAssLineIndex` in `SubtitleBlock` in `types.ts`.
   * Reconstruct the translation by replacing the dialogue text in the cloned lines array, preserving header sections, comment lines, styles, and other metadata completely.

## Current Status & TODOs
* [x] Add ASS properties to `SubtitleBlock` in `src/types.ts`
* [x] Implement ASS parser and compiler in `src/utils/srtParser.ts`
* [x] Update `App.tsx` state and file upload to support ASS format detection
* [x] Update `App.tsx` export/download and project export/import
* [x] Update system prompts to instruct translation models to preserve style tags (e.g., `{\i1}`)
* [x] Verify type safety and functionality with tests
