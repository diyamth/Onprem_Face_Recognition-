#!/bin/bash

echo "=============================="
echo "Starting RTSP Face Pipeline..."
echo "=============================="

# Activate venv if needed
# source venv/bin/activate

# Start pipeline
python rtsp_pipeline.py > pipeline.log 2>&1 &
PIPELINE_PID=$!
echo $PIPELINE_PID > pipeline.pid
echo "Pipeline started with PID: $PIPELINE_PID"

sleep 2

echo "=============================="
echo "Starting RTSP Visualization..."
echo "=============================="

# Start visualization
python rtsp_vis.py > vis.log 2>&1 &
VIS_PID=$!
echo $VIS_PID > vis.pid
echo "Visualization started with PID: $VIS_PID"

echo "=============================="
echo "All services started successfully 🚀"
echo "Pipeline PID: $PIPELINE_PID"
echo "Visualization PID: $VIS_PID"
echo "=============================="
