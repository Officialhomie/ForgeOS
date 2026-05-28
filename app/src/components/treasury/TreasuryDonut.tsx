'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { formatUsdc } from '@/lib/utils'

const COLORS = {
  available: '#22c55e',
  spent: '#f97316',
  reserved: '#3f3f46',
}

export function TreasuryDonut({
  available,
  spent,
  reserved,
}: {
  available: bigint
  spent: bigint
  reserved: bigint
}) {
  const data = [
    { name: 'Available', value: Number(available) / 1e6, fill: COLORS.available },
    { name: 'Spent', value: Number(spent) / 1e6, fill: COLORS.spent },
    { name: 'Reserved', value: Number(reserved) / 1e6, fill: COLORS.reserved },
  ].filter((d) => d.value > 0)

  if (data.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-forge-text-muted">
        No spending activity yet
      </p>
    )
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="h-48 w-full shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={80}
              paddingAngle={2}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => `$${Number(value ?? 0).toFixed(2)}`}
              contentStyle={{
                background: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: '8px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs text-forge-text-muted">
        <li className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-forge-success" />
          Available {formatUsdc(available)}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-forge-orange" />
          Spent {formatUsdc(spent)}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-forge-elevated" />
          Reserved {formatUsdc(reserved)}
        </li>
      </ul>
    </div>
  )
}
