#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const chalk = require('chalk'); // You may need to install this: npm install chalk

// Utility to make paths relative to project root
const projectRoot = path.resolve(__dirname, '..');
const resolvePath = (...parts) => path.join(projectRoot, ...parts);

console.log(chalk.blue.bold('=== Social Graph Diagnostic Tool ==='));
console.log('Running diagnostics on social graph data...\n');

// Check if data directory exists
const dataDir = resolvePath('data');
const results = {
  directories: {
    status: 'checking',
    details: {}
  },
  files: {
    status: 'checking',
    details: {}
  },
  data: {
    status: 'checking',
    details: {}
  }
};

// Check directories
console.log(chalk.cyan('Checking directories...'));
if (fs.existsSync(dataDir)) {
  console.log(`✅ Data directory found: ${chalk.green(dataDir)}`);
  results.directories.status = 'success';
  results.directories.details.dataDir = true;
} else {
  console.log(`❌ Data directory not found: ${chalk.red(dataDir)}`);
  results.directories.status = 'error';
  results.directories.details.dataDir = false;
}

// Check data files existence
console.log(chalk.cyan('\nChecking data files...'));
const socialGraphPath = resolvePath('data', 'social-graph.json');
const knownPubkeysPath = resolvePath('data', 'known-pubkeys.json');

if (fs.existsSync(socialGraphPath)) {
  const stats = fs.statSync(socialGraphPath);
  const fileSizeKB = Math.round(stats.size / 1024);
  console.log(`✅ social-graph.json found (${chalk.green(fileSizeKB + ' KB')})`);
  results.files.details.socialGraphExists = true;
  results.files.details.socialGraphSize = stats.size;
  results.files.details.socialGraphModified = stats.mtime;
} else {
  console.log(`❌ social-graph.json not found`);
  results.files.details.socialGraphExists = false;
}

if (fs.existsSync(knownPubkeysPath)) {
  const stats = fs.statSync(knownPubkeysPath);
  const fileSizeKB = Math.round(stats.size / 1024);
  console.log(`✅ known-pubkeys.json found (${chalk.green(fileSizeKB + ' KB')})`);
  results.files.details.knownPubkeysExists = true;
  results.files.details.knownPubkeysSize = stats.size;
  results.files.details.knownPubkeysModified = stats.mtime;
} else {
  console.log(`❌ known-pubkeys.json not found`);
  results.files.details.knownPubkeysExists = false;
}

// Set files status
if (!results.files.details.socialGraphExists || !results.files.details.knownPubkeysExists) {
  results.files.status = 'error';
} else {
  results.files.status = 'success';
}

// Check data file contents
console.log(chalk.cyan('\nChecking data file contents...'));

if (results.files.details.socialGraphExists) {
  try {
    const socialGraphContent = fs.readFileSync(socialGraphPath, 'utf-8');
    const socialGraphData = JSON.parse(socialGraphContent);
    
    if (socialGraphData && typeof socialGraphData === 'object') {
      results.data.details.socialGraphValid = true;
      
      if (Array.isArray(socialGraphData.nodes)) {
        const nodesCount = socialGraphData.nodes.length;
        console.log(`✅ social-graph.json contains ${chalk.green(nodesCount)} nodes`);
        results.data.details.nodesCount = nodesCount;
      } else {
        console.log(`❌ social-graph.json has invalid 'nodes' property`);
        results.data.details.socialGraphValid = false;
      }
      
      if (Array.isArray(socialGraphData.links)) {
        const linksCount = socialGraphData.links.length;
        console.log(`✅ social-graph.json contains ${chalk.green(linksCount)} links`);
        results.data.details.linksCount = linksCount;
      } else {
        console.log(`❌ social-graph.json has invalid 'links' property`);
        results.data.details.socialGraphValid = false;
      }
      
      // Check node types
      if (Array.isArray(socialGraphData.nodes) && socialGraphData.nodes.length > 0) {
        const nodeTypes = {};
        socialGraphData.nodes.forEach(node => {
          const type = node.type || 'unknown';
          nodeTypes[type] = (nodeTypes[type] || 0) + 1;
        });
        
        console.log(chalk.cyan('\nNode type distribution:'));
        Object.entries(nodeTypes).forEach(([type, count]) => {
          console.log(`  - ${type}: ${count}`);
        });
        
        results.data.details.nodeTypes = nodeTypes;
      }
    } else {
      console.log(`❌ social-graph.json has invalid format`);
      results.data.details.socialGraphValid = false;
    }
  } catch (error) {
    console.log(`❌ Error parsing social-graph.json: ${chalk.red(error.message)}`);
    results.data.details.socialGraphValid = false;
    results.data.details.socialGraphError = error.message;
  }
}

