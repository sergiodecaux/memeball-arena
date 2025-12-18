@echo off

call npm run build

cd dist

git init
git add -A
git commit -m "deploy"

git push -f https://github.com/ВАШ_USERNAME/memeball-arena.git main:gh-pages

cd ..