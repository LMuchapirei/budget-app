import React from 'react';
import Svg, { Path, Circle, Line } from 'react-native-svg';

interface SparklineProps {
  width: number;
  height: number;
  values: number[];
  color: string;
  fillColor?: string;
  zeroLineColor?: string;
}

export function Sparkline({
  width,
  height,
  values,
  color,
  fillColor,
  zeroLineColor,
}: SparklineProps) {
  if (values.length < 2) return null;

  const padY = 6;
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;
  const innerH = height - padY * 2;
  const x = (i: number) => (i * width) / (values.length - 1);
  const y = (v: number) => padY + innerH - ((v - min) / range) * innerH;

  const linePath = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`)
    .join(' ');
  const fillPath = `${linePath} L${x(values.length - 1)},${height} L${x(0)},${height} Z`;
  const lastIdx = values.length - 1;
  const zeroY = y(0);
  const showZero = zeroLineColor && min < 0 && max > 0;

  return (
    <Svg width={width} height={height}>
      {fillColor ? <Path d={fillPath} fill={fillColor} opacity={0.18} /> : null}
      {showZero ? (
        <Line
          x1={0}
          x2={width}
          y1={zeroY}
          y2={zeroY}
          stroke={zeroLineColor}
          strokeWidth={1}
          strokeDasharray="2 3"
        />
      ) : null}
      <Path d={linePath} stroke={color} strokeWidth={2} fill="none" />
      <Circle cx={x(lastIdx)} cy={y(values[lastIdx])} r={2.5} fill={color} />
    </Svg>
  );
}