if (results.files.details.knownPubkeysExists) {
  try {
    const knownPubkeysContent = fs.readFileSync(knownPubkeysPath, 'utf-8');
    const knownPubkeysData = JSON.parse(knownPubkeysContent);
    
    if (knownPubkeysData && typeof knownPubkeysData === 'object') {
      results.data.details.knownPubkeysValid = true;
      
      if (knownPubkeysData.npubs && typeof knownPubkeysData.npubs === 'object') {
        const pubkeysCount = Object.keys(knownPubkeysData.npubs).length;
        console.log(`✅ known-pubkeys.json contains ${chalk.green(pubkeysCount)} pubkeys`);
        results.data.details.pubkeysCount = pubkeysCount;
        
        // Check for important npubs
        const freeMadeiraNpub = 'npub1etgqcj9gc6yaxttuwu9eqgs3ynt2dzaudvwnrssrn2zdt2useaasfj8n6e';
        const madtripsAgencyNpub = 'npub1dxd02kcjhgpkyrx60qnkd6j42kmc72u5lum0rp2ud8x5zfhnk4zscjj6hh';
        
        const hasFreeMadeira = Object.keys(knownPubkeysData.npubs).some(npub => npub === freeMadeiraNpub);
        const hasMadtripsAgency = Object.keys(knownPubkeysData.npubs).some(npub => npub === madtripsAgencyNpub);
        
        if (hasFreeMadeira) {
          console.log(`✅ Found Free Madeira npub`);
        } else {
          console.log(`❌ Free Madeira npub not found in known pubkeys`);
        }
        
        if (hasMadtripsAgency) {
          console.log(`✅ Found Madtrips Agency npub`);
        } else {
          console.log(`❌ Madtrips Agency npub not found in known pubkeys`);
        }
        
        results.data.details.hasFreeMadeira = hasFreeMadeira;
        results.data.details.hasMadtripsAgency = hasMadtripsAgency;
      } else {
        console.log(`❌ known-pubkeys.json has invalid 'npubs' property`);
        results.data.details.knownPubkeysValid = false;
      }
    } else {
      console.log(`❌ known-pubkeys.json has invalid format`);
      results.data.details.knownPubkeysValid = false;
    }
  } catch (error) {
    console.log(`❌ Error parsing known-pubkeys.json: ${chalk.red(error.message)}`);
    results.data.details.knownPubkeysValid = false;
    results.data.details.knownPubkeysError = error.message;
  }
}

// Set data status
if (
  results.data.details.socialGraphValid === false || 
  results.data.details.knownPubkeysValid === false
) {
  results.data.status = 'error';
} else if (
  results.data.details.nodesCount === 0 || 
  results.data.details.linksCount === 0 ||
  results.data.details.pubkeysCount === 0
) {
  results.data.status = 'warning';
} else {
  results.data.status = 'success';
}

// Generate recommendations
console.log(chalk.blue.bold('\n=== Recommendations ==='));

if (results.directories.status === 'error') {
  console.log(`${chalk.red('!')} Create the data directory at the project root`);
}

if (!results.files.details.socialGraphExists) {
  console.log(`${chalk.red('!')} Create social-graph.json with structure: {"nodes":[],"links":[]}`);
}

if (!results.files.details.knownPubkeysExists) {
  console.log(`${chalk.red('!')} Create known-pubkeys.json with structure: {"npubs":{}}`);
}

if (results.data.details.socialGraphValid === false) {
  console.log(`${chalk.red('!')} Fix the social-graph.json file format`);
}

if (results.data.details.knownPubkeysValid === false) {
  console.log(`${chalk.red('!')} Fix the known-pubkeys.json file format`);
}

if (results.data.details.nodesCount === 0) {
  console.log(`${chalk.yellow('!')} The social graph has no nodes. Update it with known npubs`);
}

if (results.data.details.hasFreeMadeira === false) {
  console.log(`${chalk.yellow('!')} Add the Free Madeira npub: ${chalk.cyan('npub1etgqcj9gc6yaxttuwu9eqgs3ynt2dzaudvwnrssrn2zdt2useaasfj8n6e')}`);
}

if (results.data.details.hasMadtripsAgency === false) {
  console.log(`${chalk.yellow('!')} Add the Madtrips Agency npub: ${chalk.cyan('npub1dxd02kcjhgpkyrx60qnkd6j42kmc72u5lum0rp2ud8x5zfhnk4zscjj6hh')}`);
}

// Overall status
console.log(chalk.blue.bold('\n=== Summary ==='));

const statusEmoji = {
  success: '✅',
  warning: '⚠️',
  error: '❌',
  checking: '⏳'
};

const statusColor = {
  success: chalk.green,
  warning: chalk.yellow,
  error: chalk.red,
  checking: chalk.gray
};

console.log(`${statusEmoji[results.directories.status]} Directories: ${statusColor[results.directories.status](results.directories.status)}`);
console.log(`${statusEmoji[results.files.status]} Files: ${statusColor[results.files.status](results.files.status)}`);
console.log(`${statusEmoji[results.data.status]} Data: ${statusColor[results.data.status](results.data.status)}`);

// Overall result
let overallStatus = 'success';
if (results.directories.status === 'error' || results.files.status === 'error' || results.data.status === 'error') {
  overallStatus = 'error';
} else if (results.directories.status === 'warning' || results.files.status === 'warning' || results.data.status === 'warning') {
  overallStatus = 'warning';
}

console.log(chalk.blue.bold('\n=== Overall Diagnosis ==='));
console.log(`${statusEmoji[overallStatus]} ${statusColor[overallStatus](overallStatus.toUpperCase())}`);

// Next steps
console.log(chalk.blue.bold('\n=== Next Steps ==='));
console.log(`1. ${chalk.cyan('Visit the web diagnosis page:')} http://localhost:3000/diagnosis`);
console.log(`2. ${chalk.cyan('Check the admin page:')} http://localhost:3000/admin/socialgraph`);
console.log(`3. ${chalk.cyan('Update the social graph:')} http://localhost:3000/api/socialgraph?update=true`);

console.log('\nDiagnosis complete!'); 