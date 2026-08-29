// The swipe gestures, and a way for a test to perform one.
export const GESTURE_UP = "up";
export const GESTURE_DOWN = "down";
export const GESTURE_LEFT = "left";
export const GESTURE_RIGHT = "right";

let handler = null;

export function onGesture(options) {
  handler = options.callback;
}

export function offGesture() {
  handler = null;
}

// Performs a swipe and reports what the page did with it. Returning true means
// the page swallowed it, which is how the system back-swipe is blocked.
export function swipe(gesture) {
  return handler ? handler(gesture) : null;
}

export function listening() {
  return handler !== null;
}
