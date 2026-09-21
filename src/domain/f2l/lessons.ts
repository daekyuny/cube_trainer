import {
  applyMove,
  applyMoves,
  centerColor,
  equal,
  FACES,
  hasWhiteCross,
  inverse,
  NORMALS,
  solvedCube,
} from '../cube/cube.ts';
import type { Color, Cube, Move, Sticker } from '../cube/cube.ts';

export type LessonId = 1 | 2 | 3 | 4 | 5;
export type StageId = 'pair' | 'align' | 'insert';
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
    title: 'W 옆 · 윗색 다름',
    explanation:
      'W는 오른쪽, 코너 위는 G, 엣지 위는 R입니다. 대표 배치에서는 R 한 번으로 두 조각이 붙습니다. 붙인 페어를 비켜 놓고 열었던 면을 복원합니다.',
  },
  {
    id: 2,
    title: 'W 옆 · 윗색 같음',
    explanation:
      'W는 오른쪽, 두 조각의 윗색은 G입니다. 코너를 앞면으로 숨길 위치에 옮긴 뒤 엣지를 만나게 합니다. 윗색이 같다는 것만으로 페어가 된 것은 아닙니다.',
  },
  {
    id: 3,
    title: 'W 앞 · 윗색 같음',
    explanation:
      'W는 앞, 두 조각의 윗색은 R입니다. 코너를 오른쪽 면으로 숨길 위치에 옮긴 뒤 엣지를 만나게 합니다. 2번과 대칭으로 생각해 보세요.',
  },
  {
    id: 4,
    title: 'W 앞 · 윗색 다름',
    explanation:
      'W는 앞, 코너 위는 R, 엣지 위는 G입니다. 대표 배치에서는 F′ 한 번으로 두 조각이 붙습니다. 붙인 페어를 비키고 면을 복원하는, 1번과 대칭인 유형입니다.',
  },
  {
    id: 5,
    title: 'W 위',
    explanation:
      'W가 위를 봅니다. 먼저 엣지의 옆색을 같은 색 센터에 맞춥니다. 그 면을 열어 엣지를 잠시 내리고, 코너를 옮긴 뒤 면을 되돌려 페어를 만듭니다.',
  },
];

