import {
  applyMove,
  applyMoves,
  equal,
  centerColor,
  FACES,
  NORMALS,
  hasWhiteCross,
  solvedCube,
} from '../cube/cube.ts';
import type { Color, Cube, Move, Sticker } from '../cube/cube.ts';

export type LessonId = 1 | 2 | 3 | 4 | 5;
export const COLOR_LETTERS: Record<Color, string> = {
  white: 'W',
  yellow: 'Y',
  red: 'R',
  green: 'G',
  blue: 'B',
  orange: 'O',
};
export const LESSONS: { id: LessonId; title: string; explanation: string }[] = [
  {
    id: 1,
    title: 'W 오른쪽 · 윗색 다름',
    explanation:
      '코너의 W는 G 센터 쪽을 보고, 두 조각의 윗색은 G와 R로 다릅니다. 오른쪽 면을 열면 바로 페어가 붙습니다.',
  },
  {
    id: 2,
    title: 'W 오른쪽 · 윗색 같음',
    explanation:
      '코너의 W는 G 센터 쪽을 보고, 두 조각의 윗색은 모두 G입니다. 코너를 앞·왼쪽으로 옮겨 숨긴 뒤 엣지를 만나게 합니다.',
  },
  {
    id: 3,
    title: 'W 앞 · 윗색 다름',
    explanation:
      '코너의 W는 R 센터 쪽을 보고, 두 조각의 윗색은 R과 G로 다릅니다. 윗면으로 두 조각을 옮긴 뒤 오른쪽·앞면을 열고 복원하며 붙입니다.',
  },
  {
    id: 4,
    title: 'W 앞 · 윗색 같음',
    explanation:
      '코너의 W는 R 센터 쪽을 보고, 두 조각의 윗색은 모두 R입니다. 코너를 뒤·오른쪽으로 옮겨 숨긴 뒤 엣지를 만나게 합니다.',
  },
  {
    id: 5,
    title: 'W 위',
    explanation:
      '코너의 W는 Y 센터 쪽을 봅니다. 엣지를 앞 또는 오른쪽으로 옮겨 내리고, 코너를 옮긴 뒤 다시 올려 붙입니다. 엣지의 윗색 R/G에 따라 수순이 달라집니다.',
  },
];
type Variant = {
  whiteFace: 'R' | 'F' | 'U';
  top: 'red' | 'green';
  setup: string;
  pair: string;
  hint: string;
};
// All starts have the same UFR corner and UB edge. Only orientations vary.
// Setup sequences are independent of the pairing answer and use legal turns.
const VARIANTS: Record<LessonId, Variant[]> = {
  1: [
    {
      whiteFace: 'R',
      top: 'red',
      setup: "R U' R'",
      pair: "R U' R'",
      hint: 'R에서 두 조각이 Y층에서 붙습니다. U′로 붙은 페어를 오른쪽 면에서 비킨 뒤 R′로 W 십자가를 복원합니다. 페어는 Y층에 둡니다.',
    },
  ],
  2: [
    {
      whiteFace: 'R',
      top: 'green',
      setup: "Y L' U' L U Y' U F' U' U' F U'",
      pair: "U F' U2 F",
      hint: 'U로 코너를 앞·왼쪽에 옮기고 F′로 아래에 숨깁니다. U2로 엣지를 왼쪽으로 옮긴 뒤 F로 코너를 올려 붙입니다. 다른 세 슬롯도 복원됩니다.',
    },
  ],
  3: [
    {
      whiteFace: 'F',
      top: 'green',
      setup: "Y L' U' L U Y' R U R' F' U F",
      pair: "U' R' F R F'",
      hint: 'U′로 코너를 뒤·오른쪽, 엣지를 왼쪽으로 옮깁니다. R′ F로 코너를 아래에 내리고 R F′로 올려 엣지와 붙입니다. 열었던 면을 복원해 다른 세 슬롯도 유지합니다.',
    },
  ],
  4: [
    {
      whiteFace: 'F',
      top: 'red',
      setup: "R U R' U' U' R U' R' U",
      pair: "U' R U R'",
      hint: 'U′로 코너를 뒤·오른쪽에 옮기고 R로 아래에 숨깁니다. U로 엣지를 뒤쪽으로 옮긴 뒤 R′로 코너를 올려 붙입니다. 다른 세 슬롯도 복원됩니다.',
    },
  ],
  5: [
    {
      whiteFace: 'U',
      top: 'red',
      setup: "R U R' U' R U' U' R' U'",
      pair: "U R U2 R'",
      hint: 'U로 엣지를 오른쪽에 옮기고 R로 내립니다. U2로 코너를 뒤·오른쪽에 옮긴 뒤 R′로 엣지를 올려 붙입니다. 다른 세 슬롯도 복원됩니다.',
    },
    {
      whiteFace: 'U',
      top: 'green',
      setup: "Y L' U' L U Y' F' U F U' U'",
      pair: "U2 F' U' F",
      hint: 'U2로 엣지를 앞으로 옮기고 F′로 내립니다. U′로 코너를 앞·왼쪽에 옮긴 뒤 F로 엣지를 올려 붙입니다. 다른 세 슬롯도 복원됩니다.',
    },
  ],
};

