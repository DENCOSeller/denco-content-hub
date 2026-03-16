'use client'

import { Select } from '@mantine/core'
import { IconBuilding } from '@tabler/icons-react'

import { useCompaniesQuery } from '@/api/hooks/useCompanies'
import { useCompanyStore } from '@/stores/company-store'
import styles from './CompanySwitcher.module.css'

export function CompanySwitcher() {
  const { data: companiesData } = useCompaniesQuery(1, 100)
  const activeCompany = useCompanyStore((s) => s.activeCompany)
  const setActiveCompany = useCompanyStore((s) => s.setActiveCompany)
  const clearActiveCompany = useCompanyStore((s) => s.clearActiveCompany)

  const options = [
    { value: 'all', label: 'Все компании' },
    ...(companiesData?.items ?? []).map((c) => ({
      value: String(c.id),
      label: c.name,
    })),
  ]

  const handleChange = (value: string | null) => {
    if (!value || value === 'all') {
      clearActiveCompany()
      return
    }

    const company = companiesData?.items.find((c) => c.id === Number(value))
    if (company) {
      setActiveCompany({ id: company.id, name: company.name, slug: company.slug })
    }
  }

  return (
    <Select
      data={options}
      value={activeCompany ? String(activeCompany.id) : 'all'}
      onChange={handleChange}
      leftSection={<IconBuilding size={16} />}
      placeholder="Компания"
      allowDeselect={false}
      className={styles.switcher}
      classNames={{
        input: styles.switcherInput,
        dropdown: styles.switcherDropdown,
      }}
      comboboxProps={{ withinPortal: true }}
    />
  )
}
