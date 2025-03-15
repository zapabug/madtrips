import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

// For a real implementation, you would use a proper Nostr library
// This is a simplified version for demo purposes

// Generate a private key for the application (in production, this would be stored securely)
const APP_PRIVATE_KEY = process.env.NOSTR_PRIVATE_KEY || crypto.randomBytes(32).toString('hex');
console.log('Using Nostr private key:', APP_PRIVATE_KEY);

// Convert hex private key to public key (simplified for demo)
const getPublicKey = (privateKey) => {
  // In a real implementation, this would use proper cryptography
  // For demo, we'll just hash the private key
  return crypto.createHash('sha256').update(privateKey).digest('hex');
};

const APP_PUBLIC_KEY = getPublicKey(APP_PRIVATE_KEY);
console.log('App Nostr public key:', APP_PUBLIC_KEY);

// Helper to convert npub to hex format if needed
const normalizeNostrPubkey = (pubkey) => {
  // Check if this is an npub prefix
  if (pubkey.startsWith('npub')) {
    console.log(`Converting npub to hex: ${pubkey.substring(0, 12)}...`);
    // In a real implementation, you would use proper bech32 conversion
    // For demo, we'll just return a known hex value for npub1funchalx8v747rsee6ahsuyrcd2s3rnxlyrtumfex9lecpmgwars6hq8kc
    if (pubkey === 'npub1funchalx8v747rsee6ahsuyrcd2s3rnxlyrtumfex9lecpmgwars6hq8kc') {
      return '36f11d533238584db19a528377cb622c3e58e3066057651a82a84f1f3dd618e8';
    }
    // For other npubs, just hash them for demo
    return crypto.createHash('sha256').update(pubkey).digest('hex');
  }
  
  // Already a hex pubkey
  return pubkey;
};

// Send a direct message to a user
export const sendDirectMessage = async (recipientPubkey, message) => {
  try {
    // Normalize the pubkey (convert from npub if needed)
    const normalizedPubkey = normalizeNostrPubkey(recipientPubkey);
    
    console.log(`Sending Nostr DM to ${normalizedPubkey.substring(0, 8)}...`);
    console.log('Message content:', message);
    
    // In a real implementation, this would create and publish a Nostr event
    // For demo purposes, we'll just log the message
    
    // Check if this is a Primal pubkey and handle accordingly
    const isPrimal = recipientPubkey.startsWith('npub1funchalx8v747rsee6ahsuyrcd2s3rnxlyrtumfex9lecpmgwars6hq8kc');
    if (isPrimal) {
      console.log('Using Primal-specific DM protocol...');
    }
    
    // Simulate a successful message send
    return {
      success: true,
      eventId: crypto.randomBytes(32).toString('hex'),
      timestamp: new Date().toISOString(),
      client: isPrimal ? 'primal' : 'standard'
    };
  } catch (error) {
    console.error('Error sending Nostr DM:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Send a booking confirmation message
export const sendBookingConfirmation = async (booking, payment) => {
  if (!booking.nostrPubkey) {
    console.warn('Cannot send booking confirmation: No Nostr pubkey provided');
    return { success: false, error: 'No Nostr pubkey provided' };
  }
  
  // Check if this is a Primal pubkey
  const isPrimal = booking.nostrPubkey.includes('npub1funchalx8v747rsee6ahsuyrcd2s3rnxlyrtumfex9lecpmgwars6hq8kc');
  
  // Create a message with appropriate format for the client
  const confirmationMessage = `
🎉 Your MadTrips booking is confirmed!

📦 Package: ${booking.packageTitle}
🔑 Booking ID: ${booking.id}
💰 Amount: ${payment.amount} sats
📅 Date: ${new Date(booking.createdAt).toLocaleString()}

Thank you for booking with MadTrips! Your adventure awaits.

${isPrimal ? '📱 Confirmation sent via Primal' : 'This is a secure message sent via Nostr.'}
`;

  return await sendDirectMessage(booking.nostrPubkey, confirmationMessage);
};

// For demo purposes only - in a real app, you would use proper Nostr libraries
export const generateNostrProof = (bookingId) => {
  // Create a simple proof of booking that could be verified
  const signature = crypto.createHmac('sha256', APP_PRIVATE_KEY)
    .update(bookingId)
    .digest('hex');
    
  return {
    bookingId,
    timestamp: new Date().toISOString(),
    pubkey: APP_PUBLIC_KEY,
    signature
  };
}; 