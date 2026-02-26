
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { GoogleGenAI, Type } from "@google/genai";

interface TranslationContextType {
  language: string;
  setLanguage: (lang: string) => void;
  t: (text: string) => string;
  isTranslating: boolean;
  translationProgress: number; // 0 to 100
  syncLanguage: () => Promise<void>;
  isSynced: boolean;
  setUserId: (id: string | null) => void;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

const API_KEY = 'ta_bc0aaf5f206a55a3276b63f1d733bfa2c887e061c4c8c4a7fd457bac';
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
  { name: 'Dutch', code: 'nl' },
  { name: 'Polish', code: 'pl' },
  { name: 'Swedish', code: 'sv' },
  { name: 'Danish', code: 'da' },
  { name: 'Norwegian', code: 'no' },
  { name: 'Finnish', code: 'fi' },
  { name: 'Greek', code: 'el' },
  { name: 'Czech', code: 'cs' },
  { name: 'Romanian', code: 'ro' },
  { name: 'Hungarian', code: 'hu' },
  { name: 'Ukrainian', code: 'uk' },
  { name: 'Hebrew', code: 'he' },
  { name: 'Malay', code: 'ms' },
  { name: 'Filipino', code: 'tl' },
  { name: 'Bengali', code: 'bn' },
  { name: 'Punjabi', code: 'pa' },
  { name: 'Tamil', code: 'ta' },
  { name: 'Telugu', code: 'te' },
  { name: 'Marathi', code: 'mr' },
  { name: 'Urdu', code: 'ur' },
  { name: 'Persian', code: 'fa' },
  { name: 'Swahili', code: 'sw' },
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
  'Add Location', 'Feeling / Activity', 'Privacy', 'Allow Comments', 'Public', 'Followers', 'Private',
  'AI Image Generator', 'Create media from your caption', 'feeling', 'Creative Tools',
  'Signal Broadcasted', 'See Translation', 'Translating...', 'Original',

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
  'Downloading language pack...', 'Language pack synchronized.', 'Language pack update available.', 'Download Pack',
  'Initializing download...', 'Translation API Key Missing',
  'mode protocol.', 'Privacy & Narrative', 'Private Account', 'Only followers can view your narrative posts and lists.',
  'Follower Visibility', 'Everyone', 'Only Me', 'Private Location', 'Hide your physical signal from your profile.',
  'Allow Comments', 'Enable others to respond to your signal.', 'Public Following',
  'Make your following list visible to visitors.', 'Identity Signal', 'Current Location',
  'Broadcast your current sector.', 'Support', 'Help Center', 'FAQ and community guidelines.',
  'About VixReel', 'Terms, conditions, and privacy policy.', 'Relinquish Current Session',
  'Danger Zone', 'Delete Account', 'Permanently remove your identity and all associated signals from the VixReel registry. This action is irreversible.',
  'Terminate Identity', 'Are you absolutely certain? This will permanently erase your creator profile and remove you from all search results.',
  'Cancel',
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
  'Add a comment...', 'Delete', 'Edit', 'Save', 'Cancel', 'Confirm', 'Are you sure?',
  'Loading...', 'Error', 'Success', 'Warning', 'Info',
  'Followers', 'Following', 'Posts', 'Likes', 'Bio', 'Handle',
  'Narrative Bio', 'Identity Registry', 'Signal Search',
  'Choose Reaction', 'Choose Emoji', 'Search Emoji...',
  'Recent', 'Smileys & People', 'Animals & Nature', 'Food & Drink', 'Activities', 'Travel & Places', 'Objects', 'Symbols', 'Flags'
])).sort();