type Variant = {
  edge: 'UL' | 'UB';
  top: 'red' | 'green';
  route: 'right' | 'left';
  pair: string;
  align: string;
  hint: string;
};
const VARIANTS: Record<LessonId, Variant[]> = {
  1: [
    {
      edge: 'UB',
      top: 'red',
      route: 'right',
      pair: "R U2 R'",
      align: "U'",
      hint: 'R로 코너를 뒤쪽으로 보내 엣지와 붙입니다. U2로 페어를 오른쪽 면에서 비킨 뒤 R′로 W 십자가를 복원합니다.',
    },
    {
      edge: 'UL',
      top: 'red',
      route: 'right',
      pair: "R U R' F' U F",
      align: '',
      hint: 'R U R′로 배치를 바꾸고 F′ U F로 연결합니다. 각 묶음이 끝나면 W 십자가도 복원됩니다.',
    },
  ],
  2: [
    {
      edge: 'UL',
      top: 'green',
      route: 'left',
      pair: "U F' U' F",
      align: "U'",
      hint: 'U로 코너를 옮기고 F′로 아래에 숨깁니다. U′로 엣지를 옮긴 뒤 F로 코너를 올려 엣지와 붙입니다.',
    },
    {
      edge: 'UB',
      top: 'green',
      route: 'left',
      pair: "U F' U2 F",
      align: "U'",
      hint: 'U로 코너를 옮겨 F′로 숨깁니다. 엣지가 뒤에서 시작하므로 U2로 만나게 한 뒤 F로 올립니다.',
    },
  ],
  3: [
    {
      edge: 'UB',
      top: 'red',
      route: 'right',
      pair: "U' R U R'",
      align: 'U',
      hint: 'U′로 코너를 옮기고 R로 아래에 숨깁니다. U로 엣지를 옮긴 뒤 R′로 코너를 올려 엣지와 붙입니다.',
    },
    {
      edge: 'UL',
      top: 'red',
      route: 'right',
      pair: "U' R U2 R'",
      align: 'U',
      hint: 'U′로 코너를 옮겨 R로 숨깁니다. 엣지가 왼쪽에서 시작하므로 U2로 만나게 한 뒤 R′로 올립니다.',
    },
  ],
  4: [
    {
      edge: 'UL',
      top: 'green',
      route: 'left',
      pair: "F' U2 F",
      align: 'U',
      hint: 'F′로 코너를 왼쪽으로 보내 엣지와 붙입니다. U2로 페어를 앞면에서 비킨 뒤 F로 W 십자가를 복원합니다.',
    },
    {
      edge: 'UB',
      top: 'green',
      route: 'left',
      pair: "F' U' F R U' R'",
      align: '',
      hint: 'F′ U′ F로 배치를 바꾸고 R U′ R′로 연결합니다. 각 묶음이 끝나면 W 십자가도 복원됩니다.',
    },
  ],
  5: [
    {
      edge: 'UL',
      top: 'red',
      route: 'right',
      pair: "U2 R U R'",
      align: '',
      hint: 'U2로 엣지의 G를 오른쪽 G 센터에 맞춥니다. R로 엣지를 내리고 U로 코너를 옮긴 뒤 R′로 붙입니다.',
    },
    {
      edge: 'UB',
      top: 'red',
      route: 'right',
      pair: "U R U2 R'",
      align: '',
      hint: 'U로 엣지의 G를 오른쪽 G 센터에 맞춥니다. R로 엣지를 내리고 U2로 코너를 옮긴 뒤 R′로 붙입니다.',
    },
    {
      edge: 'UB',
      top: 'green',
      route: 'left',
      pair: "U2 F' U' F",
      align: '',
      hint: 'U2로 엣지의 R을 앞쪽 R 센터에 맞춥니다. F′로 엣지를 내리고 U′로 코너를 옮긴 뒤 F로 붙입니다.',
    },
    {
      edge: 'UL',
      top: 'green',
      route: 'left',
      pair: "U' F' U2 F",
      align: '',
      hint: 'U′로 엣지의 R을 앞쪽 R 센터에 맞춥니다. F′로 엣지를 내리고 U2로 코너를 옮긴 뒤 F로 붙입니다.',
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

export function isTargetInserted(cube: Cube): boolean {
  return cube
    .filter((s) => TARGET_IDS.includes(s.id))
    .every(
      (s) =>
        s.position[1] < 1 &&
        s.color ===
          centerColor(
            cube,
            FACES.find((f) => equal(s.normal, NORMALS[f]))!,
          ),
    );
}

export type Exercise = {
  id: LessonId;
  variant: number;
  variantCount: number;
  definition: Variant;
  initial: Cube;
  setup: Move[];
  stages: {
    id: StageId;
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
  const left = definition.route === 'left';
  const sections = [
    {
      id: 'pair' as const,
      title: '페어 만들기',
      algorithm: definition.pair,
      hint: definition.hint,
    },
    {
      id: 'align' as const,
      title: '삽입 위치 맞추기',
      algorithm: [definition.align, left ? 'Y' : ''].filter(Boolean).join(' '),
      hint: left
        ? '페어를 슬롯 위에 맞춘 뒤 →로 큐브 전체를 돌립니다. 이제 G가 앞, R이 왼쪽이므로 같은 R·G 슬롯에 왼손 공식으로 넣습니다.'
        : definition.align
          ? 'U층만 돌려 붙어 있는 페어를 R·G 슬롯 바로 위에 놓습니다. 두 조각을 계속 함께 움직이세요.'
          : '이미 페어가 R·G 슬롯 위에 있습니다. 추가 정렬 없이 오른손 삽입으로 이어갑니다.',
    },
    {
      id: 'insert' as const,
      title: left ? '왼쪽 앞으로 넣기' : '오른쪽 앞으로 넣기',
      algorithm: left ? "U' L' U L" : "U R U' R'",
      hint: '페어를 잠깐 비키고 슬롯을 연 뒤, 페어를 가져와 닫습니다. 네 수를 모두 연습합니다.',
    },
  ];
  const solution: Move[] = [];
  const stages = sections.map((section) => {
    const start = solution.length;
    solution.push(...moves(section.algorithm));
    return {
      ...section,
      algorithm: section.algorithm.replace('Y', '→'),
      start,
      end: solution.length,
    };
  });
  // Start from a solved cube in the final viewing orientation and reverse the
  // complete lesson. Every exercise is reachable using legal outer-face turns.
  const final = left ? applyMove(solved, { face: 'Y', turns: 1 }) : solved;
  const setup: Move[] = [
    ...(left ? [{ face: 'Y', turns: 1 } as Move] : []),
    ...solution.slice().reverse().map(inverse),
  ];
  const initial = applyMoves(final, solution.slice().reverse().map(inverse));
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
    stages,
    solution,
    checkpoints,
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
): 'inserted' | 'paired' | 'cross-broken' | 'working' {
  if (!hasWhiteCross(cube)) return 'cross-broken';
  if (isTargetInserted(cube)) return 'inserted';
  return isPairFormed(cube) ? 'paired' : 'working';
}
