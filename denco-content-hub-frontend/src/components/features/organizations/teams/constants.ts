export const TEAM_ROLE_OPTIONS = [
  { value: 'team_lead', label: 'Лидер команды' },
  { value: 'team_member', label: 'Участник' },
  { value: 'team_viewer', label: 'Наблюдатель' },
]

export const TEAM_ROLE_LABELS: Record<string, string> = {
  team_lead: 'Лидер',
  team_member: 'Участник',
  team_viewer: 'Наблюдатель',
}

export const TEAM_ROLE_COLORS: Record<string, string> = {
  team_lead: 'contentHubTeal',
  team_member: 'cyan',
  team_viewer: 'gray',
}

export const WS_ROLE_OPTIONS = [
  { value: 'viewer', label: 'Наблюдатель' },
  { value: 'editor', label: 'Редактор' },
  { value: 'admin', label: 'Администратор' },
]
