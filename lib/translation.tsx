
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface TranslationContextType {
  language: string;
  setLanguage: (lang: string) => void;
  t: (text: string) => string;
  isTranslating: boolean;
  setUserId: (id: string | null) => void;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

const API_KEY = 'ta_0e7597611f2614afdc0567b8dcbe0535893fdcca3fd621bb075d7cae';
const API_URL = 'https://api.translateapi.ai/api/v1/translate/';

export const SUPPORTED_LANGUAGES = [
  { name: 'English', code: 'en' },
  { name: 'Spanish', code: 'es' },
  { name: 'French', code: 'fr' },
  { name: 'German', code: 'de' },
  { name: 'Italian', code: 'it' },
  { name: 'Portuguese', code: 'pt' },
  { name: 'Russian', code: 'ru' },
  { name: 'Chinese', code: 'zh' },
  { name: 'Japanese', code: 'ja' },
  { name: 'Korean', code: 'ko' },
  { name: 'Arabic', code: 'ar' },
  { name: 'Turkish', code: 'tr' },
  { name: 'Hindi', code: 'hi' },
  { name: 'Vietnamese', code: 'vi' },
  { name: 'Thai', code: 'th' },
  { name: 'Indonesian', code: 'id' },
];

export const TranslationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [language, setLanguageState] = useState('en');
  const [translations, setTranslations] = useState<Record<string, Record<string, string>>>(() => {
    const saved = localStorage.getItem('vixreel_translations');
    return saved ? JSON.parse(saved) : {};
  });
  const [isTranslating, setIsTranslating] = useState(false);

  // Sync language when userId changes
  useEffect(() => {
    const storageKey = userId ? `vixreel_lang_${userId}` : 'vixreel_lang';
    const savedLang = localStorage.getItem(storageKey) || 'en';
    setLanguageState(savedLang);
  }, [userId]);

  const setLanguage = (lang: string) => {
    setLanguageState(lang);
    const storageKey = userId ? `vixreel_lang_${userId}` : 'vixreel_lang';
    localStorage.setItem(storageKey, lang);
  };

  const t = (text: string): string => {
    if (language === 'en') return text;
    return translations[language]?.[text] || text;
  };

  // Function to translate a batch of strings
  const translateBatch = async (texts: string[], targetLang: string) => {
    if (targetLang === 'en') return;
    
    const untranslated = texts.filter(txt => !translations[targetLang]?.[txt]);
    if (untranslated.length === 0) return;

    setIsTranslating(true);
    try {
      // The API seems to take one text at a time based on the curl example
      // To be safe and follow the user's provided API exactly, we'll do them sequentially or in parallel
      const results = await Promise.all(untranslated.map(async (text) => {
        try {
          const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
              'Authorization': API_URL.includes('translateapi.ai') ? API_KEY : '', // Safety check
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              text,
              target_language: targetLang
            })
          });
          
          if (!response.ok) throw new Error('Translation failed');
          const data = await response.json();
          return { original: text, translated: data.translated_text || data.result || text };
        } catch (err) {
          console.error(`Translation error for "${text}":`, err);
          return { original: text, translated: text };
        }
      }));

      setTranslations(prev => {
        const newTranslations = { ...prev };
        if (!newTranslations[targetLang]) newTranslations[targetLang] = {};
        results.forEach(res => {
          newTranslations[targetLang][res.original] = res.translated;
        });
        localStorage.setItem('vixreel_translations', JSON.stringify(newTranslations));
        return newTranslations;
      });
    } finally {
      setIsTranslating(false);
    }
  };

  // We'll define a set of common UI strings to translate when language changes
  const coreUIStrings = [
    // Navigation & General
    'Feed', 'Explore', 'Search', 'Notifications', 'Profile', 'Create', 'Messages', 'Settings',
    'Home', 'Groups', 'Admin Panel', 'Active', 'Admin', 'Member', 'from', 'VERISAZ',
    'Logout', 'Switch Account', 'Add Account', 'Relinquish Primary Session', 'Understood',
    'light', 'dark', 'Registry', 'Individual Creator', 'You',

    // Feed & Posts
    'No posts yet', 'Reposted', 'Duet', 'Stitch', 'likes', 'Comments', 'No signals detected',
    'Processing Watermark', 'Post', 'Like', 'Comment', 'Share', 'Duet with', 'Stitch with',
    'Post Details', 'Write a caption... Use @username to mention creators.', 'AI Caption Helper',
    'Post Settings', 'Max 50MB allowed.', 'Failed to share post.', 'Replace Media',
    'Select Media', 'High Resolution Photo or Video (max 50MB)', 'CHOOSE FILE',

    // Profile
    'Edit Profile', 'Follow', 'Following', 'Followers', 'Likes', 'Message', 'Posts', 'Liked',
    'No groups created yet', 'Members', 'Modify Identity', 'Cover Banner', 'Handle',
    'Date of Birth', 'Country', 'State/Region', 'Select Country', 'Select State',
    'Narrative bio...', 'Transmitting...', 'Synchronize Identity', 'Registry',
    'Initial bio signal pending...', 'Transmitting...',

    // Settings
    'Account Settings', 'Edit Profile', 'Update handle, bio, and identity.', 'Linked Accounts',
    'Manage other VixReel identities.', 'Control push alerts and signal pings.', 'Language',
    'Synchronizing language data...', 'Select your preferred narrative language.', 'Currently using',
    'mode protocol.', 'Privacy & Narrative', 'Private Account', 'Only followers can view your narrative posts and lists.',
    'Follower Visibility', 'Everyone', 'Only Me', 'Private Location', 'Hide your physical signal from your profile.',
    'Allow Comments', 'Enable others to respond to your signal.', 'Public Following',
    'Make your following list visible to visitors.', 'Identity Signal', 'Current Location',
    'Broadcast your current sector.', 'Support', 'Help Center', 'FAQ and community guidelines.',
    'About VixReel', 'Terms, conditions, and privacy policy.', 'Relinquish Current Session',
    'VixReel Narrative Protocol Configuration', 'VixReel Help Center',

    // Auth
    'Identity Registry', 'Select your narrative protocol', 'Saved Session', 'Add Narrative',
    'Relinquish Add', 'Use Saved Identity', 'Phone', 'Email', 'Identity Email', 'Secure Password',
    'Create Password', 'Access Void', 'Begin Narrative', 'Login', 'Sign Up', 'Recover Session',
    'Locate Account', 'Account Found', 'We located your identity signal', 'Send Access Code',
    'Identity Check', 'Verify your email signal', 'Enter Void', 'Resend Code', 'Change Method',
    'Finalize Narrative', 'Choose your handle', '@handle', 'Activate Protocol', 'Secure Encryption Active',

    // Messages
    'Narrative', 'Direct Encrypted', 'Start signal exchange...', 'No narratives active',
    'Initialize Comms', 'Type your message...', 'Encrypted Signal',
    'Initialize a secure narrative protocol to begin private signal exchange between creators.',
    'Select Creator', 'Signal Search', 'Establish new narrative connection', 'Search @handle...',
    'Scanning Registry...', 'No identity match found',

    // Explore & Search
    'Suggested for you', 'Explore Creators', 'Trending Now', 'Find creators to follow',
    'Search by username...', 'Searching...', 'No users found',

    // Notifications
    'No signals detected', 'When creators interact with your narrative, alerts will manifest here.',

    // Groups
    'Communities', 'New Group', 'No communities found', 'PUBLIC', 'PRIVATE', 'View',
    'Cover Image', 'Upload Cover', 'Group Name', 'e.g. VixReel Creators', 'Description',
    'What is this community about?', 'Privacy', 'Public', 'Private', 'Establish Community',
    'Joined', 'Join', 'Share something with', 'Write a comment...',

    // Admin
    'Admin Login', 'Restricted Access', 'Unlock Panel', 'Manage Users & Boost Content',
    'Logout Admin', 'Boosted', 'No email', 'Remove Verification', 'Verify User',
    'Add Likes (Post)', 'LIKES', 'Select a post below to add likes.', 'Add Followers (Account)',
    'FOLLOWERS', 'Add Followers', 'User Posts', 'Add', 'Select a user',
    'Choose an account from the left to manage it.',

    // Stories
    'Story file is too large (max 50MB).', 'Story upload failed: '
  ];

  useEffect(() => {
    if (language !== 'en') {
      translateBatch(coreUIStrings, language);
    }
  }, [language]);

  return (
    <TranslationContext.Provider value={{ language, setLanguage, t, isTranslating, setUserId }}>
      {children}
    </TranslationContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(TranslationContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
};
