import { useEffect, useId, useRef, useState } from 'react';
import { searchLocationSuggestions } from '../services/locationSearch';

const SEARCH_DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

export default function LocationAutocompleteInput({
  name,
  value,
  placeholder,
  className = 'form-input',
  required = false,
  disabled = false,
  type = '',
  onValueChange,
  onSuggestionSelect,
}) {
  const listboxId = useId();
  const containerRef = useRef(null);
  const shouldSearchRef = useRef(false);
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);

  const trimmedValue = String(value || '').trim();

  useEffect(() => {
    function handleClickOutside(event) {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (disabled) {
      shouldSearchRef.current = false;
      setSuggestions([]);
      setIsLoading(false);
      setIsOpen(false);
      setHasSearched(false);
      setErrorMessage('');
      setActiveIndex(-1);
      return;
    }

    if (trimmedValue.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setIsLoading(false);
      setHasSearched(false);
      setErrorMessage('');
      setIsOpen(false);
      return;
    }

    if (!shouldSearchRef.current) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsLoading(true);
      setHasSearched(true);
      setErrorMessage('');

      try {
        const nextSuggestions = await searchLocationSuggestions(trimmedValue, controller.signal, type);
        setSuggestions(nextSuggestions);
        setActiveIndex(nextSuggestions.length > 0 ? 0 : -1);
        setIsOpen(true);
      } catch (error) {
        if (error.name !== 'AbortError') {
          setSuggestions([]);
          setErrorMessage(error.message || 'Could not load location suggestions right now.');
          setIsOpen(true);
        }
      } finally {
        setIsLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [disabled, trimmedValue]);

  function handleInputChange(event) {
    shouldSearchRef.current = true;
    setSuggestions([]);
    setHasSearched(false);
    setErrorMessage('');
    setActiveIndex(-1);
    onValueChange(event.target.value);
    setIsOpen(true);
  }

  function handleSuggestionClick(suggestion) {
    shouldSearchRef.current = false;
    onValueChange(suggestion.displayName);
    onSuggestionSelect?.(suggestion);
    setSuggestions([]);
    setIsOpen(false);
    setHasSearched(false);
    setErrorMessage('');
    setActiveIndex(-1);
  }

  const shouldShowDropdown = isOpen && (
    isLoading
    || Boolean(errorMessage)
    || suggestions.length > 0
    || (hasSearched && trimmedValue.length >= MIN_QUERY_LENGTH)
  );

  return (
    <div ref={containerRef} className="location-autocomplete">
      <input
        type="text"
        name={name}
        className={className}
        placeholder={placeholder}
        value={value}
        onChange={handleInputChange}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && suggestions.length > 0) {
            event.preventDefault();
            setIsOpen(true);
            setActiveIndex((current) => (current + 1) % suggestions.length);
          } else if (event.key === 'ArrowUp' && suggestions.length > 0) {
            event.preventDefault();
            setIsOpen(true);
            setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
          } else if (event.key === 'Enter' && isOpen && activeIndex >= 0 && suggestions[activeIndex]) {
            event.preventDefault();
            handleSuggestionClick(suggestions[activeIndex]);
          } else if (event.key === 'Escape') {
            setIsOpen(false);
          }
        }}
        onFocus={() => {
          if (suggestions.length > 0 || isLoading || hasSearched || errorMessage) {
            setIsOpen(true);
          }
        }}
        autoComplete="off"
        required={required}
        disabled={disabled}
        role="combobox"
        aria-expanded={shouldShowDropdown}
        aria-controls={listboxId}
        aria-autocomplete="list"
      />

      {shouldShowDropdown && (
        <div id={listboxId} className="location-autocomplete-dropdown" role="listbox">
          {isLoading ? (
            <div className="location-autocomplete-state">Searching locations...</div>
          ) : errorMessage ? (
            <div className="location-autocomplete-state">{errorMessage}</div>
          ) : suggestions.length > 0 ? (
            suggestions.map((suggestion, index) => (
              <button
                key={suggestion.placeId}
                type="button"
                className={`location-autocomplete-option ${index === activeIndex ? 'is-active' : ''}`}
                onClick={() => handleSuggestionClick(suggestion)}
                onMouseEnter={() => setActiveIndex(index)}
                role="option"
                aria-selected={index === activeIndex}
              >
                <div className="location-autocomplete-option-row">
                  <strong>{suggestion.displayName}</strong>
                  <span className="location-autocomplete-badge">Verified</span>
                </div>
                <span className="location-autocomplete-meta">
                  OpenStreetMap result
                </span>
              </button>
            ))
          ) : (
            <div className="location-autocomplete-state">No verified locations found.</div>
          )}
        </div>
      )}
    </div>
  );
}
