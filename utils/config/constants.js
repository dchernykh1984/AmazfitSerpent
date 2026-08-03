// The playing grid. Fifteen cells across the inscribed square gives roughly 21px
// cells on a 466px screen: chunky enough to read at a glance on the wrist, and a
// board long enough that a good game lasts.
export const GRID_CELLS = 15;

// Pixels trimmed off each side of a cell so the body reads as segments.
export const CELL_INSET = 1;

// Colors drawn on the (black) watch screen.
export const COLOR_BACKGROUND = 0x000000;
export const COLOR_BOARD = 0x0c1013;
export const COLOR_BOARD_EDGE = 0x2b3339;
export const COLOR_SNAKE = 0x2fbf71;
export const COLOR_SNAKE_HEAD = 0x8ff0b4;
export const COLOR_FOOD = 0xff5a3c;
export const COLOR_TEXT = 0xffffff;
export const COLOR_MUTED = 0x9aa4ab;
export const COLOR_BUTTON = 0x1d262c;
export const COLOR_BUTTON_PRESSED = 0x2f3d46;

// The thickness of the frame drawn around the board, and the padding kept
// between any centred text or button and the bezel.
export const BOARD_EDGE = 3;
export const SCREEN_PADDING = 8;

// How long the screen stays lit while the app is open. A game is played in short
// bursts but a ten-second display timeout would black out mid-run, so the page
// asks for ten minutes and hands the setting back when it closes.
export const BRIGHT_TIME_MS = 600000;
