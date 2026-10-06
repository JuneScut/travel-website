'use client';
import { createContext, useContext } from 'react';
export const TripContext = createContext([]);
export const useTrips = () => useContext(TripContext);
