import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { createTheme, localStorageColorSchemeManager, MantineProvider } from '@mantine/core'
import { DatesProvider } from '@mantine/dates'
import { Notifications } from '@mantine/notifications'
import 'dayjs/locale/zh-cn'
import App from './App'
import '@mantine/core/styles.css'
import '@mantine/dates/styles.css'
import '@mantine/notifications/styles.css'
import './styles.css'

const theme = createTheme({
  primaryColor: 'gainlab',
  fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", sans-serif',
  colors: {
    gainlab: ['#e9fff7', '#d3faeb', '#a9f2d4', '#7ce9bc', '#59e2aa', '#42dd9d', '#32d99b', '#22bd82', '#12a772', '#008f5f'],
  },
  defaultRadius: 'md',
})

const colorSchemeManager = localStorageColorSchemeManager({ key: 'gainlab-ai-trader-color-scheme' })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="dark" colorSchemeManager={colorSchemeManager}>
      <DatesProvider settings={{ locale: 'zh-cn', firstDayOfWeek: 1, weekendDays: [0, 6] }}>
        <Notifications position="top-right" />
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </DatesProvider>
    </MantineProvider>
  </React.StrictMode>,
)
