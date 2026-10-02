import React from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';
import { Icons } from '../assets/images/icons';

/**
 * Full-bleed app background. Wrap a screen (or the app shell) once —
 * children sit on top of fwpbackground.png with an optional dark scrim.
 */
const ScreenBackground = ({ children, scrim = true, style }) => (
  <ImageBackground
    source={Icons.background}
    style={[styles.background, style]}
    resizeMode="cover"
  >
    {scrim ? <View style={styles.scrim} pointerEvents="none" /> : null}
    <View style={styles.content}>{children}</View>
  </ImageBackground>
);

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 1, 12, 0.6)',
  },
  content: {
    flex: 1,
  },
});

export default ScreenBackground;
