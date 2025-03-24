'use client';

import { NostrEvent, NostrProfile } from '../../types/nostr';
import { nip04, nip19 } from 'nostr-tools';
import { NostrDM } from '../../types/cart-types';

interface MessagingService {
  sendMessage: (recipientPubkey: string, content: string, tags?: string[][]) => Promise<NostrEvent | null>;
  getConversations: () => Promise<{ pubkey: string; profile: NostrProfile | null }[]>;
  getMessages: (pubkey: string) => Promise<NostrDM[]>;
  encryptMessage: (recipientPubkey: string, content: string) => Promise<string>;
  decryptMessage: (senderPubkey: string, encryptedContent: string) => Promise<string>;
}

class NostrMessagingService implements MessagingService {
  private pubkey: string | null = null;
  private privateKey: string | null = null;
  
  constructor(pubkey?: string, privateKey?: string) {
    this.pubkey = pubkey || null;
    this.privateKey = privateKey || null;
  }
  
  /**
   * Set user credentials for messaging
   */
  setCredentials(pubkey: string, privateKey: string) {
    this.pubkey = pubkey;
    this.privateKey = privateKey;
  }
  
  /**
   * Clear user credentials
   */
  clearCredentials() {
    this.pubkey = null;
    this.privateKey = null;
  }
  
  /**
   * Send a direct message to another user
   */
  async sendMessage(recipientPubkey: string, content: string, tags: string[][] = []): Promise<NostrEvent | null> {
    if (!this.pubkey || !this.privateKey) {
      throw new Error('User not authenticated');
    }
    
    try {
      // Encrypt message content
      const encryptedContent = await this.encryptMessage(recipientPubkey, content);
      
      // Create the event
      const event: NostrEvent = {
        kind: 4, // Direct message
        pubkey: this.pubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['p', recipientPubkey],
          ...tags
        ],
        content: encryptedContent,
        id: '', // This will be computed by the signing function
        sig: '' // This will be computed by the signing function
      };
      
      // Sign and publish event would happen here
      console.log('Would sign and publish DM event:', event);
      
      return event;
    } catch (error) {
      console.error('Error sending message:', error);
      return null;
    }
  }
  
  /**
   * Get all conversations for the current user
   */
  async getConversations(): Promise<{ pubkey: string; profile: NostrProfile | null }[]> {
    if (!this.pubkey) {
      throw new Error('User not authenticated');
    }
    
    // Placeholder for relay query and processing
    // In a real implementation, this would query kind 4 events from relays
    // and organize by pubkey
    
    return [
      // Sample conversation data
      {
        pubkey: '5af27891b77eaa4177a66e12428df6b320338f49bfecdec5a10406f61799455b',
        profile: {
          name: 'Sample User',
          displayName: 'Sample User',
          picture: '',
          npub: 'npub1sampleuser',
          pubkey: '5af27891b77eaa4177a66e12428df6b320338f49bfecdec5a10406f61799455b'
        }
      }
    ];
  }
  
  /**
   * Get messages for a specific conversation
   */
  async getMessages(pubkey: string): Promise<NostrDM[]> {
    if (!this.pubkey || !this.privateKey) {
      throw new Error('User not authenticated');
    }
    
    // Placeholder for relay query and decryption
    // In a real implementation, this would:
    // 1. Query kind 4 events with p tag matching both pubkeys
    // 2. Decrypt all messages
    // 3. Sort by timestamp
    
    return [
      // Sample message data
      {
        id: 'sample-id',
        sender: this.pubkey ? nip19.npubEncode(this.pubkey) : '',
        recipient: nip19.npubEncode(pubkey),
        content: 'Hello!',
        date: new Date(Date.now() - 3600000), // 1 hour ago
        relatedToPayment: false
      }
    ];
  }
  
  /**
   * Encrypt a message for a recipient
   */
  async encryptMessage(recipientPubkey: string, content: string): Promise<string> {
    if (!this.privateKey) {
      throw new Error('Private key not available');
    }
    
    try {
      // In a real implementation, this would use nip04
      // For now, we'll just mock the encryption
      return `encrypted:${content}`;
    } catch (error) {
      console.error('Error encrypting message:', error);
      throw error;
    }
  }
  
  /**
   * Decrypt a message from a sender
   */
  async decryptMessage(senderPubkey: string, encryptedContent: string): Promise<string> {
    if (!this.privateKey) {
      throw new Error('Private key not available');
    }
    
    try {
      // In a real implementation, this would use nip04
      // For now, we'll just mock the decryption
      if (encryptedContent.startsWith('encrypted:')) {
        return encryptedContent.replace('encrypted:', '');
      }
      
      return encryptedContent;
    } catch (error) {
      console.error('Error decrypting message:', error);
      throw error;
    }
  }
}

// Singleton service instance
let messagingService: NostrMessagingService | null = null;

/**
 * Get or create the messaging service instance
 */
export function getMessagingService(pubkey?: string, privateKey?: string): NostrMessagingService {
  if (!messagingService) {
    messagingService = new NostrMessagingService(pubkey, privateKey);
  } else if (pubkey && privateKey) {
    messagingService.setCredentials(pubkey, privateKey);
  }
  
  return messagingService;
} 