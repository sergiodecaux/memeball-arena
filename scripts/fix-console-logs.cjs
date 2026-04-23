const fs = require('fs');
const path = require('path');

function walkDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (!filePath.includes('node_modules') && !filePath.includes('dist')) {
        walkDir(filePath, fileList);
      }
    } else if (filePath.endsWith('.ts') && !filePath.includes('ProductionLogger')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

const srcDir = path.join(__dirname, '..', 'src');
const files = walkDir(srcDir);

let totalFixed = 0;

files.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  
  // Заменяем console.log на условный
  // Паттерн: console.log(...) -> if (import.meta.env.DEV) console.log(...)
  // Только если не уже обёрнут
  const lines = content.split('\n');
  const newLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Проверяем, является ли строка console.log/debug/info
    const consoleMatch = trimmed.match(/^console\.(log|debug|info)\s*\(/);
    
    if (consoleMatch) {
      // Проверяем предыдущую строку - не обёрнута ли уже
      const prevLine = i > 0 ? lines[i - 1].trim() : '';
      const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';
      
      // Пропускаем если уже обёрнута
      if (prevLine.includes('if (import.meta.env.DEV)') || 
          prevLine.includes('if(import.meta.env.DEV)') ||
          prevLine.includes('// Intentionally')) {
        newLines.push(line);
        continue;
      }
      
      // Получаем отступ
      const indent = line.match(/^\s*/)[0];
      
      // Обёртываем в условие
      newLines.push(`${indent}if (import.meta.env.DEV) {`);
      newLines.push(line);
      newLines.push(`${indent}}`);
    } else {
      newLines.push(line);
    }
  }
  
  content = newLines.join('\n');
  
  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed: ${path.relative(process.cwd(), filePath)}`);
    totalFixed++;
  }
});

console.log(`\nTotal files fixed: ${totalFixed}`);
