import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from './src/screens/HomeScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer
      theme={{
        dark: true,
        colors: {
          primary: '#6c63ff',
          background: '#0f0f1a',
          card: '#1a1a2e',
          text: '#ffffff',
          border: '#2a2a3d',
          notification: '#6c63ff',
        },
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
