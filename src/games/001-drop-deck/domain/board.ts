export const BOARD_COLS = 8;
export const BOARD_ROWS = 16;

export type Cell = { readonly id: number } | null;

export type Board = readonly (readonly Cell[])[];

export interface RunState {
  readonly board: Board;
  readonly activeColumn: number;
  readonly status: "running" | "ended";
  readonly committedCells: number;
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
  activeColumn: 4,
  status: "running",
  committedCells: 0,
});

// Intentionally not implemented — tests should fail until GREEN
export const place = (_state: RunState, _column: number): DropResult => {
  throw new Error("place: not implemented");
};
