# 語言練習手帳 · English & Japanese

Build your English intuition, one sentence at a time.

A mobile-friendly, local-first English and Japanese practice app hosted on GitHub Pages.

The homepage offers two entries: English keeps the existing EnglishForge experience; Japanese uses the same learning flow with its own vocabulary, sentences, kana readings, and Japanese pronunciation. The GitHub repository and public site URL remain unchanged.

## Features
- Language selector homepage with separate English (`practice.html?lang=en`) and Japanese (`practice.html?lang=ja`) learning spaces
- Independent local study records, JSON backups, and manual cloud backup fields for each language
- Warm paper-and-green learning journal layout, with responsive mobile navigation and keyboard focus indicators
- Guided flashcards, session progress, restartable completion screens, and quiz self-assessment summaries
- Library filters for new, due, and familiar sentences (due counts exclude unstudied items)
- Daily practice: Monday–Friday two new items, with review; Saturday weekly recall; Sunday long-term review
- Chinese-to-English active recall and self-assessment
- Separate vocabulary/phrase, sentence, and mixed practice modes across flashcards, quizzes, and the library
- Normal-speed and slow English text-to-speech, plus hide-and-recall shadowing (browser speech synthesis)
- Editable material types in the library; changing a type keeps existing review progress
- Difficulty-based review intervals: 0, 1, 3, 7, 14, 30, 60 days
- Searchable vocabulary/sentence library
- JSON import with duplicate detection and JSON progress backup
- Works without server, credentials, or external dependencies

## Run
Open `index.html` in a modern browser, or enable GitHub Pages in **Settings → Pages → Deploy from a branch → main → /(root)**.

When Pages is enabled, the expected URL is:
https://greamown.github.io/english-forge/

## Checks
Run `node --test tests/*.test.cjs` (Node.js 18+; no dependencies). These checks cover session restart, direct navigation, answer/skip handling, review counts, self-assessment, library filtering, material types, shadowing, speech error handling, Japanese text matching, and cloud backup isolation.

## Language data

English retains the existing `english-forge-v1` browser storage key, so existing records carry over. Japanese uses `japanese-forge-v1` and starts with 10 independent introductory examples. Returning to the language selector never merges or deletes progress.

Cloud backups keep the original English `items`/`updatedAt` fields under `users/{uid}/backups/latest`, and store Japanese in `japaneseItems`/`japaneseUpdatedAt`. Both upload paths use [Firestore field merging](https://firebase.google.com/docs/firestore/manage-data/add-data#set_a_document), so backing up one language preserves the other. Existing rules and old English cloud backups remain compatible. An older deployed client can still replace the whole backup document; refresh open tabs to this version before using cloud backup.

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

For Japanese, choose the Japanese entry first and import:
```json
[{"japanese":"水","chinese":"水","reading":"みず","kind":"word","example":"水をください。"}]
```
`reading` holds kana and `example` holds a Japanese-only example for playback. Japanese does not infer spoken examples from bilingual notes, because Chinese and Japanese can share characters. Internally, both languages use the legacy `english` text field for compatibility; Japanese imports also accept `japanese` or `ja`. Exported backups include a `language` identifier; importing a labelled backup into the other language is rejected.

The importer also accepts objects with `items`, `references`, `vocabulary`, or `sentences` arrays, plus common aliases for English and Chinese fields.

An optional `kind` field accepts `"word"` (including phrases) or `"sentence"`. Imports under `vocabulary` and `sentences` retain that type. Untyped items use sentence-ending punctuation as a first pass; correct ambiguous items with the type selector in the library. Existing browser data needs no migration.

For pronunciation practice, reveal a flashcard, listen at normal speed, use slow playback to shadow it, then hide the English and say it again. Bilingual examples in material notes also have normal/slow playback; only the English portion is spoken. Words focus on stress and syllables; sentences focus on rhythm, linking, and pauses. This is self-assessed practice, not microphone pronunciation scoring.

## Privacy and limitations
- All added content and practice progress are stored in the current browser's `localStorage`.
- Progress is not automatically synchronized between browsers or devices; export JSON backups regularly or use the optional manual Firebase backup controls.
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
6. Deploy the changes to GitHub Pages, open **教材與備份**, sign in with Google, and use **備份到雲端**. Use **從雲端還原** carefully; it overwrites local data.

### Security notes
- Database reads/writes are scoped to `users/{request.auth.uid}/backups/latest` by Firestore rules.
- With the rules as written, any Google user permitted to sign in may have their own private backup. They cannot access each other's records.
- If you want only one authorized Google account, configure an email/UID allowlist in Firebase Rules after your first sign-in.
- `firebase-config.js` is visible publicly; this is normal for Firebase client SDK configuration. Database access must be protected by Firestore Rules.
- The existing `reference/*.json` files have already been committed to a **public repository**, so they are public (including in Git history). Moving them to Firestore later does not erase that public history.
