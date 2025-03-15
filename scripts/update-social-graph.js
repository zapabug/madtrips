/**
 * Script to update the Nostr social graph data
 * 
 * This script can be run independently or scheduled using cron/task scheduler
 * to keep the social graph data up to date.
 * 
 * Current key npubs:
 * - Free Madeira: npub1etgqcj9gc6yaxttuwu9eqgs3ynt2dzaudvwnrssrn2zdt2useaasfj8n6e
 * - Madtrips agency: npub1dxd02kcjhgpkyrx60qnkd6j42kmc72u5lum0rp2ud8x5zfhnk4zscjj6hh
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Import our fetcher directly
// We need to transpile the TypeScript first
async function main() {
  try {
    console.log('Starting social graph update...');
    console.log('Tracking Free Madeira and Madtrips agency accounts...');
    
    // Ensure we're in the project root
    const projectRoot = path.resolve(__dirname, '..');
    process.chdir(projectRoot);
    
    // Ensure the data directory exists
    const dataDir = path.join(projectRoot, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log('Created data directory');
    }
    
    // Use Next.js API to run the update
    // This approach allows us to use the same code without duplicating the fetcher logic
    console.log('Calling API to update social graph...');
    
    // In production, you would use fetch against your deployed API
    // For local development, we'll use curl to avoid CORS issues
    try {
      execSync('curl -X GET "http://localhost:3000/api/socialgraph?update=true"', { 
        stdio: 'inherit'
      });
      console.log('Social graph update completed successfully');
    } catch (error) {
      console.error('Failed to update via API, server might not be running');
      console.error('You can run the update by starting the Next.js server and visiting /api/socialgraph?update=true');
    }
  } catch (error) {
    console.error('Error updating social graph:', error);
    process.exit(1);
  }
}

main(); 