export const BOARD_COLS = 8;
export const BOARD_ROWS = 16;
export const SPAWN_COL = 4;

export type Cell = {
  readonly id: number;
  readonly kind?: "block" | "garbage";
} | null;

export type Board = readonly (readonly Cell[])[];

export const emptyBoard = (): Board => {
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
