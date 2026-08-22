import { useEffect, useRef } from 'react'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { init, use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'

use([LineChart, GridComponent, TooltipComponent, CanvasRenderer])

export type PnlCurvePoint = {
  time: string
  pnl: number
  change: number
}

export function PnlChart({ data }: { data: PnlCurvePoint[] }) {
  const chartRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!chartRef.current || !data.length) return
    const chart = init(chartRef.current, undefined, { renderer: 'canvas' })
    chart.setOption({
      animationDuration: 450,
      grid: { top: 22, right: 22, bottom: 34, left: 66 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0b1814',
        borderColor: 'rgba(50,217,155,.28)',
        textStyle: { color: '#d9e7e2', fontSize: 12 },
        valueFormatter: (value: number) => `${value >= 0 ? '+' : ''}¥${Number(value).toFixed(2)}`,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: data.map((item) => item.time),
        axisLine: { lineStyle: { color: 'rgba(132,160,150,.22)' } },
        axisTick: { show: false },
        axisLabel: { color: '#789087', fontSize: 12 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: 'rgba(132,160,150,.1)' } },
        axisLabel: { color: '#789087', fontSize: 12, formatter: (value: number) => `¥${value}` },
      },
      series: [{
        name: '累计净盈亏',
        type: 'line',
        smooth: true,
        showSymbol: data.length < 40,
        symbolSize: 7,
        data: data.map((item) => item.pnl),
        lineStyle: { width: 2, color: '#32d99b' },
        itemStyle: { color: '#32d99b', borderColor: '#0b1814', borderWidth: 2 },
        areaStyle: { color: 'rgba(50,217,155,.12)' },
      }],
    })
    const resizeObserver = new ResizeObserver(() => chart.resize())
    resizeObserver.observe(chartRef.current)
    return () => {
      resizeObserver.disconnect()
      chart.dispose()
    }
  }, [data])

  if (!data.length) return <div className="pnl-chart-empty">当前筛选范围暂无盈亏曲线</div>
  return <div className="pnl-chart-canvas" ref={chartRef} />
}
