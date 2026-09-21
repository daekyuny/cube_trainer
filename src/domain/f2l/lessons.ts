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
      '대표 배치는 W가 오른쪽이고, 코너의 앞색 R은 이미 R 센터에 맞아 있습니다. R로 페어를 붙이고 U로 슬롯 위에 옮긴 뒤 R′로 함께 넣습니다. W가 왼쪽인 좌우 대칭 배치는 왼손 공식으로 끝납니다.',
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
    title: 'W 앞 · 윗색 다름 (1번 회전형)',
    explanation:
      '새로운 페어링 원리가 아니라 1번을 다른 방향에서 본 배치입니다. 대표 배치에서 큐브 전체를 →로 90° 돌리면 W가 왼쪽, 코너가 자기 앞·왼쪽 슬롯 위에 놓입니다. L′ U′ L로 바로 넣습니다.',
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
  direct?: boolean;
};
const VARIANTS: Record<LessonId, Variant[]> = {
  1: [
    {
      edge: 'UB',
      top: 'red',
      route: 'right',
      pair: "R U R'",
      align: '',
      direct: true,
      hint: 'R로 코너와 엣지를 붙이고, U로 페어를 슬롯 위에 옮긴 뒤 R′로 넣습니다. W 십자가도 복원되며 세 수로 끝납니다.',
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
      pair: "Y L' U' L",
      align: '',
      direct: true,
      hint: '→로 전체 큐브를 돌려 G를 앞, R을 왼쪽으로 둡니다. 이제 1번의 W 왼쪽 배치이므로 L′ U′ L 세 수로 페어와 슬롯을 함께 완성합니다.',
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
  const sections = definition.direct
    ? [
        {
          id: 'insert' as const,
          title: '정답 · 페어링과 삽입을 한 번에',
          algorithm: definition.pair,
          hint: definition.hint,
        },
      ]
    : [
        {
          id: 'pair' as const,
          title: '페어 만들기',
          algorithm: definition.pair,
          hint: definition.hint,
        },
        {
          id: 'align' as const,
          title: '삽입 위치 맞추기',
          algorithm: [definition.align, left ? 'Y' : '']
            .filter(Boolean)
            .join(' '),
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
