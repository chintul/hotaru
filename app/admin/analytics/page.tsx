'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@apollo/client/react'
import { ADMIN_ANALYTICS, ADMIN_PRODUCTS } from '@/lib/queries'
import { formatMnt, nodes, parseJson, toNumber } from '@/lib/format'
import { errorMessage } from '@/lib/errors'
import { POSTHOG_DASHBOARD_URL, POSTHOG_HOST, POSTHOG_KEY } from '@/lib/env'
import type { AnalyticsCategoryRow, AnalyticsProductRow, AnalyticsReport, AnalyticsStockRow } from '@/lib/analytics'
import type { Connection, OrderStatus } from '@/lib/types'
import { Button, Card, PageHeader } from '@/components/admin/ui'
import { BarList, ColumnCharts, Meter, StatTile, formatCount } from '@/components/admin/charts'
import type { BarListItem } from '@/components/admin/charts'
import { cn } from '@/lib/utils'
import { STATUS_LABEL, STATUS_TONE } from '../_lib/order-status'

type PeriodKey = 'today' | '7d' | '30d' | '90d'

const PERIODS: ReadonlyArray<{ key: PeriodKey; label: string; days: number }> = [
  { key: 'today', label: 'Өнөөдөр', days: 1 },
  { key: '7d', label: '7 хоног', days: 7 },
  { key: '30d', label: '30 хоног', days: 30 },
  { key: '90d', label: '90 хоног', days: 90 },
]

const UB_OFFSET_MS = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

const STAGE_ORDER: readonly OrderStatus[] = [
  'awaiting_payment', 'deposit_paid', 'awaiting_balance', 'paid', 'packed',
  'shipped', 'delivered', 'oversold', 'refunded', 'cancelled',
]

const EMPTY_REPORT: AnalyticsReport = {
  totals: { orders: 0, revenue_mnt: 0, avg_order_mnt: 0 },
  by_day: [],
  top_products: [],
  categories: [],
  stock_low: [],
  stock_out: [],
  carts: { created: 0, converted: 0, abandoned: 0, active: 0, abandoned_value_mnt: 0 },
  order_stages: {},
}

const dayLabel = new Intl.DateTimeFormat('mn-MN', { month: 'short', day: 'numeric', timeZone: 'UTC' })

interface AnalyticsData {
  adminAnalytics: string | null
}

interface AnalyticsVars {
  since: string
  until: string
}

interface ProductIdsData {
  productCollection: Connection<{ id: string; slug: string }> | null
}

function windowFor(days: number): AnalyticsVars {
  const now = Date.now()
  const ub = new Date(now + UB_OFFSET_MS)
  const startOfToday = Date.UTC(ub.getUTCFullYear(), ub.getUTCMonth(), ub.getUTCDate()) - UB_OFFSET_MS
  return {
    since: new Date(startOfToday - (days - 1) * DAY_MS).toISOString(),
    until: new Date(now).toISOString(),
  }
}

function normalise(raw: string | null | undefined): AnalyticsReport {
  const r = parseJson<Partial<AnalyticsReport>>(raw, {})
  const t = r.totals ?? EMPTY_REPORT.totals
  const c = r.carts ?? EMPTY_REPORT.carts
  const sales = <T extends { units: number; revenue_mnt: number }>(rows: T[] | undefined): T[] =>
    (rows ?? []).map((row) => ({ ...row, units: toNumber(row.units), revenue_mnt: toNumber(row.revenue_mnt) }))
  return {
    totals: { orders: toNumber(t.orders), revenue_mnt: toNumber(t.revenue_mnt), avg_order_mnt: toNumber(t.avg_order_mnt) },
    by_day: (r.by_day ?? []).map((d) => ({ day: d.day, orders: toNumber(d.orders), revenue_mnt: toNumber(d.revenue_mnt) })),
    top_products: sales<AnalyticsProductRow>(r.top_products),
    categories: sales<AnalyticsCategoryRow>(r.categories),
    stock_low: (r.stock_low ?? []).map((s) => ({ ...s, quantity: toNumber(s.quantity), baseline: toNumber(s.baseline) })),
    stock_out: r.stock_out ?? [],
    carts: {
      created: toNumber(c.created),
      converted: toNumber(c.converted),
      abandoned: toNumber(c.abandoned),
      active: toNumber(c.active),
      abandoned_value_mnt: toNumber(c.abandoned_value_mnt),
    },
    order_stages: Object.fromEntries(Object.entries(r.order_stages ?? {}).map(([k, v]) => [k, toNumber(v)])),
  }
}

