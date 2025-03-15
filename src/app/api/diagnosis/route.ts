import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { getSocialGraphData } from '@/lib/nostr/NostrSocialGraphFetcher';

export async function GET() {
  try {
    // Check if data files exist
    const diagnosticResults: Record<string, any> = {
      files: {
        status: 'checking',
        details: {}
      },
      data: {
        status: 'checking',
        details: {}
      },
      api: {
        status: 'checking',
        details: {}
      }
    };

    // Check data files
    const dataDir = path.join(process.cwd(), 'data');
    const socialGraphPath = path.join(dataDir, 'social-graph.json');
    const knownPubkeysPath = path.join(dataDir, 'known-pubkeys.json');

    // Check if directory exists
    diagnosticResults.files.details.directoryExists = fs.existsSync(dataDir);
    
    // Check individual files
    if (diagnosticResults.files.details.directoryExists) {
      diagnosticResults.files.details.socialGraphExists = fs.existsSync(socialGraphPath);
      diagnosticResults.files.details.knownPubkeysExists = fs.existsSync(knownPubkeysPath);
      
      // Check file sizes
      if (diagnosticResults.files.details.socialGraphExists) {
        const stats = fs.statSync(socialGraphPath);
        diagnosticResults.files.details.socialGraphSize = stats.size;
        diagnosticResults.files.details.socialGraphModified = stats.mtime;
        
        // Read a sample of the file to check validity
        try {
          const fileContent = fs.readFileSync(socialGraphPath, 'utf-8');
          const data = JSON.parse(fileContent);
          diagnosticResults.files.details.socialGraphValid = true;
          diagnosticResults.files.details.nodesCount = data.nodes?.length || 0;
          diagnosticResults.files.details.linksCount = data.links?.length || 0;
        } catch (e) {
          diagnosticResults.files.details.socialGraphValid = false;
          diagnosticResults.files.details.socialGraphError = (e as Error).message;
        }
      }
      
      if (diagnosticResults.files.details.knownPubkeysExists) {
        const stats = fs.statSync(knownPubkeysPath);
        diagnosticResults.files.details.knownPubkeysSize = stats.size;
        diagnosticResults.files.details.knownPubkeysModified = stats.mtime;
        
        // Read the file to check validity
        try {
          const fileContent = fs.readFileSync(knownPubkeysPath, 'utf-8');
          const data = JSON.parse(fileContent);
          diagnosticResults.files.details.knownPubkeysValid = true;
          diagnosticResults.files.details.pubkeysCount = Object.keys(data.npubs || {}).length;
        } catch (e) {
          diagnosticResults.files.details.knownPubkeysValid = false;
          diagnosticResults.files.details.knownPubkeysError = (e as Error).message;
        }
      }
    }
    
    // Set overall file status
    if (!diagnosticResults.files.details.directoryExists) {
      diagnosticResults.files.status = 'error';
      diagnosticResults.files.message = 'Data directory does not exist';
    } else if (!diagnosticResults.files.details.socialGraphExists || !diagnosticResults.files.details.knownPubkeysExists) {
      diagnosticResults.files.status = 'warning';
      diagnosticResults.files.message = 'One or more data files missing';
    } else if (!diagnosticResults.files.details.socialGraphValid || !diagnosticResults.files.details.knownPubkeysValid) {
      diagnosticResults.files.status = 'error';
      diagnosticResults.files.message = 'One or more data files are invalid';
    } else {
      diagnosticResults.files.status = 'success';
      diagnosticResults.files.message = 'All data files exist and are valid';
    }
    
    // Check data from fetcher
    try {
      const graphData = await getSocialGraphData();
      diagnosticResults.data.details.fetchSuccess = true;
      diagnosticResults.data.details.hasNodes = Boolean(graphData.nodes && graphData.nodes.length > 0);
      diagnosticResults.data.details.nodesCount = graphData.nodes?.length || 0;
      diagnosticResults.data.details.hasLinks = Boolean(graphData.links && graphData.links.length > 0);
      diagnosticResults.data.details.linksCount = graphData.links?.length || 0;
      
      if (diagnosticResults.data.details.nodesCount > 0) {
        diagnosticResults.data.details.sampleNodes = graphData.nodes.slice(0, 3);
      }
      
      // Check node types distribution
      const nodeTypes: Record<string, number> = {};
      if (graphData.nodes) {
        graphData.nodes.forEach((node: any) => {
          const type = node.type || 'unknown';
          nodeTypes[type] = (nodeTypes[type] || 0) + 1;
        });
        diagnosticResults.data.details.nodeTypeDistribution = nodeTypes;
      }
      
      // Set data status
      if (!diagnosticResults.data.details.hasNodes) {
        diagnosticResults.data.status = 'error';
        diagnosticResults.data.message = 'No nodes found in social graph data';
      } else if (!diagnosticResults.data.details.hasLinks) {
        diagnosticResults.data.status = 'warning';
        diagnosticResults.data.message = 'Nodes found but no links in social graph data';
      } else {
        diagnosticResults.data.status = 'success';
        diagnosticResults.data.message = `Social graph has ${diagnosticResults.data.details.nodesCount} nodes and ${diagnosticResults.data.details.linksCount} links`;
      }
    } catch (e) {
      diagnosticResults.data.status = 'error';
      diagnosticResults.data.message = `Failed to fetch social graph data: ${(e as Error).message}`;
      diagnosticResults.data.details.fetchSuccess = false;
      diagnosticResults.data.details.error = (e as Error).message;
    }
    
    // Overall API status
    if (diagnosticResults.files.status === 'error' || diagnosticResults.data.status === 'error') {
      diagnosticResults.api.status = 'error';
      diagnosticResults.api.message = 'Critical issues found with social graph data';
    } else if (diagnosticResults.files.status === 'warning' || diagnosticResults.data.status === 'warning') {
      diagnosticResults.api.status = 'warning';
      diagnosticResults.api.message = 'Non-critical issues found with social graph data';
    } else {
      diagnosticResults.api.status = 'success';
      diagnosticResults.api.message = 'Social graph data is healthy';
    }
    
    return NextResponse.json({
      message: 'Diagnosis complete',
      timestamp: Date.now(),
      results: diagnosticResults,
      recommendations: generateRecommendations(diagnosticResults)
    });
  } catch (error) {
    console.error('Diagnosis error:', error);
    return NextResponse.json(
      { 
        message: 'Diagnosis failed', 
        error: (error as Error).message,
        timestamp: Date.now()
      },
      { status: 500 }
    );
  }
}