// Quarter-turn checkpoints let two keyboard U presses follow an indicated U2.
function moves(text: string): Move[] {
  return text
    .split(' ')
    .filter(Boolean)
    .flatMap((token): Move[] => {
      const move: Move = {
        face: token[0] as Move['face'],
        turns: token.endsWith("'") ? -1 : 1,
      };
      return token.endsWith('2') ? [move, { ...move }] : [move];
    });
}

const solved = solvedCube();
export const CORNER_IDS = solved
  .filter((s) => equal(s.position, [1, -1, 1]))
  .map((s) => s.id);
export const EDGE_IDS = solved
  .filter((s) => equal(s.position, [1, 0, 1]))
  .map((s) => s.id);
export const TARGET_IDS = [...CORNER_IDS, ...EDGE_IDS];
export function targetPieces(cube: Cube): {
  corner: Sticker[];
  edge: Sticker[];
} {
  return {
    corner: cube.filter((s) => CORNER_IDS.includes(s.id)),
    edge: cube.filter((s) => EDGE_IDS.includes(s.id)),
  };
}

export function isPairFormed(cube: Cube): boolean {
  const { corner, edge } = targetPieces(cube);
  return (
    corner[0].position[1] === 1 &&
    edge[0].position[1] === 1 &&
    corner[0].position.reduce(
      (sum, v, i) => sum + Math.abs(v - edge[0].position[i]),
      0,
    ) === 1 &&
    (['red', 'green'] as const).every((color) =>
      equal(
        corner.find((s) => s.color === color)!.normal,
        edge.find((s) => s.color === color)!.normal,
      ),
    )
  );
}

// Three non-target F2L slots: every sticker of their corners and edges.
const OTHER_SLOT_IDS = solved
  .filter(
    (s) =>
      s.position[1] <= 0 &&
      Math.abs(s.position[0]) === 1 &&
      Math.abs(s.position[2]) === 1 &&
      !TARGET_IDS.includes(s.id),
  )
  .map((s) => s.id);

export function areOtherSlotsSolved(cube: Cube): boolean {
  return cube
    .filter((s) => OTHER_SLOT_IDS.includes(s.id))
    .every((s) => {
      const face = FACES.find((f) => equal(s.normal, NORMALS[f]))!;
      return s.position[1] < 1 && s.color === centerColor(cube, face);
    });
}

export type Exercise = {
  id: LessonId;
  variant: number;
  variantCount: number;
  definition: Variant;
  initial: Cube;
  setup: Move[];
  stages: {
    id: 'pair';
    title: string;
    algorithm: string;
    hint: string;
    start: number;
    end: number;
  }[];
  solution: Move[];
  checkpoints: Cube[];
};
function buildExercise(id: LessonId, variant: number): Exercise {
  const definition = VARIANTS[id][variant];
  const setup = moves(definition.setup);
  const initial = applyMoves(solvedCube(), setup);
  const solution = moves(definition.pair);
  const checkpoints: Cube[] = [initial];
  for (const move of solution)
    checkpoints.push(applyMove(checkpoints.at(-1)!, move));
  return {
    id,
    variant,
    variantCount: VARIANTS[id].length,
    definition,
    initial,
    setup,
    solution,
    checkpoints,
    stages: [
      {
        id: 'pair',
        title: 'Y층에서 페어 만들기',
        algorithm: definition.pair,
        hint: definition.hint,
        start: 0,
        end: solution.length,
      },
    ],
  };
}
export const EXERCISES = LESSONS.flatMap((lesson) =>
  VARIANTS[lesson.id].map((_, index) => buildExercise(lesson.id, index)),
);
export function getExercise(id: LessonId, variant = 0): Exercise {
  return EXERCISES.find(
    (exercise) => exercise.id === id && exercise.variant === variant,
  )!;
}

function sameCube(a: Cube, b: Cube): boolean {
  return a.every(
    (sticker, index) =>
      sticker.id === b[index].id &&
      equal(sticker.position, b[index].position) &&
      equal(sticker.normal, b[index].normal),
  );
}

export function guideCursor(
  exercise: Exercise,
  cube: Cube,
  previous: number | null,
  undo = false,
): number | null {
  const preferred = previous === null ? -1 : previous + (undo ? -1 : 1);
  if (
    exercise.checkpoints[preferred] &&
    sameCube(cube, exercise.checkpoints[preferred])
  )
    return preferred;
  if (previous !== null && sameCube(cube, exercise.checkpoints[previous]))
    return previous;
  const found = exercise.checkpoints.findIndex((checkpoint) =>
    sameCube(cube, checkpoint),
  );
  return found < 0 ? null : found;
}

export function trainingStatus(
  cube: Cube,
):
  | 'paired'
  | 'pair-cross-broken'
  | 'cross-broken'
  | 'slots-disturbed'
  | 'working' {
  const paired = isPairFormed(cube);
  if (!hasWhiteCross(cube))
    return paired ? 'pair-cross-broken' : 'cross-broken';
  if (!areOtherSlotsSolved(cube)) return 'slots-disturbed';
  return paired ? 'paired' : 'working';
}
