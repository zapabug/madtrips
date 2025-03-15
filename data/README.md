# Nostr Social Graph Data

This directory contains data files for the Nostr social graph visualization.

## Data Files

- `social-graph.json`: Contains the social graph data with follows, followers, and interactions.
- `known-pubkeys.json`: Contains the known Nostr pubkeys being tracked.

## Important Nostr Public Keys

- **Free Madeira**: `npub1etgqcj9gc6yaxttuwu9eqgs3ynt2dzaudvwnrssrn2zdt2useaasfj8n6e`
- **Madtrips Agency**: `npub1dxd02kcjhgpkyrx60qnkd6j42kmc72u5lum0rp2ud8x5zfhnk4zscjj6hh`

## Updating the Social Graph

The social graph data can be updated in several ways:

1. **Via Admin UI**: Visit `/admin/socialgraph` in the application to update the graph and add new pubkeys.

2. **Via API**:
   - Force update: `GET /api/socialgraph?update=true`
   - Add a new pubkey: `POST /api/socialgraph` with body `{ "npub": "npub1..." }`
   - View raw data: `GET /api/socialgraph?type=raw&format=raw`

3. **Via Script**: Run the `scripts/update-social-graph.js` script.

## Manual Backups

It's recommended to periodically back up these data files to prevent data loss. You can manually copy the JSON files to a secure location or use a version control system like Git.

## Visualization

The social graph visualization is displayed on the Community page and shows connections between Nostr users in the Free Madeira community. The visualization uses D3.js to render the graph and fetches profile images from Nostr relays.

## Node Types

- **Core**: Free Madeira members (Purple)
- **Followers**: Accounts that follow Free Madeira members (Blue)
- **Following**: Accounts followed by Free Madeira members (Green)
- **Mutual**: Accounts with mutual follows with Free Madeira members (Amber) 