import { describe, expect, it } from "vitest";
import { readEvents, type ChimbaEvent } from "./events";

function streamOf(chunks: Uint8Array[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(c);
      controller.close();
    },
  });
}

async function collect(chunks: Uint8Array[]) {
  const out: ChimbaEvent[] = [];
  for await (const e of readEvents(streamOf(chunks))) out.push(e);
  return out;
}

const encode = (s: string) => new TextEncoder().encode(s);

describe("readEvents", () => {
  it("reassembles events whose bytes arrive split, even inside a multibyte character", async () => {
    const a = JSON.stringify({ type: "received", t: 0, chars: 42, guardMs: 3 });
    const b = JSON.stringify({ type: "error", t: 5, message: "Jev está con mucha demanda." });
    const bytes = encode(`${a}\n${b}\n`);
    // "á" is two bytes in UTF-8; cut between them.
    const cut = encode(`${a}\n${b.slice(0, b.indexOf("á"))}`).length + 1;
    const events = await collect([bytes.slice(0, 10), bytes.slice(10, cut), bytes.slice(cut)]);

    expect(events.map((e) => e.type)).toEqual(["received", "error"]);
    expect(events[1]).toMatchObject({ message: "Jev está con mucha demanda." });
  });

  it("accepts a final line without a trailing newline", async () => {
    const events = await collect([
      encode(JSON.stringify({ type: "received", t: 0, chars: 1, guardMs: 3 })),
    ]);
    expect(events).toHaveLength(1);
  });
});
