import { useState } from 'react';
import type { CategoryStat, DailyTrendPoint } from '../types.ts';

interface TrendChartProps {
  data: DailyTrendPoint[];
}

export function BorrowReturnTrendChart({ data }: TrendChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxVal = Math.max(
    4,
    ...data.map((d) => Math.max(d.borrows, d.returns))
  );
  const yTicks = [0, Math.ceil(maxVal / 2), maxVal];

  const width = 600;
  const height = 220;
  const padLeft = 34;
  const padRight = 16;
  const padTop = 20;
  const padBottom = 34;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const groupW = data.length > 0 ? plotW / data.length : plotW;
  const barW = Math.min(20, groupW * 0.28);

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-5 text-xs text-[#7D5C66]">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-xs bg-[#6B1D2F]" aria-hidden="true" />
            Peminjaman
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-xs bg-[#E3A9B9]" aria-hidden="true" />
            Pengembalian
          </span>
        </div>
        {hoveredIdx !== null && data[hoveredIdx] && (
          <div className="text-xs font-mono tabular-nums text-[#2C161D]">
            {data[hoveredIdx].label}: {data[hoveredIdx].borrows} pinjam · {data[hoveredIdx].returns} kembali
          </div>
        )}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible"
        role="img"
        aria-label="Grafik tren peminjaman dan pengembalian 7 hari terakhir"
      >
        {yTicks.map((tick) => {
          const y = padTop + plotH - (tick / maxVal) * plotH;
          return (
            <g key={tick}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="#EAD6DC"
                strokeDasharray={tick === 0 ? undefined : '3 3'}
                strokeWidth={1}
              />
              <text
                x={padLeft - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-[#9E8089] text-[10px] font-mono tabular-nums"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {data.map((point, idx) => {
          const groupCenter = padLeft + groupW * idx + groupW / 2;
          const borrowH = (point.borrows / maxVal) * plotH;
          const returnH = (point.returns / maxVal) * plotH;
          const borrowY = padTop + plotH - borrowH;
          const returnY = padTop + plotH - returnH;
          const isHovered = hoveredIdx === idx;

          return (
            <g
              key={point.date}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-pointer"
            >
              <rect
                x={padLeft + groupW * idx + 4}
                y={padTop}
                width={Math.max(10, groupW - 8)}
                height={plotH}
                rx={6}
                fill={isHovered ? '#F9EEF1' : 'transparent'}
              />
              <rect
                x={groupCenter - barW - 2}
                y={borrowY}
                width={barW}
                height={Math.max(2, borrowH)}
                rx={3}
                fill={isHovered ? '#4A101E' : '#6B1D2F'}
              />
              <rect
                x={groupCenter + 2}
                y={returnY}
                width={barW}
                height={Math.max(2, returnH)}
                rx={3}
                fill={isHovered ? '#D88A9E' : '#E3A9B9'}
              />
              <text
                x={groupCenter}
                y={height - 10}
                textAnchor="middle"
                className="fill-[#7D5C66] text-[10px] font-mono tabular-nums"
              >
                {point.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

interface CategoryChartProps {
  categories: CategoryStat[];
}

export function CategoryDistributionChart({ categories }: CategoryChartProps) {
  const sorted = [...categories].sort((a, b) => b.borrows - a.borrows);
  const maxBorrows = Math.max(1, ...sorted.map((c) => c.borrows));

  return (
    <div className="space-y-3.5">
      {sorted.map((item, idx) => {
        const pct = Math.round((item.borrows / maxBorrows) * 100);
        return (
          <div key={item.category} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-[#2C161D] truncate pr-3">
                {item.category}
              </span>
              <span className="font-mono tabular-nums text-[#7D5C66] shrink-0">
                {item.borrows} pinjam · {item.books} judul
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-[#F9EEF1] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${pct}%`,
                  backgroundColor: idx === 0 ? '#6B1D2F' : idx === 1 ? '#82263C' : '#C97B90',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
