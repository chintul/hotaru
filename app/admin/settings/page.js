'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import { ADMIN_SETTINGS, UPDATE_SETTINGS } from '@/lib/queries'
import { nodes } from '@/lib/format'
import { Button, Card, Field, Input, PageHeader } from '@/components/admin/ui'

const GROUPS = [
  {
    title: 'Дансны мэдээлэл',
    hint: 'Захиалга өгсний дараа худалдан авагчид энэ мэдээлэл харагдана.',
    fields: [
      ['bankName', 'Банк'],
      ['bankAccountNumber', 'Дансны дугаар'],
      ['bankAccountName', 'Данс эзэмшигч'],
      ['bankSwift', 'SWIFT (заавал биш)'],
      ['paymentInstructions', 'Төлбөрийн заавар'],
    ],
  },
  {
    title: 'QPay QuickQR',
    hint: 'QR-аар төлсөн мөнгө шууд энэ данс руу орно. Банкны код нь банкны нэрээс өөр — QPay-д тоон код хэрэгтэй.',
    fields: [
      ['bankCode', 'Банкны код (жишээ нь 150000)'],
      ['qpayMerchantId', 'QPay merchant id'],
      ['qpayEnabled', 'QPay-г идэвхжүүлэх', 'toggle'],
    ],
  },
  {
    title: 'Нүүр хуудасны баннер',
    hint: 'Зургийг /admin/images-аас байршуулаад замыг нь энд оруулна.',
    fields: [
      ['heroImagePath', 'Зурагны зам (ImageKit)'],
      ['heroHeadline', 'Гарчиг'],
      ['heroSubline', 'Дэд гарчиг'],
      ['heroCtaLabel', 'Товчны текст'],
      ['heroCtaHref', 'Товчны холбоос'],
    ],
  },
  {
    title: 'Холбоо барих',
    fields: [
      ['ownerAlertEmail', 'Мэдэгдэл очих имэйл'],
      ['storeEmail', 'Дэлгүүрийн имэйл'],
      ['storePhone', 'Дэлгүүрийн утас'],
    ],
  },
]

export default function SettingsPage() {
  const { data, loading, refetch } = useQuery(ADMIN_SETTINGS)
  const [save, { loading: saving }] = useMutation(UPDATE_SETTINGS)
  const [form, setForm] = useState({})
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  const settings = nodes(data?.storeSettingsCollection)[0]
  useEffect(() => { if (settings) setForm(settings) }, [settings])

  if (loading && !data) return <p className="text-[13px] text-a-muted">Ачааллаж байна…</p>

  const allFields = GROUPS.flatMap((g) => g.fields)
  const placeholders = allFields
    .filter(([, , kind]) => kind !== 'toggle')
    .filter(([k]) => String(form[k] ?? '').includes('REPLACE_ME'))

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null); setSaved(false)
    const set = Object.fromEntries(allFields.map(([k]) => [k, form[k] ?? null]).filter(([, v]) => v !== null))
    try {
      const res = await save({ variables: { set } })
      if (res.data?.updateStoreSettingsCollection?.affectedCount === 0) {
        setError('Хадгалагдсангүй — админ эрхээ шалгана уу.')
      } else { setSaved(true); refetch() }
    } catch (e) { setError(e?.message ?? 'Алдаа гарлаа.') }
  }

  return (
    <form onSubmit={onSubmit}>
      <PageHeader
        title="Тохиргоо"
        subtitle="Дансны мэдээлэл өгөгдлийн санд хадгалагдана — код дахин байршуулах шаардлагагүй."
        actions={<Button type="submit" variant="primary" disabled={saving}>{saving ? 'Хадгалж байна…' : 'Хадгалах'}</Button>}
      />

      {placeholders.length > 0 && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-[13px] font-medium text-red-700">
            {placeholders.length} талбар загварын утгатай байна
          </p>
          <p className="mt-0.5 text-[13px] text-red-600">
            {placeholders.map(([, l]) => l).join(', ')} — бодит захиалга авахаас өмнө солино уу.
            Буруу данс болон зөв дансыг систем ялгаж чадахгүй.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {GROUPS.map((group) => (
          <Card key={group.title} title={group.title}>
            {group.hint && <p className="mb-4 text-[13px] text-a-muted">{group.hint}</p>}
            <div className="space-y-4">
              {group.fields.map(([key, label, kind]) => (
                kind === 'toggle' ? (
                  <label key={key} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={Boolean(form[key])}
                      onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                      className="accent-black"
                    />
                    <span className="text-[13px]">{label}</span>
                  </label>
                ) : (
                  <Field key={key} label={label}>
                    <Input value={form[key] ?? ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                  </Field>
                )
              ))}
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Button type="submit" disabled={saving}>{saving ? 'Хадгалж байна…' : 'Хадгалах'}</Button>
        {saved && <span className="text-[13px] text-emerald-600">Хадгалагдлаа.</span>}
        {error && <span className="text-[13px] text-red-600">{error}</span>}
      </div>
    </form>
  )
}
