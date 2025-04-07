import { MCP_CONFIG } from './config';
import { validateNostrData, fetchProfilesWithWoT, createEnhancedSubscription } from './nostr-integration';

// Re-export everything
export * from './config';
export * from './nostr-integration';

// Initialize MCP integrations
export const initMCP = () => {
  console.log('Initializing MCP integration');
  
  // Add MCP global object for easier debugging
  if (typeof window !== 'undefined') {
    (window as any)._mcp = {
      config: MCP_CONFIG,
      validateNostrData,
      fetchProfilesWithWoT,
      createEnhancedSubscription,
    };
    
    console.log('MCP initialized with configuration:', MCP_CONFIG);
  }
  
  return {
    config: MCP_CONFIG,
    validateNostrData,
    fetchProfilesWithWoT,
    createEnhancedSubscription,
  };
};

// Add version information
export const MCP_VERSION = {
  version: '1.0.0',
  name: 'Madeira MCP Integration',
  description: 'Nostr integration for Madeira using the Model Context Protocol',
}; 