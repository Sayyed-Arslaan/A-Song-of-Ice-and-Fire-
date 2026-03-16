python3 -m http.server 8000 > /dev/null 2>&1 &
SERVER_PID=$!
sleep 1
node test_gh_pages.js
kill $SERVER_PID
