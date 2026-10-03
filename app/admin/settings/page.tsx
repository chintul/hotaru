'use client'

import { useState, type FormEvent } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import { ADMIN_SETTINGS, UPDATE_SETTINGS } from '@/lib/queries'
import { firstNode } from '@/lib/format'
import type { Connection, StoreSettings } from '@/lib/types'
import { Button, Card, Field, Input, PageHeader } from '@/components/admin/ui'
import { errorMessage } from '@/lib/errors'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

type TextSettingKey = {
  [K in keyof StoreSettings]-?: NonNullable<StoreSettings[K]> extends string ? K : never
}[keyof StoreSettings]

type SettingField =
  | { kind: 'text'; key: TextSettingKey; label: string }
  | { kind: 'toggle'; key: 'qpayEnabled'; label: string }

interface SettingGroup {
  title: string
  hint: string
  fields: SettingField[]
}

const text = (key: TextSettingKey, label: string): SettingField => ({ kind: 'text', key, label })

const GROUPS: SettingGroup[] = [
  {
    title: 'Дансны мэдээлэл',
    hint: 'Захиалга өгсний дараа худалдан авагчид энэ мэдээлэл харагдана.',
    fields: [
      text('bankName', 'Банк'),
      text('bankAccountNumber', 'Дансны дугаар'),
      text('bankAccountName', 'Данс эзэмшигч'),
      text('bankSwift', 'SWIFT (заавал биш)'),
      text('paymentInstructions', 'Төлбөрийн заавар'),
    ],
  },
  {
    title: 'QPay QuickQR',
    hint: 'QR-аар төлсөн мөнгө шууд энэ данс руу орно. Банкны код нь банкны нэрээс өөр — QPay-д тоон код хэрэгтэй.',
    fields: [
      text('bankCode', 'Банкны код (Хаан 050000, ХХБ 040000, Голомт 150000)'),
      text('qpayMerchantId', 'QPay merchant id'),
      { kind: 'toggle', key: 'qpayEnabled', label: 'QPay-г идэвхжүүлэх' },
    ],
  },
  {
    title: 'Нүүр хуудасны баннер',
    hint: 'Зургийг аль нэг бүтээгдэхүүний Зураг таб-аас байршуулаад замыг нь энд хуулна.',
    fields: [
      text('heroImagePath', 'Зурагны зам (ImageKit)'),
      text('heroHeadline', 'Гарчиг'),
      text('heroSubline', 'Дэд гарчиг'),
      text('heroCtaLabel', 'Товчны текст'),
      text('heroCtaHref', 'Товчны холбоос'),
    ],
  },
  {
    title: 'Холбоо барих',
    hint: 'Хоосон талбар хуудсан дээр огт харагдахгүй. Сошиал холбоосыг бүтнээр нь (https://…) бичнэ үү.',
    fields: [
      text('ownerAlertEmail', 'Мэдэгдэл очих имэйл'),
      text('storeEmail', 'Дэлгүүрийн имэйл'),
      text('storePhone', 'Дэлгүүрийн утас'),
      text('storeAddress', 'Дэлгүүрийн хаяг'),
      text('facebookUrl', 'Facebook хаяг'),
      text('instagramUrl', 'Instagram хаяг'),
    ],
  },
]

const ALL_FIELDS = GROUPS.flatMap((g) => g.fields)

const TEMPLATE_PLACEHOLDER = 'REPLACE_ME'

type SettingsRow = StoreSettings & { id?: string }

interface SettingsData {
  storeSettingsCollection: Connection<SettingsRow> | null
}

interface UpdateSettingsData {
  updateStoreSettingsCollection: { affectedCount: number } | null
}

type SettingsPatch = Partial<Record<SettingField['key'], string | boolean>>

function nonNullFields(form: StoreSettings): SettingsPatch {
  const patch: SettingsPatch = {}
  for (const { key } of ALL_FIELDS) {
    const value = form[key]
    if (value != null) patch[key] = value
  }
  return patch
}

export default function SettingsPage() {
  const { data, loading, refetch } = useQuery<SettingsData>(ADMIN_SETTINGS)
  const settings = firstNode(data?.storeSettingsCollection)

  if (loading && !data) return <p className="text-[13px] text-a-muted">Ачааллаж байна…</p>

  return <SettingsForm key={settings?.id ?? 'empty'} settings={settings} refetch={refetch} />
}

interface SettingsFormProps {
  settings: SettingsRow | null
  refetch: () => unknown
}

function SettingsForm({ settings, refetch }: SettingsFormProps) {
  const [save, { loading: saving }] = useMutation<UpdateSettingsData, { set: SettingsPatch }>(UPDATE_SETTINGS)
  const [form, setForm] = useState<StoreSettings>(settings ?? {})
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const placeholders = ALL_FIELDS
    .filter((field) => field.kind === 'text')
    .filter(({ key }) => String(form[key] ?? '').includes(TEMPLATE_PLACEHOLDER))

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null); setSaved(false)
    try {
      const res = await save({ variables: { set: nonNullFields(form) } })
      if (res.data?.updateStoreSettingsCollection?.affectedCount === 0) {
        setError('Хадгалагдсангүй — админ эрхээ шалгана уу.')
      } else { setSaved(true); refetch() }
    } catch (err) { setError(errorMessage(err, 'Алдаа гарлаа.')) }
  }

  return (
    <form onSubmit={onSubmit}>
      <PageHeader
        title="Тохиргоо"
        subtitle="Дансны мэдээлэл өгөгдлийн санд хадгалагдана — код дахин байршуулах шаардлагагүй."
        actions={<Button type="submit" variant="primary" disabled={saving}>{saving ? 'Хадгалж байна…' : 'Хадгалах'}</Button>}
      />

      {placeholders.length > 0 && (
        <div className="mb-4 rounded-lg border border-danger-line bg-danger-soft px-4 py-3 sm:mb-6">
          <p className="text-[13px] font-medium text-danger-ink">
            {placeholders.length} талбар загварын утгатай байна
          </p>
          <p className="mt-0.5 text-[13px] text-danger-ink">
            {placeholders.map(({ label }) => label).join(', ')} — бодит захиалга авахаас өмнө солино уу.
            Буруу данс болон зөв дансыг систем ялгаж чадахгүй.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {GROUPS.map((group) => (
          <Card key={group.title} title={group.title}>
            {group.hint && <p className="mb-4 text-[13px] text-a-muted">{group.hint}</p>}
            <div className="space-y-4">
              {group.fields.map((field) => (
                field.kind === 'toggle' ? (
                  <div key={field.key} className="flex min-h-10 items-center gap-3">
                    <Checkbox
                      id={`setting-${field.key}`}
                      checked={Boolean(form[field.key])}
                      onCheckedChange={(checked) => setForm({ ...form, [field.key]: checked === true })}
                      className="bg-card dark:bg-card"
                    />
                    <Label htmlFor={`setting-${field.key}`} className="text-[13px] font-normal">{field.label}</Label>
                  </div>
                ) : (
                  <Field key={field.key} label={field.label}>
                    <Input
                      value={form[field.key] ?? ''}
                      onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                    />
                  </Field>
                )
              ))}
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 sm:mt-6">
        <Button type="submit" className="max-sm:w-full" disabled={saving}>{saving ? 'Хадгалж байна…' : 'Хадгалах'}</Button>
        {saved && <span className="text-[13px] text-success-ink">Хадгалагдлаа.</span>}
        {error && <span className="text-[13px] text-danger-ink">{error}</span>}
      </div>
    </form>
  )
}
