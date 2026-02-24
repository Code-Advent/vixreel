
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

const CORE_UI_STRINGS = Array.from(new Set([
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
  'Initial bio signal pending...',

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
  'Appearance', 'Control who can see your follower registry.',
  'Welcome to the Help Center. Our narrative protocol is designed for creators. For issues with verification, billing, or identity synchronization, please contact core@vixreel.io. Remember: Always maintain your visual signal integrity.',
  'VixReel Version 3.2.0-Alpha. A premium social narrative protocol built for high-performance content sharing. Credits: Engineering by World-Class AI. Aesthetic Direction by Vix Design Labs.',

  // Auth
  'Identity Registry', 'Select your narrative protocol', 'Saved Session', 'Add Narrative',
  'Relinquish Add', 'Use Saved Identity', 'Phone', 'Email', 'Identity Email', 'Secure Password',
  'Create Password', 'Access Void', 'Begin Narrative', 'Login', 'Sign Up', 'Recover Session',
  'Locate Account', 'Account Found', 'We located your identity signal', 'Send Access Code',
  'Identity Check', 'Verify your email signal', 'Enter Void', 'Resend Code', 'Change Method',
  'Finalize Narrative', 'Choose your handle', '@handle', 'Activate Protocol', 'Secure Encryption Active',
  'Recover Identity', 'Not your account?', 'Verify your', 'email', 'phone', 'signal',

  // Messages
  'Narrative', 'Direct Encrypted', 'Start signal exchange...', 'No narratives active',
  'Initialize Comms', 'Type your message...', 'Encrypted Signal',
  'Initialize a secure narrative protocol to begin private signal exchange between creators.',
  'Select Creator', 'Signal Search', 'Establish new narrative connection', 'Search @handle...',
  'Scanning Registry...', 'No identity match found',

  // Explore & Search
  'Suggested for you', 'Explore Creators', 'Trending Now', 'Find creators to follow',
  'Search by username...', 'Searching...', 'No users found', 'Creator',

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
  'Story file is too large (max 50MB).', 'Story upload failed: ',

  // Feed & Posts
  'Add a comment...'
])).sort();

export const TranslationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [userId, setUserId] = React.useState<string | null>(null);
  const [language, setLanguageState] = React.useState('en');
  const [translations, setTranslations] = React.useState<Record<string, Record<string, string>>>(() => {
    const saved = localStorage.getItem('vixreel_translations');
    return saved ? JSON.parse(saved) : {};
  });
  const [isTranslating, setIsTranslating] = React.useState(false);
  const activeRequestsRef = React.useRef(0);
  const activeBatches = React.useRef<Set<string>>(new Set());
  
  const userIdRef = React.useRef<string | null>(null);
  React.useEffect(() => { userIdRef.current = userId; }, [userId]);

  // Sync language when userId changes
  React.useEffect(() => {
    const storageKey = userId ? `vixreel_lang_${userId}` : 'vixreel_lang';
    const savedLang = localStorage.getItem(storageKey) || 'en';
    setLanguageState(savedLang);
  }, [userId]);

  const setLanguage = React.useCallback((lang: string) => {
    setLanguageState(lang);
    const storageKey = userIdRef.current ? `vixreel_lang_${userIdRef.current}` : 'vixreel_lang';
    localStorage.setItem(storageKey, lang);
    console.log(`VixReel Translation: Language set to ${lang} for user ${userIdRef.current || 'global'}`);
  }, []);

  const t = React.useCallback((text: string): string => {
    if (!text) return '';
    if (language === 'en') return text;
    const translated = translations[language]?.[text];
    if (translated) return translated;
    
    // If not translated yet, return English but ensure we don't have a missing key issue
    return text;
  }, [language, translations]);

  // Function to translate a batch of strings in chunks with retries
  const translateBatch = React.useCallback(async (texts: string[], targetLang: string) => {
    if (targetLang === 'en' || activeBatches.current.has(targetLang)) return;
    
    activeBatches.current.add(targetLang);
    activeRequestsRef.current += 1;
    setIsTranslating(true);
    
    console.log(`VixReel Translation Engine: Initiating resilient batch for ${targetLang}. Total strings: ${texts.length}`);

    try {
      const chunkSize = 3; // Smaller chunk size to prevent "Failed to fetch" / Rate limiting
      
      for (let i = 0; i < texts.length; i += chunkSize) {
        const chunk = texts.slice(i, i + chunkSize);
        console.log(`VixReel Translation Engine: Processing chunk ${Math.floor(i/chunkSize) + 1}/${Math.ceil(texts.length/chunkSize)} for ${targetLang}`);
        
        const chunkResults = await Promise.all(chunk.map(async (text) => {
          // Retry logic: try up to 3 times for each string
          let lastError = null;
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

              const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                  'Authorization': API_KEY,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  text,
                  target_language: targetLang
                }),
                signal: controller.signal
              });
              
              clearTimeout(timeoutId);

              if (!response.ok) {
                if (response.status === 429) {
                  // Rate limited - wait longer
                  await new Promise(r => setTimeout(r, 2000 * attempt));
                  continue;
                }
                throw new Error(`HTTP ${response.status}`);
              }
              
              const data = await response.json();
              return { original: text, translated: data.translated_text || data.result || text };
            } catch (e: any) {
              lastError = e;
              console.warn(`VixReel Translation: Attempt ${attempt} failed for "${text}" to ${targetLang}`, e.message);
              // Wait before retrying
              await new Promise(r => setTimeout(r, 1000 * attempt));
            }
          }
          
          console.error(`VixReel Translation: All attempts failed for "${text}" to ${targetLang}`, lastError?.message);
          return { original: text, translated: text };
        }));

        // Update state incrementally with proper immutable patterns
        setTranslations(prev => {
          const newTranslations = { ...prev };
          newTranslations[targetLang] = { ...(newTranslations[targetLang] || {}) };
          
          chunkResults.forEach(res => {
            newTranslations[targetLang][res.original] = res.translated;
          });
          
          localStorage.setItem('vixreel_translations', JSON.stringify(newTranslations));
          return newTranslations;
        });

        // Small delay between chunks to be nice to the API
        await new Promise(r => setTimeout(r, 500));
      }
      console.log(`VixReel Translation Engine: Resilient batch complete for ${targetLang}`);
    } catch (err) {
      console.error("VixReel Translation Engine Critical Error:", err);
    } finally {
      activeBatches.current.delete(targetLang);
      activeRequestsRef.current -= 1;
      if (activeRequestsRef.current <= 0) {
        setIsTranslating(false);
      }
    }
  }, []); 

  React.useEffect(() => {
    if (language !== 'en') {
      const currentCache = translations[language] || {};
      const untranslated = CORE_UI_STRINGS.filter(txt => !currentCache[txt]);
      
      if (untranslated.length > 0) {
        translateBatch(untranslated, language);
      }
    }
  }, [language, translateBatch]); 

  const contextValue = React.useMemo(() => ({
    language,
    setLanguage,
    t,
    isTranslating,
    setUserId
  }), [language, setLanguage, t, isTranslating]);

  return (
    <TranslationContext.Provider value={contextValue}>
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
