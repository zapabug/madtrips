export const LOADING_MESSAGES = {
  // graph loading messages
  GRAPH: [
    "Negotiating TLS handshakes with paranoid relays...",
    "Bribing Madeira monk seals to fetch bytes...",
    "Brewing relay coffee in the protocol percolator...",
    "Riding NPUB submarines through relay channels...",
    "Hitching a ride on digital levada waterways...",
    "Chasing kind:1 events through the stratosphere...",
    "Bribing NIP-05 validators for VIP access...",
    "Hitching a ride on digital levada waterways...",
  ],

  // Feed-specific loading messages
  FEED: [
    "Hitching a ride on digital levada waterways...",
    "Asking local poncha makers for data recipes...",
    "Riding cable cars up to the cloud servers...",
    "Chasing festival fireworks to light up your feed...",
    "Bribing Madeira monk seals to fetch bytes...",
    "Mixing a fresh batch of poncha while we wait...",
    "Herding free-range Madeira bananas into the feed...",
    "Synchronizing sardine grill timers for festival season...",
    "Buffering... (Nacional scored again)",
    "Calibrating Laurisilva forest humidity levels...",
    "Waiting for the last cable car down from Monte...",
    "Consulting the Bordão da Madeira wisdom...",
  ],
};
// Function to get a random loading message from a specific category
export const getRandomLoadingMessage = (category: keyof typeof LOADING_MESSAGES = 'GRAPH') => {
  const messages = LOADING_MESSAGES[category];
  return messages[Math.floor(Math.random() * messages.length)];
};

// Function to get a sequence of loading messages
export const getLoadingMessageSequence = (category: keyof typeof LOADING_MESSAGES = 'FEED', count: number = 3) => {
  const messages = LOADING_MESSAGES[category];
  const sequence = [];
  const messagesCopy = [...messages];
  
  // Get random messages without repeating until we run out
  for (let i = 0; i < count; i++) {
    if (messagesCopy.length === 0) break;
    const randomIndex = Math.floor(Math.random() * messagesCopy.length);
    sequence.push(messagesCopy[randomIndex]);
    messagesCopy.splice(randomIndex, 1);
  }
  
  return sequence;
}; 