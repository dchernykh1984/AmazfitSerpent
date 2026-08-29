// Records what the page asked of the screen, so a test can check the bright time
// is set while the app is open and handed back when it closes.
const state = { brightTime: 0, reset: 0 };

export function display() {
  return state;
}

export function setPageBrightTime(options) {
  state.brightTime = options.brightTime;
  return 0;
}

export function resetPageBrightTime() {
  state.reset += 1;
  return 0;
}
