import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Gets or generates a unique user ID for the current device.
 * The user ID is stored in AsyncStorage and persists across app sessions.
 * 
 * @returns {Promise<string>} A unique user ID string
 */
export const getUserId = async () => {
  let userId = await AsyncStorage.getItem('user_id');
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await AsyncStorage.setItem('user_id', userId);
  }
  return userId;
};
