# Lounge OS

Веб-приложение для управления командой и операционной работой кальянной.

## Локальный запуск

```powershell
npm install
npm start
```

Приложение откроется по адресу `http://127.0.0.1:8765`.

## Проверка

```powershell
npm test
npm run build
```

## Supabase

Скопируйте `.env.example` в `.env` и заполните:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-anon-key
```

Примените миграцию из `supabase/migrations`, затем откройте «Настройки» и
войдите по magic link. Без этих параметров приложение продолжает работать в
локальном режиме через LocalStorage.

Для GitHub Pages добавьте такие же значения как repository secrets. Никогда не
помещайте `service_role` key в `.env`, GitHub Pages или браузерный код.

Для ручного переноса и аварийного восстановления используйте резервную копию
JSON на экране «Настройки».
