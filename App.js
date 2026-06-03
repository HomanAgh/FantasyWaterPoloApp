import React, { useState, useEffect } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar, Text } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from './styles/theme';
import { RoundProvider } from './context/RoundContext';
import { TeamProvider, useTeam } from './context/TeamContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import * as userProfileService from './services/userProfileService';

// Import screens
import HomeScreen from './screens/HomeScreen';
import MyTeamScreen from './screens/MyTeamScreen';
import PlayersScreen from './screens/PlayersScreen';
import LeaguesScreen from './screens/LeaguesScreen';
import TransfersScreen from './screens/TransfersScreen';
import FixturesScreen from './screens/FixturesScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import AuthScreen from './screens/AuthScreen';
import LoadingScreen from './components/LoadingScreen';
import PlayerDetailScreen from './screens/PlayerDetailScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

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
          tabBarIcon: () => <Text style={{ fontSize: 24 }}>🏠</Text>,
        }}
      />
      <Tab.Screen
        name="MyTeam"
        component={MyTeamScreen}
        options={{
          title: 'My Team',
          tabBarIcon: () => <Text style={{ fontSize: 24 }}>🏊</Text>,
        }}
      />
      <Tab.Screen
        name="Players"
        component={PlayersScreen}
        options={{
          title: 'Players',
          tabBarIcon: () => <Text style={{ fontSize: 24 }}>👥</Text>,
        }}
      />
      <Tab.Screen
        name="Transfers"
        component={TransfersScreen}
        options={{
          title: 'Transfers',
          tabBarIcon: () => <Text style={{ fontSize: 24 }}>🔄</Text>,
        }}
      />
      <Tab.Screen
        name="Fixtures"
        component={FixturesScreen}
        options={{
          title: 'Fixtures',
          tabBarIcon: () => <Text style={{ fontSize: 24 }}>📅</Text>,
        }}
      />
      <Tab.Screen
        name="Leagues"
        component={LeaguesScreen}
        options={{
          title: 'Leagues',
          tabBarIcon: () => <Text style={{ fontSize: 24 }}>🏆</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

function AppContent() {
  const { userId, isLoadingAuth } = useAuth();
  const { loadTeamName } = useTeam();

  // null = not checked yet, true = needs onboarding, false = has profile
  const [needsOnboarding, setNeedsOnboarding] = useState(null);

  useEffect(() => {
    if (!userId) {
      // User signed out or not logged in — reset onboarding state
      setNeedsOnboarding(null);
      return;
    }
    checkProfile(userId);
  }, [userId]);

  const checkProfile = async (id) => {
    try {
      const profileExists = await userProfileService.checkIfProfileExists(id);
      if (profileExists) {
        await loadTeamName(id);
      }
      setNeedsOnboarding(!profileExists);
    } catch (error) {
      console.error('[AppContent] Error checking profile:', error);
      setNeedsOnboarding(true);
    }
  };

  const handleOnboardingComplete = async () => {
    if (userId) {
      await loadTeamName(userId);
    }
    setNeedsOnboarding(false);
  };

  // Still resolving the stored session
  if (isLoadingAuth) {
    return <LoadingScreen />;
  }

  // Not logged in — show auth screen
  if (!userId) {
    return <AuthScreen />;
  }

  // Logged in but haven't checked profile yet
  if (needsOnboarding === null) {
    return <LoadingScreen />;
  }

  // Logged in, new user — collect team name
  if (needsOnboarding) {
    return (
      <OnboardingScreen
        userId={userId}
        onComplete={handleOnboardingComplete}
      />
    );
  }

  // Logged in, profile exists — main app
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Main"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PlayerDetail"
        component={PlayerDetailScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RoundProvider>
          <TeamProvider>
            <NavigationContainer theme={DefaultTheme}>
              <StatusBar barStyle="dark-content" />
              <AppContent />
            </NavigationContainer>
          </TeamProvider>
        </RoundProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
