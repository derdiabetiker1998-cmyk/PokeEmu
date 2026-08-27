import React from 'react';
import { requireNativeComponent, ViewStyle } from 'react-native';

const NativeRenderView = requireNativeComponent<{ style?: ViewStyle }>('PokeEmuRenderView');

export function PokeEmuRenderView({ style }: { style?: ViewStyle }) {
  return <NativeRenderView style={style} />;
}
