// Tests für Wetter und Mond.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mondphase, MONDPHASEN } from "../js/wetter.js";

// Finsternisse sind sichere Vergleichswerte: Eine Sonnenfinsternis gibt es nur bei Neumond, eine Mondfinsternis nur bei Vollmond.
test("Mondphase: Sonnenfinsternisse liegen im Neumond, Mondfinsternisse im Vollmond", () => {
  for (const zeit of ["1999-08-11T12:30", "2024-04-08T20:00", "2026-08-12T19:30"])
    assert.equal(mondphase(zeit).name, "Neumond", zeit);
  for (const zeit of ["2022-11-08T12:00", "2025-03-14T08:00", "2025-09-07T20:00"])
    assert.equal(mondphase(zeit).name, "Vollmond", zeit);
});

test("Mondphase: Reihenfolge von Neumond zu Neumond", () => {
  // Ab der Sonnenfinsternis am 8.4.2024 alle 3,7 Tage eine Phase weiter.
  const namen = ["2024-04-08T20:00", "2024-04-12T12:00", "2024-04-16T06:00", "2024-04-19T23:00", "2024-04-23T16:00",
    "2024-04-27T10:00", "2024-05-01T04:00", "2024-05-04T21:00", "2024-05-08T12:00"].map(z => mondphase(z).name);
  assert.deepEqual(namen, [...MONDPHASEN, "Neumond"]);
});

test("Mondphase: beleuchteter Anteil und Alter", () => {
  assert.ok(mondphase("2024-04-08T20:00").beleuchtet < 0.02);
  assert.ok(mondphase("2025-03-14T08:00").beleuchtet > 0.98);
  const viertel = mondphase("2025-03-22T12:00");
  assert.equal(viertel.name, "Letztes Viertel");
  assert.ok(viertel.beleuchtet > 0.3 && viertel.beleuchtet < 0.7);
  const alter = mondphase("2025-03-14T08:00").alter;
  assert.ok(alter > 13.5 && alter < 16, "Vollmond liegt rund 14,8 Tage nach Neumond, war " + alter);
});

test("Mondphase: unlesbare Zeit ergibt null", () => {
  for (const z of [null, undefined, "", "2026-10-11", "gestern", 5]) assert.equal(mondphase(z), null);
});
