import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_ID_KEY = '@user_id';

/**
 * Gets or generates a unique user ID for the current device.
 * The user ID is stored in AsyncStorage and persists across app sessions.
 * 
 * @returns {Promise<string>} A unique user ID string
 */
export const getUserId = async () => {
  try {
    // Try to get existing user ID
    let userId = await AsyncStorage.getItem(USER_ID_KEY);
    
    if (userId) {
      console.log('[getUserId] Found existing userId:', userId);
      return userId;
    }
    
    // Generate new user ID if none exists
    userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('[getUserId] Generating new userId:', userId);
    
    // Save the new user ID
    await AsyncStorage.setItem(USER_ID_KEY, userId);
    
    // Verify it was saved
    const savedUserId = await AsyncStorage.getItem(USER_ID_KEY);
    console.log('[getUserId] Verified saved userId:', savedUserId);
    
    return userId;
  } catch (error) {
    console.error('[getUserId] Error accessing AsyncStorage:', error);
    // Fallback: generate a temporary ID (won't persist)
    return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
};

/**
 * Clear the stored user ID (for testing/debugging)
 */
export const clearUserId = async () => {
  try {
    await AsyncStorage.removeItem(USER_ID_KEY);
    console.log('[clearUserId] User ID cleared');
  } catch (error) {
    console.error('[clearUserId] Error:', error);
  }
};

/**
 * Debug: Show all AsyncStorage keys
 */
export const debugAsyncStorage = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    console.log('[debugAsyncStorage] All keys:', keys);
    
    if (keys.includes(USER_ID_KEY)) {
      const userId = await AsyncStorage.getItem(USER_ID_KEY);
      console.log('[debugAsyncStorage] Current user_id:', userId);
    } else {
      console.log('[debugAsyncStorage] No user_id found');
    }
  } catch (error) {
    console.error('[debugAsyncStorage] Error:', error);
  }
};
