# Virtual NA Meeting Finder

Run with Node.js 22 or newer:

```sh
npm ci
npm start
node --test
```

## Hosting and startup

The server listens on `PORT` (3000 by default). On Render, use `npm ci` as the build command and `npm start` as the start command.

Render Free web services sleep after 15 minutes without inbound traffic. To remove that initial wake-up delay for new visitors, change the **web service's instance type** to a paid instance in Render. A workspace plan upgrade alone does not change the service instance. See https://render.com/docs/free#spinning-down-on-idle. No hosting or billing changes are made by this repository update.

The service worker displays a cached application shell on repeat visits and updates it in the background. The browser can display meeting results saved within the last hour on the same local date and in the same timezone while it requests current data. First visits and live requests still depend on server availability.

## Meeting updates

Six live BMLT sources are loaded at startup and refreshed every 15 minutes while the server is running. The Refresh meetings button requests an immediate update. Concurrent refresh requests share a single fetch operation. Cached results remain available during background refreshes. Requests include a five-second timeout covering both headers and response bodies.

If a source fails, its last successful results may be retained for up to 24 hours, with an unavailable-source notice. Successful empty responses remove that source's old results. Source reports are available at `/api/debug`. Server memory caches reset on restart.

`public/custom-meetings.json` is a separate manually maintained list; BMLT refreshes do not verify or update those entries. Group-specific changes must be made by the relevant BMLT administrator or in this custom file. This update does not independently verify every meeting or helpline number.

## Helplines

US and international directories load together. Users choose their country and area before using a telephone link; location access can suggest a nearby entry. Browser language alone never chooses a number. Entries explicitly marked `isNA: false` are excluded from Call NA.

Validation: `node --test` checks JSON validity, US/UK selection, exclusion of non-NA referrals, cache refresh concurrency, temporary source failures, cache expiry, source removals, and timezone conversion. Browser checks can verify the displayed telephone link without placing a call.
