# Lounge OS

Приложение для управления командой и операционной работой кальянной. Доступно
как самостоятельное Windows-приложение, веб-версия и устанавливаемое
приложение для Android/iPhone.

## Приложение для телефона

Откройте `https://kenigsfels.github.io/lounge-os-app/` на телефоне и перейдите
в «Настройки» → «Мобильное приложение». На Android нажмите кнопку установки,
а на iPhone используйте Safari → «Поделиться» → «На экран Домой».

Телефонная версия использует тот же код, локальный offline-кэш и Supabase, что
и приложение на компьютере. Подробности — в `docs/mobile-app.md`.

## Windows-приложение

Готовый установщик создаётся в `release/LoungeOS-Setup-0.6.0-x64.exe`:

```powershell
npm install
npm run desktop:build
```

Для разработки оболочки используйте `npm run desktop:dev`, а для проверки
распакованной версии — `npm run desktop:pack`. Установленное приложение
работает в собственном окне и открывает разделы через ссылки вида
`loungeos://open/tasks`. Подробности — в `docs/desktop-app.md`.

## График

Установленное приложение читает общий локальный график из
`C:\Users\User\Desktop\LoungeOS\schedule\app-schedule.json`. Этот файл
создаётся сценарием `SyncGoogleSchedule.ps1` во внешнем рабочем каталоге и
одновременно обновляет недельные CSV Rainmeter. Реальные имена и смены не
включаются в публичный репозиторий или сборку GitHub Pages.

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
