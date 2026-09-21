export type Vec3 = readonly [number, number, number];
export type Face = 'F' | 'R' | 'U' | 'D' | 'L' | 'B';
export type Color = 'red' | 'green' | 'yellow' | 'white' | 'blue' | 'orange';
export type Axis = 0 | 1 | 2;
export type Move = { face: Face | 'Y'; turns: 1 | -1 | 2 };
export type Sticker = {
  id: string;
  position: Vec3;
  normal: Vec3;
  color: Color;
};
export type Cube = readonly Sticker[];
export type Preset = 'solved' | 'random' | 'cross' | 'f2l';

export const FACES: Face[] = ['F', 'R', 'U', 'D', 'L', 'B'];
export const NORMALS: Record<Face, Vec3> = {
  F: [0, 0, 1],
  R: [1, 0, 0],
  U: [0, 1, 0],
  D: [0, -1, 0],
  L: [-1, 0, 0],
  B: [0, 0, -1],
};
export const FACE_COLORS: Record<Face, Color> = {
  F: 'red',
  R: 'green',
  U: 'yellow',
  D: 'white',
  L: 'blue',
  B: 'orange',
};
export const COLORS: Record<Color, string> = {
  red: '#e74453',
  green: '#26ad77',
  yellow: '#f6d64b',
  white: '#f7f8f3',
  blue: '#4284e5',
  orange: '#fb9143',
};
export const COLOR_NAMES: Record<Color, string> = {
  red: '빨강',
  green: '초록',
  yellow: '노랑',
  white: '흰색',
  blue: '파랑',
  orange: '주황',
};

export function equal(a: Vec3, b: Vec3): boolean {
  return a.every((value, axis) => value === b[axis]);
}

export function solvedCube(): Cube {
  return FACES.flatMap((face) => {
    const normal = NORMALS[face];
    const axis = normal.findIndex((value) => value !== 0);
    const result: Sticker[] = [];
    for (let a = -1; a <= 1; a++) {
      for (let b = -1; b <= 1; b++) {
        const position: [number, number, number] = [...normal];
        position[(axis + 1) % 3] = a;
        position[(axis + 2) % 3] = b;
        result.push({
          id: `${face}:${a}:${b}`,
          position,
          normal,
          color: FACE_COLORS[face],
        });
      }
    }
    return result;
  });
}

// Right-handed rotation; angles remain continuous for rendering, integral for state.
export function rotate(vector: Vec3, axis: Axis, angle: number): Vec3 {
  const next: [number, number, number] = [...vector];
  const a = (axis + 1) % 3;
  const b = (axis + 2) % 3;
  next[a] = vector[a] * Math.cos(angle) - vector[b] * Math.sin(angle);
  next[b] = vector[a] * Math.sin(angle) + vector[b] * Math.cos(angle);
  return next;
}

export function rotation(move: Move): {
  axis: Axis;
  layer: number | null;
  angle: number;
} {
  if (move.face === 'Y')
    return { axis: 1, layer: null, angle: (-move.turns * Math.PI) / 2 };
  const normal = NORMALS[move.face];
  const axis = normal.findIndex((value) => value !== 0) as Axis;
  return {
    axis,
    layer: normal[axis],
    angle: (-normal[axis] * move.turns * Math.PI) / 2,
  };
}

export function applyMove(cube: Cube, move: Move): Cube {
  const { axis, layer, angle } = rotation(move);
  const integerRotation = (vector: Vec3): Vec3 =>
    rotate(vector, axis, angle).map(
      (value) => Math.round(value) || 0,
    ) as unknown as Vec3;
  return cube.map((sticker) =>
    layer === null || sticker.position[axis] === layer
      ? {
          ...sticker,
          position: integerRotation(sticker.position),
          normal: integerRotation(sticker.normal),
        }
      : sticker,
  );
}

