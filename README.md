# Home Finance Dashboard — v4 Final (UI + Firebase)

This is a ready-to-deploy static repo (HTML/CSS/JS) for your Home Finance dashboard (v4 final).

## Included
- `index.html` — main UI + Firebase logic (inline script)
- `style.css` — neumorphic styling
- `app.js` — placeholder (not required)
- `README.md` — this file
- `netlify.toml` — optional Netlify config (not required)

## How to use
1. Unzip and upload to GitHub then connect to Netlify (or upload zip directly to Netlify).
2. In `index.html`, edit the `firebaseConfig` object if you want to change project.
3. In Firebase Console > Firestore, create two collections: `accounts` and `transactions` (optional).
4. Deploy and test. Data will be saved to Firestore when available, otherwise it falls back to localStorage.

## Notes
- This is a UI + simple Firebase integration. Search & suggestion features use past transactions and datalists.
- For production, tighten Firestore rules before sharing.
