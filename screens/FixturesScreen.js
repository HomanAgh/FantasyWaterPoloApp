import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { colors, shadows, borderRadius, spacing } from '../styles/theme';
import {
  fetchFixturesForRound,
  fetchTopPerformers,
  formatMatchDate,
  getFixtureStatusStyle,
  formatPlayerStats,
} from '../services/fixtureService';
import { useRound } from '../context/RoundContext';

export default function FixturesScreen() {
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [topPerformersMap, setTopPerformersMap] = useState({});
  const [selectedRoundId, setSelectedRoundId] = useState(null);
  
  const { currentRound, allRounds, loadAllRounds } = useRound();

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

  const loadFixtures = async () => {
    if (!selectedRoundId) return;
    
    setLoading(true);
    const { data, error } = await fetchFixturesForRound(selectedRoundId);
    
    if (!error && data) {
      setFixtures(data);
      // Load top performers for finished matches
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
    if (!allRounds || allRounds.length === 0) return null;
    
    // Show only the last 5 rounds for simplicity (most recent, in ascending order)
    const recentRounds = [...allRounds]
      .sort((a, b) => a.round_number - b.round_number)
      .slice(-5);
    
    return (
      <View style={styles.roundTabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {recentRounds.map((round) => (
            <TouchableOpacity
              key={round.id}
              style={[
                styles.roundTab,
                selectedRoundId === round.id && styles.roundTabActive,
              ]}
              onPress={() => handleRoundSelect(round.id)}
              activeOpacity={0.7}>
              <Text
                style={[
                  styles.roundTabText,
                  selectedRoundId === round.id && styles.roundTabTextActive,
                ]}>
                GW {round.round_number}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderRoundInfo = () => {
    const currentRound = allRounds?.find(r => r.id === selectedRoundId);
    if (!currentRound) return null;

    const matchCount = fixtures.length;
    
    return (
      <View style={styles.roundInfoBanner}>
        <View style={styles.roundInfoContent}>
          <Text style={styles.roundInfoTitle}>Gameweek {currentRound.round_number}</Text>
          <Text style={styles.roundInfoSubtitle}>
            {matchCount} {matchCount === 1 ? 'match' : 'matches'}
          </Text>
        </View>
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
        {/* Match Header */}
        <View style={styles.matchHeader}>
          <View style={styles.teamsContainer}>
            <View style={styles.teamRow}>
              <Text style={styles.teamName} numberOfLines={1}>
                {homeTeamName}
              </Text>
              {fixture.status !== 'scheduled' && fixture.home_score !== null && (
                <Text style={styles.score}>{fixture.home_score}</Text>
              )}
            </View>
            <View style={styles.vsContainer}>
              <Text style={styles.vsText}>vs</Text>
            </View>
            <View style={styles.teamRow}>
              <Text style={styles.teamName} numberOfLines={1}>
                {awayTeamName}
              </Text>
              {fixture.status !== 'scheduled' && fixture.away_score !== null && (
                <Text style={styles.score}>{fixture.away_score}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Match Info */}
        <View style={styles.matchInfo}>
          <Text style={styles.matchDate}>
            {formatMatchDate(fixture.match_date)}
          </Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusStyle.backgroundColor },
            ]}>
            <Text style={[styles.statusText, { color: statusStyle.color }]}>
              {statusStyle.emoji} {statusStyle.label}
            </Text>
          </View>
        </View>

        {/* Top Performers (only for finished matches) */}
        {fixture.status === 'finished' && topPerformers.length > 0 && (
          <View style={styles.performersContainer}>
            <Text style={styles.performersTitle}>⭐ Top Performers</Text>
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
                <Text style={styles.performerPoints}>{performer.points_earned} pts</Text>
              </View>
            ))}
          </View>
        )}

        {/* Venue (if available) */}
        {fixture.venue && (
          <View style={styles.venueContainer}>
            <Text style={styles.venueText}>📍 {fixture.venue}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>🏊‍♂️</Text>
      <Text style={styles.emptyText}>No fixtures scheduled</Text>
      <Text style={styles.emptySubtext}>
        Check back soon for upcoming matches!
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Ocean-themed header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.waveEmoji}>🌊</Text>
          <Text style={styles.title}>Fixtures</Text>
          <Text style={styles.subtitle}>Match schedule & results</Text>
        </View>
      </View>

      {/* Round Tabs */}
      {renderRoundTabs()}

      {/* Round Info Banner */}
      {renderRoundInfo()}

      {/* Fixtures List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.oceanMedium}
            colors={[colors.oceanMedium]}
          />
        }>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.oceanMedium} />
            <Text style={styles.loadingText}>Loading fixtures...</Text>
          </View>
        ) : fixtures.length === 0 ? (
          renderEmptyState()
        ) : (
          fixtures.map((fixture) => renderFixtureCard(fixture))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  header: {
    backgroundColor: colors.oceanDeep,
    paddingTop: 60,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    ...shadows.large,
  },
  headerContent: {
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  waveEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 5,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    color: colors.oceanBright,
    fontWeight: '500',
  },
  roundTabsContainer: {
    backgroundColor: colors.white,
    marginHorizontal: spacing.md,
    marginTop: -15,
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.medium,
    ...shadows.medium,
    borderWidth: 2,
    borderColor: colors.oceanBright + '40',
  },
  roundTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.xs,
    borderRadius: borderRadius.medium,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.oceanBright + '40',
  },
  roundTabActive: {
    backgroundColor: colors.oceanMedium,
    borderColor: colors.oceanMedium,
  },
  roundTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  roundTabTextActive: {
    color: colors.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.textMuted,
    fontWeight: '500',
  },
  fixtureCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.large,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.medium,
    borderWidth: 1,
    borderColor: colors.oceanBright + '20',
    borderLeftWidth: 4,
    borderLeftColor: colors.oceanMedium,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textDark,
    flex: 1,
    marginRight: spacing.sm,
    textAlign: 'center',
  },
  score: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.oceanMedium,
    minWidth: 40,
    textAlign: 'right',
  },
  vsContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  vsText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  matchInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.oceanBright + '20',
  },
  matchDate: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.medium,
    borderWidth: 1,
    borderColor: colors.oceanBright + '40',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  performersContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.oceanBright + '20',
    backgroundColor: colors.oceanBright + '10',
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  performersTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.oceanDeep,
    marginBottom: spacing.sm,
  },
  performerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: borderRadius.medium,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  performerRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.oceanMedium,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  performerRankText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.white,
  },
  performerInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  performerName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 2,
  },
  performerStats: {
    fontSize: 12,
    color: colors.textMuted,
  },
  performerPoints: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.oceanMedium,
    minWidth: 50,
    textAlign: 'right',
  },
  venueContainer: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.oceanBright + '20',
  },
  venueText: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textMuted,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  roundInfoBanner: {
    backgroundColor: colors.white,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.medium,
    ...shadows.small,
    borderLeftWidth: 4,
    borderLeftColor: colors.oceanMedium,
  },
  roundInfoContent: {
    alignItems: 'center',
  },
  roundInfoTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.oceanDeep,
    marginBottom: 4,
  },
  roundInfoSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
  },
});