export const TranslationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [userId, setUserId] = React.useState<string | null>(null);
  const [language, setLanguageState] = React.useState('en');
  const [translations, setTranslations] = React.useState<Record<string, Record<string, string>>>(() => {
    const saved = localStorage.getItem('vixreel_translations');
    return saved ? JSON.parse(saved) : {};
  });
  const [isTranslating, setIsTranslating] = React.useState(false);
  const [translationProgress, setTranslationProgress] = React.useState(0);
  const [isSynced, setIsSynced] = React.useState(true);
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
    const key = text.trim();
    if (language === 'en') return key;
    const translated = translations[language]?.[key];
    if (translated) return translated;
    
    // Fallback to case-insensitive match if direct match fails
    const langCache = translations[language] || {};
    const caseInsensitiveKey = Object.keys(langCache).find(k => k.toLowerCase() === key.toLowerCase());
    if (caseInsensitiveKey) return langCache[caseInsensitiveKey];

    return key;
  }, [language, translations]);

  const translateBatch = React.useCallback(async (texts: string[], targetLang: string) => {
    if (targetLang === 'en' || activeBatches.current.has(targetLang)) return;
    
    activeBatches.current.add(targetLang);
    activeRequestsRef.current += 1;
    setIsTranslating(true);
    setTranslationProgress(0);
    
    console.log(`VixReel Translation Engine: Initiating Whole App Translation for ${targetLang}. Total strings: ${texts.length}`);

    const chunkSize = 15;
    const totalChunks = Math.ceil(texts.length / chunkSize);
    
    try {
      // Try Gemini first if available
      if (process.env.GEMINI_API_KEY) {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
        const model = "gemini-3-flash-preview";

        for (let i = 0; i < texts.length; i += chunkSize) {
          const chunk = texts.slice(i, i + chunkSize);
          const chunkIndex = Math.floor(i / chunkSize) + 1;
          
          const prompt = `Translate the following array of English UI strings into ${targetLang}. 
          Return the result as a JSON object where the keys are the original English strings and the values are the translations.
          Maintain the tone and context of a premium social media app for creators.
          
          Strings to translate:
          ${JSON.stringify(chunk)}`;

          const response = await ai.models.generateContent({
            model,
            contents: [{ parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
          });

          const result = JSON.parse(response.text || '{}');
          
          // Trim keys in result
          const trimmedResult: Record<string, string> = {};
          Object.entries(result).forEach(([k, v]) => {
            trimmedResult[k.trim()] = String(v);
          });

          setTranslations(prev => {
            const newTranslations = { ...prev };
            newTranslations[targetLang] = { ...(newTranslations[targetLang] || {}), ...trimmedResult };
            localStorage.setItem('vixreel_translations', JSON.stringify(newTranslations));
            return newTranslations;
          });

          setTranslationProgress(Math.round((chunkIndex / totalChunks) * 100));
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } else {
        // Use translateapi.ai as primary if Gemini is missing
        console.log("VixReel: Using dedicated Translation API...");
        for (let i = 0; i < texts.length; i += chunkSize) {
          const chunk = texts.slice(i, i + chunkSize);
          const chunkIndex = Math.floor(i / chunkSize) + 1;
          
          const chunkResults = await Promise.all(chunk.map(async (text) => {
            try {
              const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                  'Authorization': API_KEY,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text, target_language: targetLang })
              });
              const data = await response.json();
              // Handle multiple possible response formats from translateapi.ai
              const translated = data.translated_text || data.result || data.translation || data.translatedText || text;
              return { original: text.trim(), translated: String(translated) };
            } catch (e) {
              console.error(`VixReel: Translation failed for "${text}":`, e);
              return { original: text.trim(), translated: text };
            }
          }));

          setTranslations(prev => {
            const newTranslations = { ...prev };
            const batchUpdate = chunkResults.reduce((acc: any, res) => { 
              acc[res.original] = res.translated; 
              return acc; 
            }, {});
            
            newTranslations[targetLang] = { 
              ...(newTranslations[targetLang] || {}), 
              ...batchUpdate 
            };
            localStorage.setItem('vixreel_translations', JSON.stringify(newTranslations));
            return newTranslations;
          });

          setTranslationProgress(Math.round((chunkIndex / totalChunks) * 100));
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      console.log(`VixReel Translation Engine: Whole App Translation complete for ${targetLang}`);
    } catch (err) {
      console.error("VixReel Translation Error:", err);
    } finally {
      activeBatches.current.delete(targetLang);
      activeRequestsRef.current -= 1;
      if (activeRequestsRef.current <= 0) {
        setIsTranslating(false);
        setTranslationProgress(100);
      }
    }
  }, []);

  const syncLanguage = React.useCallback(async () => {
    if (language === 'en') return;
    const currentCache = translations[language] || {};
    const untranslated = CORE_UI_STRINGS.filter(txt => !currentCache[txt]);
    
    if (untranslated.length > 0) {
      await translateBatch(untranslated, language);
    }
  }, [language, translations, translateBatch]);

  React.useEffect(() => {
    if (language !== 'en') {
      const currentCache = translations[language] || {};
      const untranslated = CORE_UI_STRINGS.filter(txt => !currentCache[txt]);
      const synced = untranslated.length === 0;
      setIsSynced(synced);
      
      if (!synced) {
        // Automatically download the full pack when language changes
        translateBatch(untranslated, language);
      }
    } else {
      setIsSynced(true);
      setTranslationProgress(100);
    }
  }, [language, translations, translateBatch]); 

  const contextValue = React.useMemo(() => ({
    language,
    setLanguage,
    t,
    isTranslating,
    translationProgress,
    syncLanguage,
    isSynced,
    setUserId
  }), [language, setLanguage, t, isTranslating, translationProgress, syncLanguage, isSynced]);

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
