tmux \
	new-session "sh riot/stop.sh; sh synapse/stop.sh; sh synapse/clear.sh; sh synapse/start.sh; sh riot/start.sh; read"\; \
	split-window "sleep 5; node start.js; sh riot/stop.sh; sh synapse/stop.sh; read"\; \
	select-layout even-vertical
