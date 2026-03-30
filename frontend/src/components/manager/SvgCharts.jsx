function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function formatCurrency(n) {
  const num = Number(n || 0);
  return `$${num.toFixed(2)}`;
}

function niceMax(maxValue) {
  const m = Math.max(0, Number(maxValue || 0));
  if (m <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(m)));
  const scaled = m / pow;
  const nice =
    scaled <= 1 ? 1 :
    scaled <= 2 ? 2 :
    scaled <= 5 ? 5 :
    10;
  return nice * pow;
}

export function VerticalBarChart({ data, height = 260, valueFormatter = formatCurrency }) {
  const safe = Array.isArray(data) ? data : [];
  const w = 720;
  const h = height;
  const padL = 52;
  const padR = 18;
  const padT = 18;
  const padB = 44;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const maxV = niceMax(Math.max(...safe.map((d) => Number(d.value || 0))));

  const barSlot = safe.length > 0 ? innerW / safe.length : innerW;
  const barW = clamp(barSlot * 0.66, 6, 44);

  const tickCount = 4;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => (maxV * i) / tickCount);

  const labelEvery = safe.length > 8 ? Math.ceil(safe.length / 8) : 1;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label="Bar chart">
        {/* y grid + ticks */}
        {ticks.map((t, i) => {
          const y = padT + innerH - (t / maxV) * innerH;
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="rgba(15,118,110,0.15)" strokeWidth="1" />
              <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="11" fill="rgba(28,25,23,0.75)">
                {valueFormatter(t).replace('$', '')}
              </text>
            </g>
          );
        })}

        {/* bars */}
        {safe.map((d, i) => {
          const v = Number(d.value || 0);
          const x = padL + i * barSlot + (barSlot - barW) / 2;
          const barH = maxV > 0 ? (v / maxV) * innerH : 0;
          const y = padT + innerH - barH;
          const isEmpty = v <= 0;
          return (
            <g key={`${d.label}-${i}`}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                rx={6}
                fill={isEmpty ? 'rgba(15,118,110,0.12)' : 'rgba(13,79,74,0.85)'}
              />
              {i % labelEvery === 0 && (
                <text
                  x={x + barW / 2}
                  y={padT + innerH + 24}
                  textAnchor="middle"
                  fontSize="11"
                  fill="rgba(28,25,23,0.7)"
                >
                  {String(d.label)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function LineChartCategory({ data, height = 260 }) {
  const safe = Array.isArray(data) ? data : [];
  const w = 720;
  const h = height;
  const padL = 52;
  const padR = 18;
  const padT = 18;
  const padB = 44;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const maxV = niceMax(Math.max(...safe.map((d) => Number(d.value || 0))));

  const labelEvery = safe.length > 10 ? Math.ceil(safe.length / 10) : 1;

  const points = safe.map((d, i) => {
    const t = safe.length <= 1 ? 0 : i / (safe.length - 1);
    const x = padL + t * innerW;
    const v = Number(d.value || 0);
    const y = padT + innerH - (v / maxV) * innerH;
    return { x, y, i, label: d.label };
  });

  const tickCount = 4;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => (maxV * i) / tickCount);

  const poly = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label="Line chart">
        {ticks.map((t, i) => {
          const y = padT + innerH - (t / maxV) * innerH;
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="rgba(13,79,74,0.12)" strokeWidth="1" />
              <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="11" fill="rgba(28,25,23,0.75)">
                {Math.round(t)}
              </text>
            </g>
          );
        })}

        {/* path */}
        <polyline
          points={poly}
          fill="none"
          stroke="rgba(13,79,74,0.9)"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* points */}
        {points.map((p) => (
          <g key={p.i}>
            <circle cx={p.x} cy={p.y} r={5} fill="white" stroke="rgba(13,79,74,0.95)" strokeWidth="3" />
          </g>
        ))}

        {/* x labels */}
        {points.map((p) => {
          if (p.i % labelEvery !== 0) return null;
          return (
            <text
              key={p.i}
              x={p.x}
              y={padT + innerH + 24}
              textAnchor="middle"
              fontSize="11"
              fill="rgba(28,25,23,0.7)"
            >
              {String(p.label)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export function HorizontalBarChart({ data, height = 320, valueFormatter = formatCurrency }) {
  const safe = Array.isArray(data) ? data : [];
  const w = 720;
  const h = height;
  const padL = 190;
  const padR = 22;
  const padT = 20;
  const padB = 26;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const maxV = niceMax(Math.max(...safe.map((d) => Number(d.value || 0))));

  const rowSlot = safe.length > 0 ? innerH / safe.length : innerH;
  const barH = clamp(rowSlot * 0.55, 10, 44);
  const labelEvery = safe.length > 10 ? Math.ceil(safe.length / 10) : 1;

  const tickCount = 4;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => (maxV * i) / tickCount);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label="Horizontal bar chart">
        {/* x grid + ticks */}
        {ticks.map((t, i) => {
          const x = padL + (t / maxV) * innerW;
          return (
            <g key={i}>
              <line x1={x} y1={padT} x2={x} y2={h - padB} stroke="rgba(13,79,74,0.12)" strokeWidth="1" />
              <text x={x} y={h - 8} textAnchor="middle" fontSize="11" fill="rgba(28,25,23,0.7)">
                {valueFormatter(t).replace('$', '')}
              </text>
            </g>
          );
        })}

        {/* bars */}
        {safe.map((d, i) => {
          const v = Number(d.value || 0);
          const y = padT + i * rowSlot + (rowSlot - barH) / 2;
          const barW = maxV > 0 ? (v / maxV) * innerW : 0;
          return (
            <g key={`${d.label}-${i}`}>
              <text x={padL - 10} y={y + barH / 2 + 4} textAnchor="end" fontSize="12" fill="rgba(28,25,23,0.78)">
                {String(d.label)}
              </text>
              <rect x={padL} y={y} width={barW} height={barH} rx={10} fill="rgba(13,79,74,0.86)" />
              {i % labelEvery === 0 && (
                <text x={padL + barW + 8} y={y + barH / 2 + 4} fontSize="12" fill="rgba(28,25,23,0.78)">
                  {valueFormatter(v)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function polarToCartesian(cx, cy, r, angleDeg) {
  const angleRad = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

export function DonutChart({ data, size = 180 }) {
  const safe = Array.isArray(data) ? data : [];
  const total = safe.reduce((sum, d) => sum + Number(d.value || 0), 0);
  const colors = [
    'rgba(13,79,74,0.95)',
    'rgba(94,234,212,0.95)',
    'rgba(56,189,248,0.9)',
    'rgba(99,102,241,0.9)',
    'rgba(251,191,36,0.9)',
  ];
  const thickness = 28;
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;

  let angle = 0;
  const segments = safe.map((d, i) => {
    const value = Number(d.value || 0);
    const pct = total > 0 ? value / total : 0;
    const start = angle;
    const end = angle + pct * 360;
    angle = end;
    return { ...d, i, start, end, color: colors[i % colors.length] };
  });

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Donut chart">
        <circle cx={cx} cy={cy} r={r} stroke="rgba(15,118,110,0.15)" strokeWidth={thickness} fill="none" />
        {segments.map((s) => {
          // If value is 0, end==start; avoid degenerate paths.
          if (s.end - s.start <= 0) return null;
          return (
            <path
              key={s.i}
              d={describeArc(cx, cy, r, s.start, s.end)}
              stroke={s.color}
              strokeWidth={thickness}
              strokeLinecap="round"
              fill="none"
            />
          );
        })}
      </svg>

      <div className="text-sm text-stone-700">
        {safe.length === 0 ? 'No data' : (
          <span className="tabular-nums">
            {safe[0].name}: {total > 0 ? `${safe[0].value.toFixed(2)} / ${total.toFixed(2)}` : '0'}
          </span>
        )}
      </div>
    </div>
  );
}

