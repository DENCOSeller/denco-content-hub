import { createDencoTheme } from '@denco/ui/theme'
import type { MantineColorsTuple, MantineThemeOverride } from '@mantine/core'

/**
 * Content Hub uses createDencoTheme('contentHub') as base.
 * neonViolet is added because it's used in gradient props (ContentChatTab, WorkspaceCard, etc.)
 */
const neonViolet: MantineColorsTuple = [
  '#f6ecfe',
  '#e8d5f5',
  '#cda8e8',
  '#b178db',
  '#9a50d1',
  '#8b37cb',
  '#BF5AF2',
  '#6e24a8',
  '#621e97',
  '#551685',
]

const base = createDencoTheme('contentHub')

export const theme: MantineThemeOverride = {
  ...base,
  colors: {
    ...base.colors,
    neonViolet,
  },
}
