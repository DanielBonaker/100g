export type Cell = { readonly id: number } | null;

export type Board = readonly (readonly Cell[])[];
