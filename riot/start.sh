pushd riot-web/webapp/
python -m SimpleHTTPServer 8080 &
PID=$!
popd
echo $PID > riot.pid