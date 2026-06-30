import React, { useState, useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';

interface LiveTimerProps {
  status: 'CHECKED_IN' | 'CHECKED_OUT';
  checkInTimestamp: number | null;
}

export const LiveTimer: React.FC<LiveTimerProps> = ({ status, checkInTimestamp }) => {
  const [timerDisplay, setTimerDisplay] = useState('0h 0m 0s');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (status === 'CHECKED_IN' && checkInTimestamp) {
      // Run immediately on render
      updateTimer(checkInTimestamp);
      
      // Setup the interval to run every second
      interval = setInterval(() => {
        updateTimer(checkInTimestamp);
      }, 1000);
      
    } else {
      setTimerDisplay('0h 0m 0s');
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status, checkInTimestamp]);

  const updateTimer = (startTimestamp: number) => {
    const diff = Date.now() - startTimestamp;
    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);
    setTimerDisplay(`${h}h ${m}m ${s}s`);
  };

  return <Text style={styles.bentoValue}>{timerDisplay}</Text>;
};

const styles = StyleSheet.create({
  bentoValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
  },
});