const percent = (part: number, whole: number): string =>
  whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—'

function posthogAppUrl(): string {
  if (POSTHOG_DASHBOARD_URL) return POSTHOG_DASHBOARD_URL
  try {
    const url = new URL(POSTHOG_HOST)
    const host = url.hostname.replace(/^(us|eu)\.i\.posthog\.com$/, '$1.posthog.com')
    return `${url.protocol}//${host}`
  } catch {
    return 'https://us.posthog.com'
  }
}

function Muted({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-[13px] text-muted-foreground">{children}</p>
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<PeriodKey>('30d')
  const days = PERIODS.find((p) => p.key === period)?.days ?? 30
  const variables = useMemo(() => windowFor(days), [days])

  const { data, loading, error } = useQuery<AnalyticsData, AnalyticsVars>(ADMIN_ANALYTICS, {
    variables,
    fetchPolicy: 'cache-and-network',
  })
  const { data: productData } = useQuery<ProductIdsData>(ADMIN_PRODUCTS, { fetchPolicy: 'cache-first' })

  const report = useMemo(() => normalise(data?.adminAnalytics), [data])
  const productIds = useMemo(
    () => new Map(nodes(productData?.productCollection).map((p) => [p.slug, p.id])),
    [productData])
  const productHref = (slug: string) => {
    const id = productIds.get(slug)
    return id ? `/admin/products/${id}` : '/admin/products'
  }

  const { totals, carts } = report
  const abandonRate = percent(carts.abandoned, carts.abandoned + carts.converted)

  const stageItems: BarListItem[] = STAGE_ORDER
    .filter((s) => (report.order_stages[s] ?? 0) > 0)
    .map((s) => ({
      key: s,
      label: STATUS_LABEL[s],
      value: report.order_stages[s] ?? 0,
      display: formatCount(report.order_stages[s] ?? 0),
      tone: STATUS_TONE[s],
    }))

  const switcher = (
    <div role="radiogroup" aria-label="Хугацаа" className="inline-flex rounded-lg border border-border bg-card p-0.5 max-sm:w-full">
      {PERIODS.map((p) => (
        <button
          key={p.key}
          type="button"
          role="radio"
          aria-checked={period === p.key}
          onClick={() => setPeriod(p.key)}
          className={cn(
            'rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors max-sm:min-h-9 max-sm:flex-1 max-sm:px-1',
            period === p.key ? 'bg-a-ink text-a-on-ink' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="Тайлан"
        subtitle="Борлуулалт, нөөц, сагс болон захиалгын явц. Огноо Улаанбаатарын цагаар."
        actions={switcher}
      />

      {error && (
        <p className="rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-[13px] text-danger-ink">
          {errorMessage(error, 'Тайланг ачаалж чадсангүй.')}
        </p>
      )}

      {loading && !data ? (
        <p className="text-[13px] text-muted-foreground">Ачааллаж байна…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Захиалга" value={formatCount(totals.orders)} />
            <StatTile label="Борлуулалт" value={formatMnt(totals.revenue_mnt)} />
            <StatTile label="Дундаж захиалга" value={totals.orders > 0 ? formatMnt(totals.avg_order_mnt) : '—'} />
            <StatTile
              label="Сагс орхилт"
              value={abandonRate}
              hint={`${formatCount(carts.abandoned)} орхисон · ${formatCount(carts.converted)} захиалсан`}
            />
          </div>

          <StockSection report={report} productHref={productHref} />

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Сагс орхилт" subtitle="Бараатай боловч 24+ цаг хөндөөгүй, захиалга болоогүй сагс">
              {carts.created === 0 ? (
                <Muted>Энэ хугацаанд сагс үүсээгүй байна.</Muted>
              ) : (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px] sm:grid-cols-3">
                  <Figure label="Орхисон" value={formatCount(carts.abandoned)} />
                  <Figure label="Захиалга болсон" value={formatCount(carts.converted)} />
                  <Figure label="Идэвхтэй хэвээр" value={formatCount(carts.active)} />
                  <Figure label="Орхилтын хувь" value={abandonRate} />
                  <Figure label="Орхисон сагсны үнэ" value={formatMnt(carts.abandoned_value_mnt)} />
                  <Figure label="Нийт сагс" value={formatCount(carts.created)} />
                </dl>
              )}
            </Card>

            <Card title="Захиалгын төлөв" subtitle="Энэ хугацаанд орсон захиалгууд одоо хаана байна">
              {stageItems.length === 0
                ? <Muted>Энэ хугацаанд захиалга ороогүй байна.</Muted>
                : <BarList items={stageItems} />}
            </Card>
          </div>

          <DailySection byDay={report.by_day} />

          <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
            <SalesTable
              title="Шилдэг бараа"
              nameHeader="Бараа"
              empty="Энэ хугацаанд зарагдсан бараа алга."
              rows={report.top_products.map((p) => ({ key: p.slug, name: p.title, href: productHref(p.slug), units: p.units, revenue: p.revenue_mnt }))}
            />
            <SalesTable
              title="Ангилал"
              nameHeader="Ангилал"
              empty="Энэ хугацаанд ангиллаар борлуулалт алга."
              rows={report.categories.map((c) => ({ key: c.slug, name: c.name, units: c.units, revenue: c.revenue_mnt }))}
            />
          </div>
        </>
      )}

      <PosthogCard />
    </div>
  )
}

function Figure({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-[15px] font-semibold text-foreground [overflow-wrap:anywhere]">{value}</dd>
    </div>
  )
}

function StockName({ row, href }: { row: AnalyticsStockRow; href: string }) {
  return (
    <Link href={href} className="block min-w-0 hover:underline">
      <span className="block truncate font-medium text-foreground">{row.title}</span>
      {row.variant && <span className="block truncate text-[12px] text-muted-foreground">{row.variant}</span>}
    </Link>
  )
}

function StockSection({ report, productHref }: { report: AnalyticsReport; productHref: (slug: string) => string }) {
  const rowClass = 'flex items-center gap-3 border-b border-border px-4 py-2.5 text-[13px] last:border-0 sm:px-6'
  return (
    <section aria-labelledby="stock-heading" className="space-y-2">
      <h2 id="stock-heading" className="text-[15px] font-semibold text-foreground">Нөөц анхаарах</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Дууссан" subtitle="Идэвхтэй сонголтуудаас үлдэгдэл 0 болсон" padded={false}>
          {report.stock_out.length === 0 ? (
            <Muted>Дууссан бараа алга. Сайн байна.</Muted>
          ) : (
            <ul>
              {report.stock_out.map((s) => (
                <li key={`${s.slug}-${s.variant ?? ''}`} className={cn(rowClass, 'max-sm:flex-wrap max-sm:gap-y-1.5')}>
                  <span className="min-w-0 flex-1"><StockName row={s} href={productHref(s.slug)} /></span>
                  {s.preorder && (
                    <span className="shrink-0 rounded-full border border-info-line bg-info-soft px-1.5 text-[11px] font-medium text-info-ink">
                      урьдчилсан захиалгаар зарагдаж байна
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="50%-иас бага үлдсэн" subtitle="Сүүлийн нөхөлтийн хагасаас доош орсон" padded={false}>
          {report.stock_low.length === 0 ? (
            <Muted>Бүх бараа хангалттай нөөцтэй байна.</Muted>
          ) : (
            <ul>
              {report.stock_low.map((s) => {
                const quantity = s.quantity ?? 0
                const baseline = s.baseline ?? 0
                return (
                  <li key={`${s.slug}-${s.variant ?? ''}`} className={rowClass}>
                    <span className="min-w-0 flex-1"><StockName row={s} href={productHref(s.slug)} /></span>
                    <span className="w-16 shrink-0 sm:w-24">
                      <Meter value={quantity} max={baseline} label={`${quantity} / ${baseline}`} />
                    </span>
                    <span className="w-14 shrink-0 text-right tabular-nums text-muted-foreground">
                      <span className="font-medium text-foreground">{quantity}</span> / {baseline}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>
    </section>
  )
}

function DailySection({ byDay }: { byDay: AnalyticsReport['by_day'] }) {
  const labels = byDay.map((d) => {
    const [y, m, day] = d.day.split('-').map(Number)
    return dayLabel.format(new Date(Date.UTC(y, (m ?? 1) - 1, day ?? 1)))
  })
  const hasSales = byDay.some((d) => d.orders > 0)

  return (
    <Card title="Өдрөөр" subtitle="Өдөр бүрийн захиалга ба борлуулалт">
      {byDay.length < 2 ? (
        <Muted>Нэг өдрийн тайланд өдрөөр задлах зүйлгүй — дээрх тоонууд өнөөдрийнх.</Muted>
      ) : !hasSales ? (
        <Muted>Энэ хугацаанд захиалга ороогүй байна.</Muted>
      ) : (
        <>
          <ColumnCharts
            labels={labels}
            series={[
              { key: 'orders', title: 'Захиалга', values: byDay.map((d) => d.orders), format: formatCount },
              { key: 'revenue', title: 'Борлуулалт', values: byDay.map((d) => d.revenue_mnt), format: (n) => formatMnt(n) },
            ]}
          />
          <details className="mt-4 text-[13px]">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Хүснэгтээр харах</summary>
            <table className="mt-2 w-full">
              <thead>
                <tr className="text-left text-[12px] text-muted-foreground">
                  <th className="py-1.5 font-normal">Өдөр</th>
                  <th className="py-1.5 text-right font-normal">Захиалга</th>
                  <th className="py-1.5 text-right font-normal">Борлуулалт</th>
                </tr>
              </thead>
              <tbody>
                {byDay.map((d, i) => (
                  <tr key={d.day} className="border-t border-border">
                    <td className="py-1.5">{labels[i]}</td>
                    <td className="py-1.5 text-right tabular-nums">{formatCount(d.orders)}</td>
                    <td className="py-1.5 text-right tabular-nums">{formatMnt(d.revenue_mnt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </Card>
  )
}

interface SalesRow {
  key: string
  name: string
  href?: string
  units: number
  revenue: number
}

type SortKey = 'units' | 'revenue'

function SortHeader({ label, active, desc, onClick }: { label: string; active: boolean; desc: boolean; onClick: () => void }) {
  return (
    <th
      aria-sort={active ? (desc ? 'descending' : 'ascending') : 'none'}
      className="px-3 py-2 text-right font-normal sm:px-4"
    >
      <button
        type="button"
        onClick={onClick}
        className={cn('inline-flex min-h-8 items-center gap-1 hover:text-foreground', active && 'text-foreground')}
      >
        {label}
        <span aria-hidden className={cn('text-[10px]', !active && 'opacity-0')}>{desc ? '▼' : '▲'}</span>
      </button>
    </th>
  )
}

function SalesTable({ title, nameHeader, rows, empty }: { title: string; nameHeader: string; rows: readonly SalesRow[]; empty: string }) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'units', desc: true })
  const sorted = useMemo(() => {
    const dir = sort.desc ? -1 : 1
    return [...rows].sort((a, b) => dir * (a[sort.key] - b[sort.key]))
  }, [rows, sort])
  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: true }))

  return (
    <Card title={title} padded={false}>
      {rows.length === 0 ? (
        <Muted>{empty}</Muted>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[12px] text-muted-foreground">
                <th className="px-3 py-2 font-normal sm:px-4">{nameHeader}</th>
                <SortHeader label="Зарагдсан" active={sort.key === 'units'} desc={sort.desc} onClick={() => toggle('units')} />
                <SortHeader label="Борлуулалт" active={sort.key === 'revenue'} desc={sort.desc} onClick={() => toggle('revenue')} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.key} className="border-t border-border">
                  <td className="max-w-0 px-3 py-2 sm:px-4">
                    {r.href
                      ? <Link href={r.href} className="block truncate font-medium text-foreground hover:underline">{r.name}</Link>
                      : <span className="block truncate font-medium text-foreground">{r.name}</span>}
                  </td>
                  <td className="w-20 px-3 py-2 text-right tabular-nums sm:w-24 sm:px-4">{formatCount(r.units)}</td>
                  <td className="w-28 whitespace-nowrap px-3 py-2 text-right tabular-nums sm:w-32 sm:px-4">{formatMnt(r.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

function PosthogCard() {
  return (
    <Card
      title="Зочид ба хандалт"
      subtitle="Зочлолт, барааны үзэлт, худалдан авалтын алхам (зочилсон → үзсэн → сагсанд → төлбөр рүү → захиалсан) болон хамгийн ачаалалтай цагууд PostHog-д байна."
      actions={POSTHOG_KEY ? (
        <Button variant="primary" asChild>
          <a href={posthogAppUrl()} target="_blank" rel="noreferrer">PostHog-д нээх</a>
        </Button>
      ) : undefined}
    >
      {POSTHOG_KEY ? undefined : (
        <p className="text-[13px] text-warn-ink">PostHog тохируулаагүй байна (NEXT_PUBLIC_POSTHOG_KEY)</p>
      )}
    </Card>
  )
}
