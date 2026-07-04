import type { SubtitleBlock } from '../types';

export function parseSRT(content: string): SubtitleBlock[] {
  // Normalize line endings to LF
  const normalized = content.replace(/\r\n/g, '\n').trim();
  
  // Split by double newlines or more
  const rawBlocks = normalized.split(/\n\s*\n+/);
  const blocks: SubtitleBlock[] = [];

  for (const rawBlock of rawBlocks) {
    const lines = rawBlock.split('\n').map(line => line.trim()).filter(line => line !== '');
    if (lines.length < 3) continue;

    // Line 1 is the index
    const index = parseInt(lines[0], 10);
    if (isNaN(index)) continue;

    // Line 2 is the timestamp range
    const timestampLine = lines[1];
    if (!timestampLine.includes('-->')) continue;
    const [start, end] = timestampLine.split('-->').map(t => t.trim());

    // Line 3 and onwards are subtitle texts
    const text = lines.slice(2).join('\n');

    // Parse speaker name if text matches "Name: Dialogue"
    const speakerMatch = text.match(/^([A-Za-z0-9\s-]{1,15}):\s*(.*)/s);
    let speaker: string | undefined = undefined;
    if (speakerMatch) {
      const nameCandidate = speakerMatch[1].trim();
      const rest = (speakerMatch[2] || '').trim();
      if (!nameCandidate.match(/^(http|https|ftp)$/i) && !rest.startsWith('//')) {
        speaker = nameCandidate;
      }
    }

    blocks.push({
      index,
      start,
      end,
      text,
      status: 'idle',
      speaker
    });
  }

  return blocks;
}

export function compileSRT(blocks: SubtitleBlock[]): string {
  return blocks
    .map(block => {
      const outputText = block.translation !== undefined && block.translation.trim() !== '' 
        ? block.translation 
        : block.text;
      return `${block.index}\n${block.start} --> ${block.end}\n${outputText}`;
    })
    .join('\n\n') + '\n';
}

function getNthOccurrenceIndex(str: string, char: string, n: number): number {
  let idx = -1;
  for (let i = 0; i < n; i++) {
    idx = str.indexOf(char, idx + 1);
    if (idx === -1) return -1;
  }
  return idx;
}

export interface ASSParseResult {
  subtitles: SubtitleBlock[];
  rawLines: string[];
}

export function parseASS(content: string): ASSParseResult {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const subtitles: SubtitleBlock[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('Dialogue:')) {
      const commaIndex = getNthOccurrenceIndex(line, ',', 9);
      if (commaIndex !== -1) {
        const prefix = line.substring(0, commaIndex + 1);
        const text = line.substring(commaIndex + 1);
        const parts = prefix.split(',');

        const start = (parts[1] || '').trim();
        const end = (parts[2] || '').trim();
        const speaker = (parts[4] || '').trim();

        subtitles.push({
          index: subtitles.length + 1,
          start,
          end,
          text,
          status: 'idle',
          rawAssPrefix: prefix,
          rawAssLineIndex: i,
          speaker: speaker !== '' ? speaker : undefined
        });
      }
    }
  }

  return { subtitles, rawLines: lines };
}

export function compileASS(blocks: SubtitleBlock[], rawLines: string[]): string {
  const lines = [...rawLines];
  for (const block of blocks) {
    if (block.rawAssLineIndex !== undefined && block.rawAssPrefix !== undefined) {
      const outputText = block.translation !== undefined && block.translation.trim() !== '' 
        ? block.translation 
        : block.text;
      lines[block.rawAssLineIndex] = `${block.rawAssPrefix}${outputText}`;
    }
  }
  return lines.join('\n');
}

