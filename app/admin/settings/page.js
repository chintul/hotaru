'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import { ADMIN_SETTINGS, UPDATE_SETTINGS } from '@/lib/queries'
import { nodes } from '@/lib/format'
import AdminGate from '@/components/AdminGate'

export default function SettingsPage() {
  return <AdminGate><SettingsForm /></AdminGate>
}

const FIELDS = [
  ['bankName', 'Банк'],
  ['bankAccountNumber', 'Дансны дугаар'],
  ['bankAccountName', 'Данс эзэмшигч'],
  ['bankSwift', 'SWIFT (заавал биш)'],
  ['paymentInstructions', 'Төлбөрийн заавар'],
  ['ownerAlertEmail', 'Мэдэгдэл очих имэйл'],
  ['storeEmail', 'Дэлгүүрийн имэйл'],
  ['storePhone', 'Дэлгүүрийн утас'],
]

function SettingsForm() {
  const { data, loading, refetch } = useQuery(ADMIN_SETTINGS)
  const [save, { loading: saving }] = useMutation(UPDATE_SETTINGS)
  const [form, setForm] = useState({})
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  const settings = nodes(data?.storeSettingsCollection)[0]
  useEffect(() => { if (settings) setForm(settings) }, [settings])

  if (loading && !data) return <p className="label text-ink-faint">Ачааллаж байна…</p>

  const placeholders = FIELDS
    .filter(([k]) => String(form[k] ?? '').includes('REPLACE_ME'))
    .map(([, label]) => label)

  return (
    <div className="max-w-xl">
      <h2 className="label">Дэлгүүрийн тохиргоо</h2>
      <p className="mt-2 text-ink-soft">
        Дансны мэдээлэл өгөгдлийн санд хадгалагдана — код дахин байршуулах шаардлагагүй.
      </p>

      {placeholders.length > 0 && (
        <p className="mt-5 border border-sale px-4 py-3 text-sale">
          Дараах талбарууд загварын утгатай байна: {placeholders.join(', ')}. Бодит захиалга авахаас
          өмнө солино уу.
        </p>
      )}

      <form
        className="mt-8 space-y-5"
        onSubmit={async (e) => {
          e.preventDefault()
          setError(null); setSaved(false)
          const set = Object.fromEntries(
            FIELDS.map(([k]) => [k, form[k] ?? null]).filter(([, v]) => v !== null),
          )
          try {
            const res = await save({ variables: { set } })
            if (res.data?.updateStoreSettingsCollection?.affectedCount === 0) {
              setError('Хадгалагдсангүй — админ эрхээ шалгана уу.')
            } else { setSaved(true); refetch() }
          } catch (e) { setError(e?.message ?? 'Алдаа гарлаа.') }
        }}
      >
        {FIELDS.map(([key, label]) => (
          <label key={key} className="block">
            <span className="label text-ink-faint">{label}</span>
            <input
              value={form[key] ?? ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-ink"
            />
          </label>
        ))}
        {error && <p className="text-sale">{error}</p>}
        {saved && <p className="text-ink-soft">Хадгалагдлаа.</p>}
        <button type="submit" disabled={saving}
          className="label bg-ink px-6 py-3 text-paper transition-opacity hover:opacity-85 disabled:opacity-40">
          {saving ? 'Хадгалж байна…' : 'Хадгалах'}
        </button>
      </form>
    </div>
  )
}
