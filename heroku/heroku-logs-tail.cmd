@cd %~dp0
@cd ..
call heroku logs --tail | node -e process.stdin.pipe(process.stdout);
pause
