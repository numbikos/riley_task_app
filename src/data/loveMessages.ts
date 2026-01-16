export const LOVE_MESSAGES = [
  'I love you more than words can say.',
  "You're the most beautiful person I know.",
  'Thank you for being my partner in everything.',
  'You make every single day better.',
  "I'm so lucky to have you.",
  'You are my favorite person.',
  'I fall in love with you all over again every day.',
  "You're my best friend and the love of my life.",
  'Everything is better with you by my side.',
  'You have the most beautiful smile.',
  'I love the way you laugh.',
  "You're amazing in every way.",
  'Being with you is my favorite thing.',
  'You make my heart so happy.',
  "I'm grateful for you every single day.",
  "You're the reason I smile.",
  'I love our life together.',
  "You're my person, always.",
  'Every moment with you is a gift.',
  'I love you today and always.',
];

export const TARGET_USER_EMAIL = 'riley.ikos@gmail.com';

// Simple hash of date string for deterministic message selection
const getMessageIndex = (dateString: string): number => {
  let hash = 0;
  for (let i = 0; i < dateString.length; i++) {
    hash = ((hash << 5) - hash) + dateString.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash) % LOVE_MESSAGES.length;
};

export const getDailyMessage = (dateString: string): string => {
  return LOVE_MESSAGES[getMessageIndex(dateString)];
};
