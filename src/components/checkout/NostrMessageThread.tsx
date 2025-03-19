'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useNostr } from '../../lib/contexts/NostrContext';
import { useCartStore } from '../../lib/store/cart-store';
import { NostrDM } from '../../types/cart-types';
import { formatDistanceToNow } from 'date-fns';

interface NostrMessageThreadProps {
  providerNpub?: string;
  onSendMessage?: (message: string) => Promise<boolean>;
  onlyShowPaymentMessages?: boolean;
}

/**
 * NostrMessageThread
 * Displays the conversation thread between customer and provider,
 * with special formatting for payment-related messages
 */
const NostrMessageThread: React.FC<NostrMessageThreadProps> = ({
  providerNpub,
  onSendMessage,
  onlyShowPaymentMessages = false
}) => {
  const { user } = useNostr();
  const { messages, customerNpub, addMessage } = useCartStore();
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Filter messages based on props
  const filteredMessages = onlyShowPaymentMessages 
    ? messages.filter(msg => msg.relatedToPayment)
    : messages;
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [filteredMessages]);
  
  // Format message date
  const formatMessageDate = (date: Date) => {
    return formatDistanceToNow(date, { addSuffix: true });
  };
  
  // Handle send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || sending || !user) return;
    
    if (!providerNpub) {
      console.error('No provider npub specified');
      return;
    }
    
    try {
      setSending(true);
      
      // Create new message in the cart store
      const dmMessage: Omit<NostrDM, 'id' | 'date'> = {
        sender: user.npub,
        recipient: providerNpub,
        content: newMessage.trim(),
        relatedToPayment: false
      };
      
      addMessage(dmMessage);
      
      // Call external handler if provided (for NDK messaging)
      if (onSendMessage) {
        await onSendMessage(newMessage.trim());
      }
      
      // Clear the input
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };
  
  // Render message based on type
  const renderMessage = (message: NostrDM) => {
    const isFromUser = message.sender === customerNpub;
    
    // Message container classes
    const containerClasses = `flex ${isFromUser ? 'justify-end' : 'justify-start'} mb-4`;
    
    // Message bubble classes
    const bubbleClasses = `max-w-3/4 rounded-lg p-3 ${
      isFromUser
        ? 'bg-blue-500 text-white rounded-br-none'
        : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-none'
    } ${
      message.relatedToPayment 
        ? 'border-2 ' + (isFromUser ? 'border-green-400' : 'border-green-500 dark:border-green-600')
        : ''
    }`;
    
    // Render payment message with special formatting
    if (message.relatedToPayment) {
      return (
        <div key={message.id} className={containerClasses}>
          <div className={bubbleClasses}>
            {message.paymentType === 'collateral' && (
              <div className="font-bold mb-1 text-sm">
                {isFromUser ? '💸 Collateral Payment Sent' : '✅ Collateral Payment Received'}
              </div>
            )}
            
            {message.paymentType === 'final' && (
              <div className="font-bold mb-1 text-sm">
                {isFromUser ? '💸 Final Payment Sent' : '✅ Final Payment Received'}
              </div>
            )}
            
            {message.paymentType === 'reminder' && (
              <div className="font-bold mb-1 text-sm">
                ⏰ Payment Reminder
              </div>
            )}
            
            <div className="text-sm">{message.content}</div>
            <div className="text-xs mt-1 opacity-70 text-right">
              {formatMessageDate(message.date)}
            </div>
          </div>
        </div>
      );
    }
    
    // Regular message
    return (
      <div key={message.id} className={containerClasses}>
        <div className={bubbleClasses}>
          <div>{message.content}</div>
          <div className="text-xs mt-1 opacity-70 text-right">
            {formatMessageDate(message.date)}
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="nostr-message-thread bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <h3 className="text-lg font-medium mb-4 pb-2 border-b dark:border-gray-700">
        {onlyShowPaymentMessages ? 'Payment Messages' : 'Message Thread'}
      </h3>
      
      {/* Messages container */}
      <div className="messages-container h-80 overflow-y-auto mb-4 px-2">
        {filteredMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400 text-sm italic">
            {onlyShowPaymentMessages 
              ? 'No payment messages yet'
              : 'Start a conversation with the provider'}
          </div>
        ) : (
          filteredMessages.map(message => renderMessage(message))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Message input */}
      {!onlyShowPaymentMessages && user && (
        <form onSubmit={handleSendMessage} className="mt-4">
          <div className="flex">
            <input
              type="text"
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 rounded-l-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2 px-4 text-gray-700 dark:text-white focus:outline-none"
              disabled={sending || !user}
            />
            <button
              type="submit"
              className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-r-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={sending || !newMessage.trim() || !user}
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </form>
      )}
      
      {/* Authentication reminder */}
      {!user && !onlyShowPaymentMessages && (
        <div className="mt-4 text-center py-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Please login with your Nostr key to send messages
          </p>
        </div>
      )}
    </div>
  );
};

export default NostrMessageThread; 