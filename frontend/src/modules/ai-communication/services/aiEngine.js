

export function normalizeNeuroChatConversation(conversation, draftList = []) {
  const customerName = conversation?.customerName || conversation?.name || 'Customer';
  const lastMessage = conversation?.lastMessage || conversation?.messages?.at(-1)?.text || 'No message yet';
  const timestamp = conversation?.lastMessageTime || conversation?.messages?.at(-1)?.timestamp || null;

  return {
    id: conversation?.id,
    buyerId: conversation?.buyerId,
    name: customerName,
    avatar: customerName.charAt(0).toUpperCase() || '?',
    lastMessage,
    timestamp,
    unreadCount: conversation?.unreadCount || 0,
    draftCount: draftList.length,
    latestDraft: draftList[0] || null,
  };
}

const emotionKeywords = {
  Excited: ['amazing', 'love', 'great', 'awesome', 'fantastic', 'excited', 'perfect', 'wow', 'excellent', 'superb', 'brilliant', 'wonderful'],
  Interested: ['interested', 'tell me more', 'curious', 'how', 'what', 'feature', 'details', 'info', 'learn', 'explain', 'considering'],
  Frustrated: ['problem', 'issue', 'broken', 'wrong', 'bad', 'terrible', 'hate', 'annoying', 'delay', 'late', 'complaint', 'unacceptable'],
  Doubtful: ['unsure', 'maybe', 'not sure', 'think', 'wondering', 'hesitant', 'confused', 'doubt', 'worried', 'concern', 'risky'],
  Neutral: [],
};

export function detectEmotion(message) {
  const lower = message.toLowerCase();
  for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
    if (keywords.some(kw => lower.includes(kw))) return emotion;
  }
  return 'Neutral';
}

const strategyMap = {
  Excited: 'Urgency CTA',
  Interested: 'Educational',
  Frustrated: 'Reassurance',
  Doubtful: 'Social Proof',
  Neutral: 'Educational',
};

export function predictStrategy(emotion) {
  return strategyMap[emotion] || 'Educational';
}

export function calculateLeadScore(message, emotion, strategy) {
  let score = 0;
  const lower = message.toLowerCase();

  const emotionScores = { Excited: 40, Interested: 30, Doubtful: 15, Frustrated: 10, Neutral: 20 };
  score += emotionScores[emotion] || 20;

  const strategyScores = { 'Urgency CTA': 30, Educational: 20, 'Social Proof': 15, Reassurance: 10 };
  score += strategyScores[strategy] || 10;

  const keywords = { buy: 20, purchase: 20, price: 10, interested: 20, invest: 15, demo: 15, order: 15, deal: 10, discount: 10, offer: 10 };
  for (const [word, points] of Object.entries(keywords)) {
    if (lower.includes(word)) score += points;
  }

  return Math.min(score, 100);
}

const responseTemplates = {
  Excited: [
    "That's wonderful to hear! We're glad you're excited. Let me get you the best deal right away.",
    "Awesome! You have great taste. This is one of our top picks — shall I reserve it for you?",
    "We love your enthusiasm! Let me share some exclusive offers that match what you're looking for.",
  ],
  Interested: [
    "Great question! Let me walk you through the details. This product features premium quality and competitive pricing.",
    "I'd be happy to help you learn more. Here are the key highlights that our customers love most.",
    "Thanks for your interest! Let me share some information that will help you make the best decision.",
  ],
  Frustrated: [
    "I completely understand your frustration, and I sincerely apologize for the inconvenience. Let me resolve this for you right away.",
    "I'm sorry to hear about this issue. Your satisfaction is our priority — here's what I'm doing to fix it immediately.",
    "I understand how upsetting this must be. Let me personally ensure this gets resolved as quickly as possible.",
  ],
  Doubtful: [
    "I understand your concerns — many of our customers felt the same way initially. Here's what changed their mind...",
    "That's a completely valid concern. Let me share some reviews and results from buyers just like you.",
    "It's natural to have questions. Here's a quick comparison that might help you feel more confident about your decision.",
  ],
  Neutral: [
    "Thanks for reaching out! Let me help you find exactly what you're looking for.",
    "Hello! I'm here to assist you. What can I help you with today?",
    "Welcome! Feel free to ask anything about our products or services.",
  ],
};

export function generateAIResponse(message, emotion, strategy) {
  const templates = responseTemplates[emotion] || responseTemplates.Neutral;
  return templates[Math.floor(Math.random() * templates.length)];
}

export function analyzeMessage(message) {
  const emotion = detectEmotion(message);
  const strategy = predictStrategy(emotion);
  const leadScore = calculateLeadScore(message, emotion, strategy);
  const response = generateAIResponse(message, emotion, strategy);

  return { emotion, strategy, leadScore, response };
}
