# Social Graph Diagnosis Tools

This document outlines the diagnostic tools available for troubleshooting the Nostr Social Graph in the MadTrips application.

## Available Diagnostic Tools

### 1. Quick Diagnostic Script

The easiest way to diagnose social graph issues is to run:

```bash
./diagnose.sh
```

This shell script will:
- Run the server-side diagnostic script
- Offer to open the web-based diagnosis page
- Provide an option to force-update the social graph

### 2. Web-based Diagnosis Page

Visit [http://localhost:3000/diagnosis](http://localhost:3000/diagnosis) to access the comprehensive web-based diagnosis tool that provides:

- Server-side data diagnostics
- Client-side rendering diagnostics
- Data visualizations and statistics
- Specific recommendations for fixing issues

### 3. Command-line Diagnostic Tool

For developers who prefer command-line tools:

```bash
node scripts/diagnose-socialgraph.js
```

This script checks:
- Data directory structure
- Data file existence and validity
- Node and link counts
- Important npubs presence

### 4. Browser Console Diagnostic

For client-side rendering issues, you can run the browser diagnostic tool:

1. Visit the Community page at [http://localhost:3000/community](http://localhost:3000/community)
2. Open your browser's developer console (F12 or right-click > Inspect > Console)
3. Run this command:
```javascript
const script = document.createElement('script'); script.src = '/diagnosis.js'; document.body.appendChild(script);
```

Alternatively, use the "Run Browser Diagnostic" button on the diagnosis page.

## Common Issues and Solutions

### No Data Showing

If the visualization shows no data:

1. Check if the data files exist:
   - `data/social-graph.json`
   - `data/known-pubkeys.json`

2. Force an update of the social graph:
   - Visit [http://localhost:3000/api/socialgraph?update=true](http://localhost:3000/api/socialgraph?update=true)
   - Or use the "Force Graph Update" button on the diagnosis page

3. Add essential npubs if missing:
   - Free Madeira: `npub1etgqcj9gc6yaxttuwu9eqgs3ynt2dzaudvwnrssrn2zdt2useaasfj8n6e`
   - Madtrips Agency: `npub1dxd02kcjhgpkyrx60qnkd6j42kmc72u5lum0rp2ud8x5zfhnk4zscjj6hh`

### Visualization Rendering Issues

If data exists but is not displaying:

1. Try the simple view (using the toggle on the Community page)
2. Check browser console for errors
3. Verify SVG container dimensions
4. Ensure D3.js is properly loaded

## Reporting Issues

When reporting issues, please include:

1. Output from running `./diagnose.sh`
2. Browser console errors (if any)
3. Screenshots of the diagnosis page
4. Steps to reproduce the issue

## Maintaining the Social Graph

For optimal performance:

1. Regularly update the social graph to include new connections
2. Keep the list of known npubs current
3. If the graph becomes too large, consider filtering less relevant connections
4. Back up data files periodically 