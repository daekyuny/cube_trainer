import { useId } from 'react';
import {
  COLORS,
  COLOR_NAMES,
  FACES,
  centerColor,
} from '../../domain/cube/cube';
import type { Cube, Move } from '../../domain/cube/cube';
import {
  RINGS,
  VIEW_BOX,
  activeTurn,
  faceLabelPoint,
  layoutSpots,
  moveSymbol,
} from './circleMap';
import type { ActiveTurn, Point } from './circleMap';

type Props = {
  cube: Cube;
  move?: Move;
  progress: number;
  // Shown faintly while nothing turns.
  lastMove?: Move;
  highlightIds?: readonly string[];
};

const ARROW_SPAN = (40 * Math.PI) / 180;
const around = (center: Point, radius: number, angle: number) =>
  `${center[0] + radius * Math.cos(angle)} ${center[1] + radius * Math.sin(angle)}`;
// The turning direction: an arc just outside the outermost turning ring, in
// the empty stretch between the hidden faces.
function arrowPath({ rings, direction, arrowAngle }: ActiveTurn) {
  const { center, radius: ringRadius } = rings.reduce((a, b) =>
    a.radius > b.radius ? a : b,
  );
  const radius = ringRadius + 13;
  const from = arrowAngle - (direction * ARROW_SPAN) / 2;
  const to = arrowAngle + (direction * ARROW_SPAN) / 2;
  return `M ${around(center, radius, from)} A ${radius} ${radius} 0 0 ${direction > 0 ? 1 : 0} ${around(center, radius, to)}`;
}

export function CircleView({
  cube,
  move,
  progress,
  lastMove,
  highlightIds,
}: Props) {
  const arrowId = useId();
  const active = move ? activeTurn(move) : null;
  const spots = layoutSpots(cube, move, progress);
  const symbol = move ?? lastMove;
  const description = (['U', 'F', 'R', 'B', 'L', 'D'] as const)
    .map((face) => `${face} ${COLOR_NAMES[centerColor(cube, face)]}`)
    .join(', ');
  return (
    <svg
      className="cube-svg circle-svg"
      viewBox={VIEW_BOX.join(' ')}
      role="img"
      aria-label={`원 그래프: ${description}${move ? `, ${moveSymbol(move)} 회전 중` : ''}`}
      data-testid="cube-circles"
      data-turning={move ? moveSymbol(move) : undefined}
    >
      <defs>
        <marker
          id={arrowId}
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="3.6"
          markerHeight="3.6"
          orient="auto-start-reverse"
        >
          <path d="M0 0 L10 5 L0 10 z" className="circle-arrow-head" />
        </marker>
      </defs>
      {RINGS.map((ring) => {
        const isActive = active?.rings.includes(ring);
        return (
          <circle
            key={`${ring.axis}:${ring.layer}`}
            className={`ring${isActive ? ' is-active' : active ? ' is-idle' : ''}`}
            cx={ring.center[0]}
            cy={ring.center[1]}
            r={ring.radius}
            data-ring={`${ring.axis}:${ring.layer}`}
            data-active={isActive || undefined}
          />
        );
      })}
      {FACES.map((face) => {
        const [x, y] = faceLabelPoint(face);
        return (
          <text
            key={face}
            className="circle-face-label"
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {face}
          </text>
        );
      })}
      {spots.map((spot) => (
        <circle
          key={spot.id}
          className={`sticker-dot${
            !highlightIds
              ? ''
              : highlightIds.includes(spot.id)
                ? ' is-target'
                : ' is-muted'
          }`}
          cx={spot.point[0]}
          cy={spot.point[1]}
          r="8"
          fill={COLORS[spot.color]}
        />
      ))}
      {active && (
        <path
          className="ring-arrow"
          d={arrowPath(active)}
          markerEnd={`url(#${arrowId})`}
        />
      )}
      {symbol && (
        <text
          className={`circle-move${move ? ' is-active' : ''}`}
          x={VIEW_BOX[0] + VIEW_BOX[2] - 8}
          y={VIEW_BOX[1] + 30}
          textAnchor="end"
          data-testid="circle-move"
        >
          {moveSymbol(symbol)}
        </text>
      )}
    </svg>
  );
}
