# Share Kulangor Meetup

GitHub stores the source. Vercel runs the website. Your group only needs the meetup invitation link.

## Upload the code

1. Create an empty **private** repository named `kulangor-meetup` at [GitHub](https://github.com/new). Leave the README, license, and gitignore options unchecked; the project already has its own files.
2. From the project folder, connect the new repository and push the local commit. Use the HTTPS URL GitHub gives you:

   ```powershell
   git remote add origin https://github.com/YOUR-USERNAME/kulangor-meetup.git
   git push -u origin HEAD:main
   ```

   Sign in to GitHub if Git prompts you. Do not upload `.env.local`, `.data/`, or built files. `.env.example` is the blank template.

## Put the website online

1. In your Supabase project, open **SQL Editor → New query** and run [the meetup schema](../database/schema.sql). The hosted app needs a database; it cannot rely on this computer's local session files.
2. In [Vercel](https://vercel.com/new), import the private GitHub repository and keep the Next.js framework preset.
   If the import shows a multi-service configuration prompt, return to **New Project** and import the latest `main` again. The root `vercel.json` pins the Next.js preset. The optional `renderer/` is a local tool and is not a separate web service. Keep the root directory at the repository root.
3. Under **Environment Variables**, add the four settings below using the values from your local setup. Keep the private values in the host's settings, never in GitHub source or chat.

   | Setting | Value |
   | --- | --- |
   | `GOOGLE_MAPS_API_KEY` | Server key restricted to Places API (New) and Routes API, configured for requests from your host. A key restricted to your home IP needs separate hosting configuration. |
   | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Separate browser key, restricted to Maps JavaScript API. |
   | `SUPABASE_URL` | Supabase project URL. |
   | `SUPABASE_SERVICE_ROLE_KEY` | Private service-role key for that Supabase project. |

   Leave `NEXT_PUBLIC_APP_URL` unset on Vercel so invitations use the deployed hostname. Do not copy `http://localhost:3000` into Vercel. You can optionally set `NEXT_PUBLIC_GOOGLE_MAP_ID` to your own Google JavaScript map ID.
4. Deploy. Add the exact live hostname, such as `https://your-project.vercel.app/*`, to the **Websites** restrictions for the browser key in Google Cloud. Save and allow the restriction change to take effect.
5. Open the live site. Test a starting point, address search and the map. Click **Invite people → Copy invitation link**, then send that one link to the group. Anyone with the invite link can edit the meetup. Do not post it publicly.

Hosted meetups start with their own stored data; old localhost sessions are not automatically moved into Supabase.
