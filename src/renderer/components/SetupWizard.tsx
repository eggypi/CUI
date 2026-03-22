import { useState } from 'react'
import { AppConfig } from '@shared/types'

interface SetupWizardProps {
  onSave: (config: AppConfig) => void
  onCancel?: () => void
}

export default function SetupWizard({ onSave, onCancel }: SetupWizardProps) {
  const [baseUrl, setBaseUrl] = useState('')
  const [modelName, setModelName] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!baseUrl.trim()) {
      errs.baseUrl = 'Base URL 不能为空'
    } else {
      try {
        new URL(baseUrl)
      } catch {
        errs.baseUrl = '请输入有效的 URL'
      }
    }
    if (!modelName.trim()) {
      errs.modelName = 'Model Name 不能为空'
    }
    if (!apiKey.trim()) {
      errs.apiKey = 'API Key 不能为空'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    try {
      const config: AppConfig = {
        baseUrl: baseUrl.trim(),
        modelName: modelName.trim(),
        apiKey: apiKey.trim(),
      }
      await window.electronAPI.invoke('config:save', config)
      onSave(config)
    } catch (err) {
      setErrors({ submit: String(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-screen w-screen bg-dark-bg flex items-center justify-center">
      <div className="w-full max-w-md mx-4">
        <div className="bg-dark-card rounded-card p-8 border border-dark-border shadow-2xl">
          {/* Logo / Title */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-dark-accent/20 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect x="4" y="6" width="24" height="20" rx="3" stroke="#6c63ff" strokeWidth="2" />
                <path d="M4 12h24" stroke="#6c63ff" strokeWidth="2" />
                <path d="M10 18l2 2 4-4" stroke="#6c63ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-dark-text">配置 Claude Code</h1>
            <p className="text-sm text-dark-muted mt-2">
              请输入内部模型服务的连接信息
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Base URL */}
            <div>
              <label className="block text-sm font-medium text-dark-text mb-1.5">
                Base URL
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com/v1"
                className={`w-full px-3 py-2.5 bg-dark-bg border rounded-lg text-sm text-dark-text placeholder-dark-muted outline-none transition-colors focus:border-dark-accent ${
                  errors.baseUrl ? 'border-dark-error' : 'border-dark-border'
                }`}
              />
              {errors.baseUrl && (
                <p className="text-xs text-dark-error mt-1">{errors.baseUrl}</p>
              )}
            </div>

            {/* Model Name */}
            <div>
              <label className="block text-sm font-medium text-dark-text mb-1.5">
                Model Name
              </label>
              <input
                type="text"
                value={modelName}
                onChange={e => setModelName(e.target.value)}
                placeholder="claude-sonnet-4-20250514"
                className={`w-full px-3 py-2.5 bg-dark-bg border rounded-lg text-sm text-dark-text placeholder-dark-muted outline-none transition-colors focus:border-dark-accent ${
                  errors.modelName ? 'border-dark-error' : 'border-dark-border'
                }`}
              />
              {errors.modelName && (
                <p className="text-xs text-dark-error mt-1">{errors.modelName}</p>
              )}
            </div>

            {/* API Key */}
            <div>
              <label className="block text-sm font-medium text-dark-text mb-1.5">
                API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="sk-..."
                className={`w-full px-3 py-2.5 bg-dark-bg border rounded-lg text-sm text-dark-text placeholder-dark-muted outline-none transition-colors focus:border-dark-accent ${
                  errors.apiKey ? 'border-dark-error' : 'border-dark-border'
                }`}
              />
              {errors.apiKey && (
                <p className="text-xs text-dark-error mt-1">{errors.apiKey}</p>
              )}
            </div>

            {errors.submit && (
              <p className="text-xs text-dark-error">{errors.submit}</p>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 py-2.5 border border-dark-border text-dark-text rounded-lg text-sm hover:bg-dark-hover transition-colors"
                >
                  取消
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 bg-dark-accent hover:bg-dark-accent-hover disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {saving ? '保存中...' : '保存配置'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
