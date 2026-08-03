// Pure board geometry: where the playing grid sits on a round screen and where a
// single grid cell lands in pixels. Free of any Zepp OS dependency so it is unit
// tested; the page turns these boxes into widgets.

// The playing field is the largest axis-aligned square that fits inside the round
// screen (side = diameter / sqrt(2)), shrunk to a whole number of equal cells so
// no cell is a pixel wider than its neighbour. Centring that square leaves a
// circular cap above and below it, which the page uses for the score and the
// pause button.
export function boardLayout(screenSize, cells) {
  const columns = Math.max(1, Math.floor(cells));
  const inscribed = Math.floor(screenSize / Math.SQRT2);
  const cell = Math.max(1, Math.floor(inscribed / columns));
  const size = cell * columns;
  const origin = Math.round((screenSize - size) / 2);
  return { cell, size, x: origin, y: origin, cells: columns };
}

// The pixel box of grid cell (column, row), inset on every side so neighbouring
// cells read as separate segments rather than one solid bar. The inset is capped
// at a third of the cell so a small cell can never collapse to nothing.
export function cellRect(board, column, row, inset) {
  const gap = Math.max(0, Math.min(inset, Math.floor(board.cell / 3)));
  return {
    x: board.x + column * board.cell + gap,
    y: board.y + row * board.cell + gap,
    w: board.cell - 2 * gap,
    h: board.cell - 2 * gap,
  };
}
