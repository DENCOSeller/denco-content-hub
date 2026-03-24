import { createTheme, MantineColorsTuple } from '@mantine/core'

const neonBlue: MantineColorsTuple = [
  '#e5f4ff',
  '#cde2ff',
  '#9bc2ff',
  '#64a0ff',
  '#3884fe',
  '#1b72fe',
  '#0A84FF',
  '#0062db',
  '#0057c4',
  '#004aad',
]

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

const neonCyan: MantineColorsTuple = [
  '#e1f8ff',
  '#ccecff',
  '#9bd5ff',
  '#64bcfe',
  '#39a8fe',
  '#1d9bfe',
  '#32ADE6',
  '#0085d8',
  '#0077c3',
  '#0067ad',
]

const contentHubTeal: MantineColorsTuple = [
  '#f0fdfa',
  '#ccfbf1',
  '#99f6e4',
  '#5eead4',
  '#2dd4bf',
  '#14B8A6',
  '#0d9488',
  '#0f766e',
  '#115e59',
  '#134e4a',
]

export const theme = createTheme({
  primaryColor: 'contentHubTeal',
  colors: {
    neonBlue,
    neonViolet,
    neonCyan,
    contentHubTeal,
    dark: [
      '#C1C2C5',
      '#A6A7AB',
      '#909296',
      '#5C5F66',
      '#373A40',
      '#2C2E33',
      '#1C1C1E',
      '#141416',
      '#101012',
      '#0D0D0F',
    ],
  },
  fontFamily: 'Inter, sans-serif',
  defaultRadius: 'md',
  components: {
    Button: { defaultProps: { size: 'md' } },
    TextInput: { defaultProps: { size: 'md' } },
    PasswordInput: { defaultProps: { size: 'md' } },
    Select: { defaultProps: { size: 'md' } },
  },
})
