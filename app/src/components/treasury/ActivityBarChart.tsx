'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatUsdc } from '@/lib/utils'

export function ActivityBarChart({
  dailySpend,
}: {
  dailySpend: { date: string; total: bigint }[]
}) {
  const data = dailySpend.map((row) => ({
    date: row.date.slice(5),
    usdc: Number(row.total) / 1e6,
  }))

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#71717a', fontSize: 10 }}
            axisLine={{ stroke: '#3f3f46' }}
          />
          <YAxis
            tick={{ fill: '#71717a', fontSize: 10 }}
            axisLine={{ stroke: '#3f3f46' }}
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip
            formatter={(value) => [
              `$${Number(value ?? 0).toFixed(2)}`,
              'x402 spend',
            ]}
            contentStyle={{
              background: '#18181b',
              border: '1px solid #3f3f46',
              borderRadius: '8px',
            }}
          />
          <Bar dataKey="usdc" fill="#f97316" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-2 text-center text-xs text-forge-text-subtle">
        Daily x402 / agent payments (last 30 days)
      </p>
    </div>
  )
}
