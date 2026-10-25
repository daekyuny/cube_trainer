import {
  applyMove,
  applyMoves,
  equal,
  hasFirstTwoLayers,
  inverse,
  isSolved,
  normalizeOrientation,
  NORMALS,
  solvedCube,
} from '../cube/cube.ts';
import type { Cube, Move } from '../cube/cube.ts';
import { guideSteps, parseAlgorithm } from '../training/guide.ts';
import type { GuidedExercise } from '../training/guide.ts';

export type LastLayerSet = 'oll' | 'pll';
export type LastLayerStep =
  'oll-edges' | 'oll-corners' | 'pll-corners' | 'pll-edges';
export type LastLayerCaseId =
  | 'oll-line'
  | 'oll-l'
  | 'oll-dot'
  | 'oll-sune'
  | 'oll-antisune'
  | 'oll-h'
  | 'oll-pi'
  | 'oll-headlights'
  | 'oll-t'
  | 'oll-bowtie'
  | 'pll-t'
  | 'pll-y'
  | 'pll-ua'
  | 'pll-ub'
  | 'pll-h'
  | 'pll-z';

export const LAST_LAYER_STEPS: {
  id: LastLayerStep;
  set: LastLayerSet;
  title: string;
  goal: string;
}[] = [
  {
    id: 'oll-edges',
    set: 'oll',
    title: '1단계 · 엣지 방향',
    goal: '노란 십자',
  },
  {
    id: 'oll-corners',
    set: 'oll',
    title: '2단계 · 코너 방향',
    goal: '윗면 전체 노랑',
  },
  {
    id: 'pll-corners',
    set: 'pll',
    title: '1단계 · 코너 위치',
    goal: '네 옆면 모두 헤드라이트',
  },
  {
    id: 'pll-edges',
    set: 'pll',
    title: '2단계 · 엣지 위치',
    goal: '큐브 완성',
  },
];

export type LastLayerCase = {
  id: LastLayerCaseId;
  step: LastLayerStep;
  name: string;
  recognition: string;
  algorithm: string;
  hint: string;
  // The finished state is exactly the next case's start (null: solved cube),
  // so each step ends in a realistic position for the following step.
  next: LastLayerCaseId | null;
};

