import assert from "node:assert/strict";
import test from "node:test";

const app = await import("../src/app.js");

class FakeNode {
  constructor(tagName) {
    this.tagName = tagName;
    this.className = "";
    this.textContent = "";
    this.children = [];
    this.attributes = new Map();
  }

  append(...children) {
    this.children.push(...children.filter(Boolean));
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }
}

function textOf(node) {
  return [node.textContent, ...node.children.map(textOf)].filter(Boolean).join(" ");
}

function find(node, predicate) {
  if (predicate(node)) return node;
  for (const child of node.children) {
    const match = find(child, predicate);
    if (match) return match;
  }
  return null;
}

function fakeDocument() {
  return {
    createElement: (tagName) => new FakeNode(tagName),
    createElementNS: (_namespace, tagName) => new FakeNode(tagName)
  };
}

function icon(name = "sun", label = "Clear sky") {
  return {
    name,
    label,
    paths: [{ tag: "circle", cx: 12, cy: 12, r: 4 }]
  };
}

test("rendered stale weather is concise, visible, and accessibly distinct", () => {
  assert.equal(typeof app.buildWeatherCard, "function");
  const previousDocument = globalThis.document;
  globalThis.document = fakeDocument();
  try {
    const stale = app.buildWeatherCard({
      status: "stale",
      temperature: "72°F",
      feelsLike: "70°F",
      condition: "Partly cloudy",
      caveat: "Updated earlier",
      icon: icon("partly-cloudy", "Partly cloudy")
    });
    const ready = app.buildWeatherCard({
      status: "ready",
      temperature: "72°F",
      feelsLike: "70°F",
      condition: "Partly cloudy",
      icon: icon("partly-cloudy", "Partly cloudy")
    });
    const unavailable = app.buildWeatherCard({
      status: "unavailable",
      label: "Weather unavailable",
      icon: icon("unavailable", "Weather unavailable")
    });

    assert.match(stale.className, /\bstale\b/);
    assert.match(textOf(stale), /Updated earlier/);
    assert.equal(stale.getAttribute("aria-label"), "Current weather. Updated earlier.");
    assert.doesNotMatch(textOf(ready), /Updated earlier|Stale weather/);
    assert.equal(ready.getAttribute("aria-label"), "Current weather");
    assert.match(textOf(unavailable), /Weather unavailable/);
    assert.equal(unavailable.getAttribute("aria-label"), "Current weather");
    assert.equal(
      find(stale, (node) => node.getAttribute("role") === "img")?.getAttribute("aria-label"),
      "Partly cloudy"
    );
  } finally {
    globalThis.document = previousDocument;
  }
});
