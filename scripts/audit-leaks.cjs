/**
 * Скрипт для поиска потенциальных утечек памяти
 * Exit codes:
 *   0 - всё ок
 *   1 - есть ошибки (блокирует CI)
 *   2 - есть предупреждения (unstable build)
 */

const fs = require('fs');
const path = require('path');

// Простой glob без зависимости
function walkDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (!filePath.includes('node_modules') && !filePath.includes('dist')) {
        walkDir(filePath, fileList);
      }
    } else if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

const srcDir = path.join(__dirname, '..', 'src');

// Паттерны для поиска
const patterns = [
  {
    name: 'Direct setTimeout (not via leakGuard/globalCleanup)',
    regex: /(?<!leakGuard\.)(?<!globalCleanup\.)(?<!this\.)(?<!window\.)\bsetTimeout\s*\(/g,
    severity: 'warning',
    message: 'Используйте leakGuard.setTimeout() или globalCleanup.setTimeout()',
    exclude: ['GlobalCleanup.ts', 'LeakGuardPlugin.ts', 'SimulationWorker.ts', 'OnScreenLogger.ts']
  },
  {
    name: 'Direct setInterval',
    regex: /(?<!leakGuard\.)(?<!globalCleanup\.)\bsetInterval\s*\(/g,
    severity: 'warning',
    message: 'Используйте leakGuard.setInterval() или globalCleanup.setInterval()',
    exclude: ['GlobalCleanup.ts', 'LeakGuardPlugin.ts', 'ProductionLogger.ts']
  },
  {
    name: 'window.addEventListener without cleanup',
    regex: /window\.addEventListener\s*\(/g,
    severity: 'warning',
    message: 'Используйте leakGuard.addListener() для автоочистки',
    exclude: ['GlobalCleanup.ts', 'LeakGuardPlugin.ts', 'ProductionLogger.ts'],
    // Игнорировать если есть комментарий "Intentionally using direct addEventListener"
    ignoreIf: (content, matchIndex) => {
      const beforeMatch = content.substring(Math.max(0, matchIndex - 200), matchIndex);
      return beforeMatch.includes('Intentionally using direct addEventListener');
    }
  },
  {
    name: 'Console.log in production',
    regex: /(?<!\/\/.*)(?<!if\s*\(import\.meta\.env\.DEV\)\s*)\bconsole\.(log|debug|info)\s*\(/g,
    severity: 'info',
    message: 'Оберните в if (import.meta.env.DEV) или используйте ProductionLogger',
    exclude: ['ProductionLogger.ts']
  },
  {
    name: 'Fetch to localhost (debug logging)',
    regex: /fetch\s*\(\s*['"`]https?:\/\/(127\.0\.0\.1|localhost)/g,
    severity: 'error',
    message: 'Удалите fetch запросы для отладочного логирования',
    exclude: []
  },
  {
    name: 'delayedCall with loop without cleanup',
    regex: /delayedCall\s*\([^)]*loop\s*:\s*true/g,
    severity: 'warning',
    message: 'Убедитесь, что loop: true delayedCall очищается в shutdown()',
    exclude: []
  }
];

function shouldExclude(filePath, excludeList) {
  return excludeList.some(exclude => filePath.includes(exclude));
}

function auditFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(process.cwd(), filePath);
  const issues = [];

  patterns.forEach(pattern => {
    if (shouldExclude(filePath, pattern.exclude)) return;
    
    const matches = content.match(pattern.regex);
    if (matches) {
      // Находим номера строк
      const lines = content.split('\n');
      const lineNumbers = [];
      
      lines.forEach((line, lineNum) => {
        if (pattern.regex.test(line)) {
          lineNumbers.push(lineNum + 1);
        }
      });
      
      issues.push({
        file: relativePath,
        pattern: pattern.name,
        severity: pattern.severity,
        count: matches.length,
        lines: lineNumbers.slice(0, 5), // Первые 5 строк
        message: pattern.message
      });
    }
  });

  return issues;
}

function main() {
  console.log('🔍 Аудит утечек памяти...\n');

  const files = walkDir(srcDir);
  const allIssues = [];

  files.forEach(file => {
    const issues = auditFile(file);
    allIssues.push(...issues);
  });

  // Группируем по severity
  const errors = allIssues.filter(i => i.severity === 'error');
  const warnings = allIssues.filter(i => i.severity === 'warning');
  const infos = allIssues.filter(i => i.severity === 'info');

  // Выводим результаты
  if (errors.length > 0) {
    console.log('❌ ОШИБКИ (блокируют сборку):');
    errors.forEach(i => {
      const lines = i.lines.length > 0 ? ` (строки: ${i.lines.join(', ')})` : '';
      console.log(`  ${i.file}${lines}`);
      console.log(`    └─ ${i.pattern} (${i.count}x)`);
      console.log(`       ${i.message}\n`);
    });
  }

  if (warnings.length > 0) {
    console.log('⚠️  ПРЕДУПРЕЖДЕНИЯ (unstable build):');
    warnings.forEach(i => {
      const lines = i.lines.length > 0 ? ` (строки: ${i.lines.join(', ')})` : '';
      console.log(`  ${i.file}${lines}`);
      console.log(`    └─ ${i.pattern} (${i.count}x)`);
      console.log(`       ${i.message}\n`);
    });
  }

  if (infos.length > 0) {
    console.log('ℹ️  ИНФОРМАЦИЯ:');
    infos.forEach(i => {
      console.log(`  ${i.file}: ${i.pattern} (${i.count}x)`);
    });
    console.log('');
  }

  // Итоги
  const total = errors.length + warnings.length + infos.length;
  console.log('─'.repeat(50));
  console.log(`📊 Итого: ${total} потенциальных проблем в ${files.length} файлах`);
  console.log(`   ❌ Ошибок: ${errors.length}`);
  console.log(`   ⚠️  Предупреждений: ${warnings.length}`);
  console.log(`   ℹ️  Информация: ${infos.length}`);
  console.log('');

  // Генерируем отчёт для CI
  const report = {
    timestamp: new Date().toISOString(),
    summary: { errors: errors.length, warnings: warnings.length, infos: infos.length },
    issues: allIssues
  };
  
  fs.writeFileSync(
    path.join(__dirname, '..', 'leak-report.json'),
    JSON.stringify(report, null, 2)
  );
  console.log('📄 Отчёт сохранён: leak-report.json\n');

  // Exit codes
  if (errors.length > 0) {
    console.log('🛑 Сборка заблокирована из-за ошибок');
    process.exit(1);
  }
  if (warnings.length > 0) {
    console.log('⚠️  Сборка помечена как unstable');
    process.exit(2);
  }
  console.log('✅ Проверка пройдена успешно');
  process.exit(0);
}

main();
