import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Icons } from '../assets/images/icons';
import { colors, borderRadius, spacing, fonts } from '../styles/theme';
import { useAuth } from '../context/AuthContext';
import LeaderboardItem from '../components/LeaderboardItem';
import {
  fetchGlobalLeaderboard,
  fetchMyLeagues,
  createLeague,
  joinLeague,
} from '../services/leagueService';
import { reportTeamName } from '../services/userProfileService';

const PAGE_SIZE = 50;
const NAME_PATTERN = /^[a-zA-Z0-9\s\-_'!]+$/;

function validateLeagueName(name) {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { isValid: false, error: 'Please enter a league name' };
  }
  if (trimmed.length < 3) {
    return { isValid: false, error: 'League name must be at least 3 characters' };
  }
  if (trimmed.length > 30) {
    return { isValid: false, error: 'League name must be less than 30 characters' };
  }
  if (!NAME_PATTERN.test(trimmed)) {
    return { isValid: false, error: 'League name contains invalid characters' };
  }
  return { isValid: true, error: '' };
}

function validateInviteCode(code) {
  const normalised = code.trim().toUpperCase();
  if (normalised.length === 0) {
    return { isValid: false, error: 'Please enter an invite code' };
  }
  if (!/^[A-Z0-9]{6}$/.test(normalised)) {
    return { isValid: false, error: 'Invite codes are 6 letters or numbers' };
  }
  return { isValid: true, error: '', code: normalised };
}

