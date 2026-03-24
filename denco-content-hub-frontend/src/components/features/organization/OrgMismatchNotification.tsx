'use client'

import { useEffect } from 'react'
import { notifications } from '@mantine/notifications'
import { IconAlertTriangle } from '@tabler/icons-react'
import { useOrgSwitcher } from '@/api/hooks/useOrgSwitcher'

/**
 * Listens for 403 org mismatch events dispatched by the API interceptor.
 * Shows a notification suggesting the user switch organization.
 */
export function OrgMismatchNotification() {
  const { availableOrgs, switchOrg } = useOrgSwitcher()

  useEffect(() => {
    function handleMismatch(e: Event) {
      const detail = (e as CustomEvent).detail as {
        message: string
        requiredOrgId: number | null
      }

      const requiredOrg = detail.requiredOrgId
        ? availableOrgs.find((o) => o.id === detail.requiredOrgId)
        : null

      if (requiredOrg) {
        notifications.show({
          id: 'org-mismatch',
          title: 'Другая организация',
          message: `Этот ресурс принадлежит организации "${requiredOrg.name}". Нажмите здесь, чтобы переключиться.`,
          color: 'yellow',
          icon: <IconAlertTriangle size={18} />,
          autoClose: 8000,
          onClick: () => {
            switchOrg(requiredOrg.id)
            notifications.hide('org-mismatch')
          },
          style: { cursor: 'pointer' },
        })
      } else {
        notifications.show({
          id: 'org-mismatch',
          title: 'Нет доступа',
          message: detail.message || 'У вас нет доступа к этому ресурсу в текущей организации.',
          color: 'yellow',
          icon: <IconAlertTriangle size={18} />,
          autoClose: 5000,
        })
      }
    }

    window.addEventListener('denco:org-mismatch', handleMismatch)
    return () => window.removeEventListener('denco:org-mismatch', handleMismatch)
  }, [availableOrgs, switchOrg])

  return null
}
