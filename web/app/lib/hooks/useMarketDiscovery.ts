'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ProcessedMarket, MarketFilters, PaginationState } from '../market-types';
import { readBlockHeightWarning, readMarketListCache, warmMarketListCache } from '../market-list-cache';

interface UseMarketDiscoveryState {
  // Data
  allMarkets: ProcessedMarket[];
  filteredMarkets: ProcessedMarket[];
  paginatedMarkets: ProcessedMarket[];
  
  // Loading states
  isLoading: boolean;
  error: string | null;
  
  // Non-blocking data freshness warnings
  blockHeightWarning: string | null;

  // Filters and pagination
  filters: MarketFilters;
  pagination: PaginationState;
  
  // Actions
  setSearch: (search: string) => void;
  setStatusFilter: (status: MarketFilters['status']) => void;
  setSortBy: (sortBy: MarketFilters['sortBy']) => void;
  setPage: (page: number) => void;
  retry: () => void;
}

const ITEMS_PER_PAGE = 12;

export function useMarketDiscovery(): UseMarketDiscoveryState {
  // Instant first paint from cached market list.
  const [cacheSnapshot] = useState(() => readMarketListCache());
  const hasFreshInitialCacheRef = useRef(cacheSnapshot.isFresh);
  const hasAnyMarketsRef = useRef(cacheSnapshot.markets.length > 0);

  const [blockHeightWarning, setBlockHeightWarning] = useState<string | null>(() =>
    readBlockHeightWarning()
  );

  // Core data state
  const [allMarkets, setAllMarkets] = useState<ProcessedMarket[]>(cacheSnapshot.markets);
  const [isLoading, setIsLoading] = useState<boolean>(() => !cacheSnapshot.isFresh);
  const [error, setError] = useState<string | null>(null);
  
  // Filter state
  const [filters, setFilters] = useState<MarketFilters>({
    search: '',
    status: 'all',
    sortBy: 'newest'
  });
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch markets data
  const fetchMarkets = useCallback(async (options?: { forceLoading?: boolean }) => {
    const shouldShowLoading =
      options?.forceLoading || !hasFreshInitialCacheRef.current;

    try {
      if (shouldShowLoading) setIsLoading(true);
      setError(null);
      
      const processedMarkets = await warmMarketListCache();
      
      setAllMarkets(processedMarkets);
      hasAnyMarketsRef.current = processedMarkets.length > 0;
      setBlockHeightWarning(readBlockHeightWarning());
    } catch (err) {
      console.error('Failed to fetch markets:', err);

      // Preserve cached markets (if any) on background refresh failures.
      if (hasAnyMarketsRef.current) {
        setError(null);
      } else {
        setError('Failed to load markets. Please try again.');
      }
    } finally {
      setIsLoading(false);
      hasFreshInitialCacheRef.current = true;
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  // Filter and sort markets
  const filteredMarkets = useMemo(() => {
    let filtered = [...allMarkets];

    // Apply search filter
    if (filters.search.trim()) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(market => 
        market.title.toLowerCase().includes(searchLower) ||
        market.description.toLowerCase().includes(searchLower)
      );
    }

    // Apply status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(market => market.status === filters.status);
    }

    // Apply sorting
    switch (filters.sortBy) {
      case 'volume':
        filtered.sort((a, b) => b.totalVolume - a.totalVolume);
        break;
      case 'newest':
        filtered.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'ending-soon':
        filtered.sort((a, b) => {
          // Active markets first, sorted by time remaining
          if (a.status === 'active' && b.status !== 'active') return -1;
          if (b.status === 'active' && a.status !== 'active') return 1;
          
          if (a.status === 'active' && b.status === 'active') {
            const aTime = a.timeRemaining ?? Infinity;
            const bTime = b.timeRemaining ?? Infinity;
            return aTime - bTime;
          }
          
          // For non-active markets, sort by creation time
          return b.createdAt - a.createdAt;
        });
        break;
    }

    return filtered;
  }, [allMarkets, filters]);

  // Calculate pagination
  const pagination = useMemo((): PaginationState => {
    const totalItems = filteredMarkets.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    
    return {
      currentPage,
      itemsPerPage: ITEMS_PER_PAGE,
      totalItems,
      totalPages
    };
  }, [filteredMarkets.length, currentPage]);

  // Get paginated markets
  const paginatedMarkets = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredMarkets.slice(startIndex, endIndex);
  }, [filteredMarkets, currentPage]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.search, filters.status, filters.sortBy]);

  // Action handlers
  const setSearch = useCallback((search: string) => {
    setFilters(prev => ({ ...prev, search }));
  }, []);

  const setStatusFilter = useCallback((status: MarketFilters['status']) => {
    setFilters(prev => ({ ...prev, status }));
  }, []);

  const setSortBy = useCallback((sortBy: MarketFilters['sortBy']) => {
    setFilters(prev => ({ ...prev, sortBy }));
  }, []);

  const setPage = useCallback((page: number) => {
    if (page >= 1 && page <= pagination.totalPages) {
      setCurrentPage(page);
    }
  }, [pagination.totalPages]);

  const retry = useCallback(() => {
    fetchMarkets({ forceLoading: true });
  }, [fetchMarkets]);

  return {
    // Data
    allMarkets,
    filteredMarkets,
    paginatedMarkets,
    
    // Loading states
    isLoading,
    error,
    blockHeightWarning,
    
    // Filters and pagination
    filters,
    pagination,
    
    // Actions
    setSearch,
    setStatusFilter,
    setSortBy,
    setPage,
    retry
  };
}