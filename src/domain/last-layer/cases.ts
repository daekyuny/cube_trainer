import {
  applyMove,
  applyMoves,
  equal,
  hasFirstTwoLayers,
  inverse,
  isSolved,
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

// Outer-face algorithms only; every case is shown in the orientation the
// printed algorithm applies to, with red front / green right / yellow up.
export const LAST_LAYER_CASES: LastLayerCase[] = [
  {
    id: 'oll-line',
    step: 'oll-edges',
    name: '일자',
    recognition: '노란 엣지 두 개가 왼쪽·오른쪽으로 가로 일자를 이룹니다.',
    algorithm: "F R U R' U' F'",
    hint: '일자를 가로로 둔 채 F로 앞면을 열고 R U R′ U′로 엣지를 바꾼 뒤 F′로 닫습니다.',
    next: 'oll-sune',
  },
  {
    id: 'oll-l',
    step: 'oll-edges',
    name: 'L자',
    recognition: '노란 엣지 두 개가 뒤·왼쪽에서 L자(9시~12시)를 이룹니다.',
    algorithm: "F U R U' R' F'",
    hint: 'L자를 뒤·왼쪽에 둡니다. 일자 공식에서 가운데 R U R′ U′를 U R U′ R′로 바꾼 형태입니다.',
    next: 'oll-antisune',
  },
  {
    id: 'oll-dot',
    step: 'oll-edges',
    name: '점',
    recognition: '윗면 가운데만 노랗고 노란 엣지가 하나도 없습니다.',
    algorithm: "F R U R' U' F' U2 F U R U' R' F'",
    hint: '일자 공식으로 L자를 만들고 U2로 L자를 뒤·왼쪽에 둔 뒤 L자 공식을 이어 합니다.',
    next: 'oll-pi',
  },
  {
    id: 'oll-sune',
    step: 'oll-corners',
    name: '수네 (Sune)',
    recognition:
      '노란 코너 하나가 앞·왼쪽에 있고, 앞·오른쪽 코너의 노랑은 앞을 봅니다.',
    algorithm: "R U R' U R U2 R'",
    hint: 'R U R′ U R U2 R′ 한 번으로 남은 세 코너를 함께 돌립니다.',
    next: 'pll-t',
  },
  {
    id: 'oll-antisune',
    step: 'oll-corners',
    name: '안티수네 (Antisune)',
    recognition:
      '노란 코너 하나가 뒤·오른쪽에 있고, 앞·왼쪽 코너의 노랑은 앞을 봅니다.',
    algorithm: "R U2 R' U' R U' R'",
    hint: '수네를 거꾸로 실행한 수순입니다. R U2 R′로 시작합니다.',
    next: 'pll-y',
  },
  {
    id: 'oll-h',
    step: 'oll-corners',
    name: 'H',
    recognition:
      '노란 코너가 없고, 왼쪽·오른쪽 면에 노랑이 두 개씩 마주 봅니다.',
    algorithm: "R U R' U R U' R' U R U2 R'",
    hint: 'R U R′ U를 두 번 이어 가다 마지막을 R U2 R′로 마칩니다.',
    next: 'pll-t',
  },
  {
    id: 'oll-pi',
    step: 'oll-corners',
    name: '파이 (Pi)',
    recognition:
      '노란 코너가 없고, 왼쪽 면에만 노랑 두 개가 나란히 있습니다. 오른쪽 두 코너의 노랑은 앞·뒤를 봅니다.',
    algorithm: "R U2 R2 U' R2 U' R2 U2 R",
    hint: 'R2와 U′를 번갈아 돌리는 부분이 핵심입니다.',
    next: 'pll-y',
  },
  {
    id: 'oll-headlights',
    step: 'oll-corners',
    name: '헤드라이트',
    recognition: '노란 코너 두 개가 뒤쪽에 있고, 앞면에 노랑 두 개가 보입니다.',
    algorithm: "R2 D R' U2 R D' R' U2 R'",
    hint: 'D로 아래층을 잠시 돌렸다가 D′로 되돌립니다. 1·2층은 마지막에 복원됩니다.',
    next: 'pll-t',
  },
  {
    id: 'oll-t',
    step: 'oll-corners',
    name: 'T',
    recognition:
      '노란 코너 두 개가 오른쪽(앞·뒤)에 있고, 왼쪽 두 코너의 노랑은 앞·뒤를 봅니다.',
    algorithm: "L F R' F' L' F R F'",
    hint: 'L F R′ F′와 L′ F R F′ 두 묶음입니다.',
    next: 'pll-y',
  },
  {
    id: 'oll-bowtie',
    step: 'oll-corners',
    name: '나비 (Bowtie)',
    recognition:
      '노란 코너 두 개가 대각선(뒤·왼쪽, 앞·오른쪽)에 있고, 앞·왼쪽 코너의 노랑은 앞을 봅니다.',
    algorithm: "R' F R B' R' F' R B",
    hint: 'R′ F R B′와 R′ F′ R B 두 묶음입니다.',
    next: 'pll-t',
  },
  {
    id: 'pll-t',
    step: 'pll-corners',
    name: '헤드라이트 · T-perm',
    recognition:
      '왼쪽 면에만 같은 색 코너 두 개(헤드라이트)가 있습니다. 헤드라이트를 왼쪽에 둡니다.',
    algorithm: "R U R' U' R' F R2 U' R' U' R U R' F'",
    hint: '오른쪽 두 코너를 맞바꿉니다. 왼쪽·오른쪽 엣지도 함께 바뀌지만 다음 단계에서 맞춥니다.',
    next: 'pll-ua',
  },
  {
    id: 'pll-y',
    step: 'pll-corners',
    name: '대각선 · Y-perm',
    recognition:
      '어느 옆면에도 헤드라이트가 없습니다. 대각선 두 코너를 맞바꿉니다.',
    algorithm: "F R U' R' U' R U R' F' R U R' U' R' F R F'",
    hint: '뒤·왼쪽과 앞·오른쪽 코너를 맞바꿉니다. 왼쪽·뒤 엣지도 함께 바뀌지만 다음 단계에서 맞춥니다.',
    next: 'pll-ub',
  },
  {
    id: 'pll-ua',
    step: 'pll-edges',
    name: 'Ua-perm',
    recognition:
      '뒷면 한 줄이 완성되어 있고, 앞면 가운데 엣지가 오른쪽 센터 색입니다.',
    algorithm: "R U' R U R U R U' R' U' R2",
    hint: '앞 엣지는 오른쪽, 오른쪽 엣지는 왼쪽, 왼쪽 엣지는 앞으로 갑니다. 완성된 줄은 뒤에 둡니다.',
    next: null,
  },
  {
    id: 'pll-ub',
    step: 'pll-edges',
    name: 'Ub-perm',
    recognition:
      '뒷면 한 줄이 완성되어 있고, 앞면 가운데 엣지가 왼쪽 센터 색입니다.',
    algorithm: "R2 U R U R' U' R' U' R' U R'",
    hint: '앞 엣지는 왼쪽, 왼쪽 엣지는 오른쪽, 오른쪽 엣지는 앞으로 갑니다. Ua의 반대 방향입니다.',
    next: null,
  },
  {
    id: 'pll-h',
    step: 'pll-edges',
    name: 'H-perm',
    recognition:
      '완성된 줄이 없고, 각 옆면 가운데 엣지가 반대편 센터 색입니다.',
    algorithm: 'R2 U2 R U2 R2 U2 R2 U2 R U2 R2',
    hint: '앞↔뒤, 왼쪽↔오른쪽 엣지를 맞바꿉니다. R2와 U2만 사용합니다.',
    next: null,
  },
  {
    id: 'pll-z',
    step: 'pll-edges',
    name: 'Z-perm',
    recognition:
      '완성된 줄이 없고, 앞 엣지는 왼쪽 센터 색, 오른쪽 엣지는 뒤 센터 색입니다.',
    algorithm: "R' U' R U' R U R U' R' U R U R2 U' R' U2",
    hint: '앞↔왼쪽, 오른쪽↔뒤 엣지를 맞바꿉니다. 마지막 U2로 윗층 각도를 맞춥니다.',
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

// Status only reads the actual cube, so any correct path is accepted and the
// whole-cube horizontal rotation never changes the result.
export function lastLayerStatus(
  cube: Cube,
  step: LastLayerStep,
): LastLayerStatus {
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
