# CIRC HQ Active Lesson Design QA

## Visual source

- Selected source: the approved hybrid active-lesson reference.
- Source size: 1487 by 1058 pixels.
- Source intent: one calm classroom screen with a dominant step timer, a secondary class timer, immediate controls, short numbered student directions, real contextual imagery, and a visible lesson sequence.
- Existing product context retained: the CIRC HQ white maker-studio surface, SV blue, electric lime, rounded cards, reviewed Phosphor icons, current lesson data, teacher schedule, and strict teacher or student projection boundary.

## Browser implementation evidence

- Local URL: `http://127.0.0.1:4273/`.
- Desktop live-runner capture: `prototype-1440x900-live-controls-final.png`, 1425 by 1670 full-page pixels.
- Exact-size desktop capture: `prototype-1487x1058-reference-state-final.png`.
- iPad portrait capture: `prototype-768x1024-live-controls-final.png`, 753 by 2038 full-page pixels.
- Phone live-runner captures: `prototype-390x844-live-controls-final.png`, 375 by 1696 full-page pixels, and `prototype-360x800-live-controls-final.png`, 345 by 1690 full-page pixels.
- Phone student-view capture: `prototype-360x800-student-view-final.png`, 345 by 1143 full-page pixels.
- Normalized comparison: `reference-vs-prototype-1487x1058-normalized-final.png`. The source is on the left and the implementation is on the right. Both panels are exact 1487 by 1058 viewport captures with no scaling, crop, or unequal framing.
- Evidence files remain outside the repository and cannot enter the public Pages release.

## Source match assessment

- The active lesson uses the reference hierarchy: current step, dominant step timer, class timer, and primary controls in one blue command bar.
- Student directions are the first content inside the current-step card. The real project image sits beside the directions on desktop and follows them on phones and tablets.
- The full lesson path shows the actual number of steps for the selected experience. Every item includes a meaning-based reviewed icon, short label, duration, and Done, Now, Ended here, or Next state.
- The ordinary CIRC HQ header is hidden while a live teacher or student runner is open. This focused treatment prevents another sticky surface from competing with the live timers.
- The selected reference depicts a different outdoor lesson. The implementation uses the current Tech Terrarium lesson, its reviewed real image, and its actual step data.
- No placeholder art, text-symbol control, handcrafted SVG, gradient, or remote image dependency was introduced.

## Focused checks

- Timer priority: the current-step timer appears before and more prominently than the class timer.
- Live controls: Pause or Resume, +1 min, Previous, and Next Step remain in the command bar while the lesson scrolls.
- Pause behavior: both timers remained unchanged during the timed pause check and resumed correctly.
- Add-time behavior: +1 min increased both the current-step timer and the class timer.
- Navigation behavior: Next Step advanced the runner and updated the lesson path.
- Directions: every student direction in the active step renders. No first-three truncation remains.
- Teacher hierarchy: Student directions come first. A single Teacher action card appears only when the current step contains teacher guidance. No speech is inferred, no generic fallback is invented, and no empty cue card renders. Additional teacher material stays collapsed under More teacher help and More context.
- Early finish accuracy: when the class clock ends before the final lesson step, the runner names the actual stopped step and marks Ended here instead of claiming the final step.
- Variable lesson length: seven-step, eight-step, and nine-step experiences use their actual path length instead of a fixed nine-column layout.
- Student privacy: student view retains the same step, timer values, complete path, directions, and safe exit. It renders no teacher cues, teacher controls, teacher identity, duty information, or private schedule content.
- Accessible labeling: teacher controls are announced only while controls exist. Student and completed states announce timers without claiming unavailable controls.
- Sticky behavior: the command bar remains eight pixels from the top of the page.
- Phone controls: all four controls remain in one row at 390 and 360 CSS pixels. Each control is at least 48 pixels high with a readable 0.8rem label.
- Phone schedule: class end and cleanup time remain on one line without wrapping AM onto a separate line.
- Responsive order: at both 390 and 360 CSS pixels, student directions appear before optional artwork. In the final 360-pixel teacher state, directions begin at 512 pixels and the optional image begins at 972 pixels.
- Student entry: the 360-pixel student route opens at scroll position zero, directions begin at 447 pixels, and the optional image follows at 616 pixels.
- Tablet order: at 768 CSS pixels, directions begin at 668 pixels and optional artwork follows at 1096 pixels.
- Responsive safety: measured horizontal overflow is zero at 1440, 1487, 768, 390, and 360 CSS pixels.
- Desktop timer fit: the class timer card remains within its measured width with no horizontal overflow.
- Meaning-based icon coverage: all 42 selectable lesson paths, 340 step instances, and 231 unique step labels resolve through the reviewed semantic icon map. No current label reaches the neutral future-step fallback, and safety, exit, transition, cleanup, and work precedence cases are locked by tests.
- Automated contract: the focused app-render, public-shell, and security matrix passes 109 of 109 tests.

## Iteration history

1. Primary controls originally appeared at the bottom of the runner and scrolled away. They moved into one sticky command bar with the timers.
2. The old runner displayed only the first three student directions. The renderer and tests now require the complete direction list.
3. Global horizontal overflow handling prevented reliable sticky behavior. The page now uses `overflow-x: clip` and preserves sticky behavior without spill.
4. Phone controls originally wrapped into two rows. The compact layout now keeps all four controls in one readable row.
5. The ordinary sticky site header competed with the live command bar. Active runner routes now hide that header until the teacher exits.
6. Student directions originally followed the image on phones. The DOM and responsive layout now keep directions before optional art.
7. Tablet widths originally inherited desktop minimum columns. The 900-pixel breakpoint now stacks content and uses a horizontal path without clipping.
8. The lesson path originally assumed nine steps. It now derives its tracks, icons, and state labels from the selected experience.
9. An early class-clock finish originally displayed the final lesson step. The complete state now retains and labels the actual stopped step.
10. Student entry originally preserved the teacher page scroll. Route navigation now resets to the top before moving focus.
11. No-control command bars originally claimed that lesson controls were present. Their accessible label now announces timers only.
12. Unstructured teacher actions originally became invented Say and Do cards, often leaving Do empty. The runner now shows one honest Teacher action card only when guidance exists.
13. Step icons originally rotated by position. Every current step now receives an icon from a deterministic meaning-based resolver with complete curriculum coverage.
14. The narrowest phone schedule originally wrapped AM onto a separate line. The schedule now stays on one compact line per time.

## Final findings

- P0 findings remaining: 0.
- P1 findings remaining: 0.
- P2 findings remaining: 0.
- Intentional differences: current Tech Terrarium content instead of the reference lesson, four complete teacher controls instead of three, a focused runner without ordinary site navigation, and additional teacher-only information below the core lesson path.

final result: passed
