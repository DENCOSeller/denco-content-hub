import { Center, Loader } from '@mantine/core'

export default function Loading() {
  return (
    <Center mih="100vh" bg="var(--app-bg)">
      <Loader size="lg" color="contentHubTeal" />
    </Center>
  )
}
