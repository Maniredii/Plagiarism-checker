declare module 'mammoth' {
  interface ExtractRawTextResult {
    value: string;
    messages: any[];
  }

  interface ExtractRawTextOptions {
    buffer?: Buffer;
    path?: string;
  }

  export function extractRawText(options: ExtractRawTextOptions): Promise<ExtractRawTextResult>;
}
