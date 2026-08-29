// Where the on-screen controls sit on a round screen, and what is under a
// finger.
//
// The board is the square inscribed in the circle, which leaves four segments
// around it - one at each edge, thick in the middle and tapering to nothing at
// the corners. Those segments are dead space on a round watch, and they are
// exactly where the four direction arrows go: the board keeps its whole area,
// and steering never covers the snake.
//
// The top segment carries two things, the score above and the up arrow below it.
// The bottom segment carries the down arrow with the pause control beside it.
//
// All of it is pure geometry, so a test can ask what a tap at a point would do
// without a watch in the room.
import { centeredBox } from "./round-geometry.js";
import { BOARD_EDGE, SCREEN_PADDING } from "../utils/config/constants.js";

export const UP = "up";
export const DOWN = "down";
export const LEFT = "left";
export const RIGHT = "right";
export const PAUSE = "pause";

// How much of a segment a control fills. The arrows are generous - they are the
// thing being aimed at constantly - and everything is kept clear of the bezel.
const ARROW_SPAN = 0.72;
const ARROW_HEIGHT = 0.34;

// How the top segment is split between the score and the up arrow. The score
// does not start at the very top: a round screen is barely 70px across up there,
// and a couple of digits want more than that.
const SCORE_TOP = 0.14;
const SCORE_FILL = 0.35;
const UP_FILL = 0.5;

// The bottom row sits just under the board rather than centred in the segment. A
// round screen narrows fast towards the bottom: centred, the row is only as wide
// as the chord at its lowest edge. Moved up against the board it gets far more
// width to share, and that width is what buys the gap between the two controls.
//
// One pixel clear of the frame drawn around the board, so tightening the frame
// cannot slide the row underneath it.
const ROW_TOP_GAP = BOARD_EDGE + 1;
const ROW_FILL = 0.55;

// The row is not two equal buttons. The down arrow is steering, pressed
// constantly; pause is pressed once or twice a game and is an unwelcome surprise
// mid-run. So the arrow is centred under the board and much the wider of the
// two, pause is pushed out to the end, and what is left between them belongs to
// nobody: a thumb landing wide of the arrow does nothing at all rather than
// stopping the game it was steering.
const DOWN_SHARE = 0.4;
const PAUSE_SHARE = 0.24;

function box(x, y, w, h) {
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}

// Every control, given the screen size and where the board sits on it.
export function controlLayout(screenSize, board) {
  const top = board.y;
  const bottom = screenSize - (board.y + board.size);
  const middle = board.y + board.size / 2;

  // The board is centred to the nearest whole pixel, so on some screens its left
  // and right margins differ by one. The narrower of the two sizes both arrows,
  // and the right one is placed as the mirror image of the left about the middle
  // of the SCREEN - centring each in its own margin instead would leave the pair
  // visibly off-centre by that pixel.
  const side = Math.min(board.x, screenSize - (board.x + board.size));
  const armWidth = Math.round(side * ARROW_SPAN);
  const armHeight = Math.round(board.size * ARROW_HEIGHT);

  const scoreHeight = Math.round(top * SCORE_FILL);
  const scoreTop = Math.round(top * SCORE_TOP);
  const scoreRow = centeredBox(screenSize, scoreTop, scoreHeight, board.size, SCREEN_PADDING);

  // The up arrow stops clear of the frame drawn around the board. Its box is
  // wiped to the background before the chevron is painted, so a box that reached
  // the frame would rub the frame's top edge out on every press.
  const upTop = scoreTop + scoreHeight;
  const upHeight = Math.min(Math.round(top * UP_FILL), top - BOARD_EDGE - 1 - upTop);
  const upRow = centeredBox(screenSize, upTop, upHeight, board.size * 0.5, SCREEN_PADDING);

  const rowHeight = Math.round(bottom * ROW_FILL);
  const rowTop = board.y + board.size + ROW_TOP_GAP;
  const row = centeredBox(screenSize, rowTop, rowHeight, board.size, SCREEN_PADDING);
  const downWidth = Math.round(row.w * DOWN_SHARE);
  const pauseWidth = Math.round(row.w * PAUSE_SHARE);
  const armLeft = Math.round((side - armWidth) / 2);

  return {
    board: box(board.x, board.y, board.size, board.size),
    score: box(scoreRow.x, scoreRow.y, scoreRow.w, scoreRow.h),
    up: box(upRow.x, upRow.y, upRow.w, upRow.h),
    down: box(row.x + (row.w - downWidth) / 2, row.y, downWidth, row.h),
    pause: box(row.x + row.w - pauseWidth, row.y, pauseWidth, row.h),
    left: box(armLeft, middle - armHeight / 2, armWidth, armHeight),
    right: box(screenSize - armLeft - armWidth, middle - armHeight / 2, armWidth, armHeight),
  };
}

function inside(area, x, y) {
  return x >= area.x && x < area.x + area.w && y >= area.y && y < area.y + area.h;
}

// What a touch at this point is aimed at, or null for the dead space between
// controls and for the board itself, which takes no taps in this game.
export function hitTest(layout, x, y) {
  if (inside(layout.up, x, y)) {
    return UP;
  }
  if (inside(layout.down, x, y)) {
    return DOWN;
  }
  if (inside(layout.left, x, y)) {
    return LEFT;
  }
  if (inside(layout.right, x, y)) {
    return RIGHT;
  }
  if (inside(layout.pause, x, y)) {
    return PAUSE;
  }
  return null;
}
