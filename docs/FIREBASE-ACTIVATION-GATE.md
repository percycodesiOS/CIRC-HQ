# Firebase activation gate

CIRC HQ must use a separate Firebase project. It must not reuse CyberGrader.

This repository tracks no real Firebase configuration. The example configuration contains only placeholder property values, and configuration is supplied later through an approved deployment process.

Before any activation, emulator tests must cover Kenny, Tammy, an unrelated authenticated user, and an unauthenticated user.

| Emulator persona | Expected private-teacher result | Expected tenant result |
| --- | --- | --- |
| Kenny | Allow only `playbookTeachers/{kennyUid}` | Allow only when a trusted membership grants the requested tenant access |
| Tammy | Allow only `playbookTeachers/{tammyUid}` | Allow only when a trusted membership grants the requested tenant access |
| Unrelated authenticated user | Deny Kenny and Tammy private-teacher documents | Deny unless their own trusted membership grants the requested tenant access |
| Unauthenticated user | Deny | Deny |

The following actions require Kenny's explicit approval: provider enablement, account creation, private teacher-data upload, rules deployment, hosting deployment, and billing changes.

Board mode uses no student accounts and writes no student data.
