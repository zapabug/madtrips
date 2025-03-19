import NDK, { NDKEvent, NDKFilter, NDKUser } from '@nostr-dev-kit/ndk';
import { nip04 } from 'nostr-tools';
import { NostrDM } from '../../types/cart-types';

export class NostrMessagingService {
  private ndk: NDK;
  
  constructor(ndk: NDK) {
    this.ndk = ndk;
  }
  
  /**
   * Send a direct message to another Nostr user
   * @param senderPrivateKey - Sender's private key (will be null if using NIP-07 extension)
   * @param recipientPubkey - Recipient's public key
   * @param content - Message content
   * @returns Promise with the event ID
   */
  async sendDirectMessage(
    recipientPubkey: string,
    content: string,
    relatedToPayment: boolean = false,
    paymentType?: 'collateral' | 'final' | 'reminder'
  ): Promise<string> {
    if (!this.ndk.signer) {
      throw new Error('No signer available. You must be logged in to send messages.');
    }
    
    try {
      // Create a new event
      const event = new NDKEvent(this.ndk);
      
      // Set kind to 4 (encrypted direct message)
      event.kind = 4;
      
      // Get the sender's pubkey from the signer
      const sender = await this.ndk.signer.user();
      
      // Add recipient as a tag
      event.tags = [['p', recipientPubkey]];
      
      // Add payment-related tags if this is a payment message
      if (relatedToPayment) {
        event.tags.push(['t', 'payment']);
        
        if (paymentType) {
          event.tags.push(['payment', paymentType]);
        }
      }
      
      // Encrypt the content with NIP-04
      // If using NIP-07, this will be handled by the extension
      if (this.ndk.signer.nip04) {
        event.content = await this.ndk.signer.nip04.encrypt(recipientPubkey, content);
      } else {
        // Fallback for demo purposes
        event.content = content;
        console.warn('Encryption not available - sending plaintext message for demo purposes');
      }
      
      // Sign and publish the event
      await event.publish();
      
      return event.id || '';
    } catch (error) {
      console.error('Failed to send direct message:', error);
      throw error;
    }
  }
  
  /**
   * Get direct messages between two users
   * @param user1 - First user's public key
   * @param user2 - Second user's public key
   * @param limit - Maximum number of messages to fetch
   * @returns Promise with an array of messages
   */
  async getDirectMessages(
    user1: string,
    user2: string,
    limit: number = 50
  ): Promise<NostrDM[]> {
    try {
      // Create a filter for DMs between these users
      const filter: NDKFilter = {
        kinds: [4],
        authors: [user1, user2],
        '#p': [user1, user2],
        limit,
      };
      
      // Fetch the events
      const events = await this.ndk.fetchEvents(filter);
      
      // Process the events
      const messages: NostrDM[] = [];
      
      for (const event of events) {
        try {
          // Skip events with missing data
          if (!event.pubkey || !event.content || !event.tags) continue;
          
          // Find the recipient tag
          const pTag = event.tags.find(tag => tag[0] === 'p');
          if (!pTag || !pTag[1]) continue;
          
          const recipientPubkey = pTag[1];
          
          // Determine if this is a payment-related message
          const isPaymentMessage = event.tags.some(tag => tag[0] === 't' && tag[1] === 'payment');
          const paymentTypeTag = event.tags.find(tag => tag[0] === 'payment');
          const paymentType = paymentTypeTag ? paymentTypeTag[1] as 'collateral' | 'final' | 'reminder' : undefined;
          
          // Decrypt the content if needed
          let decryptedContent = event.content;
          
          // Add to messages array
          messages.push({
            id: event.id || '',
            sender: event.pubkey,
            recipient: recipientPubkey,
            content: decryptedContent,
            date: new Date(event.created_at ? event.created_at * 1000 : Date.now()),
            relatedToPayment: isPaymentMessage,
            paymentType
          });
        } catch (decryptError) {
          console.error('Failed to process direct message:', decryptError);
          // Skip this message
        }
      }
      
      // Sort by date
      messages.sort((a, b) => a.date.getTime() - b.date.getTime());
      
      return messages;
    } catch (error) {
      console.error('Failed to fetch direct messages:', error);
      return [];
    }
  }
  
  /**
   * Subscribe to incoming direct messages
   * @param userPubkey - User's public key
   * @param onMessage - Callback function to handle new messages
   * @returns A function to unsubscribe
   */
  subscribeToDirectMessages(
    userPubkey: string,
    onMessage: (message: NostrDM) => void
  ): () => void {
    try {
      // Create a filter for incoming DMs
      const filter: NDKFilter = {
        kinds: [4],
        '#p': [userPubkey],
        since: Math.floor(Date.now() / 1000),
      };
      
      // Create a subscription
      const subscription = this.ndk.subscribe(filter, { closeOnEose: false });
      
      // Handle incoming events
      subscription.on('event', async (event: NDKEvent) => {
        try {
          // Skip events with missing data
          if (!event.pubkey || !event.content || !event.tags) return;
          
          // Verify this is a message for our user
          const pTag = event.tags.find(tag => tag[0] === 'p' && tag[1] === userPubkey);
          if (!pTag) return;
          
          // Determine if this is a payment-related message
          const isPaymentMessage = event.tags.some(tag => tag[0] === 't' && tag[1] === 'payment');
          const paymentTypeTag = event.tags.find(tag => tag[0] === 'payment');
          const paymentType = paymentTypeTag ? paymentTypeTag[1] as 'collateral' | 'final' | 'reminder' : undefined;
          
          // Decrypt the content if needed (would be handled by the extension)
          let decryptedContent = event.content;
          
          // Call the callback with the new message
          onMessage({
            id: event.id || '',
            sender: event.pubkey,
            recipient: userPubkey,
            content: decryptedContent,
            date: new Date(event.created_at ? event.created_at * 1000 : Date.now()),
            relatedToPayment: isPaymentMessage,
            paymentType
          });
        } catch (messageError) {
          console.error('Failed to process incoming direct message:', messageError);
        }
      });
      
      // Return a function to unsubscribe
      return () => {
        subscription.stop();
      };
    } catch (error) {
      console.error('Failed to subscribe to direct messages:', error);
      return () => {};
    }
  }
}

// Create a singleton instance
let messagingServiceInstance: NostrMessagingService | null = null;

/**
 * Get or create the messaging service instance
 */
export const getMessagingService = (ndk: NDK): NostrMessagingService => {
  if (!messagingServiceInstance) {
    messagingServiceInstance = new NostrMessagingService(ndk);
  }
  return messagingServiceInstance;
}; 