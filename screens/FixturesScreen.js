import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Dimensions,
} from 'react-native';
import { Icons } from '../assets/images/icons';
import { colors, borderRadius, spacing, fonts } from '../styles/theme';
import {
  fetchFixturesForRound,
  fetchTopPerformers,
  formatMatchDate,
  getFixtureStatusStyle,
  formatPlayerStats,
} from '../services/fixtureService';
import { useRound } from '../context/RoundContext';

const ROUND_TAB_W = 52;
const ROUND_TAB_GAP = spacing.sm;

export default function FixturesScreen() {
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [topPerformersMap, setTopPerformersMap] = useState({});
  const [selectedRoundId, setSelectedRoundId] = useState(null);

  const roundTabsScrollRef = useRef(null);
  const { currentRound, allRounds, loadAllRounds } = useRound();

  const sortedRounds = useMemo(
    () => [...(allRounds || [])].sort((a, b) => a.round_number - b.round_number),
    [allRounds],
  );

  useEffect(() => {
    if (currentRound) {
      setSelectedRoundId(currentRound.id);
    }
  }, [currentRound]);

  useEffect(() => {
    loadAllRounds();
  }, []);

  useEffect(() => {
    if (selectedRoundId) {
      loadFixtures();
    }
  }, [selectedRoundId]);

  useEffect(() => {
    if (!selectedRoundId || sortedRounds.length === 0) return;

    const index = sortedRounds.findIndex(r => r.id === selectedRoundId);
    if (index < 0) return;

    const timer = setTimeout(() => {
      const { width } = Dimensions.get('window');
      const tabStride = ROUND_TAB_W + ROUND_TAB_GAP;
      const x = Math.max(
        0,
        index * tabStride - width / 2 + ROUND_TAB_W / 2 + spacing.md,
      );
      roundTabsScrollRef.current?.scrollTo({ x, animated: true });
    }, 50);

    return () => clearTimeout(timer);
  }, [selectedRoundId, sortedRounds]);

  const loadFixtures = async () => {
    if (!selectedRoundId) return;

    setLoading(true);
    const { data, error } = await fetchFixturesForRound(selectedRoundId);

    if (!error && data) {
      setFixtures(data);
      loadTopPerformersForFixtures(data);
    }

    setLoading(false);
  };

  const loadTopPerformersForFixtures = async (fixturesList) => {
    const finishedFixtures = fixturesList.filter(f => f.status === 'finished');
    const performersData = {};

    for (const fixture of finishedFixtures) {
      const { data, error } = await fetchTopPerformers(fixture.id, 3);
      if (!error && data) {
        performersData[fixture.id] = data;
      }
    }

    setTopPerformersMap(performersData);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFixtures();
    setRefreshing(false);
  };

  const handleRoundSelect = (roundId) => {
    setSelectedRoundId(roundId);
  };

  const renderRoundTabs = () => {
    if (sortedRounds.length === 0) return null;

    return (
      <View style={styles.roundTabsContainer}>
        <ScrollView
          ref={roundTabsScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.roundTabsScroll}
        >
          {sortedRounds.map((round) => {
            const isActive = selectedRoundId === round.id;
            return (
              <TouchableOpacity
                key={round.id}
                style={[styles.roundTab, isActive && styles.roundTabActive]}
                onPress={() => handleRoundSelect(round.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.roundTabLabel, isActive && styles.roundTabLabelActive]}>
                  GW
                </Text>
                <Text style={[styles.roundTabNumber, isActive && styles.roundTabNumberActive]}>
                  {round.round_number}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderRoundInfo = () => {
    const selectedRound = allRounds?.find(r => r.id === selectedRoundId);
    if (!selectedRound) return null;

    const matchCount = fixtures.length;

    return (
      <View style={styles.roundInfoBanner}>
        <Text style={styles.roundInfoTitle}>GAMEWEEK {selectedRound.round_number}</Text>
        <Text style={styles.roundInfoSubtitle}>
          {matchCount} {matchCount === 1 ? 'Match' : 'Matches'}
        </Text>
      </View>
    );
  };

  const renderFixtureCard = (fixture) => {
    const statusStyle = getFixtureStatusStyle(fixture.status);
    const topPerformers = topPerformersMap[fixture.id] || [];
    const homeTeamName = fixture.home_team?.name || 'TBD';
    const awayTeamName = fixture.away_team?.name || 'TBD';

    return (
      <View key={fixture.id} style={styles.fixtureCard}>
        <View style={styles.matchHeader}>
          <View style={styles.teamsContainer}>
            <View style={styles.teamRow}>
              <Text style={styles.teamName} numberOfLines={1}>
                {homeTeamName}
              </Text>
              <View style={styles.scoreSlot}>
                {fixture.status !== 'scheduled' && fixture.home_score !== null && (
                  <Text style={styles.score}>{fixture.home_score}</Text>
                )}
              </View>
            </View>
            <View style={styles.vsContainer}>
              <Text style={styles.vsText}>VS</Text>
              <View style={styles.scoreSlot} />
            </View>
            <View style={styles.teamRow}>
              <Text style={styles.teamName} numberOfLines={1}>
                {awayTeamName}
              </Text>
              <View style={styles.scoreSlot}>
                {fixture.status !== 'scheduled' && fixture.away_score !== null && (
                  <Text style={styles.score}>{fixture.away_score}</Text>
                )}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.matchInfo}>
          <Text style={styles.matchDate}>
            {formatMatchDate(fixture.match_date)}
          </Text>
          <View
            style={[
              styles.statusBadge,
              { borderColor: statusStyle.color + '80' },
            ]}
          >
            {fixture.status === 'scheduled' && (
              <Image
                source={Icons.calendar}
                style={[styles.statusIcon, { tintColor: statusStyle.color }]}
              />
            )}
            <Text style={[styles.statusText, { color: statusStyle.color }]}>
              {fixture.status !== 'scheduled' ? `${statusStyle.emoji} ` : ''}
              {statusStyle.label.toUpperCase()}
            </Text>
          </View>
        </View>

        {fixture.status === 'finished' && topPerformers.length > 0 && (
          <View style={styles.performersContainer}>
            <Text style={styles.performersTitle}>TOP PERFORMERS</Text>
            {topPerformers.map((performer, index) => (
              <View key={performer.id} style={styles.performerRow}>
                <View style={styles.performerRank}>
                  <Text style={styles.performerRankText}>{index + 1}</Text>
                </View>
                <View style={styles.performerInfo}>
                  <Text style={styles.performerName} numberOfLines={1}>
                    {performer.player?.name || 'Unknown'}
                  </Text>
                  <Text style={styles.performerStats}>
                    {formatPlayerStats(performer)}
                  </Text>
                </View>
                <Text style={styles.performerPoints}>{performer.points_earned} PTS</Text>
              </View>
            ))}
          </View>
        )}

        {fixture.venue && (
          <View style={styles.venueContainer}>
            <Image source={Icons.field} style={styles.venueIcon} />
            <Text style={styles.venueText}>{fixture.venue}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyCard}>
      <Image source={Icons.bigcalender} style={styles.emptyIcon} />
      <Text style={styles.emptyTitle}>NO FIXTURES SCHEDULED</Text>
      <Text style={styles.emptySubtext}>
        Check back soon{'\n'}for upcoming matches.
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.auth.neon}
            colors={[colors.auth.neon]}
          />
        }
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.title}>FIXTURES</Text>
          <Text style={styles.subtitle}>MATCH SCHEDULE AND RESULTS</Text>
        </View>

        {renderRoundTabs()}
        {renderRoundInfo()}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.auth.neon} />
            <Text style={styles.loadingText}>LOADING FIXTURES...</Text>
          </View>
        ) : fixtures.length === 0 ? (
          renderEmptyState()
        ) : (
          <View style={styles.fixturesList}>
            {fixtures.map((fixture) => renderFixtureCard(fixture))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },

  header: {
    paddingTop: 56,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.barlowCondensedExtraBoldItalic,
    fontSize: 64,
    color: colors.white,
    letterSpacing: 1,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.barlowCondensedMedium,
    fontSize: 16,
    color: colors.white,
    letterSpacing: 1.5,
    marginTop: 4,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },

  roundTabsContainer: {
    marginBottom: spacing.md,
  },
  roundTabsScroll: {
    paddingHorizontal: spacing.md,
    paddingRight: spacing.md + ROUND_TAB_W / 2,
    gap: ROUND_TAB_GAP,
  },
  roundTab: {
    width: ROUND_TAB_W,
    height: 64,
    backgroundColor: colors.auth.glass,
    borderRadius: borderRadius.small,
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundTabActive: {
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
    backgroundColor: colors.auth.inputBg,
  },
  roundTabLabel: {
    fontFamily: fonts.barlowCondensedMedium,
    fontSize: 16,
    color: colors.auth.statLabel,
    letterSpacing: 0.5,
  },
  roundTabLabelActive: {
    color: colors.auth.neon,
  },
  roundTabNumber: {
    fontFamily: fonts.barlowCondensedExtraBold,
    fontSize: 24,
    color: colors.white,
    marginTop: 0,
  },
  roundTabNumberActive: {
    color: colors.white,
  },

  roundInfoBanner: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.medium,
    borderWidth: 0.5,
    borderColor: colors.sand,
    backgroundColor: colors.auth.inputBg,
    alignItems: 'center',
  },
  roundInfoTitle: {
    fontFamily: fonts.barlowCondensedExtraBold,
    fontSize: 24,
    color: colors.sand,
    letterSpacing: 1,
    marginBottom: 4,
  },
  roundInfoSubtitle: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 16,
    color: colors.white,
  },

  fixturesList: {
    paddingHorizontal: spacing.md,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  loadingText: {
    marginTop: spacing.md,
    fontFamily: fonts.barlowCondensedMedium,
    fontSize: 14,
    color: colors.auth.statLabel,
    letterSpacing: 1,
  },

  fixtureCard: {
    backgroundColor: colors.auth.glass,
    borderRadius: borderRadius.medium,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
  },
  matchHeader: {
    marginBottom: spacing.md,
  },
  teamsContainer: {
    gap: spacing.sm,
  },
  teamRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  teamName: {
    fontFamily: fonts.barlowCondensedSemiBold,
    fontSize: 24,
    color: colors.white,
    flex: 1,
    marginRight: spacing.sm,
    textAlign: 'center',
  },
  scoreSlot: {
    minWidth: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  score: {
    fontFamily: fonts.barlowCondensedExtraBold,
    fontSize: 24,
    color: colors.sand,
    textAlign: 'right',
  },
  vsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  vsText: {
    flex: 1,
    marginRight: spacing.sm,
    fontFamily: fonts.barlowCondensedMedium,
    fontSize: 16,
    color: colors.auth.placeholder,
    letterSpacing: 1,
    textAlign: 'center',
  },
  matchInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: colors.auth.neonSoft,
  },
  matchDate: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 18,
    color: colors.auth.placeholder,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.small,
    borderWidth: 0.5,
    backgroundColor: colors.auth.inputBg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  statusText: {
    fontFamily: fonts.barlowCondensedBold,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  performersContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: colors.auth.neonSoft,
  },
  performersTitle: {
    fontFamily: fonts.barlowCondensedSemiBold,
    fontSize: 18,
    color: colors.auth.statLabel,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  performerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: colors.auth.inputBg,
    borderRadius: borderRadius.small,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 0.5,
    borderColor: colors.auth.neonSoft,
  },
  performerRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.auth.neon,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  performerRankText: {
    fontFamily: fonts.barlowCondensedExtraBold,
    fontSize: 14,
    color: colors.white,
  },
  performerInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  performerName: {
    fontFamily: fonts.barlowCondensedSemiBold,
    fontSize: 20,
    color: colors.white,
    marginBottom: 2,
  },
  performerStats: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 16,
    color: colors.auth.placeholder,
  },
  performerPoints: {
    fontFamily: fonts.barlowCondensedExtraBold,
    fontSize: 20,
    color: colors.sand,
    minWidth: 50,
    textAlign: 'right',
  },
  venueContainer: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 0.5,
    borderTopColor: colors.auth.neonSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  venueIcon: {
    width: 12,
    height: 12,
    resizeMode: 'contain',
    tintColor: colors.auth.neon,
  },
  venueText: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 12,
    color: colors.auth.placeholder,
  },

  emptyCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.auth.glass,
    borderRadius: borderRadius.large,
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 80,
    height: 80,
    resizeMode: 'contain',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontFamily: fonts.barlowCondensedExtraBold,
    fontSize: 24,
    color: colors.auth.statLabel,
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptySubtext: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 18,
    color: colors.white,
    textAlign: 'center',
    lineHeight: 22,
  },
});
