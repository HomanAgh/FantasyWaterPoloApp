import React, { useState, useEffect } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  StatusBar,
  Image,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

// iOS only: cap Dynamic Type so layout matches the designed (Android) sizes.
// Android is left unchanged — system font scaling behaves as before.
if (Platform.OS === 'ios') {
  Text.defaultProps = Text.defaultProps ?? {};
  Text.defaultProps.maxFontSizeMultiplier = 1.0;
  TextInput.defaultProps = TextInput.defaultProps ?? {};
  TextInput.defaultProps.maxFontSizeMultiplier = 1.0;
}
import * as Sentry from '@sentry/react-native';
import {
  useFonts,
  BarlowCondensed_400Regular,
  BarlowCondensed_500Medium,
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
  BarlowCondensed_800ExtraBold_Italic,
} from '@expo-google-fonts/barlow-condensed';
import { colors, fonts, spacing, borderRadius } from './styles/theme';
import { Icons } from './assets/images/icons';
import ScreenBackground from './components/ScreenBackground';
import { RoundProvider } from './context/RoundContext';
import { TeamProvider, useTeam } from './context/TeamContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import * as userProfileService from './services/userProfileService';
import { withJwtClockSkewRetry } from './utils/supabaseAuthRetry';

const TAB_INACTIVE_ICON = '#6B9BC4';
const TAB_INACTIVE_LABEL = '#B8D0E6';

function TabIcon({ source, focused }) {
  return (
    <Image
      source={source}
      style={[
        tabStyles.iconShift,
        {
          width: 22,
          height: 22,
          resizeMode: 'contain',
          tintColor: focused ? colors.sand : TAB_INACTIVE_ICON,
        },
      ]}
    />
  );
}

function TabLabel({ label, focused }) {
  return (
    <View style={tabStyles.labelWrap}>
      <Text
        style={[
          tabStyles.label,
          { color: focused ? colors.sand : TAB_INACTIVE_LABEL },
        ]}
        numberOfLines={1}
        maxFontSizeMultiplier={Platform.OS === 'ios' ? 1 : undefined}
      >
        {label}
      </Text>
      <View
        style={[
          tabStyles.underline,
          { backgroundColor: focused ? colors.sand : 'transparent' },
        ]}
      />
    </View>
  );
}

const tabStyles = StyleSheet.create({
  // Nudge icons/labels upward — tweak iconShift / labelWrap.marginTop if needed
  iconShift: {
    marginTop: 0,
  },
  labelWrap: {
    alignItems: 'center',
    marginTop: -2,
  },
  label: {
    fontFamily: fonts.barlowCondensedExtraBoldItalic, // cursive / italic like Figma
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  underline: {
    marginTop: 2,
    height: 3,
    width: 36,
    borderRadius: 2,
  },
});

const AppTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: 'transparent',
    card: 'transparent',
  },
};

let sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (!sentryDsn) {
  try {
    const { SENTRY_CONFIG } = require('./config/sentryConfig');
    sentryDsn = SENTRY_CONFIG.dsn;
  } catch {
    // sentryConfig.js not present — Sentry will be disabled
  }
}

Sentry.init({
  dsn: sentryDsn,
  // Set tracesSampleRate to 1.0 to capture 100% of transactions.
  // Reduce in production (e.g. 0.2) once you have baseline data.
  tracesSampleRate: 1.0,
  // Uncomment to enable Sentry's performance monitoring breadcrumbs:
  // enableTracing: true,
  enabled: !!sentryDsn && sentryDsn !== 'YOUR_SENTRY_DSN_HERE',
});

