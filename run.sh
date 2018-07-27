#!/bin/bash
./synapse/start.sh
./riot/start.sh
node start.js
./riot/stop.sh
./synapse/stop.sh
