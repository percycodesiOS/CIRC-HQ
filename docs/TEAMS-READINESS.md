# Teams readiness for CIRC HQ handouts

October 11, 2026. This page says exactly what is prepared, what is untested, and what Teams does and does not do with the files in `assets/handouts/`. Nothing here creates a school item or changes a permission.

## Status labels

- **Prepared**: the file or text exists in this repository and was checked here.
- **Untested**: the step depends on the school's Microsoft 365 tenant and was not run. Nobody signed in to Teams or Forms for this work.
- **Verified**: a step actually run and checked. No Teams or Forms step on this page is verified.

## What a PDF attachment does in Teams

Uploading a PDF as a class resource or as an assignment attachment shares a file. It does not create a native assignment with editable response fields, a Forms quiz, or any grading structure. Students read the PDF; they answer somewhere else. That is why every lesson also has a Word response sheet.

Microsoft's own guidance for attaching files to an assignment is at [Attachments for an assignment in Microsoft Teams for Education](https://support.microsoft.com/en-us/education/assignments/attachments-for-an-assignment-in-microsoft-teams-for-education) and for creating an assignment at [Create an assignment in Microsoft Teams](https://support.microsoft.com/en-us/education/assignments/create-an-assignment-in-microsoft-teams). Read the current page before relying on an option name below; Microsoft renames them.

## Files per lesson (prepared)

| File | Audience | Use in Teams |
| --- | --- | --- |
| `CIRC-<Lesson>-Student.pdf` | Students | Attach as a resource. Students read it; they cannot type in it. Set it to **Students cannot edit**. |
| `CIRC-<Lesson>-Response.docx` | Students | Attach with **Students edit their own copy** so each student gets a private Word copy to type in and turn in. |
| Teacher references in `assets/guides/` | Teacher | Keep in the class team's private teacher channel or the Files tab for staff, not as a student assignment attachment. |

Both files for every lesson are listed on the handouts page of the site, `resources.html`, with the lesson's own filename. The private teacher package (outside this repository) holds the assessment guidance; do not attach it to a student assignment.

## Upload steps (prepared, untested)

1. Open the class team, then **Assignments**, then **Create**, then **Assignment**.
2. Title: use the pattern below.
3. Instructions: paste the directions block below.
4. **Attach**, then **Upload from this device**, choose the lesson's PDF and set it to **Students cannot edit**.
5. **Attach** again, choose the lesson's Response `.docx` and set it to **Students edit their own copy**.
6. Points: leave blank or use the rubric line below. Due date: the next CIRC visit, not a calendar guess.
7. Assign to the class, or **Save** as a draft to assign on the day.

Repeat per class. A draft can be reused with **Reuse assignment** in another class team.

## Assignment template (prepared)

Title pattern: `CIRC Meeting <number>: <Lesson title>` (for a split meeting add `Grade 5` or `Grade 6`).

Directions block (copy, then replace the bracketed parts):

```
Goal: [goal sentence from the lesson]

1. Open the attached lesson PDF and read the goal and the "You are done when" box.
2. Follow the numbered steps during CIRC. Your teacher says when to move on.
3. Type your answers in your own copy of the Response sheet (the Word file). Do not change the sharing on anything.
4. Turn in: [what to turn in, from the lesson]. If your work is a physical thing, write where it is on the Response sheet.
5. Finished early? Try the "Next challenge" box.

Materials: [materials list]
Another way to do it: [fallback line]
```

Response format: the Word response sheet, plus any physical work left in the class tray as the lesson says.

Assessment guidance (teacher only, in the private package): the lesson's done-when check, grade targets, exemplar reasoning for open-ended design work, and the support and stretch notes. For open-ended design lessons there is no single correct answer; assess the reasoning and the test evidence the student records. Keep official rubric wording from the school's own documents unchanged; this project adds none.

## Forms import (not proposed)

No PDF-to-Forms or Word-to-Forms conversion was tested, and none is promised. A Forms quiz would need every question and answer rebuilt and checked by hand inside Forms. If that is wanted later, treat it as a separate, verified task.

## What remains school-side

- Create the assignments in the real class teams and confirm students see both attachments.
- Confirm **Students edit their own copy** works for the `.docx` on the school tenant (it is a plain Word file with no macros).
- Decide where the teacher references live in Teams; this page only recommends the staff Files tab.
- Real student testing in an approved school setting. Everything in this repository was a simulated review with dummy data.
