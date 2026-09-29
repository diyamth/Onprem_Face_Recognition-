#!/bin/bash

# Setup script for SMG Face On-Prem Backend and Frontend
# This script sets up the Python backend environment and Node.js frontend environment

set -e  # Exit on any error

echo "========================================"
echo "SMG Face On-Prem Setup Script"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${BLUE}➜${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# ============================================
# Backend Setup
# ============================================
echo ""
print_step "Setting up Backend..."
echo ""

BACKEND_DIR="$SCRIPT_DIR/backend"

# Check if backend directory exists
if [ ! -d "$BACKEND_DIR" ]; then
    print_error "Backend directory not found at $BACKEND_DIR"
    exit 1
fi

cd "$BACKEND_DIR"

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

print_step "Python version: $(python3 --version)"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    print_step "Creating Python virtual environment..."
    python3 -m venv venv
    print_success "Virtual environment created"
else
    print_warning "Virtual environment already exists"
fi

# Activate virtual environment
print_step "Activating virtual environment..."
source venv/bin/activate
print_success "Virtual environment activated"

# Upgrade pip, setuptools, and wheel
print_step "Upgrading pip, setuptools, and wheel..."
python -m pip install --upgrade pip setuptools wheel > /dev/null
print_success "pip, setuptools, and wheel upgraded"

# Install backend dependencies
print_step "Installing backend dependencies..."
pip install -r requirements.txt > /dev/null
print_success "Backend dependencies installed"

# Deactivate virtual environment
deactivate
print_success "Backend setup completed"

# ============================================
# Frontend Setup
# ============================================
echo ""
print_step "Setting up Frontend..."
echo ""

FRONTEND_DIR="$SCRIPT_DIR/frontend"

# Check if frontend directory exists
if [ ! -d "$FRONTEND_DIR" ]; then
    print_error "Frontend directory not found at $FRONTEND_DIR"
    exit 1
fi

cd "$FRONTEND_DIR"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 16.x or higher."
    exit 1
fi

print_step "Node.js version: $(node --version)"
print_step "npm version: $(npm --version)"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    print_step "Installing frontend dependencies..."
    npm install
    print_success "Frontend dependencies installed"
else
    print_warning "node_modules already exists. Running 'npm install' to ensure dependencies are up to date..."
    npm install
fi

print_success "Frontend setup completed"

# ============================================
# Summary
# ============================================
echo ""
echo "========================================"
echo -e "${GREEN}Setup completed successfully!${NC}"
echo "========================================"
echo ""
print_step "Next steps:"
echo ""
echo "  Backend:"
echo "    1. cd backend"
echo "    2. source venv/bin/activate"
echo "    3. uvicorn app.main:app --reload"
echo ""
echo "  Frontend (in a new terminal):"
echo "    1. cd frontend"
echo "    2. npm run dev"
echo ""
echo "========================================"
