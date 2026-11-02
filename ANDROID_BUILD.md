# Android APK

Нативная оболочка Galaxy League на **Capacitor 6** + Android WebView. APK не содержит 763 МБ игровых ассетов: WebView открывает задеплоенную игру, поэтому остаются те же origin, `localStorage` и прогресс, а веб-обновления подхватываются без переустановки APK.

## Требования

- Node.js и `npm install`
- Android SDK: platform **android-34**, build-tools **34.0.0**
- JDK **17** (удобнее всего — JBR из Android Studio). Gradle 8.2.1 не работает на JDK 21.
- Python + Pillow — только для перегенерации иконок и сплеша

Скрипт сборки сам находит Android SDK (`ANDROID_HOME`, `ANDROID_SDK_ROOT`, `%LOCALAPPDATA%\Android\Sdk`) и JDK 17 (Android Studio JBR), поэтому вручную выставлять переменные обычно не нужно.

Если репозиторий лежит в пути с кириллицей, сборка всё равно работает: в `android/gradle.properties` включён `android.overridePathCheck=true` (AGP иначе блокирует такие пути).

## Сборка

```bash
npm run android:apk
```

Команда:

1. синхронизирует Capacitor-проект (`cap sync android`);
2. собирает `assembleRelease` и подписывает APK release-ключом;
3. проверяет подпись через `apksigner` и выводит package/version;
4. кладёт результат в `builds/GalaxyLeague-<version>.apk` и рядом `.sha256`.

Другие команды:

```bash
npm run android:debug    # debug APK (подпись debug-ключом, release-keystore не нужен)
npm run android:sync     # только синхронизация веб-части
npm run android:open     # открыть android/ в Android Studio
npm run android:assets   # перегенерировать иконки и сплеш из public/assets/images/logo*.png
```

Перед сборкой из Android Studio (а не через `npm run android:apk`) выполните `npm run android:sync`, иначе WebView не получит актуальные локальные ассеты и `capacitor.config.json`.

Установка на устройство:

```bash
adb install -r builds/GalaxyLeague-1.0.106.apk
```

Либо скопировать APK на телефон и разрешить установку из неизвестных источников.

## Версия и URL игры

Версия нативной оболочки задаётся в `android/app/build.gradle`:

```groovy
versionCode 106
versionName "1.0.106"
```

`versionCode` нужно увеличивать при каждом обновлении APK, иначе Android не даст установить новую версию поверх старой.

По умолчанию WebView открывает:

```text
https://sergiodecaux.github.io/memeball-arena/
```

Для staging/локальной сборки URL можно переопределить:

```powershell
$env:NATIVE_APP_URL = "https://example.com/memeball-arena/"
npm run android:apk
```

URL зашивается в `capacitor.config.ts` на момент `cap sync` и попадает в APK. Для продакшена используйте HTTPS-origin с тем же API, что и у веб-версии.

## Подпись и обновления

Release-ключ и параметры подписи лежат локально:

- `android/keys/galaxyleague-release.jks`
- `android/keystore.properties`

Оба пути исключены из git. **Сделайте резервную копию этих двух файлов.** Если ключ потерян, обновить уже установленное приложение новой сборкой нельзя: подпись не совпадёт, потребуется удаление приложения (локальный `localStorage` будет потерян; серверный прогресс останется).

APK подписывается схемами v1 + v2 + v3, поэтому устанавливается на Android 5.1+ и корректно обновляется на современных версиях.

## Что оптимизировано под игру

- полноэкранный immersive-режим, скрытые статус-бар и навигация;
- `KEEP_SCREEN_ON` и `setSustainedPerformanceMode(true)` для стабильного FPS в длинных матчах;
- приоритет рендерера WebView `RENDERER_PRIORITY_IMPORTANT` и аппаратный слой;
- отключены zoom, overscroll, long-press, force-dark и смешанный контент;
- `largeHeap` и аппаратное ускорение;
- портретная ориентация и `configChanges`, чтобы WebView не пересоздавался;
- собственные иконки, adaptive icon и брендированный splash.

## Ограничения

- Нужен интернет: фронтенд загружается с GitHub Pages, API — с `game.galaxyleague.ru`.
- Нативная оболочка не заменяет серверную часть. Если API недоступен, сетевые функции игры работать не будут.
- Telegram SDK в APK не требуется: игра корректно работает без `Telegram.WebApp`. При этом сама веб-страница по-прежнему подключает `telegram-web-app.js`; в обычном WebView он не даёт нативных преимуществ и не мешает запуску.
