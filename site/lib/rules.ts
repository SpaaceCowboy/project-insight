// Port of app/src/main/java/com/insightpuzzle/app/Rules.kt. A board is a list of rows; '.' is a hole.
export type Level = { n: number; name: string; start: string[]; target: string[]; par: number }

export const MOVES: Record<string, [number, number][]> = {
  R: [[-1, 0], [1, 0]],
  B: [[0, -1], [0, 1]],
  G: [[-1, 1], [1, -1]],
  Y: [[-1, -1], [1, 1]],
  P: [[-2, 0], [2, 0], [0, -2], [0, 2]],
  W: [],
}

export const active = (board: string[], r: number, c: number) =>
  r >= 0 && r < board.length && c >= 0 && c < board[r].length && board[r][c] !== '.'

/** Cells the tile at (r, c) can swap with: its own directions, onto another tile. */
export function legalMoves(board: string[], r: number, c: number): [number, number][] {
  if (!active(board, r, c)) return []
  return MOVES[board[r][c]].map(([dr, dc]): [number, number] => [r + dr, c + dc]).filter(([nr, nc]) => active(board, nr, nc))
}

export function swap(board: string[], a: [number, number], b: [number, number]): string[] {
  const rows = board.map((row) => [...row])
  ;[rows[a[0]][a[1]], rows[b[0]][b[1]]] = [rows[b[0]][b[1]], rows[a[0]][a[1]]]
  return rows.map((row) => row.join(''))
}
