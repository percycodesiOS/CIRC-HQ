// Private dated updates import. Check first, then import. Local to this browser.
import { createBuilder } from "./playbook-view.js";

// input: { book, preview, status }
// actions: { onCheckText(text), onReadFile(file), onApply(), onClear() }
export function buildDatedUpdatesPanel(input, actions = {}, { documentRef } = {}) {
  const h = createBuilder(documentRef);
  const { book, preview, status } = input;
  const text = h("textarea", { attributes: { id: "dated-updates-text", rows: "6", spellcheck: "false", "aria-describedby": "dated-updates-help" } });
  const file = h("input", { attributes: { id: "dated-updates-file", type: "file", accept: "application/json,.json" } });
  file.addEventListener("change", () => {
    const chosen = file.files?.[0];
    if (chosen) actions.onReadFile?.(chosen);
  });
  const summary = book
    ? h("p", { className: "th-source", text: `Saved on this browser: ${book.updates.length} updates checked ${book.checkedFrom} to ${book.checkedThrough}, prepared ${book.preparedAt}.` })
    : h("p", { className: "th-quiet", text: "No dated updates saved on this browser yet." });
  let previewNode = null;
  if (preview && !preview.ok) {
    previewNode = h("div", { className: "dated-preview has-errors", attributes: { role: "alert" } }, [
      h("p", { text: "Nothing was imported. Fix these first:" }),
      h("ul", { className: "plain-list" }, preview.errors.slice(0, 12).map(error => h("li", { text: error })))
    ]);
  } else if (preview?.ok) {
    const value = preview.value;
    previewNode = h("div", { className: "dated-preview", attributes: { role: "status" } }, [
      h("p", { text: `Ready: ${value.updates.length} updates, checked ${value.checkedFrom} to ${value.checkedThrough}. Importing replaces any dated updates saved on this browser.` }),
      h("button", { className: "primary-action", text: "Import these updates", attributes: { type: "button" }, onClick: actions.onApply })
    ]);
  }
  return h("section", { className: "dated-updates-panel", attributes: { id: "dated-updates", "aria-labelledby": "dated-updates-title" } }, [
    h("h2", { text: "Dated updates", attributes: { id: "dated-updates-title", tabindex: "-1" } }),
    h("p", { attributes: { id: "dated-updates-help" }, text: "Appointments, meetings and assignment changes that are not part of your five-day schedule. This site cannot read your school calendar or email. Someone checks the calendar in the school browser and saves a small dated update file. Load it here. It stays on this browser and is not synced." }),
    summary,
    status ? h("p", { className: "schedule-editor-status", text: status, attributes: { role: "status", "aria-live": "polite" } }) : null,
    h("div", { className: "dated-inputs" }, [
      h("label", { text: "Choose a dated update file", attributes: { for: "dated-updates-file" } }), file,
      h("label", { text: "Or paste the file text", attributes: { for: "dated-updates-text" } }), text,
      h("button", { className: "secondary-action", text: "Check pasted text", attributes: { type: "button" }, onClick: () => actions.onCheckText?.(text.value) })
    ]),
    previewNode,
    book ? h("button", { className: "button-link", text: "Remove dated updates from this browser", attributes: { type: "button" }, onClick: actions.onClear }) : null
  ]);
}
