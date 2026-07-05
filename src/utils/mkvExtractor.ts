/// <reference path="../mkv-subtitles.d.ts" />
import * as MatroskaSubtitles from 'matroska-subtitles';
import type { SubtitleBlock } from '../types';

// Resolve UMD/CommonJS/ESM exports mismatch
const MatroskaSubtitlesAny = MatroskaSubtitles as any;
const SubtitleParserConstructor = MatroskaSubtitlesAny.SubtitleParser || MatroskaSubtitlesAny.default?.SubtitleParser || MatroskaSubtitlesAny;

export interface MKVTrack {
  number: number;
  language: string;
  type: string; // e.g. 'srt', 'ass', etc.
  name?: string;
}

export function extractSubtitlesFromMKV(
  file: File,
  onTracksFound: (tracks: MKVTrack[]) => Promise<number>,
  onProgress: (percent: number) => void
): Promise<{ subtitleText: string; type: 'srt' | 'ass'; blocks: SubtitleBlock[] }> {
  return new Promise((resolve, reject) => {
    const parser = new SubtitleParserConstructor();
    const tracks: MKVTrack[] = [];
    const subtitles: Array<{ text: string; time: number; duration: number }> = [];
    let selectedTrackNumber: number | null = null;
    let trackResolved = false;
    let resolveTrackPromise: ((value: number) => void) | null = null;

    parser.on('tracks', async (detectedTracks: any[]) => {
      tracks.push(...detectedTracks);
      
      if (tracks.length === 0) {
        reject(new Error('No subtitle tracks found in this MKV file.'));
        return;
      }

      try {
        const trackNo = await onTracksFound(tracks);
        selectedTrackNumber = trackNo;
        trackResolved = true;
        if (resolveTrackPromise) {
          resolveTrackPromise(trackNo);
        }
      } catch (err) {
        reject(err);
      }
    });

    parser.on('subtitle', (subtitle: { text: string; time: number; duration: number }, trackNumber: number) => {
      if (selectedTrackNumber === null || trackNumber === selectedTrackNumber) {
        subtitles.push(subtitle);
      }
    });

    // Read file in chunks
    const chunkSize = 10 * 1024 * 1024; // 10MB chunks
    let offset = 0;
    const reader = new FileReader();

    const readNextChunk = () => {
      if (offset >= file.size) {
        parser.end();
        
        if (subtitles.length === 0) {
          reject(new Error('No subtitles extracted from the selected track.'));
          return;
        }

        // Sort subtitles chronologically
        subtitles.sort((a, b) => a.time - b.time);

        const selectedTrack = tracks.find(t => t.number === selectedTrackNumber);
        const isAss = selectedTrack?.type === 'ass' || selectedTrack?.type === 'ssa';
        
        // Helper to format milliseconds to subtitle timestamp
        // Format for SRT: HH:MM:SS,mmm
        // Format for ASS: H:MM:SS.cc
        const formatTime = (ms: number, formatAss: boolean) => {
          const hours = Math.floor(ms / 3600000);
          const minutes = Math.floor((ms % 3600000) / 60000);
          const seconds = Math.floor((ms % 60000) / 1000);
          const millisecond = Math.floor(ms % 1000);
          
          if (formatAss) {
            const centisecond = Math.floor(millisecond / 10);
            return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centisecond).padStart(2, '0')}`;
          } else {
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(millisecond).padStart(3, '0')}`;
          }
        };

        const blocks: SubtitleBlock[] = subtitles.map((sub, index) => {
          const startStr = formatTime(sub.time, isAss);
          const endStr = formatTime(sub.time + sub.duration, isAss);
          
          return {
            index: index + 1,
            start: startStr,
            end: endStr,
            text: sub.text,
            status: 'idle'
          };
        });

        // Generate raw text content
        let subtitleText = '';
        if (isAss) {
          subtitleText = `[Script Info]\nTitle: Extracted Subtitles\nScriptType: v4.00+\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
          blocks.forEach(b => {
            subtitleText += `Dialogue: 0,${b.start},${b.end},Default,,0,0,0,,${b.text}\n`;
          });
        } else {
          blocks.forEach(b => {
            subtitleText += `${b.index}\n${b.start} --> ${b.end}\n${b.text}\n\n`;
          });
        }

        resolve({
          subtitleText,
          type: isAss ? 'ass' : 'srt',
          blocks
        });
        return;
      }

      const blob = file.slice(offset, offset + chunkSize);
      reader.onload = async (e) => {
        if (e.target?.result) {
          const chunk = new Uint8Array(e.target.result as ArrayBuffer);
          try {
            parser.write(chunk);
          } catch (err) {
            console.error('EBML chunk parsing error:', err);
          }
          
          offset += chunkSize;
          onProgress(Math.min(100, Math.round((offset / file.size) * 100)));

          // If tracks are detected but selection is not yet resolved, pause reading chunks
          if (tracks.length > 0 && !trackResolved) {
            resolveTrackPromise = () => {
              readNextChunk();
            };
          } else {
            readNextChunk();
          }
        }
      };
      reader.readAsArrayBuffer(blob);
    };

    readNextChunk();
  });
}
