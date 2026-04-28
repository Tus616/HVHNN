import { useState, useCallback } from 'react';

const STORAGE_KEY = 'hvhn_bookmarks';

function loadBookmarks() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveBookmarks(ids) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

/**
 * Hook for managing bookmarked/saved request IDs in localStorage.
 * No backend dependency — fully client-side.
 */
export default function useBookmarks() {
  const [bookmarks, setBookmarks] = useState(loadBookmarks);

  const isBookmarked = useCallback((requestId) => {
    return bookmarks.includes(String(requestId));
  }, [bookmarks]);

  const toggleBookmark = useCallback((requestId) => {
    const id = String(requestId);
    setBookmarks((prev) => {
      const next = prev.includes(id)
        ? prev.filter((b) => b !== id)
        : [id, ...prev];
      saveBookmarks(next);
      return next;
    });
  }, []);

  const removeBookmark = useCallback((requestId) => {
    const id = String(requestId);
    setBookmarks((prev) => {
      const next = prev.filter((b) => b !== id);
      saveBookmarks(next);
      return next;
    });
  }, []);

  const clearBookmarks = useCallback(() => {
    setBookmarks([]);
    saveBookmarks([]);
  }, []);

  return { bookmarks, isBookmarked, toggleBookmark, removeBookmark, clearBookmarks };
}
