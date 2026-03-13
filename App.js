import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'react-native';
import { colors } from './styles/theme';
import { RoundProvider } from './context/RoundContext';
import { TeamProvider } from './context/TeamContext';

// Import screens
import HomeScreen from './screens/HomeScreen';
import MyTeamScreen from './screens/MyTeamScreen';
import PlayersScreen from './screens/PlayersScreen';
import LeaguesScreen from './screens/LeaguesScreen';
import TransfersScreen from './screens/TransfersScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Main Tab Navigator
function MainTabs() {
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
          height: 60,
          paddingBottom: 8,
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
        options={{ title: 'Home' }}
      />
      <Tab.Screen 
        name="MyTeam" 
        component={MyTeamScreen}
        options={{ title: 'My Team' }}
      />
      <Tab.Screen 
        name="Players" 
        component={PlayersScreen}
        options={{ title: 'Players' }}
      />
      <Tab.Screen 
        name="Transfers" 
        component={TransfersScreen}
        options={{ title: 'Transfers' }}
      />
      <Tab.Screen 
        name="Leagues" 
        component={LeaguesScreen}
        options={{ title: 'Leagues' }}
      />
    </Tab.Navigator>
  );
}

// Root Stack Navigator
export default function App() {
  return (
    <RoundProvider>
      <TeamProvider>
        <NavigationContainer>
          <StatusBar barStyle="dark-content" />
          <Stack.Navigator>
            <Stack.Screen 
              name="Main" 
              component={MainTabs}
              options={{ headerShown: false }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </TeamProvider>
    </RoundProvider>
  );
}
