import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from './styles/theme';
import { RoundProvider } from './context/RoundContext';
import { TeamProvider, useTeam } from './context/TeamContext';
import { getUserId } from './utils/userIdHelper';
import * as userProfileService from './services/userProfileService';

// Import screens
import HomeScreen from './screens/HomeScreen';
import MyTeamScreen from './screens/MyTeamScreen';
import PlayersScreen from './screens/PlayersScreen';
import LeaguesScreen from './screens/LeaguesScreen';
import TransfersScreen from './screens/TransfersScreen';
import FixturesScreen from './screens/FixturesScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import LoadingScreen from './components/LoadingScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Main Tab Navigator
function MainTabs() {
  const insets = useSafeAreaInsets();
  
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.oceanMedium,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopWidth: 2,
          borderTopColor: colors.oceanBright + '40',
          height: 60 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 8,
          shadowColor: colors.oceanDeep,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 10,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}>
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{ 
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: 24 }}>🏠</Text>
          ),
        }}
      />
      <Tab.Screen 
        name="MyTeam" 
        component={MyTeamScreen}
        options={{ 
          title: 'My Team',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: 24 }}>🏊</Text>
          ),
        }}
      />
      <Tab.Screen 
        name="Players" 
        component={PlayersScreen}
        options={{ 
          title: 'Players',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: 24 }}>👥</Text>
          ),
        }}
      />
      <Tab.Screen 
        name="Transfers" 
        component={TransfersScreen}
        options={{ 
          title: 'Transfers',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: 24 }}>🔄</Text>
          ),
        }}
      />
      <Tab.Screen 
        name="Fixtures" 
        component={FixturesScreen}
        options={{ 
          title: 'Fixtures',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: 24 }}>📅</Text>
          ),
        }}
      />
      <Tab.Screen 
        name="Leagues" 
        component={LeaguesScreen}
        options={{ 
          title: 'Leagues',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: 24 }}>🏆</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// App Content (with onboarding check)
function AppContent() {
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [userId, setUserId] = useState(null);
  const { loadTeamName } = useTeam();

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const id = await getUserId();
      console.log('[checkOnboardingStatus] Got userId:', id);
      setUserId(id);

      // Check if user profile exists
      const profileExists = await userProfileService.checkIfProfileExists(id);
      console.log('[checkOnboardingStatus] Profile exists:', profileExists);
      
      if (profileExists) {
        // Load team name if profile exists
        await loadTeamName(id);
        console.log('[checkOnboardingStatus] Team name loaded');
      }

      setNeedsOnboarding(!profileExists);
    } catch (error) {
      console.error('[checkOnboardingStatus] Error:', error);
      // If error, assume onboarding is needed
      setNeedsOnboarding(true);
    } finally {
      setIsCheckingOnboarding(false);
    }
  };

  const handleOnboardingComplete = async (teamName) => {
    // Load the team name into context
    await loadTeamName(userId);
    // Hide onboarding screen
    setNeedsOnboarding(false);
  };

  if (isCheckingOnboarding) {
    return <LoadingScreen />;
  }

  if (needsOnboarding) {
    return (
      <OnboardingScreen 
        userId={userId} 
        onComplete={handleOnboardingComplete} 
      />
    );
  }

  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="Main" 
        component={MainTabs}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

// Root App Component
export default function App() {
  return (
    <RoundProvider>
      <TeamProvider>
        <NavigationContainer>
          <StatusBar barStyle="dark-content" />
          <AppContent />
        </NavigationContainer>
      </TeamProvider>
    </RoundProvider>
  );
}
