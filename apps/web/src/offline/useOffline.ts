import { useSyncExternalStore } from 'react';
import { getSyncState, subscribeSync } from './sync';

export const useOffline = () => useSyncExternalStore(subscribeSync, getSyncState, getSyncState);
