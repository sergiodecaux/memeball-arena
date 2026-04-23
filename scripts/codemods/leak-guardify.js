/**
 * jscodeshift codemod для миграции на LeakGuard
 * Запуск: npx jscodeshift -t scripts/codemods/leak-guardify.js src/scenes/*.ts
 */
module.exports = function transformer(file, api) {
  const j = api.jscodeshift;
  let source = j(file.source);

  // 1. window.setTimeout -> this.leakGuard.setTimeout
  source = source
    .find(j.CallExpression, {
      callee: {
        type: 'MemberExpression',
        object: { name: 'window' },
        property: { name: 'setTimeout' }
      }
    })
    .replaceWith(p => {
      return j.callExpression(
        j.memberExpression(
          j.memberExpression(j.thisExpression(), j.identifier('leakGuard')),
          j.identifier('setTimeout')
        ),
        p.value.arguments
      );
    });

  // 2. setTimeout (без window) -> this.leakGuard.setTimeout
  // Исключаем уже преобразованные и globalCleanup
  source = source
    .find(j.CallExpression, {
      callee: { type: 'Identifier', name: 'setTimeout' }
    })
    .filter(p => {
      // Пропускаем если это уже leakGuard или globalCleanup
      const parent = p.parent;
      if (parent && parent.value.type === 'MemberExpression') {
        const prop = parent.value.property;
        if (prop && (prop.name === 'setTimeout' || prop.name === 'setInterval')) {
          const obj = parent.value.object;
          if (obj && (
            (obj.type === 'MemberExpression' && obj.property && obj.property.name === 'leakGuard') ||
            (obj.type === 'Identifier' && obj.name === 'globalCleanup')
          )) {
            return false;
          }
        }
      }
      return true;
    })
    .replaceWith(p => {
      return j.callExpression(
        j.memberExpression(
          j.memberExpression(j.thisExpression(), j.identifier('leakGuard')),
          j.identifier('setTimeout')
        ),
        p.value.arguments
      );
    });

  // 3. window.setInterval -> this.leakGuard.setInterval
  source = source
    .find(j.CallExpression, {
      callee: {
        type: 'MemberExpression',
        object: { name: 'window' },
        property: { name: 'setInterval' }
      }
    })
    .replaceWith(p => {
      return j.callExpression(
        j.memberExpression(
          j.memberExpression(j.thisExpression(), j.identifier('leakGuard')),
          j.identifier('setInterval')
        ),
        p.value.arguments
      );
    });

  // 4. window.addEventListener -> this.leakGuard.addListener(window, ...)
  source = source
    .find(j.CallExpression, {
      callee: {
        type: 'MemberExpression',
        object: { name: 'window' },
        property: { name: 'addEventListener' }
      }
    })
    .replaceWith(p => {
      return j.callExpression(
        j.memberExpression(
          j.memberExpression(j.thisExpression(), j.identifier('leakGuard')),
          j.identifier('addListener')
        ),
        [j.identifier('window'), ...p.value.arguments]
      );
    });

  return source.toSource({ quote: 'single' });
};
