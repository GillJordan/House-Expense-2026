# Home Finance Dashboard — Neumorphic v3 (Firebase-ready)

This repo is a UI-first home finance prototype with per-account custom fields and Firestore sync.
Files:
- index.html
- style.css
- app.js

## Setup
1. Replace firebase config in `app.js` (already injected with your values).
2. Deploy to Netlify or open locally. For Firestore, use test rules during development:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} { allow read, write: if true; }
  }
}
```
(Use only for a short testing period.)

## Notes
- Accounts saved to `accounts` collection; transactions saved to `transactions` collection.
- Custom fields are saved inside accounts document as `customFields`.
- LocalStorage fallback used when Firestore unavailable.
