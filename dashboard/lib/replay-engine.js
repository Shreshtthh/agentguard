/**
 * Replay Engine — Timer-based event replayer for demo mode.
 * Plays back pre-captured events from demo-data.json at recorded intervals.
 */

export function startReplay(demoData, onUpdate, onComplete) {
  if (!demoData || !demoData.timeline || demoData.timeline.length === 0) {
    console.warn("[Replay] No timeline data found");
    onComplete?.();
    return;
  }

  let i = 0;
  let cancelled = false;

  // Emit initial state
  if (demoData.initialState) {
    onUpdate({
      type: "state_update",
      data: demoData.initialState,
    });
  }

  function playNext() {
    if (cancelled || i >= demoData.timeline.length) {
      onComplete?.();
      return;
    }

    const event = demoData.timeline[i];
    const delay = event.delay || 500;

    setTimeout(() => {
      if (cancelled) return;
      onUpdate(event);
      i++;
      playNext();
    }, delay);
  }

  playNext();

  // Return cancel function
  return () => {
    cancelled = true;
  };
}
