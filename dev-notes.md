# Local development notes

## Run unpacked

```
npm run dev
```

Opens a fresh Firefox profile with the extension loaded. Visit any
Scholar profile URL like `https://scholar.google.com/citations?user=...`
to see the projection bar.

## Manual smoke tests

- Open three different profiles: high-volume, mid-volume, sparse (≤2 yrs).
- For each: confirm the projection bar appears, the tooltip shows expected
  fields, and chart rescaling looks proportional.
- Disable the extension; confirm the chart returns to normal.

## Packaging

```
npm run package
```

Produces a signed `.xpi` in `web-ext-artifacts/`.

## Replacing fixtures with real Scholar HTML

Real Scholar markup may differ from the synthetic fixtures used in tests.
After verifying on a live profile:

1. Save the chart container's `outerHTML` from DevTools.
2. Replace `test/fixtures/{tall,medium,sparse}.html` with realistic snapshots.
3. Re-run `npm test`. Adjust selectors in `src/dom/extract.js` if needed.