function generateRecommendations(results: Record<string, any>): string[] {
  const recommendations: string[] = [];
  
  if (results.files.status !== 'success') {
    if (!results.files.details.directoryExists) {
      recommendations.push('Create the data directory at the root of your project');
    }
    if (!results.files.details.socialGraphExists) {
      recommendations.push('Initialize the social-graph.json file with a valid graph structure: {"nodes":[],"links":[]}');
    }
    if (!results.files.details.knownPubkeysExists) {
      recommendations.push('Initialize the known-pubkeys.json file with a valid structure: {"npubs":{}}');
    }
    if (results.files.details.socialGraphExists && !results.files.details.socialGraphValid) {
      recommendations.push('Fix the social-graph.json file - it contains invalid JSON');
    }
    if (results.files.details.knownPubkeysExists && !results.files.details.knownPubkeysValid) {
      recommendations.push('Fix the known-pubkeys.json file - it contains invalid JSON');
    }
  }
  
  if (results.data.status !== 'success') {
    if (!results.data.details.fetchSuccess) {
      recommendations.push('Check the getSocialGraphData function for errors');
    } else if (!results.data.details.hasNodes) {
      recommendations.push('The social graph has no nodes. Try updating it with known npubs');
      recommendations.push('Use the admin UI or API to add initial npubs');
    } else if (!results.data.details.hasLinks) {
      recommendations.push('The social graph has nodes but no links. This suggests incomplete data');
      recommendations.push('Try updating more npubs or checking the link generation logic');
    }
  }
  
  // Check file sizes
  if (results.files.details.socialGraphSize && results.files.details.socialGraphSize < 100) {
    recommendations.push('The social-graph.json file is suspiciously small. It may be empty or initialized incorrectly');
  }
  
  // Add general recommendations
  recommendations.push('Visit the admin page at /admin/socialgraph to manage the social graph');
  recommendations.push('If visualization issues persist, check the browser console for client-side errors');
  
  return recommendations;
} 