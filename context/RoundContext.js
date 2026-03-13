import React, { createContext, useContext, useState, useEffect } from 'react';
import * as roundService from '../services/roundService';

// Create context
const RoundContext = createContext();

/**
 * Hook to use the Round context
 */
export const useRound = () => {
  const context = useContext(RoundContext);
  if (!context) {
    throw new Error('useRound must be used within a RoundProvider');
  }
  return context;
};

/**
 * Round Provider Component
 * Manages current gameweek state, deadline tracking, and round locking
 */
export const RoundProvider = ({ children }) => {
  const [currentRound, setCurrentRound] = useState(null);
  const [allRounds, setAllRounds] = useState([]);
  const [isLocked, setIsLocked] = useState(false);
  const [timeToDeadline, setTimeToDeadline] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load current round on mount and set up auto-refresh
  useEffect(() => {
    loadCurrentRound();
    
    // Refresh every minute to check deadline status
    const interval = setInterval(() => {
      loadCurrentRound();
      updateTimeToDeadline();
    }, 60000); // 60 seconds
    
    return () => clearInterval(interval);
  }, []);

  // Update time to deadline every second for countdown
  useEffect(() => {
    if (currentRound && !isLocked) {
      updateTimeToDeadline();
      
      // Update countdown every second
      const interval = setInterval(updateTimeToDeadline, 1000);
      
      return () => clearInterval(interval);
    }
  }, [currentRound, isLocked]);

  /**
   * Load the current active or upcoming round
   */
  const loadCurrentRound = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await roundService.fetchCurrentRound();
      
      if (fetchError) {
        console.error('Error loading current round:', fetchError);
        setError(fetchError);
        return;
      }
      
      setCurrentRound(data);
      
      // Update locked status
      if (data) {
        const locked = roundService.isRoundLocked(data);
        setIsLocked(locked);
        
        // Update time to deadline
        if (!locked) {
          const time = roundService.getTimeToDeadline(data);
          setTimeToDeadline(time);
        } else {
          setTimeToDeadline(null);
        }
      }
    } catch (err) {
      console.error('Error in loadCurrentRound:', err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Load all rounds for history view
   */
  const loadAllRounds = async () => {
    try {
      const { data, error: fetchError } = await roundService.fetchAllRounds();
      
      if (fetchError) {
        console.error('Error loading all rounds:', fetchError);
        return;
      }
      
      setAllRounds(data || []);
    } catch (err) {
      console.error('Error in loadAllRounds:', err);
    }
  };

  /**
   * Update the countdown timer
   */
  const updateTimeToDeadline = () => {
    if (currentRound && !isLocked) {
      const time = roundService.getTimeToDeadline(currentRound);
      setTimeToDeadline(time);
      
      // If time is null, deadline has passed - update locked status
      if (time === null) {
        setIsLocked(true);
      }
    }
  };

  /**
   * Manually refresh current round data
   */
  const refreshRound = async () => {
    await loadCurrentRound();
  };

  /**
   * Get a specific round by ID
   */
  const getRound = async (roundId) => {
    try {
      const { data, error: fetchError } = await roundService.getRoundById(roundId);
      
      if (fetchError) {
        console.error('Error fetching round:', fetchError);
        return null;
      }
      
      return data;
    } catch (err) {
      console.error('Error in getRound:', err);
      return null;
    }
  };

  /**
   * Get the status of a round
   */
  const getRoundStatus = (round) => {
    return roundService.getRoundStatus(round);
  };

  /**
   * Format a deadline for display
   */
  const formatDeadline = (deadline) => {
    return roundService.formatDeadline(deadline);
  };

  /**
   * Check if a specific round is locked
   */
  const checkIsRoundLocked = (round) => {
    return roundService.isRoundLocked(round);
  };

  // Context value
  const value = {
    // State
    currentRound,
    allRounds,
    isLocked,
    timeToDeadline,
    isLoading,
    error,

    // Functions
    loadCurrentRound,
    loadAllRounds,
    refreshRound,
    getRound,
    getRoundStatus,
    formatDeadline,
    checkIsRoundLocked,
  };

  return <RoundContext.Provider value={value}>{children}</RoundContext.Provider>;
};
