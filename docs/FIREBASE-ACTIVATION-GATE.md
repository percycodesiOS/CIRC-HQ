# Firebase activation gate

Firebase is inactive in CIRC HQ v1. There is no real configuration, account, provider, data upload, rules or hosting deployment, billing, or shared synchronization.

CIRC HQ must use a separate Firebase project. It must not reuse CyberGrader. This repository tracks only an exact placeholder configuration. Documentation, dormant adapters, tests, and GitHub Pages publication do not activate Firebase or authorize any external service change.

Before any future activation, emulator tests must cover Kenny, Tammy, an unrelated authenticated user, and an unauthenticated user. The table below is a future access model, not current production access.

| Emulator persona | Expected private-teacher result | Expected tenant result |
| --- | --- | --- |
| Kenny | Allow only that teacher's private document | Allow only when a trusted membership grants the requested tenant access |
| Tammy | Allow only that teacher's private document | Allow only when a trusted membership grants the requested tenant access |
| Unrelated authenticated user | Deny other teachers' private documents | Deny unless their own trusted membership grants the requested tenant access |
| Unauthenticated user | Deny | Deny |

Each of the following remains a separate explicit-approval gate: creating the project, supplying real configuration, enabling a provider, creating an account, uploading teacher data, deploying rules, deploying Firebase Hosting, changing billing, or enabling shared synchronization.

Board and Student directions use no student accounts and write no student data.
