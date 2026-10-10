import mongoose from 'mongoose';
import Session from '../models/Session.js';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import { createNotificationHelper } from '../utils/notificationUtils.js';

/**
 * Helper to retrieve or lazily create chat room for a session
 */
async function getOrCreateSessionChat(session) {
  let chat = await Chat.findOne({ sessionId: session._id });

  if (!chat) {
    chat = await Chat.create({
      sessionId: session._id,
      learnerId: session.learnerId,
      helperId: session.helperId,
      participantIds: [session.learnerId, session.helperId],
      lastMessage: '',
      lastMessageAt: new Date(),
    });
  }

  return chat;
}

/**
 * @desc    Get all chat messages for a study session in chronological order
 * @route   GET /api/chats/:sessionId
 * @access  Private
 */
export async function getChatMessages(req, res, next) {
  try {
    const { sessionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session ID.',
      });
    }

    const session = await Session.findById(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Study session not found.',
      });
    }

    // Only session participants may access messages
    const isLearner = session.learnerId.toString() === req.user._id.toString();
    const isHelper = session.helperId.toString() === req.user._id.toString();

    if (!isLearner && !isHelper) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this session chat.',
      });
    }

    const chat = await getOrCreateSessionChat(session);

    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));

    const messages = await Message.find({ sessionId: session._id })
      .sort({ createdAt: 1 }) // Chronological order
      .limit(limit);

    return res.status(200).json({
      success: true,
      chat: chat.toJSON(),
      count: messages.length,
      messages: messages.map((m) => m.toJSON()),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Send a message in a session chat room
 * @route   POST /api/chats/:sessionId
 * @access  Private
 */
export async function sendChatMessage(req, res, next) {
  try {
    const { sessionId } = req.params;
    const { text } = req.body;

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session ID.',
      });
    }

    const session = await Session.findById(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Study session not found.',
      });
    }

    const isLearner = session.learnerId.toString() === req.user._id.toString();
    const isHelper = session.helperId.toString() === req.user._id.toString();

    if (!isLearner && !isHelper) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to send messages in this session.',
      });
    }

    // Validate message content
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot be empty.',
      });
    }

    const cleanText = text.trim();

    if (cleanText.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot exceed 1000 characters.',
      });
    }

    const chat = await getOrCreateSessionChat(session);

    // Sender identity is derived strictly from verified JWT
    const senderId = req.user._id;
    const senderName = req.user.name || 'User';

    const newMessage = await Message.create({
      chatId: chat._id,
      sessionId: session._id,
      senderId,
      senderName,
      text: cleanText,
    });

    // Update parent chat snippet and timestamp
    chat.lastMessage = cleanText;
    chat.lastMessageAt = new Date();
    await chat.save();

    // Notify the other participant
    const recipientId = isLearner ? session.helperId : session.learnerId;
    const shortPreview = cleanText.length > 80 ? `${cleanText.substring(0, 80)}...` : cleanText;

    await createNotificationHelper({
      recipientId,
      senderId,
      senderName,
      type: 'new_message',
      title: `New Message from ${senderName}`,
      message: `"${shortPreview}"`,
      relatedSessionId: session._id,
    });

    return res.status(201).json({
      success: true,
      message: newMessage.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}
