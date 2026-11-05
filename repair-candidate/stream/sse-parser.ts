// Buffered SSE frame parser. Handles arbitrary network chunk boundaries.
export interface SSEFrame { data: string }
export class SSEParser {
  private decoder = new TextDecoder()
  private buffer = ''
  push(bytes: Uint8Array): SSEFrame[] {
    this.buffer += this.decoder.decode(bytes, { stream: true })
    return this.drain()
  }
  finish(): SSEFrame[] {
    this.buffer += this.decoder.decode()
    return this.drain()
  }
  private drain(): SSEFrame[] {
    const frames: SSEFrame[] = []
    // Normalize CRLF and bare CR, including split CRLF boundaries.
    // A trailing CR must remain buffered until the next chunk arrives.
    const safeEnd = this.buffer.endsWith('\r') ? this.buffer.length - 1 : this.buffer.length
    const candidate = this.buffer.slice(0, safeEnd).replace(/\r\n|\r/g, '\n')
    const cut = candidate.lastIndexOf('\n\n')
    if (cut < 0) return frames
    const completed = candidate.slice(0, cut + 2)
    this.buffer = this.buffer.slice(safeEnd).concat(candidate.slice(cut + 2))
    for (const block of completed.split('\n\n')) {
      if (!block) continue
      const data = block.split('\n')
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).replace(/^ /, '')).join('\n')
      if (data) frames.push({ data })
    }
    return frames
  }
}
