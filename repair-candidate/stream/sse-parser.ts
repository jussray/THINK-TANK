// Buffered SSE frame parser. Handles arbitrary network chunk boundaries.
export interface SSEFrame { data: string }
export class SSEParser {
  private decoder = new TextDecoder()
  private buffer = ''
  private previousChunkEndedWithCR = false

  push(bytes: Uint8Array): SSEFrame[] {
    this.append(this.decoder.decode(bytes, { stream: true }))
    return this.drain()
  }
  finish(): SSEFrame[] {
    this.append(this.decoder.decode())
    return this.drain()
  }
  private append(decoded: string): void {
    // A CR already ended the prior line. Ignore only its optional following LF.
    // Empty decoded chunks can occur when UTF-8 code points span byte chunks.
    if (!decoded) return
    if (this.previousChunkEndedWithCR && decoded.startsWith('\n')) {
      decoded = decoded.slice(1)
    }
    this.previousChunkEndedWithCR = decoded.endsWith('\r')
    this.buffer += decoded.replace(/\r\n|\r/g, '\n')
  }
  private drain(): SSEFrame[] {
    const frames: SSEFrame[] = []
    const cut = this.buffer.lastIndexOf('\n\n')
    if (cut < 0) return frames
    const completed = this.buffer.slice(0, cut + 2)
    this.buffer = this.buffer.slice(cut + 2)
    for (const block of completed.split('\n\n')) {
      if (!block) continue
      const dataLines = block.split('\n')
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).replace(/^ /, ''))
      if (dataLines.length) frames.push({ data: dataLines.join('\n') })
    }
    return frames
  }
}
