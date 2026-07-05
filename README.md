# AI Subtitle Translator

A premium, modern web application designed for context-aware translation of subtitle files (`.srt`, `.ass`) and video containers (`.mkv`) using both local Large Language Models (LLMs via Ollama) and cloud-based AI providers (Gemini API and OpenRouter).

The application is built using **React, Vite, and strict TypeScript**, styled with custom **Vanilla CSS** following glassmorphism design principles.

---

## 🌟 Key Features

### 1. File Format Support (`.srt`, `.ass` & `.mkv`)
- **Subtitle Parsing & Preservation**: Fully parses SubRip (`.srt`), Advanced SubStation Alpha (`.ass`), and embedded video containers (`.mkv`).
- **Browser-Side MKV Extraction**: Upload `.mkv` video files directly. The client-side binary parser extracts embedded subtitle tracks in 10MB streaming chunks without uploading your video to any server. If multiple tracks are detected, an interactive modal allows you to choose your desired track.
- **ASS Formatting & Style Preservation**: Dialogue lines are extracted dynamically while completely preserving headers, scripts info, comment blocks, styles, and other metadata. Styling overrides inside dialogue tags (e.g. `{\i1}`, `{\fade(200,200)}`, `{\pos(100,200)}`) are locked in place and translated in their relative positions.
- **Project Save/Resume**: Export and import your ongoing translation workspaces as `.json` translation projects to preserve all timing, styles, settings, and progress.

### 2. Context-Aware Translation
- Subtitles are grouped into adjustable batch sizes (5 to 30 lines) and sent to the LLM with the preceding translated blocks as context. This ensures correct grammatical flow, pronoun consistency, and natural spoken dialogues.

### 3. Story & Context Pre-Analysis
- Upload a file and let the AI analyze a sample (first 80 lines) of the subtitles to extract the **Genre, Plot/Situation, and overall Tone** of the video.
- The summary is fully editable by the user and is automatically injected as global context to guide the LLM's translation choices for subsequent batches.

### 4. Dynamic Local Model Loader & Refresher
- Removes hardcoded Ollama models. On startup, it dynamically fetches currently installed/downloaded models from your local Ollama tags API.
- Features a **Reload (🔄)** button to refresh the model list instantly if you download a new model externally.
- Shows clear troubleshooting indicators if Ollama is not detected or stopped.

### 5. Multi-Language Target Selector
- Select your target language dynamically (e.g., Myanmar, Spanish, French, Japanese, German, Thai, Chinese, Korean, Vietnamese, or custom input).
- System prompts are dynamically resolved based on the selected target language.

### 6. Speaker Profiles & Relation Mapping (Myanmar Specific)
- Automatically scans dialogue lines for character names.
- Map character genders (Male/Female/Unknown) and relationship status (Polite, Casual, Lover, Omit) in the sidebar.
- Guides the AI to translate pronouns and conversational ending particles (such as polite `ကျွန်တော်`/`ကျွန်မ` or casual `ငါ`/`နင်`) with 100% precision.

### 7. In-Context Learning (Feedback Loop)
- The app monitors manual edits you make in the workspace.
- Modified translations are fed back into subsequent requests as live few-shot learning references, allowing the LLM to learn your vocabulary, styling preferences, and corrections on the fly.

---

## 🛠️ Tech Stack & Architecture

- **Frontend Framework**: React 18+ (Vite, Strict TypeScript)
- **Styling**: Vanilla CSS (sleek dark mode, neon accents, and smooth glassmorphism effects)
- **Typography**: Google Fonts (Outfit & Inter)
- **Build Tool**: Vite

---

## 🚀 Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) (v18+) and npm installed.

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/thihabobo/ai-subtitle-translator.git
   cd ai-subtitle-translator
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:5173](http://localhost:5173) in your web browser.

---

## 🤖 Translators & API Configuration

### 1. Local Ollama (Offline & Free)
- Ensure [Ollama](https://ollama.com/) is installed and running:
  ```bash
  ollama serve
  ```
- Make sure you have pulled a model (e.g., `gemma2`, `qwen2.5`, `llama3`):
  ```bash
  ollama pull gemma:2b
  ```
- By default, Vite requests local APIs from `http://localhost:11434`. Make sure Ollama's CORS origins are configured if running on custom ports.

### 2. Cloud Gemini API
- Enter your Gemini API Key in the settings panel.
- Choose from models like `gemini-2.5-flash` or `gemini-1.5-pro`.
- Supports API Key rotation (comma-separated keys) to distribute request loads.

### 3. Cloud OpenRouter API
- Enter your OpenRouter API Key.
- Select from various hosted models (e.g. Gemma 2, Llama 3, Qwen) or input a custom model identifier.

---

## 📄 License
This project is licensed under the MIT License. Feel free to use and customize it!
