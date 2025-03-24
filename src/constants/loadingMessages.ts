export const LOADING_MESSAGES = {
  // General loading messages
  GENERAL: [
    "Loading the nostr-verse...",
    "Gathering sats from the digital ocean...",
    "Connecting to the decentralized web...",
    "Pinging the Bitcoin timechain...",
    "Checking signal across relays...",
  ],

  // Feed-specific loading messages
  FEED: [
    "Fetching the latest updates from your nostr friends...",
    "Catching up with the conversation...",
    "Surfing the nostr wave for fresh content...",
    "Looking for interesting zaps and posts...",
    "Tuning into the global nostr frequency...",
  ],

  // Community updates loading messages
  COMMUNITY: [
    "Gathering the latest from the MadTrips community...",
    "Checking what's happening in the community...",
    "Finding exciting community adventures...",
    "Discovering new community events and meetups...",
    "Loading community highlights and announcements...",
  ],

  // Profile loading messages
  PROFILE: [
    "Loading nostr identity...",
    "Grabbing your digital self from the nostr network...",
    "Checking your nostr presence...",
    "Syncing your profile across relays...",
    "Retrieving your latest activity...",
  ],
};

// Function to get a random loading message from a specific category
export const getRandomLoadingMessage = (category: keyof typeof LOADING_MESSAGES = 'GENERAL') => {
  const messages = LOADING_MESSAGES[category];
  return messages[Math.floor(Math.random() * messages.length)];
};

// Function to get a sequence of loading messages
export const getLoadingMessageSequence = (category: keyof typeof LOADING_MESSAGES = 'GENERAL', count: number = 3) => {
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