// Import screens
import HomeScreen from './screens/HomeScreen';
import MyTeamScreen from './screens/MyTeamScreen';
import PlayersScreen from './screens/PlayersScreen';
import LeaguesScreen from './screens/LeaguesScreen';
import TransfersScreen from './screens/TransfersScreen';
import FixturesScreen from './screens/FixturesScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import AuthScreen from './screens/AuthScreen';
import ProfileScreen from './screens/ProfileScreen';
import LoadingScreen from './components/LoadingScreen';
import PlayerDetailScreen from './screens/PlayerDetailScreen';
import GWHistoryScreen from './screens/GWHistoryScreen';
import LeagueDetailScreen from './screens/LeagueDetailScreen';
import ViewTeamScreen from './screens/ViewTeamScreen';
import { startAdsIfAllowed } from './services/adsService';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.sand,
        tabBarInactiveTintColor: TAB_INACTIVE_LABEL,
        tabBarStyle: {
          backgroundColor: '#011430',
          borderTopWidth: 0,
          height: 64 + insets.bottom,
          // Less paddingTop = icons closer to top of bar
          paddingBottom: Math.max(insets.bottom, 4),
          paddingTop: 4,
          elevation: 0,
          shadowOpacity: 0,
        },
        sceneStyle: {
          backgroundColor: 'transparent',
        },
        tabBarItemStyle: {
          paddingTop: 0,
          justifyContent: 'flex-start',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon source={Icons.house} focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label="Home" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="MyTeam"
        component={MyTeamScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon source={Icons.swimmer} focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label="My Team" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Players"
        component={PlayersScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon source={Icons.player} focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label="Players" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Transfers"
        component={TransfersScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon source={Icons.swap} focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label="Transfers" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Fixtures"
        component={FixturesScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon source={Icons.calendar} focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label="Fixtures" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Leagues"
        component={LeaguesScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon source={Icons.trophy} focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label="Leagues" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon source={Icons.account} focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label="Profile" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

function AppContent() {
  const { userId, isLoadingAuth } = useAuth();
  const { loadTeamName } = useTeam();

  // null = not checked yet / checking, true = needs onboarding, false = has profile
  const [needsOnboarding, setNeedsOnboarding] = useState(null);
  // Set when profile check fails (JWT/network) — never treat this as a new user
  const [profileCheckError, setProfileCheckError] = useState(null);

  useEffect(() => {
    if (!userId) {
      setNeedsOnboarding(null);
      setProfileCheckError(null);
      return;
    }
    checkProfile(userId);
  }, [userId]);

  const checkProfile = async (id) => {
    setProfileCheckError(null);
    setNeedsOnboarding(null);

    try {
      const { data: profileExists, error } = await withJwtClockSkewRetry(() =>
        userProfileService.checkIfProfileExists(id)
      );

      if (error) {
        console.error('[AppContent] Error checking profile:', error);
        setProfileCheckError(
          "Couldn't verify your account. Check your connection and try again."
        );
        return;
      }

      if (profileExists) {
        await loadTeamName(id);
      }
      setNeedsOnboarding(!profileExists);
    } catch (error) {
      console.error('[AppContent] Error checking profile:', error);
      setProfileCheckError(
        "Couldn't verify your account. Check your connection and try again."
      );
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

  // Profile check failed — retry, do NOT send existing users to onboarding
  if (profileCheckError) {
    return (
      <View style={profileSyncStyles.container}>
        <Text style={profileSyncStyles.title}>Couldn't sync account</Text>
        <Text style={profileSyncStyles.message}>{profileCheckError}</Text>
        <TouchableOpacity
          style={profileSyncStyles.retryButton}
          onPress={() => checkProfile(userId)}
          activeOpacity={0.8}
        >
          <Text style={profileSyncStyles.retryText}>TRY AGAIN</Text>
        </TouchableOpacity>
      </View>
    );
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
    <Stack.Navigator
      screenOptions={{
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
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
      <Stack.Screen
        name="GWHistory"
        component={GWHistoryScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="LeagueDetail"
        component={LeagueDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ViewTeam"
        component={ViewTeamScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

const profileSyncStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: 'transparent',
  },
  title: {
    fontFamily: fonts.barlowCondensedBold,
    fontSize: 20,
    color: colors.sand,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  message: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 15,
    color: colors.white,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryButton: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.medium,
    borderWidth: 1.5,
    borderColor: colors.auth.neon,
  },
  retryText: {
    fontFamily: fonts.barlowCondensedBold,
    fontSize: 14,
    color: colors.auth.neon,
    letterSpacing: 1,
  },
});

export default Sentry.wrap(function App() {
  const [fontsLoaded] = useFonts({
    BarlowCondensed_400Regular,
    BarlowCondensed_500Medium,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    BarlowCondensed_800ExtraBold,
    BarlowCondensed_800ExtraBold_Italic,
  });

  useEffect(() => {
    if (!fontsLoaded) {
      return;
    }
    // UMP → ATT (iOS) → init/preload when canRequestAds.
    // __DEV__ uses TestIds.REWARDED (safe to click) + EEA debug geography.
    startAdsIfAllowed({ preload: true }).catch(() => {
      // Ads must never block app startup
    });
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return (
      <SafeAreaProvider>
        <ScreenBackground>
          <LoadingScreen />
        </ScreenBackground>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RoundProvider>
          <TeamProvider>
            <NavigationContainer theme={AppTheme}>
              <StatusBar barStyle="light-content" />
              <ScreenBackground>
                <AppContent />
              </ScreenBackground>
            </NavigationContainer>
          </TeamProvider>
        </RoundProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
});
