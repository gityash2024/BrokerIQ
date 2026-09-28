/** Languages offered across web, app and the AI assistant (English + 12 Indian languages). */
export const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English', dir: 'ltr', speech: 'en-IN' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', dir: 'ltr', speech: 'hi-IN' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা', dir: 'ltr', speech: 'bn-IN' },
  { code: 'mr', name: 'Marathi', native: 'मराठी', dir: 'ltr', speech: 'mr-IN' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు', dir: 'ltr', speech: 'te-IN' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்', dir: 'ltr', speech: 'ta-IN' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી', dir: 'ltr', speech: 'gu-IN' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ', dir: 'ltr', speech: 'kn-IN' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം', dir: 'ltr', speech: 'ml-IN' },
  { code: 'or', name: 'Odia', native: 'ଓଡ଼ିଆ', dir: 'ltr', speech: 'or-IN' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', dir: 'ltr', speech: 'pa-IN' },
  { code: 'as', name: 'Assamese', native: 'অসমীয়া', dir: 'ltr', speech: 'as-IN' },
  { code: 'ur', name: 'Urdu', native: 'اردو', dir: 'rtl', speech: 'ur-IN' },
] as const;
export type LanguageCode = (typeof LANGUAGES)[number]['code'];
export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code) as [LanguageCode, ...LanguageCode[]];
export const DEFAULT_LANGUAGE: LanguageCode = 'en';
export const languageOf = (code?: string | null) => LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
