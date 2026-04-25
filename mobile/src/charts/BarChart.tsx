import Svg, { Rect, Line, Text as SvgText, G } from 'react-native-svg';
import { colors } from '../theme';

interface BarDatum {
  label: string;
  income: number;
  expenses: number;
}

interface BarChartProps {
  width: number;
  height: number;
  data: BarDatum[];
}

const PADDING = { top: 12, right: 12, bottom: 24, left: 36 };
const BAR_RADIUS = 4;

export function BarChart({ width, height, data }: BarChartProps) {
  const innerW = width - PADDING.left - PADDING.right;
  const innerH = height - PADDING.top - PADDING.bottom;
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expenses]));

  const groupCount = data.length || 1;
  const groupWidth = innerW / groupCount;
  const barWidth = Math.max(4, (groupWidth - 6) / 2);

  const y = (v: number) => PADDING.top + innerH - (v / max) * innerH;

  const gridLines = 4;
  const tickFormatter = (v: number) =>
    v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${Math.round(v)}`;

  return (
    <Svg width={width} height={height}>
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

      {data.map((d, i) => {
        const groupX = PADDING.left + i * groupWidth + 3;
        const incH = innerH - (y(d.income) - PADDING.top);
        const expH = innerH - (y(d.expenses) - PADDING.top);
        return (
          <G key={`bar-${i}`}>
            <Rect
              x={groupX}
              y={y(d.income)}
              width={barWidth}
              height={Math.max(0, incH)}
              fill={colors.moss}
              rx={BAR_RADIUS}
            />
            <Rect
              x={groupX + barWidth + 2}
              y={y(d.expenses)}
              width={barWidth}
              height={Math.max(0, expH)}
              fill={colors.clay}
              rx={BAR_RADIUS}
            />
            <SvgText
              x={groupX + barWidth + 1}
              y={height - 6}
              fontSize={9}
              fill={colors.stone400}
              textAnchor="middle"
            >
              {d.label}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}
