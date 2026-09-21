import {
  COLORS,
  COLOR_NAMES,
  FACES,
  NORMALS,
  centerColor,
  equal,
  rotate,
  rotation,
} from '../../domain/cube/cube';
import type { Cube, Face, Move, Vec3 } from '../../domain/cube/cube';
import { COLOR_LETTERS } from '../../domain/f2l/lessons';

type Props = {
  cube: Cube;
  reverse?: boolean;
  move?: Move;
  progress: number;
  highlightIds?: readonly string[];
};
const dot = (a: Vec3, b: Vec3) =>
  a.reduce((sum, value, index) => sum + value * b[index], 0);
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, value: number): Vec3 => [
  a[0] * value,
  a[1] * value,
  a[2] * value,
];
const right: Vec3 = [0.91, 0, -0.415];
const up: Vec3 = [-0.2075, 0.866, -0.455];
const camera: Vec3 = [0.3594, 0.5, 0.7881];

export function CubeView({
  cube,
  reverse = false,
  move,
  progress,
  highlightIds,
}: Props) {
  const viewUp = scale(up, reverse ? -1 : 1);
  const viewCamera = scale(camera, reverse ? -1 : 1);
  const project = (point: Vec3) => [
    190 + dot(point, right) * 70,
    180 - dot(point, viewUp) * 70,
  ];
  const active = move ? rotation(move) : null;
  const eased = progress * progress * (3 - 2 * progress);
  const transform = (point: Vec3, position: Vec3) =>
    active && (active.layer === null || position[active.axis] === active.layer)
      ? rotate(point, active.axis, active.angle * eased)
      : point;
  const polygons: {
    key: string;
    points: string;
    sticker: string;
    fill: string;
    depth: number;
    label: string;
    labelPosition: number[];
    light: boolean;
  }[] = [];

  for (let x = -1; x <= 1; x++)
    for (let y = -1; y <= 1; y++)
      for (let z = -1; z <= 1; z++) {
        if (!x && !y && !z) continue;
        const position: Vec3 = [x, y, z];
        for (const face of FACES) {
          const normal = NORMALS[face];
          const animatedNormal = transform(normal, position);
          if (dot(animatedNormal, viewCamera) <= 0.001) continue;
          const axis = normal.findIndex((value) => value !== 0);
          const a: Vec3 = axis === 0 ? [0, 1, 0] : [1, 0, 0];
          const b: Vec3 = axis === 2 ? [0, 1, 0] : [0, 0, 1];
          const middle = add(position, scale(normal, 0.492));
          const corners = (size: number) =>
            [
              [-1, -1],
              [1, -1],
              [1, 1],
              [-1, 1],
            ]
              .map(([u, v]) => {
                const point = add(
                  middle,
                  add(scale(a, u * size), scale(b, v * size)),
                );
                return project(transform(point, position)).join(',');
              })
              .join(' ');
          const sticker = cube.find(
            (s) => equal(s.position, position) && equal(s.normal, normal),
          );
          const highlighted = sticker && highlightIds?.includes(sticker.id);
          const crossPosition =
            position[1] === -1 &&
            Math.abs(position[0]) + Math.abs(position[2]) <= 1;
          const muted =
            highlightIds &&
            sticker &&
            !highlighted &&
            !crossPosition &&
            !equal(position, normal);
          polygons.push({
            key: `${x}:${y}:${z}:${face}`,
            points: corners(0.482),
            sticker: sticker ? corners(0.439) : '',
            fill: sticker
              ? muted
                ? '#cbd4ca'
                : COLORS[sticker.color]
              : '#25352f',
            depth: dot(transform(middle, position), viewCamera),
            label: highlighted ? COLOR_LETTERS[sticker.color] : '',
            labelPosition: project(transform(middle, position)),
            light: sticker?.color === 'white' || sticker?.color === 'yellow',
          });
        }
      }
  polygons.sort((a, b) => a.depth - b.depth);
  const visible: Face[] = reverse ? ['B', 'L', 'D'] : ['F', 'R', 'U'];
  const description = visible
    .map((face) => `${face} ${COLOR_NAMES[centerColor(cube, face)]}`)
    .join(', ');
  return (
    <svg
      className="cube-svg"
      viewBox="0 0 380 355"
      role="img"
      aria-label={`${reverse ? '뒤집어 본 큐브' : '기준 큐브'}: ${description}`}
      data-testid={reverse ? 'cube-back' : 'cube-front'}
    >
      <ellipse
        cx="190"
        cy="324"
        rx="105"
        ry="12"
        fill="#263d31"
        opacity="0.07"
      />
      {polygons.map((polygon) => (
        <g key={polygon.key}>
          <polygon
            points={polygon.points}
            fill="#26352f"
            stroke="#26352f"
            strokeWidth="0.6"
            strokeLinejoin="round"
          />
          {polygon.sticker && (
            <polygon
              points={polygon.sticker}
              fill={polygon.fill}
              stroke={polygon.fill}
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          )}
          {polygon.label && (
            <text
              x={polygon.labelPosition[0]}
              y={polygon.labelPosition[1]}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="15"
              fontWeight="800"
              fill={polygon.light ? '#23392b' : '#fff'}
              stroke={polygon.light ? '#fff' : '#23392b'}
              strokeWidth="0.5"
              paintOrder="stroke"
              data-target-label={polygon.label}
            >
              {polygon.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
