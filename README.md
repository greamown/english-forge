# EnglishForge

Build your English intuition, one sentence at a time.

A mobile-friendly, local-first English practice app hosted on GitHub Pages.

## Features
- Daily practice: Monday–Friday two new items, with review; Saturday weekly recall; Sunday long-term review
- Chinese-to-English active recall and self-assessment
- English text-to-speech (browser speech synthesis)
- Difficulty-based review intervals: 0, 1, 3, 7, 14, 30, 60 days
- Searchable vocabulary/sentence library
- JSON import with duplicate detection and JSON progress backup
- Works without server, credentials, or external dependencies

## Run
Open `index.html` in a modern browser, or enable GitHub Pages in **Settings → Pages → Deploy from a branch → main → /(root)**.

When Pages is enabled, the expected URL is:
https://greamown.github.io/english-forge/

## Import format
```json
[
  {
    "english": "Let's clarify the goal first.",
    "chinese": "我們先釐清目標。",
    "category": "Business",
    "source": "English-Class"
  }
]
```

The importer also accepts objects with `items`, `references`, `vocabulary`, or `sentences` arrays, plus common aliases for English and Chinese fields.

## Privacy and limitations
- All added content and practice progress are stored in the current browser's `localStorage`.
- Progress is not synchronized between browsers or devices; export backups regularly.
- The website does not access Gmail, and no Gmail tokens or private email bodies are committed to this repository.
- Gmail content can be transformed into a reviewable JSON reference dataset in ChatGPT and then imported into this app.
- Answer checks compare normalized strings; alternative correct expressions require your own judgment.
- Voice pronunciation is provided by browser text-to-speech; this version does not score microphone pronunciation.
- Review scheduling is lightweight, not a scientifically validated SRS implementation.

## Next steps
- Curate and import the rest of the English-Class learning reference.
- Add smarter answer checking and English interview scenarios.
- Consider authenticated private sync if cross-device access becomes important.


## Firebase private cloud backup (optional)

The UI has Google sign-in and manual Firestore backup/restore controls. **They remain inactive until you configure your own Firebase project.** These features are not automatic multi-device sync.

1. Create a project at https://console.firebase.google.com/ (choose the Spark plan).
2. Add a **Web app** under project settings and copy its Firebase SDK `firebaseConfig` into `firebase-config.js`. This config identifies the public Firebase app; never paste service-account credentials.
3. In **Build → Authentication → Sign-in method**, enable **Google** and configure the support email.
4. In **Authentication → Settings → Authorized domains**, add `greamown.github.io` (and localhost for testing if needed).
5. In **Build → Firestore Database**, create the database, then copy the contents of `firestore.rules` into the **Rules** editor and click **Publish**. Do not leave Firestore in test mode.
6. Deploy the changes to GitHub Pages, open **匯入與備份**, sign in with Google, and use **備份到雲端**. Use **從雲端還原** carefully; it overwrites local data.

### Security notes
- Database reads/writes are scoped to `users/{request.auth.uid}/backups/latest` by Firestore rules.
- With the rules as written, any Google user permitted to sign in may have their own private backup. They cannot access each other's records.
- If you want only one authorized Google account, configure an email/UID allowlist in Firebase Rules after your first sign-in.
- `firebase-config.js` is visible publicly; this is normal for Firebase client SDK configuration. Database access must be protected by Firestore Rules.
- The existing `reference/*.json` files have already been committed to a **public repository**, so they are public (including in Git history). Moving them to Firestore later does not erase that public history.
