declare module 'matroska-subtitles' {
  export class SubtitleParser {
    constructor();
    on(event: 'tracks', callback: (tracks: any[]) => void): this;
    on(event: 'subtitle', callback: (subtitle: { text: string; time: number; duration: number }, trackNumber: number) => void): this;
    on(event: 'file', callback: (file: { filename: string; mimetype: string; data: ArrayBuffer }) => void): this;
    write(chunk: ArrayBuffer | Uint8Array): void;
    end(): void;
  }
}
