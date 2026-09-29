#!/bin/bash

echo "=============================="
echo "Stopping RTSP Face System..."
echo "=============================="

# Stop pipeline
if [ -f pipeline.pid ]; then
    PIPELINE_PID=$(cat pipeline.pid)
    if ps -p $PIPELINE_PID > /dev/null; then
        echo "Stopping pipeline (PID: $PIPELINE_PID)..."
        kill $PIPELINE_PID
    else
        echo "Pipeline already stopped."
    fi
    rm -f pipeline.pid
else
    echo "pipeline.pid not found."
fi

# Stop visualization
if [ -f vis.pid ]; then
    VIS_PID=$(cat vis.pid)
    if ps -p $VIS_PID > /dev/null; then
        echo "Stopping visualization (PID: $VIS_PID)..."
        kill $VIS_PID
    else
        echo "Visualization already stopped."
    fi
    rm -f vis.pid
else
    echo "vis.pid not found."
fi

echo "=============================="
echo "All services stopped 🛑"
echo "=============================="
