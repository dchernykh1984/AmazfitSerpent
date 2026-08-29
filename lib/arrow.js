// The control icons, as stroke primitives.
//
// Everything here is built from lines, and that is deliberate. The canvas also
// offers `drawPoly`, and the sibling Sokoban app found it accepted without
// complaint on a real watch and then drawing nothing at all - its arrows were
// simply missing on hardware while every line-drawn icon appeared. Lines are the
// primitive that is known to work, so a chevron is two thick strokes rather than
// a filled triangle.
//
// Pure: the page executes what these return, and a test can ask what an arrow
// looks like without a screen in the room.
import { DOWN, LEFT, RIGHT, UP } from "./controls.js";

// How thick a stroke is, and how far an arrow reaches from its centre, both as
// fractions of the smallest control.
const STROKE_RATIO = 0.14;
const REACH_RATIO = 0.42;
const MIN_STROKE = 2;

// One size shared by every arrow, so the four read as one set of controls rather
// than as four unrelated marks. The smallest box decides, so the shared size
// always fits every one of them, stroke included.
export function arrowMetrics(boxes) {
  let shortest = Infinity;
  // How far a centre can travel before it leaves the tightest box. Measured from
  // the centre the arrow is actually drawn around, which is rounded to a whole
  // pixel and so is not exactly half way across an odd-sized box.
  let room = Infinity;

  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i];
    shortest = Math.min(shortest, box.w, box.h);
    const midX = Math.round(box.x + box.w / 2);
    const midY = Math.round(box.y + box.h / 2);
    room = Math.min(room, midX - box.x, box.x + box.w - midX, midY - box.y, box.y + box.h - midY);
  }
  if (!isFinite(shortest) || shortest <= 0 || room <= 0) {
    return { reach: 0, width: 0 };
  }

  const width = Math.max(MIN_STROKE, Math.round(shortest * STROKE_RATIO));
  // Half the stroke hangs outside the endpoint it is drawn from, so the reach has
  // to leave room for it or the arrow overhangs its box - and both are whole
  // pixels, because the endpoints are rounded before they are drawn.
  const reach = Math.max(0, Math.floor(Math.min(shortest * REACH_RATIO, room - width / 2)));
  return { reach, width };
}

function stroke(from, to, width, color) {
  return {
    op: "line",
    x1: Math.round(from[0]),
    y1: Math.round(from[1]),
    x2: Math.round(to[0]),
    y2: Math.round(to[1]),
    width,
    color,
  };
}

// An arrow, drawn as a chevron: two thick strokes meeting at the tip.
export function arrowStrokes(direction, area, color, metrics) {
  const size = metrics || arrowMetrics([area]);
  const reach = size.reach;
  if (reach <= 0) {
    return [];
  }
  const midX = Math.round(area.x + area.w / 2);
  const midY = Math.round(area.y + area.h / 2);

  let tip;
  let armA;
  let armB;
  if (direction === UP) {
    tip = [midX, midY - reach];
    armA = [midX - reach, midY + reach];
    armB = [midX + reach, midY + reach];
  } else if (direction === DOWN) {
    tip = [midX, midY + reach];
    armA = [midX - reach, midY - reach];
    armB = [midX + reach, midY - reach];
  } else if (direction === LEFT) {
    tip = [midX - reach, midY];
    armA = [midX + reach, midY - reach];
    armB = [midX + reach, midY + reach];
  } else if (direction === RIGHT) {
    tip = [midX + reach, midY];
    armA = [midX - reach, midY - reach];
    armB = [midX - reach, midY + reach];
  } else {
    return [];
  }

  return [stroke(armA, tip, size.width, color), stroke(tip, armB, size.width, color)];
}

// Pause: the two upright bars everything else in the world uses for it. Drawn at
// the same stroke weight as the arrows, because it sits in the same row and a
// hairline icon beside a thick chevron looks like a different app drew it.
export function pauseStrokes(area, color, metrics) {
  const size = metrics || arrowMetrics([area]);
  const reach = size.reach;
  if (reach <= 0) {
    return [];
  }
  const midX = Math.round(area.x + area.w / 2);
  const midY = Math.round(area.y + area.h / 2);
  const gap = Math.max(size.width, Math.round(reach * 0.55));

  return [
    stroke([midX - gap, midY - reach], [midX - gap, midY + reach], size.width, color),
    stroke([midX + gap, midY - reach], [midX + gap, midY + reach], size.width, color),
  ];
}
