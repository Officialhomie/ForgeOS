'use client'

import type { AgentTemplate, ConfigField } from '@/lib/agents/templates'
import { CaveatPreview } from './CaveatPreview'
import { FieldLabel } from '@/components/ui/Tooltip'

interface AgentConfigFormProps {
  template: AgentTemplate
  values: Record<string, string | number | boolean>
  prompt: string
  spendCap: number
  intervalHours: number
  onValuesChange: (values: Record<string, string | number | boolean>) => void
  onPromptChange: (prompt: string) => void
  onSpendCapChange: (cap: number) => void
  onIntervalChange: (hours: number) => void
}

export function AgentConfigForm({
  template,
  values,
  prompt,
  spendCap,
  intervalHours,
  onValuesChange,
  onPromptChange,
  onSpendCapChange,
  onIntervalChange,
}: AgentConfigFormProps) {
  function handleField(key: string, value: string | number | boolean) {
    onValuesChange({ ...values, [key]: value })
  }

  return (
    <div className="space-y-6">
      {/* Agent settings */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-forge-text">Agent settings</h3>
        {Object.entries(template.configSchema).map(([key, field]) => (
          <FormField
            key={key}
            fieldKey={key}
            field={field}
            value={values[key]}
            onChange={(v) => handleField(key, v)}
          />
        ))}
      </div>

      {/* Spending + schedule */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <FieldLabel
            label="Max spend per action (USDC)"
            tooltip="The most this agent can spend in a single action. It can never exceed this — even if you ask it to. Start low and increase once you trust it."
            className="text-sm font-medium text-forge-text-muted"
          />
          <input
            type="number"
            value={spendCap}
            min={1}
            max={500}
            onChange={(e) => onSpendCapChange(Number(e.target.value))}
            className="w-full rounded-lg border border-forge-border bg-forge-bg px-3 py-2 text-sm text-forge-text focus:border-orange-500 focus:outline-none"
          />
          <p className="text-xs text-forge-text-subtle">The agent can never spend more than this in a single action</p>
        </div>
        <div className="space-y-1">
          <FieldLabel
            label="How often it runs (hours)"
            tooltip="How frequently this agent wakes up and takes action on its own. Enter 1 for every hour, 0.5 for every 30 minutes, 24 for once a day."
            className="text-sm font-medium text-forge-text-muted"
          />
          <input
            type="number"
            value={intervalHours}
            min={0.25}
            step={0.25}
            onChange={(e) => onIntervalChange(Number(e.target.value))}
            className="w-full rounded-lg border border-forge-border bg-forge-bg px-3 py-2 text-sm text-forge-text focus:border-orange-500 focus:outline-none"
          />
          <p className="text-xs text-forge-text-subtle">How often the agent wakes up and acts automatically</p>
        </div>
      </div>

      {/* Instructions */}
      <div className="space-y-1">
        <FieldLabel
          label="Agent instructions"
          tooltip="Write what you want the agent to do every time it runs. Be specific — the clearer your instructions, the better the agent performs. You can use {variable} to insert values from the settings above."
          className="text-sm font-medium text-forge-text-muted"
        />
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          rows={5}
          className="w-full rounded-lg border border-forge-border bg-forge-bg px-3 py-2 font-mono text-xs text-forge-text placeholder:text-forge-text-subtle focus:border-orange-500 focus:outline-none"
        />
        <p className="text-xs text-forge-text-subtle">
          Tell the agent what to do on every run. Use {'{variable}'} placeholders to insert your settings.
        </p>
      </div>

      {/* Built-in protections */}
      <div className="space-y-1">
        <FieldLabel
          label="Built-in protections"
          tooltip="These rules are automatically applied every time your agent acts. The agent physically cannot break these limits — not even by accident. You set the spending cap above; the rest are fixed safety guardrails."
          className="text-sm font-medium text-forge-text-muted"
        />
        <CaveatPreview
          caveats={template.defaultCaveats}
          spendCap={spendCap}
          intervalSeconds={intervalHours * 3600}
        />
      </div>
    </div>
  )
}

// ─── FIELD RENDERER ───────────────────────────────────────────────────────────

function FormField({
  fieldKey,
  field,
  value,
  onChange,
}: {
  fieldKey: string
  field: ConfigField
  value: string | number | boolean | undefined
  onChange: (v: string | number | boolean) => void
}) {
  const current = value ?? field.defaultValue

  return (
    <div className="space-y-1">
      {field.description && field.type !== 'toggle' ? (
        <FieldLabel
          label={field.label + (field.required ? ' *' : '')}
          tooltip={field.description}
          className="text-sm font-medium text-forge-text-muted"
        />
      ) : (
        <label className="text-sm font-medium text-forge-text-muted">
          {field.label}
          {field.required && <span className="ml-1 text-forge-danger">*</span>}
        </label>
      )}

      {field.type === 'toggle' ? (
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={Boolean(current)}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 accent-orange-500"
          />
          <span className="text-sm text-forge-text">{field.description}</span>
        </label>
      ) : field.type === 'select' ? (
        <select
          value={String(current ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-forge-border bg-forge-bg px-3 py-2 text-sm text-forge-text focus:border-orange-500 focus:outline-none"
        >
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : field.type === 'number' ? (
        <input
          type="number"
          value={Number(current ?? 0)}
          onChange={(e) => onChange(Number(e.target.value))}
          placeholder={field.placeholder}
          className="w-full rounded-lg border border-forge-border bg-forge-bg px-3 py-2 text-sm text-forge-text placeholder:text-forge-text-subtle focus:border-orange-500 focus:outline-none"
        />
      ) : (
        <input
          type="text"
          value={String(current ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="w-full rounded-lg border border-forge-border bg-forge-bg px-3 py-2 text-sm text-forge-text placeholder:text-forge-text-subtle focus:border-orange-500 focus:outline-none"
        />
      )}

      {field.description && field.type !== 'toggle' && (
        <p className="text-xs text-forge-text-subtle">{field.description}</p>
      )}
    </div>
  )
}
