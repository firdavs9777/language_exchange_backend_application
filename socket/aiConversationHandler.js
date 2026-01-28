/**
 * AI Conversation Socket Handler
 * Handles real-time AI conversation and grammar feedback events
 */

const aiConversationService = require('../services/aiConversationService');
const grammarFeedbackService = require('../services/grammarFeedbackService');

/**
 * Register AI conversation socket event handlers
 * @param {Socket} socket - Socket.IO socket instance
 * @param {Server} io - Socket.IO server instance
 */
const registerAIConversationHandlers = (socket, io) => {
  const userId = socket.user.id;

  /**
   * Send a message in AI conversation
   * Event: aiConversation:sendMessage
   * Data: { conversationId, content, responseTime }
   */
  socket.on('aiConversation:sendMessage', async (data, callback) => {
    try {
      const { conversationId, content, responseTime } = data;

      if (!conversationId) {
        throw new Error('Conversation ID is required');
      }

      if (!content || content.trim().length === 0) {
        throw new Error('Message content is required');
      }

      console.log(`🤖 AI Chat: User ${userId} sent message in conversation ${conversationId}`);

      // Emit typing indicator
      socket.emit('aiConversation:typing', {
        conversationId,
        isTyping: true
      });

      const result = await aiConversationService.sendMessage({
        conversationId,
        userId,
        content: content.trim(),
        responseTime
      });

      // Stop typing indicator
      socket.emit('aiConversation:typing', {
        conversationId,
        isTyping: false
      });

      // Send AI response
      socket.emit('aiConversation:message', {
        conversationId,
        message: result.message,
        xpAwarded: result.xpAwarded,
        messageCount: result.messageCount
      });

      if (callback) {
        callback({ success: true, data: result });
      }
    } catch (error) {
      console.error('AI conversation error:', error.message);

      socket.emit('aiConversation:typing', {
        conversationId: data?.conversationId,
        isTyping: false
      });

      socket.emit('aiConversation:error', {
        conversationId: data?.conversationId,
        error: error.message
      });

      if (callback) {
        callback({ success: false, error: error.message });
      }
    }
  });

  /**
   * Stream AI response (for longer responses)
   * Event: aiConversation:stream
   * Data: { conversationId, content, responseTime }
   */
  socket.on('aiConversation:stream', async (data, callback) => {
    try {
      const { conversationId, content, responseTime } = data;

      if (!conversationId || !content) {
        throw new Error('Conversation ID and content are required');
      }

      console.log(`🤖 AI Chat (streaming): User ${userId} in conversation ${conversationId}`);

      // Emit typing indicator
      socket.emit('aiConversation:typing', {
        conversationId,
        isTyping: true
      });

      const result = await aiConversationService.sendMessageStreaming(
        {
          conversationId,
          userId,
          content: content.trim(),
          responseTime
        },
        (chunk, fullContent) => {
          // Send each chunk as it arrives
          socket.emit('aiConversation:streamChunk', {
            conversationId,
            chunk,
            fullContent
          });
        }
      );

      // Stop typing and send completion
      socket.emit('aiConversation:typing', {
        conversationId,
        isTyping: false
      });

      socket.emit('aiConversation:streamComplete', {
        conversationId,
        message: result.message,
        xpAwarded: result.xpAwarded,
        messageCount: result.messageCount
      });

      if (callback) {
        callback({ success: true, data: result });
      }
    } catch (error) {
      console.error('AI streaming error:', error.message);

      socket.emit('aiConversation:typing', {
        conversationId: data?.conversationId,
        isTyping: false
      });

      socket.emit('aiConversation:error', {
        conversationId: data?.conversationId,
        error: error.message
      });

      if (callback) {
        callback({ success: false, error: error.message });
      }
    }
  });

  /**
   * End AI conversation
   * Event: aiConversation:end
   * Data: { conversationId }
   */
  socket.on('aiConversation:end', async (data, callback) => {
    try {
      const { conversationId } = data;

      if (!conversationId) {
        throw new Error('Conversation ID is required');
      }

      console.log(`🤖 AI Chat: User ${userId} ending conversation ${conversationId}`);

      const result = await aiConversationService.endConversation(conversationId, userId);

      socket.emit('aiConversation:ended', {
        conversationId,
        summary: result.summary
      });

      if (callback) {
        callback({ success: true, data: result });
      }
    } catch (error) {
      console.error('AI conversation end error:', error.message);

      if (callback) {
        callback({ success: false, error: error.message });
      }
    }
  });

  /**
   * Get conversation history
   * Event: aiConversation:getHistory
   * Data: { conversationId }
   */
  socket.on('aiConversation:getHistory', async (data, callback) => {
    try {
      const { conversationId } = data;

      if (!conversationId) {
        throw new Error('Conversation ID is required');
      }

      const conversation = await aiConversationService.getConversation(conversationId, userId);

      if (callback) {
        callback({ success: true, data: conversation });
      }
    } catch (error) {
      console.error('Get AI conversation error:', error.message);

      if (callback) {
        callback({ success: false, error: error.message });
      }
    }
  });
};

/**
 * Register Grammar Feedback socket event handlers
 * @param {Socket} socket - Socket.IO socket instance
 * @param {Server} io - Socket.IO server instance
 */
const registerGrammarFeedbackHandlers = (socket, io) => {
  const userId = socket.user.id;

  /**
   * Analyze text for grammar feedback
   * Event: grammarFeedback:analyze
   * Data: { text, targetLanguage, nativeLanguage, cefrLevel }
   */
  socket.on('grammarFeedback:analyze', async (data, callback) => {
    try {
      const { text, targetLanguage, nativeLanguage, cefrLevel, aiConversationId } = data;

      if (!text || text.trim().length === 0) {
        throw new Error('Text to analyze is required');
      }

      console.log(`📝 Grammar: User ${userId} analyzing text`);

      const result = await grammarFeedbackService.analyzeGrammar({
        userId,
        text,
        targetLanguage: targetLanguage || 'es',
        nativeLanguage: nativeLanguage || 'en',
        cefrLevel: cefrLevel || 'A1',
        aiConversationId,
        requestedBy: 'user'
      });

      socket.emit('grammarFeedback:result', {
        feedback: result.feedback,
        xpAwarded: result.xpAwarded
      });

      if (callback) {
        callback({ success: true, data: result });
      }
    } catch (error) {
      console.error('Grammar feedback error:', error.message);

      socket.emit('grammarFeedback:error', {
        error: error.message
      });

      if (callback) {
        callback({ success: false, error: error.message });
      }
    }
  });

  /**
   * Get explanation for a grammar rule
   * Event: grammarFeedback:explain
   * Data: { rule, targetLanguage, nativeLanguage, cefrLevel, context }
   */
  socket.on('grammarFeedback:explain', async (data, callback) => {
    try {
      const { rule, targetLanguage, nativeLanguage, cefrLevel, context } = data;

      if (!rule) {
        throw new Error('Grammar rule is required');
      }

      const explanation = await grammarFeedbackService.explainRule({
        rule,
        targetLanguage: targetLanguage || 'es',
        nativeLanguage: nativeLanguage || 'en',
        cefrLevel: cefrLevel || 'A1',
        context
      });

      socket.emit('grammarFeedback:explanation', {
        rule,
        explanation
      });

      if (callback) {
        callback({ success: true, data: explanation });
      }
    } catch (error) {
      console.error('Grammar explanation error:', error.message);

      if (callback) {
        callback({ success: false, error: error.message });
      }
    }
  });
};

module.exports = {
  registerAIConversationHandlers,
  registerGrammarFeedbackHandlers
};
