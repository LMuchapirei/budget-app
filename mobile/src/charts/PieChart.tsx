import Svg, { Path, Circle } from 'react-native-svg';

interface Slice {
  value: number;
  color: string;
}

interface PieChartProps {
  size: number;
  innerRadius?: number;
  data: Slice[];
}

function arcPath(cx: number, cy: number, r: number, ir: number, start: number, end: number) {
  const large = end - start > Math.PI ? 1 : 0;
  const x1 = cx + r * Math.cos(start);
  const y1 = cy + r * Math.sin(start);
  const x2 = cx + r * Math.cos(end);
  const y2 = cy + r * Math.sin(end);
  const xi1 = cx + ir * Math.cos(end);
  const yi1 = cy + ir * Math.sin(end);
  const xi2 = cx + ir * Math.cos(start);
  const yi2 = cy + ir * Math.sin(start);
  return [
    `M ${x1} ${y1}`,
    `A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`,
    `L ${xi1} ${yi1}`,
    `A ${ir} ${ir} 0 ${large} 0 ${xi2} ${yi2}`,
    'Z',
  ].join(' ');
}

export function PieChart({ size, innerRadius, data }: PieChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;
  const ir = innerRadius ?? r * 0.55;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;

  let angle = -Math.PI / 2;
  const slices = data.map((d) => {
    const sweep = (d.value / total) * Math.PI * 2;
    const start = angle;
    const end = angle + sweep;
    angle = end;
    return { d, start, end };
  });

  return (
    <Svg width={size} height={size}>
      {data.length === 1 ? (
        <Circle cx={cx} cy={cy} r={r} fill={data[0].color} />
      ) : (
        slices.map((s, i) => (
          <Path key={i} d={arcPath(cx, cy, r, ir, s.start, s.end)} fill={s.d.color} />
        ))
      )}
    </Svg>
  );
}