export default function LeaguesScreen({ navigation }) {
  const { userId } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [myLeagues, setMyLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(null);

  const [createVisible, setCreateVisible] = useState(false);
  const [joinVisible, setJoinVisible] = useState(false);
  const [leagueName, setLeagueName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadScreenData = useCallback(async () => {
    setError(null);

    try {
      const [leaderboardResult, leaguesResult] = await Promise.all([
        fetchGlobalLeaderboard(PAGE_SIZE, 0),
        fetchMyLeagues(),
      ]);

      if (leaderboardResult.error) {
        throw leaderboardResult.error;
      }

      if (leaguesResult.error) {
        console.warn('Error fetching my leagues:', leaguesResult.error);
      }

      const rows = leaderboardResult.data || [];
      setLeaderboard(rows);
      setHasMore(rows.length >= PAGE_SIZE);
      setMyLeagues(leaguesResult.data || []);
    } catch (err) {
      console.error('Error loading leaderboard:', err);
      setError('Failed to load leaderboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  const loadMoreLeaderboard = useCallback(async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const { data, error: moreError } = await fetchGlobalLeaderboard(
        PAGE_SIZE,
        leaderboard.length
      );

      if (moreError) throw moreError;

      const rows = data || [];
      const seen = new Set(leaderboard.map(e => e.user_id));
      const unique = rows.filter(e => !seen.has(e.user_id));
      setLeaderboard([...leaderboard, ...unique]);
      setHasMore(rows.length >= PAGE_SIZE);
    } catch (err) {
      console.error('Error loading more leaderboard:', err);
      Alert.alert("Couldn't load more", 'Please try again.');
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, leaderboard]);

  useFocusEffect(
    useCallback(() => {
      if (userId) {
        loadScreenData();
      }
    }, [userId, loadScreenData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadScreenData();
  }, [loadScreenData]);

  const openLeague = (league) => {
    navigation.navigate('LeagueDetail', {
      leagueId: league.id,
      leagueName: league.name,
      inviteCode: league.invite_code,
      createdBy: league.created_by,
    });
  };

  const openViewTeam = (entry) => {
    if (!entry?.user_id) return;
    navigation.navigate('ViewTeam', {
      userId: entry.user_id,
      teamName: entry.team_name,
    });
  };

  const handleReportTeamName = (entry) => {
    if (!entry?.user_id || entry.user_id === userId) return;

    Alert.alert(
      'Report team name?',
      `Report "${entry.team_name}" as offensive? We'll review it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: async () => {
            const { error: reportError } = await reportTeamName(entry.user_id);
            if (reportError) {
              const message = reportError.message?.includes('already reported')
                ? 'You already reported this team.'
                : reportError.message || 'Please try again.';
              Alert.alert("Couldn't send report", message);
              return;
            }
            Alert.alert('Report sent', 'Thanks — we will review this team name.');
          },
        },
      ]
    );
  };

  const closeCreateModal = () => {
    if (submitting) return;
    setCreateVisible(false);
    setLeagueName('');
  };

  const closeJoinModal = () => {
    if (submitting) return;
    setJoinVisible(false);
    setInviteCode('');
  };

  const handleCreateLeague = async () => {
    const validation = validateLeagueName(leagueName);
    if (!validation.isValid) {
      Alert.alert('Invalid league name', validation.error);
      return;
    }

    setSubmitting(true);
    const { data, error: createError } = await createLeague(leagueName.trim());
    setSubmitting(false);

    if (createError || !data) {
      Alert.alert(
        "Couldn't create league",
        createError?.message || 'Please try again.'
      );
      return;
    }

    setCreateVisible(false);
    setLeagueName('');
    const created = {
      id: data.id,
      name: data.name,
      invite_code: data.invite_code,
      created_by: userId,
      member_count: 1,
    };
    setMyLeagues((prev) => [
      created,
      ...prev.filter((league) => league.id !== data.id),
    ]);
    openLeague(created);
  };

  const handleJoinLeague = async () => {
    const validation = validateInviteCode(inviteCode);
    if (!validation.isValid) {
      Alert.alert('Invalid code', validation.error);
      return;
    }

    setSubmitting(true);
    const { data, error: joinError } = await joinLeague(validation.code);
    setSubmitting(false);

    if (joinError || !data) {
      const message = joinError?.message?.includes('Invalid league code')
        ? "That code doesn't match any league."
        : joinError?.message || 'Please try again.';
      Alert.alert("Couldn't join league", message);
      return;
    }

    setJoinVisible(false);
    setInviteCode('');

    const leaguesResult = await fetchMyLeagues();
    if (!leaguesResult.error) {
      setMyLeagues(leaguesResult.data || []);
    }

    const joined =
      (leaguesResult.data || []).find((league) => league.id === data.id) || {
        ...data,
        created_by: null,
      };
    openLeague(joined);
  };

  return (
    <>
      <ScrollView
        style={styles.container}
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
          <Text style={styles.title}>LEAGUES</Text>
        </View>

        {/* ── Join / Create private leagues ── */}
        <View style={styles.privateCard}>
          <TouchableOpacity
            style={[styles.outlineButton, styles.outlineButtonFirst]}
            onPress={() => setJoinVisible(true)}
            activeOpacity={0.8}
          >
            <Image source={Icons.join} style={[styles.outlineButtonIcon, styles.iconNeon]} />
            <Text style={styles.outlineButtonText}>JOIN PRIVATE LEAGUE</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.outlineButton}
            onPress={() => setCreateVisible(true)}
            activeOpacity={0.8}
          >
            <Image source={Icons.join} style={[styles.outlineButtonIcon, styles.iconNeon]} />
            <Text style={styles.outlineButtonText}>CREATE PRIVATE LEAGUE</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* ── Joined private leagues ── */}
        <View style={styles.privateCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>PRIVATE LEAGUES</Text>
            <Image source={Icons.trophy} style={[styles.cardHeaderIcon, styles.iconNeon]} />
          </View>

          {myLeagues.length === 0 ? (
            <Text style={styles.myLeaguesEmpty}>
              You haven't joined any private leagues yet.
            </Text>
          ) : (
            <View style={styles.myLeaguesList}>
              {myLeagues.map((league, index) => (
                <TouchableOpacity
                  key={league.id}
                  style={[
                    styles.leagueRow,
                    index === myLeagues.length - 1 && styles.leagueRowLast,
                  ]}
                  onPress={() => openLeague(league)}
                  activeOpacity={0.7}
                >
                  <View style={styles.leagueRowInfo}>
                    <Text style={styles.leagueRowName}>{league.name.toUpperCase()}</Text>
                    <Text style={styles.leagueRowMeta}>
                      {league.member_count} MEMBER{league.member_count !== 1 ? 'S' : ''}
                      {league.created_by === userId ? ' · ADMIN' : ''}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ── Global Leaderboard ── */}
        <View style={styles.leaderboardCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>GLOBAL LEADERBOARD</Text>
            <Image source={Icons.trophy} style={[styles.cardHeaderIcon, styles.iconNeon]} />
          </View>

          {loading && !refreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.auth.neon} />
              <Text style={styles.loadingText}>LOADING RANKINGS...</Text>
            </View>
          ) : error ? (
            <View style={styles.emptyContainer}>
              <Image source={Icons.warning} style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>{error.toUpperCase()}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={loadScreenData} activeOpacity={0.8}>
                <Text style={styles.retryButtonText}>RETRY</Text>
              </TouchableOpacity>
            </View>
          ) : leaderboard.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Image source={Icons.bigtrophy} style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>NO RANKINGS YET</Text>
              <Text style={styles.emptySubtext}>
                Be the first to build your team{'\n'}and score points.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.reportHint}>
                TAP VIEW TO SEE THEIR TEAM · LONG-PRESS TO REPORT
              </Text>
              {leaderboard.map((entry) => (
                <LeaderboardItem
                  key={entry.user_id}
                  entry={entry}
                  isCurrentUser={entry.user_id === userId}
                  onViewTeam={() => openViewTeam(entry)}
                  onLongPress={
                    entry.user_id !== userId
                      ? () => handleReportTeamName(entry)
                      : undefined
                  }
                />
              ))}
              {hasMore ? (
                <TouchableOpacity
                  style={[styles.loadMoreButton, loadingMore && styles.loadMoreButtonDisabled]}
                  onPress={loadMoreLeaderboard}
                  disabled={loadingMore}
                  activeOpacity={0.8}
                >
                  {loadingMore ? (
                    <ActivityIndicator color={colors.auth.neon} />
                  ) : (
                    <Text style={styles.loadMoreButtonText}>SHOW MORE</Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>

      <LeagueFormModal
        visible={createVisible}
        title="CREATE PRIVATE LEAGUE"
        label="LEAGUE NAME"
        value={leagueName}
        onChangeText={setLeagueName}
        placeholder="Office League"
        hint="3-30 characters • Letters, numbers & spaces"
        maxLength={30}
        autoCapitalize="words"
        submitLabel="CREATE LEAGUE"
        submitting={submitting}
        onSubmit={handleCreateLeague}
        onClose={closeCreateModal}
      />

      <LeagueFormModal
        visible={joinVisible}
        title="JOIN PRIVATE LEAGUE"
        label="INVITE CODE"
        value={inviteCode}
        onChangeText={(text) => setInviteCode(text.toUpperCase())}
        placeholder="ABC123"
        hint="6-character code from the league admin"
        maxLength={6}
        autoCapitalize="characters"
        autoCorrect={false}
        submitLabel="JOIN LEAGUE"
        submitting={submitting}
        onSubmit={handleJoinLeague}
        onClose={closeJoinModal}
      />
    </>
  );
}

function LeagueFormModal({
  visible,
  title,
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  maxLength,
  autoCapitalize,
  autoCorrect = true,
  submitLabel,
  submitting,
  onSubmit,
  onClose,
}) {
  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          style={styles.modalDismiss}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalLabel}>{label}</Text>
          <TextInput
            style={styles.modalInput}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={colors.auth.placeholder}
            maxLength={maxLength}
            autoCapitalize={autoCapitalize}
            autoCorrect={autoCorrect}
            autoFocus
            editable={!submitting}
          />
          <Text style={styles.modalHint}>{hint}</Text>
          <TouchableOpacity
            style={[styles.modalSubmit, submitting && styles.disabledButton]}
            onPress={onSubmit}
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.modalSubmitText}>{submitLabel}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.modalCancel}
            onPress={onClose}
            disabled={submitting}
          >
            <Text style={styles.modalCancelText}>CANCEL</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },

  header: {
    paddingTop: 56,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.barlowCondensedExtraBoldItalic,
    fontSize: 64,
    color: colors.white,
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: spacing.xxl + 8
  },

  iconNeon: {
    tintColor: colors.auth.neon,
  },

  privateCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.auth.glass,
    borderRadius: borderRadius.large,
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
  },

  myLeaguesList: {
    marginTop: 0,
  },
  myLeaguesEmpty: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 16,
    color: colors.auth.statLabel,
    letterSpacing: 0.3,
    paddingVertical: spacing.sm,
  },
  leagueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.auth.neonSoft,
  },
  leagueRowLast: {
    borderBottomWidth: 0,
  },
  leagueRowInfo: {
    flex: 1,
  },
  leagueRowName: {
    fontFamily: fonts.barlowCondensedSemiBold,
    fontSize: 18,
    color: colors.white,
    marginBottom: 2,
  },
  leagueRowMeta: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 14,
    color: colors.auth.statLabel,
    letterSpacing: 0.5,
  },

  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
    borderRadius: borderRadius.round,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  outlineButtonFirst: {
    marginTop: 0,
  },
  outlineButtonIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
    marginRight: spacing.sm,
  },
  outlineButtonText: {
    flex: 1,
    fontFamily: fonts.barlowCondensedExtraBoldItalic,
    fontSize: 24,
    color: colors.white,
    letterSpacing: 0.5,
  },
  chevron: {
    fontSize: 28,
    color: colors.auth.neon,
    fontWeight: '300',
    lineHeight: 28,
    marginTop: -2,
  },

  leaderboardCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.auth.glass,
    borderRadius: borderRadius.large,
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    marginBottom: spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.auth.neon,
  },
  cardTitle: {
    fontFamily: fonts.barlowCondensedSemiBold,
    fontSize: 20,
    color: colors.white,
    letterSpacing: 0.5,
  },
  cardHeaderIcon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
  },

  loadingContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontFamily: fonts.barlowCondensedMedium,
    fontSize: 14,
    color: colors.auth.statLabel,
    letterSpacing: 1,
  },
  emptyContainer: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
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
  reportHint: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 11,
    color: colors.auth.placeholder,
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  retryButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.medium,
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
  },
  retryButtonText: {
    fontFamily: fonts.barlowCondensedBold,
    fontSize: 14,
    color: colors.auth.neon,
    letterSpacing: 1,
  },
  loadMoreButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.medium,
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
    backgroundColor: 'rgba(0, 174, 239, 0.08)',
    minHeight: 44,
  },
  loadMoreButtonDisabled: {
    opacity: 0.7,
  },
  loadMoreButtonText: {
    fontFamily: fonts.barlowCondensedBold,
    fontSize: 14,
    color: colors.auth.neon,
    letterSpacing: 1,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 11, 24, 0.72)',
    justifyContent: 'flex-end',
  },
  modalDismiss: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: '#0A1A2E',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
    borderBottomWidth: 0,
    padding: spacing.xl,
    paddingBottom: spacing.xl + 20,
  },
  modalTitle: {
    fontFamily: fonts.barlowCondensedExtraBold,
    fontSize: 20,
    color: colors.white,
    letterSpacing: 0.5,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  modalLabel: {
    fontFamily: fonts.barlowCondensedSemiBold,
    fontSize: 13,
    color: colors.auth.statLabel,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  modalInput: {
    backgroundColor: colors.auth.inputBg,
    borderRadius: borderRadius.medium,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: fonts.barlowCondensedSemiBold,
    fontSize: 20,
    color: colors.white,
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
    textAlign: 'center',
  },
  modalHint: {
    fontFamily: fonts.barlowCondensedRegular,
    fontSize: 12,
    color: colors.auth.placeholder,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  modalSubmit: {
    backgroundColor: colors.auth.buttonTop,
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: colors.auth.neon,
    minHeight: 48,
  },
  modalSubmitText: {
    fontFamily: fonts.barlowCondensedExtraBold,
    fontSize: 16,
    color: colors.white,
    letterSpacing: 1,
  },
  disabledButton: {
    opacity: 0.5,
  },
  modalCancel: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  modalCancelText: {
    fontFamily: fonts.barlowCondensedSemiBold,
    fontSize: 14,
    color: colors.auth.placeholder,
    letterSpacing: 1,
  },
});
