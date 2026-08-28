import { Moon, Sun } from 'lucide-react'
import { useMantineColorScheme } from '@mantine/core'

export function ThemeMenuItem() {
  const { colorScheme, setColorScheme } = useMantineColorScheme()
  const isLight = colorScheme === 'light'

  return (
    <button
      className="user-menu-theme"
      type="button"
      role="menuitem"
      aria-label={`切换为${isLight ? '暗色' : '亮色'}模式`}
      onClick={() => setColorScheme(isLight ? 'dark' : 'light')}
    >
      {isLight ? <Sun size={16} /> : <Moon size={16} />}
      <span>主题颜色</span>
      <small>{isLight ? '亮色' : '暗色'}</small>
    </button>
  )
}
