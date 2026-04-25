import Svg, { Path, Circle, Line, Text as SvgText, G } from 'react-native-svg';
import { colors } from '../theme';

interface LineChartProps {
  width: number;
  height: number;
  values: number[];
  labels: string[];
  color?: string;
}

const PADDING = { top: 12, right: 12, bottom: 24, left: 36 };

export function LineChart({ width, height, values, labels, color = colors.rust }: LineChartProps) {
  const innerW = width - PADDING.left - PADDING.right;
  const innerH = height - PADDING.top - PADDING.bottom;

  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const range = max - min || 1;
  const n = values.length;

  const x = (i: number) => PADDING.left + (n <= 1 ? innerW / 2 : (i * innerW) / (n - 1));
  const y = (v: number) => PADDING.top + innerH - ((v - min) / range) * innerH;

  const path = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ');

  const gridLines = 4;
  const tickFormatter = (v: number) =>
    Math.abs(v) >= 1000 ? `$${Math.round(v / 1000)}k` : `$${Math.round(v)}`;

  return (
    <Svg width={width} height={height}>
      {Array.from({ length: gridLines + 1 }).map((_, i) => {
        const gy = PADDING.top + (innerH * i) / gridLines;
        const v = max - (range * i) / gridLines;
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

      <Path d={path} stroke={color} strokeWidth={2.5} fill="none" />

      {values.map((v, i) => (
        <Circle key={i} cx={x(i)} cy={y(v)} r={3.5} fill={color} />
      ))}

      {labels.map((label, i) => {
        if (i % Math.ceil(n / 6) !== 0 && i !== n - 1) return null;
        return (
          <SvgText
            key={`l-${i}`}
            x={x(i)}
            y={height - 6}
            fontSize={9}
            fill={colors.stone400}
            textAnchor="middle"
          >
            {label}
          </SvgText>
        );
      })}
    </Svg>
  );
}
