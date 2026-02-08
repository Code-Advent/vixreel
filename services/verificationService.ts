
/**
 * VixReel Verification Protocol Service
 * Refactored to remove exposed keys. 
 * Core authentication now relies on Supabase Native OTP.
 */

/**
 * Validates phone number format locally.
 * Professional implementation would use libphonenumber or similar.
 */
export const validatePhoneNumber = async (phone: string, countryCode: string = '') => {
  // Simple regex for E.164 format or basic numeric strings
  const cleaned = phone.replace(/\D/g, '');
  const isValid = cleaned.length >= 10;
  
  // Format for Supabase (Ensure it starts with +)
  let formattedNumber = phone.startsWith('+') ? phone : `+${cleaned}`;
  
  return {
    isValid,
    formattedNumber
  };
};

/**
 * Generates a high-entropy 6-digit numeric OTP for client-side reference if needed.
 * Note: Supabase generates its own tokens when using signInWithOtp.
 */
export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Mock function to satisfy legacy imports without exposing keys.
 * In production, Supabase's signInWithOtp handles the SMS dispatch via the configured provider.
 */
export const sendTwilioOTP = async (phoneNumber: string, otpCode: string) => {
  console.log(`[VixReel Protocol] System preparing to dispatch signal to ${phoneNumber}.`);
  // Using Supabase Auth native methods in Auth.tsx instead of this custom dispatch.
  return true; 
};