// Algorithms follow the Happy Cubing beginner 2-Look lessons: parentheses group
// repeated motions (트위스트 R U R' U', 슬레지해머 R' F R F'), f turns the front
// two layers, M the middle layer and x the whole cube (x' turns it back so
// the next step starts yellow up). Every case is shown in the orientation the
// printed algorithm applies to, with red front / green right / yellow up.
export const LAST_LAYER_CASES: LastLayerCase[] = [
  {
    id: 'oll-line',
    step: 'oll-edges',
    name: '일자',
    recognition: '노란 엣지 두 개가 왼쪽·오른쪽으로 가로 일자를 이룹니다.',
    algorithm: "F (R U R' U') F'",
    hint: '일자를 가로로 두고 앞면을 시계 방향(F)으로 연 뒤 트위스트 한 번, F′로 원래대로 닫습니다.',
    next: 'oll-sune',
  },
  {
    id: 'oll-l',
    step: 'oll-edges',
    name: 'ㄴ자',
    recognition: '노란 엣지 두 개가 앞·오른쪽에서 ㄴ자(3시~6시)를 이룹니다.',
    algorithm: "f (R U R' U') f'",
    hint: '맞은 엣지를 앞쪽과 오른쪽에 둡니다. 일자 공식에서 F 대신 앞면 두 줄(f)을 한꺼번에 돌립니다.',
    next: 'oll-antisune',
  },
  {
    id: 'oll-dot',
    step: 'oll-edges',
    name: '점',
    recognition: '윗면 가운데만 노랗고 노란 엣지가 하나도 없습니다.',
    algorithm: "F (R U R' U') F' f (R U R' U') f'",
    hint: '일자 공식을 먼저 하면 앞·오른쪽에 ㄴ자가 바로 생깁니다. 돌리지 않고 이어서 ㄴ자 공식을 합니다.',
    next: 'oll-pi',
  },
  {
    id: 'oll-sune',
    step: 'oll-corners',
    name: '수네 (Sune)',
    recognition:
      '노란 코너 하나가 앞·왼쪽에 있고, 앞·오른쪽 코너의 노랑은 앞을 봅니다.',
    algorithm: "(R U R' U) (R U2 R')",
    hint: '트위스트처럼 R U R′로 시작해 같은 방향으로 U 한 번 더, 올리고(R) 두 번 돌리고(U2) 내립니다(R′).',
    next: 'pll-t',
  },
  {
    id: 'oll-antisune',
    step: 'oll-corners',
    name: '안티수네 (Antisune)',
    recognition:
      '노란 코너 하나가 앞·오른쪽에 있고, 앞·왼쪽 코너의 노랑은 앞을 봅니다.',
    algorithm: "(L' U' L U') (L' U2 L)",
    hint: '수네를 왼손으로 똑같이 합니다. 맞은 노란 코너를 수네와 반대로 앞·오른쪽에 둡니다.',
    next: 'pll-y',
  },
  {
    id: 'oll-h',
    step: 'oll-corners',
    name: 'H',
    recognition: '노란 코너가 없고, 앞·뒤 면에 노랑이 두 개씩 마주 봅니다.',
    algorithm: "F (R U R' U') (R U R' U') (R U R' U') F'",
    hint: '노랑 두 개씩을 앞뒤에 두고 일자 공식과 같은 틀에서 트위스트만 세 번 합니다.',
    next: 'pll-t',
  },
  {
    id: 'oll-pi',
    step: 'oll-corners',
    name: '파이 (Pi)',
    recognition:
      '노란 코너가 없고, 왼쪽 면에만 노랑 두 개가 나란히 있습니다. 오른쪽 두 코너의 노랑은 앞·뒤를 봅니다.',
    algorithm: "R U2 (R2 U') (R2 U') R2 U2 R",
    hint: '같은 방향을 보는 노랑 두 개를 왼쪽에 둡니다. R U2 다음 R2 U′를 두 번 반복하고 R2 U2 R로 마칩니다.',
    next: 'pll-y',
  },
  {
    id: 'oll-headlights',
    step: 'oll-corners',
    name: '헤드라이트',
    recognition: '노란 코너 두 개가 뒤쪽에 있고, 앞면에 노랑 두 개가 보입니다.',
    algorithm: "R2 D (R' U2 R) D' (R' U2 R')",
    hint: 'R2 다음 아랫면을 왼손 약지로 D, R′ U2 R, D′로 되돌리고 R′ U2 R′. 1·2층은 마지막에 복원됩니다.',
    next: 'pll-t',
  },
  {
    id: 'oll-t',
    step: 'oll-corners',
    name: 'T',
    recognition:
      '노란 코너 두 개가 오른쪽(앞·뒤)에 있고, 왼쪽 두 코너의 노랑은 앞·뒤를 봅니다.',
    algorithm: "x (L U R' U') (L' U R U') x'",
    hint: 'x로 아랫면을 앞으로 봅니다. 왼쪽 줄 내리고 U, 오른쪽 줄 내리고 U′, 왼쪽 올리고 U, 오른쪽 올리고 U′. 윗면이 U·U′로 왔다 갔다 하고, x′로 노랑을 다시 위로 둡니다.',
    next: 'pll-y',
  },
  {
    id: 'oll-bowtie',
    step: 'oll-corners',
    name: '나비 (Bowtie)',
    recognition:
      '노란 코너 두 개가 대각선(뒤·왼쪽, 앞·오른쪽)에 있고, 앞·왼쪽 코너의 노랑은 앞을 봅니다.',
    algorithm: "x (U R' U' L) (U R U' L') x'",
    hint: '맞은 코너를 앞·오른쪽에 두고 앞면 왼쪽에 노랑이 보이게 합니다. T와 같은 규칙에서 윗면을 먼저 돌립니다: U, 오른쪽 내리고 U′, 왼쪽 내리고 U, 오른쪽 올리고 U′, 왼쪽 올리기.',
    next: 'pll-t',
  },
  {
    id: 'pll-t',
    step: 'pll-corners',
    name: '헤드라이트 O · T-perm',
    recognition:
      '왼쪽 면에만 같은 색 코너 두 개(헤드라이트)가 있습니다. 헤드라이트를 왼쪽에 둡니다.',
    algorithm: "(R U R' U') (R' F R F') F (R U' R') U' (R U R') F'",
    hint: '헤드라이트 X 공식의 두 부분 순서를 바꿉니다: 트위스트 + 슬레지해머 다음 F, 페어 넣기(R U′ R′), U′, 꺼내기(R U R′), F′. 오른쪽 두 코너가 바뀝니다.',
    next: 'pll-ua',
  },
  {
    id: 'pll-y',
    step: 'pll-corners',
    name: '헤드라이트 X · Y-perm',
    recognition:
      '어느 옆면에도 헤드라이트가 없습니다. 대각선 두 코너를 맞바꿉니다.',
    algorithm: "F (R U' R') U' (R U R') F' (R U R' U') (R' F R F')",
    hint: '첫 부분: F로 열고 페어를 넣었다가(R U′ R′) U′ 후 다시 꺼내고(R U R′) F′. 둘째 부분: 트위스트 + 슬레지해머. 어느 방향에서 해도 됩니다.',
    next: 'pll-ub',
  },
  {
    id: 'pll-ua',
    step: 'pll-edges',
    name: 'Ua-perm',
    recognition:
      '뒷면 한 줄이 완성되어 있고, 앞면 가운데 엣지가 오른쪽 센터 색입니다.',
    algorithm: "M2 U M U2 M' U M2",
    hint: '완성된 줄을 뒤에 둡니다. M2 후 아래 센터와 반대 색인 오른쪽 엣지를 U로 앞으로, M(가운데 줄 내리기) U2 M′, 같은 방향 U, M2.',
    next: null,
  },
  {
    id: 'pll-ub',
    step: 'pll-edges',
    name: 'Ub-perm',
    recognition:
      '뒷면 한 줄이 완성되어 있고, 앞면 가운데 엣지가 왼쪽 센터 색입니다.',
    algorithm: "M2 U' M U2 M' U' M2",
    hint: 'Ua와 같은 규칙에서 U 방향만 반대입니다. M2 후 반대 색인 왼쪽 엣지를 U′로 앞으로, M U2 M′, 같은 방향 U′, M2.',
    next: null,
  },
  {
    id: 'pll-h',
    step: 'pll-edges',
    name: 'H-perm',
    recognition:
      '완성된 줄이 없고, 각 옆면 가운데 엣지가 반대편 센터 색입니다.',
    algorithm: "M2 U' M2 U2 M2 U' M2",
    hint: '앞↔뒤, 왼쪽↔오른쪽 엣지를 맞바꿉니다. M2 사이에 U′, U2, U′를 넣습니다.',
    next: null,
  },
  {
    id: 'pll-z',
    step: 'pll-edges',
    name: 'Z-perm',
    recognition:
      '완성된 줄이 없고, 앞 엣지는 왼쪽 센터 색, 오른쪽 엣지는 뒤 센터 색입니다.',
    algorithm: "(M2 U') (M2 U') M' U2 M2 U2 M' U2",
    hint: '바꿀 두 엣지를 앞·왼쪽에 둡니다. M2 U′를 두 번, M′ U2 M2 U2 M′. 마지막 U2로 윗층 각도를 맞춥니다.',
    next: null,
  },
];

