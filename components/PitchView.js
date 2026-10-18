import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Icons } from '../assets/images/icons';
import { colors, borderRadius, spacing, fonts } from '../styles/theme';
import PlayerCard from './PlayerCard';

/**
 * PitchView — water polo formation for My Team / Transfers.
 * Layout: 1 GK, 6 outfield (2×3), 2 bench (GK + 1 outfield).
 */
const PitchView = ({
  players = [],
  captainId = null,
  mode = 'pickTeam',
  onPlayerPress,
  onEmptySlotPress,
  isLocked = false,
  compact = false,
}) => {
  const starters = players.filter(p => p.isStarter);
  const substitutes = players.filter(p => !p.isStarter);

  const starterGK = starters.find(p => p.position === 'GK');
  const starterOutfield = starters.filter(p => p.position === 'Outfield');

  const subGK = substitutes.find(p => p.position === 'GK');
  const subOutfield = substitutes
    .filter(p => p.position === 'Outfield')
    .sort((a, b) => (a.positionOrder || 0) - (b.positionOrder || 0));

  const starterOutfieldSlots = [...Array(6)].map((_, i) => starterOutfield[i] || null);
  const subOutfieldSlots = [...Array(1)].map((_, i) => subOutfield[i] || null);

  const renderEmptySlot = (position, isStarter) => (
    <TouchableOpacity
      style={styles.emptySlot}
      onPress={() => !isLocked && onEmptySlotPress && onEmptySlotPress(position, isStarter)}
      disabled={isLocked}
      activeOpacity={0.7}
    >
      <View style={styles.emptySlotCircle}>
        <Image
          source={position === 'GK' ? Icons.goalie : Icons.player1}
          style={styles.emptySlotEmoji}
        />
      </View>
      <Text style={styles.emptySlotText}>EMPTY</Text>
    </TouchableOpacity>
  );

  const renderPlayerOrEmpty = (player, position, isStarter, benchBadge = null) => {
    if (player) {
      return (
        <PlayerCard
          player={player}
          isCaptain={mode !== 'transfers' && player.id === captainId}
          isStarter={isStarter}
          mode={mode}
          benchBadge={benchBadge}
          onPress={() => !isLocked && onPlayerPress && onPlayerPress(player.id, player)}
          disabled={isLocked}
        />
      );
    }
    return renderEmptySlot(position, isStarter);
  };

  const SectionPill = ({ label }) => (
    <View style={styles.sectionPill}>
      <Text style={styles.sectionPillText}>{label}</Text>
    </View>
  );

  if (mode === 'transfers') {
    const allGKs = players.filter(p => p.position === 'GK');
    const allOutfield = players.filter(p => p.position === 'Outfield');
    const gkSlots = [...Array(2)].map((_, i) => allGKs[i] || null);
    const outfieldSlots = [...Array(7)].map((_, i) => allOutfield[i] || null);

    // Compact transfers pitch for 2 GK + 7 outfield: 2 / 3 / 3 / 1
    return (
      <View style={[styles.pitch, compact && styles.pitchCompact]}>
        <View style={styles.pitchInner}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.contentContainer,
              compact && styles.contentContainerCompact,
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.compactRowTight}>
              {gkSlots.map((player, index) => (
                <View key={player?.id || `gk-${index}`} style={styles.playerSlotTight}>
                  {renderPlayerOrEmpty(player, 'GK', true)}
                </View>
              ))}
            </View>
            <View style={styles.compactRowTight}>
              {outfieldSlots.slice(0, 3).map((player, index) => (
                <View key={player?.id || `of-${index}`} style={styles.playerSlotTight}>
                  {renderPlayerOrEmpty(player, 'Outfield', true)}
                </View>
              ))}
            </View>
            <View style={styles.compactRowTight}>
              {outfieldSlots.slice(3, 6).map((player, index) => (
                <View key={player?.id || `of-${index + 3}`} style={styles.playerSlotTight}>
                  {renderPlayerOrEmpty(player, 'Outfield', true)}
                </View>
              ))}
            </View>
            <View style={styles.compactRowTight}>
              {outfieldSlots.slice(6, 7).map((player, index) => (
                <View key={player?.id || `of-${index + 6}`} style={styles.playerSlotTight}>
                  {renderPlayerOrEmpty(player, 'Outfield', true)}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.pitch, compact && styles.pitchCompact]}>
      <View style={styles.pitchInner}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.contentContainer,
            compact && styles.contentContainerCompact,
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.startersSection}>
            <SectionPill label="STARTING LINE-UP" />

            <View style={styles.gkRow}>
              <View style={styles.playerSlot}>
                {renderPlayerOrEmpty(starterGK, 'GK', true)}
              </View>
            </View>

            <View style={styles.outfieldRow}>
              {starterOutfieldSlots.slice(0, 3).map((player, index) => (
                <View key={player?.id || `starter-of-${index}`} style={styles.playerSlot}>
                  {renderPlayerOrEmpty(player, 'Outfield', true)}
                </View>
              ))}
            </View>

            <View style={styles.outfieldRow}>
              {starterOutfieldSlots.slice(3, 6).map((player, index) => (
                <View key={player?.id || `starter-of-${index + 3}`} style={styles.playerSlot}>
                  {renderPlayerOrEmpty(player, 'Outfield', true)}
                </View>
              ))}
            </View>
          </View>

          <View style={styles.substitutesSection}>
            <SectionPill label="BENCH" />

            <View style={styles.benchRow}>
              <View style={styles.playerSlot}>
                {renderPlayerOrEmpty(subGK, 'GK', false, 'GK')}
              </View>
              {subOutfieldSlots.map((player, index) => (
                <View key={player?.id || `sub-of-${index}`} style={styles.playerSlot}>
                  {renderPlayerOrEmpty(player, 'Outfield', false, String(index + 1))}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

// One value for space between every player row — tweak this only
const ROW_GAP = spacing.sm;

const styles = StyleSheet.create({
  // Outer neon frame stays fixed (no overflow — Android clips borders otherwise)
  pitch: {
    flex: 1,
    backgroundColor: colors.auth.glass,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: borderRadius.large,
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
  },
  // ViewTeam / scout: pull the frame up from the screen bottom
  pitchCompact: {
    marginBottom: spacing.xxl + 50,
  },
  // Inner clip so players scroll under the frame without eating the border
  pitchInner: {
    flex: 1,
    borderRadius: borderRadius.large - 2,
    overflow: 'hidden',
  },
  scroll: {
    flex: 1,
  },
  contentContainer: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xl,
  },
  contentContainerCompact: {
    paddingVertical: spacing.sm,
    paddingBottom: spacing.sm,
  },
  startersSection: {
    paddingBottom: spacing.sm,
  },
  sectionPill: {
    alignSelf: 'center',
    backgroundColor: colors.auth.inputBg,
    borderWidth: 0.5,
    borderColor: colors.sand,
    borderRadius: borderRadius.small,
    paddingVertical: 4,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  sectionPillText: {
    fontFamily: fonts.barlowCondensedBold,
    fontSize: 20,
    color: colors.white,
    letterSpacing: 1,
  },
  gkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: ROW_GAP,
  },
  outfieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: ROW_GAP,
    paddingHorizontal: spacing.xs,
  },
  playerSlot: {
    alignItems: 'center',
    marginHorizontal: 2,
  },
  substitutesSection: {
    paddingTop: spacing.md - 1,
    borderTopWidth: 1,
    borderTopColor: colors.auth.neonSoft,
  },
  benchRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.xs,
    rowGap: ROW_GAP,
  },
  compactRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: ROW_GAP,
    paddingHorizontal: spacing.xs,
    flexWrap: 'wrap',
  },
  compactRowTight: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: ROW_GAP + spacing.xs,
  },
  playerSlotTight: {
    alignItems: 'center',
    marginHorizontal: spacing.xs,
  },
  emptySlot: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
    minWidth: 64,
    minHeight: 90,
  },
  emptySlotCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
    backgroundColor: 'transparent',
    borderWidth: 0.5,
    borderStyle: 'dashed',
    borderColor: colors.auth.neonSoft,
  },
  emptySlotEmoji: {
    width: 34,
    height: 34,
    opacity: 0.45,
    resizeMode: 'contain',
  },
  emptySlotText: {
    fontFamily: fonts.barlowCondensedMedium,
    fontSize: 10,
    color: colors.auth.placeholder,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});

export default React.memo(PitchView);
