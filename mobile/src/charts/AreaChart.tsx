import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Line,
  Text as SvgText,
  G,
} from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

interface Series {
  color: string;
  values: number[];
  gradientId: string;
}

interface AreaChartProps {
  width: number;
  height: number;
  series: Series[];
  labels?: string[];
}

const PADDING = { top: 12, right: 16, bottom: 22, left: 40 };

export function AreaChart({ width, height, series, labels }: AreaChartProps) {
  const { colors } = useTheme();
  const innerW = width - PADDING.left - PADDING.right;
  const innerH = height - PADDING.top - PADDING.bottom;

  const allValues = series.flatMap((s) => s.values);
  const max = Math.max(1, ...allValues);
  const n = series[0]?.values.length ?? 0;

  const x = (i: number) => PADDING.left + (n <= 1 ? innerW / 2 : (i * innerW) / (n - 1));
  const y = (v: number) => PADDING.top + innerH - (v / max) * innerH;

  const pathFor = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ');

  const fillPathFor = (vals: number[]) => {
    if (vals.length === 0) return '';
    return `${pathFor(vals)} L${x(vals.length - 1)},${PADDING.top + innerH} L${x(0)},${
      PADDING.top + innerH
    } Z`;
  };

  const gridLines = 4;
  const tickFormatter = (v: number) =>
    v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${Math.round(v)}`;
  const labelIndexes = new Set<number>();

  if (labels && n > 0) {
    const labelCount = Math.min(5, n);
    for (let i = 0; i < labelCount; i++) {
      labelIndexes.add(Math.round((i * (n - 1)) / Math.max(1, labelCount - 1)));
    }
  }

  return (
    <Svg width={width} height={height}>
      <Defs>
        {series.map((s) => (
          <LinearGradient
            key={s.gradientId}
            id={s.gradientId}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <Stop offset="0%" stopColor={s.color} stopOpacity={0.32} />
            <Stop offset="100%" stopColor={s.color} stopOpacity={0} />
          </LinearGradient>
        ))}
      </Defs>

      {Array.from({ length: gridLines + 1 }).map((_, i) => {
        const gy = PADDING.top + (innerH * i) / gridLines;
        const v = max * (1 - i / gridLines);
        return (
          <G key={`grid-${i}`}>
            <Line
              x1={PADDING.left}
              x2={width - PADDING.right}
              y1={gy}
              y2={gy}
              stroke={colors.hairline}
              strokeDasharray="2 4"
            />
            <SvgText
              x={PADDING.left - 4}
              y={gy + 3}
              fontSize={9}
              fill={colors.stone400}
              textAnchor="end"
            >
              {tickFormatter(v)}
            </SvgText>
          </G>
        );
      })}

      {series.map((s) => (
        <Path
          key={`fill-${s.gradientId}`}
          d={fillPathFor(s.values)}
          fill={`url(#${s.gradientId})`}
        />
      ))}
      {series.map((s) => (
        <Path
          key={`line-${s.gradientId}`}
          d={pathFor(s.values)}
          stroke={s.color}
          strokeWidth={2}
          fill="none"
        />
      ))}

      {labels &&
        labels.map((label, i) => {
          if (!labelIndexes.has(i)) return null;
          const isFirst = i === 0;
          const isLast = i === n - 1;
          return (
            <SvgText
              key={i}
              x={x(i)}
              y={height - 6}
              fontSize={9}
              fill={colors.stone400}
              textAnchor={isFirst ? 'start' : isLast ? 'end' : 'middle'}
            >
              {label}
            </SvgText>
          );
        })}
    </Svg>
  );
}
