import { createContext, useContext, useState, useEffect } from 'react';

const AccessibilityContext = createContext(null);

export function AccessibilityProvider({ children }) {
  const [isDyslexic, setIsDyslexic] = useState(() => {
    return localStorage.getItem('hvhn_a11y_dyslexia') === 'true';
  });

  const [isHighContrast, setIsHighContrast] = useState(() => {
    return localStorage.getItem('hvhn_a11y_high_contrast') === 'true';
  });

  const [isLargeText, setIsLargeText] = useState(() => {
    return localStorage.getItem('hvhn_a11y_large_text') === 'true';
  });

  useEffect(() => {
    // Sync localStorage
    localStorage.setItem('hvhn_a11y_dyslexia', isDyslexic);
    localStorage.setItem('hvhn_a11y_high_contrast', isHighContrast);
    localStorage.setItem('hvhn_a11y_large_text', isLargeText);

    // Update body classes
    const body = document.body;
    
    if (isDyslexic) body.classList.add('dyslexia');
    else body.classList.remove('dyslexia');

    if (isHighContrast) body.classList.add('high-contrast');
    else body.classList.remove('high-contrast');

    if (isLargeText) body.classList.add('large-text');
    else body.classList.remove('large-text');

  }, [isDyslexic, isHighContrast, isLargeText]);

  const toggleDyslexia = () => setIsDyslexic(prev => !prev);
  const toggleHighContrast = () => setIsHighContrast(prev => !prev);
  const toggleLargeText = () => setIsLargeText(prev => !prev);

  return (
    <AccessibilityContext.Provider value={{
      isDyslexic, toggleDyslexia,
      isHighContrast, toggleHighContrast,
      isLargeText, toggleLargeText
    }}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) throw new Error('useAccessibility must be used within an AccessibilityProvider');
  return ctx;
}
