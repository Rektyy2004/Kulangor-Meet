# Simple API key setup

The app supports phone and laptop layouts. Its route preview uses a real Google Map, so you need **two different Google keys**. No TypeScript code replacement is needed. The private server key calculates routes; the browser key displays the map and surrounding area.

## 1. What each key does

| Setting in `.env.local` | Purpose | Visibility |
| --- | --- | --- |
| `GOOGLE_MAPS_API_KEY` | Verified address search, nearby meeting venues, and traffic-aware driving times. Enable Places API (New) and Routes API. | Secret, used on the server. |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Displays the live Google map and route lines. Enable Maps JavaScript API. | Visible in visitors' browsers; restrict it to your website. |

Keep the two keys different. The app refuses to build if the private server key is reused in the public browser setting. This app does not need a separate Geocoding API or legacy Distance Matrix API key.

## 2. Where to get them

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project and enable billing.
3. Under **APIs & Services → Library**, enable **Places API (New)**, **Routes API**, and **Maps JavaScript API**.
4. Open **APIs & Services → Credentials → Create credentials → API key**. Some Google screens call this **Google Maps Platform → Keys & Credentials**.
5. Create one key named `Kulangor server` and another named `Kulangor browser`.
6. Open each key and set its restrictions before using it.

For **Kulangor server**:
- Under API restrictions, allow only **Places API (New)** and **Routes API**.
- Use IP-address restrictions for the machine/server making the requests when its public outbound IP is known. This is the public IP, not `127.0.0.1`. Revisit this when choosing a host; some hosts have changing outbound IPs.
- Never give this key website-referrer restrictions or place it in a `NEXT_PUBLIC_` setting.

For **Kulangor browser**:
- Under Application restrictions, choose **Websites / HTTP referrers**.
- For local testing, allow `http://localhost:3000/*`. Add `http://127.0.0.1:3000/*` if you use that address.
- When published, add your actual HTTPS hostname, such as `https://your-app.example/*`.
- Under API restrictions, allow only **Maps JavaScript API**.

Set appropriate usage quotas and billing alerts in Google Cloud. The browser key cannot be hidden from visitors; its website and API restrictions are its protection.

Official instructions: [Places](https://developers.google.com/maps/documentation/places/web-service/get-api-key), [Routes](https://developers.google.com/maps/documentation/routes/get-api-key), [Maps JavaScript](https://developers.google.com/maps/documentation/javascript/get-api-key), [key security](https://developers.google.com/maps/api-security-best-practices).

## 3. Where to paste them

Open **`.env.local` in the project root**, beside `package.json`:

```dotenv
GOOGLE_MAPS_API_KEY=PASTE_YOUR_SECRET_SERVER_KEY_HERE
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=PASTE_YOUR_RESTRICTED_BROWSER_KEY_HERE
```

Replace only the text after each `=` with the corresponding key. Do not paste keys into `.env.example`, source files, GitHub, or chat. Restart `npm run dev` after saving. If using the production server, run `npm run build` again before `npm start` because browser settings are included during the build.

The code already reads these values in `src/lib/google.ts` and `src/components/GoogleMap.tsx`.

For custom/production map styling, create a JavaScript map ID under Google Maps Platform → Map Management, and add `NEXT_PUBLIC_GOOGLE_MAP_ID=YOUR_MAP_ID`. Local testing uses Google’s `DEMO_MAP_ID` by default.

Leave the Supabase settings blank while testing locally. Shared hosting can use the Supabase database setup in the main README. Leave `NEXT_PUBLIC_APP_URL` blank to make invitations use the address currently open in the browser.

## GitHub later

- `.env.local` and other `.env*` files are ignored by Git. Only the blank `.env.example` template belongs in the repository.
- `.data/` is ignored too, so local participant records and organizer token hashes are excluded.
- Before the first upload, check staged files and scan the source and full commit history for credentials. There are currently no commits in this repository.
- Never use `git add -f` to include an environment file. `.gitignore` does not protect a file that has already been committed.
- Configure real keys in the hosting provider's environment settings when deploying, then rebuild. GitHub stores the code; GitHub Pages alone cannot run this project's Next.js server/API.
- Enable GitHub secret scanning and push protection if available for the repository. If a secret ever reaches a commit, revoke/rotate it first, then remove it from history; deleting it only from the latest file is insufficient.

No GitHub repository has been created or uploaded yet. Uploading can be handled when you are ready.
