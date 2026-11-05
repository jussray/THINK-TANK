// Buffered SSE frame parser. Handles arbitrary network chunk boundaries.
export interface SSEFrame { data: string }
export class SSEParser {
  private decoder = new TextDecoder()
  private buffer = ''
  push(bytes: Uint8Array): SSEFrame[] {
    this.buffer += this.decoder.decode(bytes, { stream: true })
    return this.drain(false)
  }
  finish(): SSEFrame[] {
    this.buffer += this.decoder.decode()
    return this.drain(true)
  }
  private drain(final: boolean): SSEFrame[] {
    const frames: SSEFrame[] = []
    // A trailing CR may be the first half of a CRLF split across chunks, so hold it.
    // The held CR is the LATEST byte: it is kept after the unconsumed remainder.
    // At end of stream nothing else can arrive, so it is released as a terminator.
    const held = !final && this.buffer.endsWith('\r') ? '\r' : ''
    const body = this.buffer.slice(0, this.buffer.length - held.length).replace(/\r\n|\r/g, '\n')
    const cut = body.lastIndexOf('\n\n')
    if (cut < 0) {
      this.buffer = body + held
      return frames
    }
    const completed = body.slice(0, cut + 2)
    this.buffer = body.slice(cut + 2) + held
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