export type LastLayerExercise = GuidedExercise & { case: LastLayerCase };

function caseById(id: LastLayerCaseId): LastLayerCase {
  return LAST_LAYER_CASES.find((item) => item.id === id)!;
}

// Build from the solved end backward: start = next case's start + inverse.
function setupFor(id: LastLayerCaseId): Move[] {
  const item = caseById(id);
  return [
    ...(item.next ? setupFor(item.next) : []),
    ...parseAlgorithm(item.algorithm).reverse().map(inverse),
  ];
}

export const LAST_LAYER_EXERCISES: LastLayerExercise[] = LAST_LAYER_CASES.map(
  (item) => {
    const setup = setupFor(item.id);
    const initial = applyMoves(solvedCube(), setup);
    return {
      case: item,
      initial,
      setup,
      ...guideSteps(initial, item.algorithm),
    };
  },
);

export function getLastLayerExercise(id: LastLayerCaseId): LastLayerExercise {
  return LAST_LAYER_EXERCISES.find((exercise) => exercise.case.id === id)!;
}

export function lastLayerCases(set: LastLayerSet): LastLayerCase[] {
  return LAST_LAYER_CASES.filter((item) =>
    LAST_LAYER_STEPS.some((step) => step.id === item.step && step.set === set),
  );
}

export function lastLayerSet(id: LastLayerCaseId): LastLayerSet {
  return LAST_LAYER_STEPS.find((step) => step.id === caseById(id).step)!.set;
}

const SIDE_NORMALS = [NORMALS.F, NORMALS.R, NORMALS.B, NORMALS.L];

function topFace(cube: Cube) {
  return cube.filter((s) => equal(s.normal, NORMALS.U));
}

export function hasYellowCross(cube: Cube): boolean {
  return topFace(cube)
    .filter((s) => Math.abs(s.position[0]) + Math.abs(s.position[2]) === 1)
    .every((s) => s.color === 'yellow');
}

export function isTopOriented(cube: Cube): boolean {
  return topFace(cube).every((s) => s.color === 'yellow');
}

// Each side face shows a matching corner pair ("headlights") on the top row.
export function areTopCornersPermuted(cube: Cube): boolean {
  return SIDE_NORMALS.every((normal) => {
    const corners = cube.filter(
      (s) =>
        s.position[1] === 1 &&
        equal(s.normal, normal) &&
        Math.abs(s.position[0]) + Math.abs(s.position[2]) === 2,
    );
    return corners[0].color === corners[1].color;
  });
}

export type LastLayerStatus = 'complete' | 'needs-auf' | 'f2l-open' | 'working';

// Status only reads the actual cube, so any correct path is accepted, and it
// is judged white down / red front so whole-cube rotations never change it.
export function lastLayerStatus(
  cube: Cube,
  step: LastLayerStep,
): LastLayerStatus {
  cube = normalizeOrientation(cube);
  if (!hasFirstTwoLayers(cube)) return 'f2l-open';
  if (step === 'oll-edges')
    return hasYellowCross(cube) ? 'complete' : 'working';
  if (step === 'oll-corners')
    return isTopOriented(cube) ? 'complete' : 'working';
  if (step === 'pll-corners')
    return isTopOriented(cube) && areTopCornersPermuted(cube)
      ? 'complete'
      : 'working';
  if (isSolved(cube)) return 'complete';
  let turned = cube;
  for (let turn = 0; turn < 3; turn++) {
    turned = applyMove(turned, { face: 'U', turns: 1 });
    if (isSolved(turned)) return 'needs-auf';
  }
  return 'working';
}
