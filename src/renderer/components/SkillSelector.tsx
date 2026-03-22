import { useState, useEffect } from 'react'

interface Skill {
  name: string
  description: string
}

interface SkillSelectorProps {
  filter: string
  onSelect: (name: string) => void
  onClose: () => void
}

export default function SkillSelector({ filter, onSelect, onClose }: SkillSelectorProps) {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.electronAPI.invoke('claude:getSkills')
      .then((result: unknown) => {
        setSkills(result as Skill[])
      })
      .catch(() => {
        setSkills([])
      })
      .finally(() => setLoading(false))
  }, [])

  const filtered = skills.filter(s =>
    s.name.toLowerCase().includes(filter.toLowerCase()) ||
    s.description.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="border-t border-dark-border max-h-48 overflow-y-auto">
      {loading ? (
        <div className="px-3 py-4 text-xs text-dark-muted text-center">加载 Skills...</div>
      ) : filtered.length === 0 ? (
        <div className="px-3 py-4 text-xs text-dark-muted text-center">
          {skills.length === 0 ? '没有可用的 Skill' : '无匹配结果'}
        </div>
      ) : (
        filtered.map(skill => (
          <button
            key={skill.name}
            onClick={() => onSelect(skill.name)}
            className="w-full px-3 py-2 text-left hover:bg-dark-hover transition-colors flex items-start gap-2"
          >
            <span className="text-dark-accent text-sm font-mono">/{skill.name}</span>
            <span className="text-dark-muted text-xs truncate">{skill.description}</span>
          </button>
        ))
      )}
      <div className="px-3 py-1.5 border-t border-dark-border">
        <button
          onClick={onClose}
          className="text-xs text-dark-muted hover:text-dark-text"
        >
          Esc 关闭
        </button>
      </div>
    </div>
  )
}
