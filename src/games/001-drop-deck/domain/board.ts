export const BOARD_COLS = 8;
export const BOARD_ROWS = 16;
const CENTER_COL = 4;

export type Cell = { readonly id: number } | null;

export type Board = readonly (readonly Cell[])[];

export interface RunState {
  readonly board: Board;
  readonly activeColumn: number;
  readonly status: "running" | "ended";
  readonly committedCells: number;
  readonly nextCellId: number;
}

export interface DropResult {
  readonly state: RunState;
  readonly toppedOut: boolean;
}

const emptyBoard = (): Board => {
  const rows: Cell[][] = [];
  for (let r = 0; r < BOARD_ROWS; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < BOARD_COLS; c++) {
      row.push(null);
    }
    rows.push(row);
  }
  return rows;
};

export const makeRunState = (): RunState => ({
  board: emptyBoard(),
  activeColumn: CENTER_COL,
  status: "running",
  committedCells: 0,
  nextCellId: 1,
});

export const place = (state: RunState, column: number): DropResult => {
  // No-op after top-out
  if (state.status === "ended") {
    return { state, toppedOut: false };
  }

  // Guard: out-of-range column — treat as no-op (not a top-out)
  if (column < 0 || column >= BOARD_COLS) {
    return { state, toppedOut: false };
  }

  // Top-out: row 0 of the target column is already occupied
  const topRow = state.board[0];
  if (topRow !== undefined && topRow[column] !== null) {
    return {
      state: { ...state, status: "ended" },
      toppedOut: true,
    };
  }

  // Find lowest empty row in the target column
  let targetRow = -1;
  for (let r = BOARD_ROWS - 1; r >= 0; r--) {
    if (state.board[r]?.[column] === null) {
      targetRow = r;
      break;
    }
  }

  // All rows occupied → top-out (row 0 was occupied, already caught above;
  // this handles the case where the loop found no empty row somehow)
  if (targetRow === -1) {
    return {
      state: { ...state, status: "ended" },
      toppedOut: true,
    };
  }

  // Place the cell
  const cellId = state.nextCellId;
  const newBoard = state.board.map((row, r) =>
    r === targetRow
      ? row.map((cell, c) =>
          c === column ? ({ id: cellId } satisfies Cell) : cell,
        )
      : row,
  ) as Board;

  return {
    state: {
      board: newBoard,
      activeColumn: CENTER_COL,
      status: "running",
      committedCells: state.committedCells + 1,
      nextCellId: cellId + 1,
    },
    toppedOut: false,
  };
};
