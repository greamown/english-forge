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
