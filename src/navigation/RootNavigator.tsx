import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RomListScreen } from '../screens/RomListScreen';
import { EmulatorScreen } from '../screens/EmulatorScreen';
import { CheatsEditorScreen } from '../screens/CheatsEditorScreen';

export type RootStackParamList = {
  RomList: undefined;
  Emulator: { filePath: string; romId: string };
  CheatsEditor: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="RomList" component={RomListScreen} options={{ title: 'PokeEmu' }} />
        <Stack.Screen name="Emulator" component={EmulatorScreen} options={{ title: '' }} />
        <Stack.Screen name="CheatsEditor" component={CheatsEditorScreen} options={{ title: 'Cheats' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