export function inverse(move: Move): Move {
  return { ...move, turns: move.turns === 2 ? 2 : move.turns === 1 ? -1 : 1 };
}

export function applyMoves(cube: Cube, moves: readonly Move[]): Cube {
  return moves.reduce(applyMove, cube);
}

export function notation(move: Move): string {
  if (move.face === 'Y') return move.turns === 1 ? '←' : '→';
  return move.face + (move.turns === -1 ? "'" : move.turns === 2 ? '2' : '');
}

export function centerColor(cube: Cube, face: Face): Color {
  return cube.find(
    (s) => equal(s.normal, NORMALS[face]) && equal(s.position, NORMALS[face]),
  )!.color;
}

export function isSolved(cube: Cube): boolean {
  return FACES.every((face) =>
    cube
      .filter((s) => equal(s.normal, NORMALS[face]))
      .every((s) => s.color === centerColor(cube, face)),
  );
}

export function hasWhiteCross(cube: Cube): boolean {
  return (
    cube
      .filter(
        (s) =>
          s.position[1] === -1 &&
          Math.abs(s.position[0]) + Math.abs(s.position[2]) <= 1,
      )
      .every(
        (s) =>
          s.color ===
          centerColor(
            cube,
            FACES.find((face) => equal(s.normal, NORMALS[face]))!,
          ),
      ) && centerColor(cube, 'D') === 'white'
  );
}

export function hasFirstTwoLayers(cube: Cube): boolean {
  return (
    cube
      .filter((s) => s.position[1] < 1)
      .every(
        (s) =>
          s.color ===
          centerColor(
            cube,
            FACES.find((face) => equal(s.normal, NORMALS[face]))!,
          ),
      ) && centerColor(cube, 'D') === 'white'
  );
}

function choose<T>(values: readonly T[], random: () => number): T {
  return values[
    Math.min(values.length - 1, Math.floor(random() * values.length))
  ];
}

export function makePreset(
  preset: Preset,
  random = Math.random,
): { cube: Cube; moves: Move[] } {
  const moves: Move[] = [];
  if (preset === 'random') {
    for (let i = 0; i < 25; i++) {
      const face = choose(
        FACES.filter((f) => f !== moves.at(-1)?.face),
        random,
      );
      moves.push({ face, turns: choose([1, -1, 2] as const, random) });
    }
  }
  if (preset === 'cross') {
    // Side / U / inverse side displaces corners and middle edges, preserving all D edges.
    for (let i = 0; i < 8; i++) {
      const face = choose(['F', 'R', 'L', 'B'] as const, random);
      moves.push(
        { face, turns: 1 },
        { face: 'U', turns: choose([1, -1] as const, random) },
        { face, turns: -1 },
      );
    }
  }
  if (preset === 'f2l') {
    // Sune and U rotations preserve the first two layers.
    const sune: Move[] = [
      { face: 'R', turns: 1 },
      { face: 'U', turns: 1 },
      { face: 'R', turns: -1 },
      { face: 'U', turns: 1 },
      { face: 'R', turns: 1 },
      { face: 'U', turns: 2 },
      { face: 'R', turns: -1 },
    ];
    for (let i = 0; i < 3; i++) {
      moves.push(
        { face: 'U', turns: choose([1, -1, 2] as const, random) },
        ...sune,
      );
    }
  }
  let cube = applyMoves(solvedCube(), moves);
  // Guarantee that practice presets still have work left, even for degenerate RNGs.
  const fallback: Move[] =
    preset === 'cross'
      ? [
          { face: 'R', turns: 1 },
          { face: 'U', turns: 1 },
          { face: 'R', turns: -1 },
        ]
      : [{ face: 'U', turns: 1 }];
  if (
    (preset === 'cross' && hasFirstTwoLayers(cube)) ||
    (preset !== 'solved' && isSolved(cube))
  ) {
    cube = applyMoves(cube, fallback);
    moves.push(...fallback);
  }
  return { cube, moves };
}
