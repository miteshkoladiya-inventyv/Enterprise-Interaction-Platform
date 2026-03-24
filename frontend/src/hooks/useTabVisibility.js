import { useState, useEffect } from "react";

/**
 * useTabVisibility Hook
 * Detects if the current browser tab is active/focused
 * Uses browser Visibility API + window focus/blur events for accurate detection
 */
export const useTabVisibility = () => {
  // Initialize based on current document state AND window focus
  const [isTabActive, setIsTabActive] = useState(
    !document.hidden && document.hasFocus()
  );
  const [isPageVisible, setIsPageVisible] = useState(!document.hidden);

  useEffect(() => {
    // Handler for visibility change (tab becomes hidden/visible)
    const handleVisibilityChange = () => {
      const hidden = document.hidden;
      setIsPageVisible(!hidden);
      setIsTabActive(!hidden && document.hasFocus());

      const status = hidden ? "HIDDEN" : "VISIBLE";
      console.log(`[TAB_VISIBILITY] Page visibility changed to: ${status}`);
    };

    // Handler for focus (tab gains focus)
    const handleFocus = () => {
      console.log("[TAB_VISIBILITY] Window gained focus");
      setIsTabActive(true);
      setIsPageVisible(true);
    };

    // Handler for blur (tab loses focus)
    const handleBlur = () => {
      console.log("[TAB_VISIBILITY] Window lost focus");
      setIsTabActive(false);
    };

    // Add event listeners
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    // Cleanup on unmount
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  return {
    isTabActive,
    isPageVisible,
  };
};

export default useTabVisibility;
