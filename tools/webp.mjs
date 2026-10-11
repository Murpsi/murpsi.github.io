// Liest Breite und Höhe aus dem Kopf einer WebP-Datei. Gebraucht vom Hilfsskript und von den Tests.
export function webpGroesse(buf) {
  if (buf.length < 30 || buf.toString("latin1", 0, 4) !== "RIFF" || buf.toString("latin1", 8, 12) !== "WEBP") return null;
  const art = buf.toString("latin1", 12, 16);
  // VP8: verlustbehaftet, VP8L: verlustfrei, VP8X: erweitert (z. B. mit Transparenz)
  if (art === "VP8 ") return { breite: buf.readUInt16LE(26) & 0x3fff, hoehe: buf.readUInt16LE(28) & 0x3fff };
  if (art === "VP8L") { const b = buf.readUInt32LE(21); return { breite: (b & 0x3fff) + 1, hoehe: ((b >>> 14) & 0x3fff) + 1 }; }
  if (art === "VP8X") return { breite: buf.readUIntLE(24, 3) + 1, hoehe: buf.readUIntLE(27, 3) + 1 };
  return null;
}
