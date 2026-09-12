# Firebase activation gate

CIRC HQ has a separate configured Firebase project, `circ-hq-k6-2026`, and supports Google popup sign-in and email/password accounts when the release's provider and authorized-domain gates are complete. The public web configuration is client identification, not an administrator credential. It must not be reused by CyberGrader.

The email entry is **Sign up with any email**, beside the Google option. It accepts school or other email addresses without a Google account. **Create account with email** creates a CIRC HQ account with a separate password. **I already have a CIRC HQ account** switches to **Sign in with email**; **Forgot password** requests recovery instructions. Passwords are passed only to the authentication SDK, cleared from the form, and excluded from teaching state, setup models, and sync metadata. The authentication observer remains the source of account identity.

Owner activation check: in Firebase Console, open **Authentication → Sign-in method → Email/Password** and verify the Email/Password provider is enabled. Email-link sign-in is not required for this flow. Firebase documents [email/password setup](https://firebase.google.com/docs/auth/web/password-auth) and [password reset](https://firebase.google.com/docs/auth/web/manage-users). If the provider is disabled, teachers receive plain guidance that email accounts are not enabled and local mode is still available. No real account creation or recovery email is required for local unit tests.

September 11, 2026 owner action: the authorized coordinator enabled Email/Password in the configured live project, saved it, and re-read both **Email/Password: Enabled** and **Google: Enabled** with a success confirmation. Passwordless email-link sign-in remains off. No account was created, auth email sent, or private data uploaded. This verifies the provider setting only; the new email interface still awaits an authorized repository push and verified Pages deployment.

Configuration in Git is not proof that Google Auth is enabled, Firestore exists in `nam5` production mode, rules are deployed, `percycodesios.github.io` is an authorized domain, Pages is live, or a private plan has been uploaded. Those remain Task 9 evidence gates. No Console action, rules deployment, hosting deployment, billing change, or private-data upload is claimed by this document.

Each authenticated teacher has a UID-scoped private cloud namespace. Shared room artifacts and room progress are available only to trusted members. Board and Student use no accounts and have no direct cloud-write path. A teacher previews a local private plan before confirmation. No private cloud write occurs until **Upload and verify**; every admitted private domain is read back and verified, and a local backup remains preserved.

Offline, signed-out, popup-blocked, denied, partial, and conflict states preserve usable local teaching and show safe recovery guidance. Setup Help includes safe status, Sync now, local-backup export, replacement-plan preview, and sign-out guidance without identifiers or raw error text. The live runner is local to the device that starts it and displays **This device is running the class**. It never becomes a shared cloud timer.

Before any production activation, emulator tests must cover Kenny, Tammy, an unrelated authenticated user, and an unauthenticated user. The table below is the required access model, not current production access.

| Emulator persona | Expected private-teacher result | Expected tenant result |
| --- | --- | --- |
| Kenny | Allow only that teacher's private document | Allow only when a trusted membership grants the requested tenant access |
| Tammy | Allow only that teacher's private document | Allow only when a trusted membership grants the requested tenant access |
| Unrelated authenticated user | Deny other teachers' private documents | Deny unless their own trusted membership grants the requested tenant access |
| Unauthenticated user | Deny | Deny |

The following remain separate evidence and approval gates: enabling Google Auth, creating Firestore in production mode, deploying the reviewed rules, admitting the GitHub Pages domain, verifying Kenny and Tammy sign-in, completing the live room transaction matrix, publishing Pages, and confirming live browser behavior. The release includes no grades, rosters, student accounts, student submissions, analytics, advertising, Firebase Hosting cutover, billing change, or CyberGrader reuse.

Board and Student directions use no student accounts and write no student data.
