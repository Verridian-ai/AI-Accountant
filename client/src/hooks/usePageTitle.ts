import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { pageTitles } from '../routes';

/**
 * Sets document.title based on the current route.
 * Returns the current page title for use in components like HeaderBar.
 */
export function usePageTitle(): string {
  const { pathname } = useLocation();

  // Match exact path first, then try prefix match for nested routes
  const title =
    pageTitles[pathname] ??
    pageTitles[Object.keys(pageTitles).find((p) => p !== '/' && pathname.startsWith(p)) ?? ''] ??
    'GoldLedger';

  useEffect(() => {
    document.title = `GoldLedger - ${title}`;
  }, [title]);

  return title;
}
