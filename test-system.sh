#!/bin/bash
# TruthLayer Testing Utility
# Run this script to test all components of the system

set -e

echo "🧪 TruthLayer System Testing Utility"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check Python environment
echo "📝 Test 1: Checking Python environment..."
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}✗ Python 3 not found${NC}"
    exit 1
fi
PYTHON_VERSION=$(python3 --version | awk '{print $2}')
echo -e "${GREEN}✓ Python ${PYTHON_VERSION} found${NC}"
echo ""

# Test 2: Check Node environment
echo "📝 Test 2: Checking Node.js environment..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js not found${NC}"
    exit 1
fi
NODE_VERSION=$(node --version)
echo -e "${GREEN}✓ ${NODE_VERSION} found${NC}"
echo ""

# Test 3: Check AI Service
echo "📝 Test 3: Checking AI Service..."
if curl -s http://127.0.0.1:8000/health > /dev/null 2>&1; then
    HEALTH=$(curl -s http://127.0.0.1:8000/health)
    echo -e "${GREEN}✓ AI Service is running${NC}"
    echo "  Response: $HEALTH"
else
    echo -e "${YELLOW}⚠ AI Service not running on port 8000${NC}"
fi
echo ""

# Test 4: Check Backend Service
echo "📝 Test 4: Checking Backend Service..."
if curl -s http://localhost:3000/version > /dev/null 2>&1; then
    HEALTH=$(curl -s http://localhost:3000/version)
    echo -e "${GREEN}✓ Backend Service is running${NC}"
    echo "  Response: $HEALTH"
else
    echo -e "${YELLOW}⚠ Backend Service not running on port 3000${NC}"
fi
echo ""

# Test 5: Check model files
echo "📝 Test 5: Checking ML model files..."
if [ -f "ai-service/models/model.pkl" ]; then
    SIZE=$(ls -lh ai-service/models/model.pkl | awk '{print $5}')
    echo -e "${GREEN}✓ model.pkl found (${SIZE})${NC}"
else
    echo -e "${RED}✗ model.pkl not found - run 'python3 training/train.py'${NC}"
fi

if [ -f "ai-service/models/vectorizer.pkl" ]; then
    SIZE=$(ls -lh ai-service/models/vectorizer.pkl | awk '{print $5}')
    echo -e "${GREEN}✓ vectorizer.pkl found (${SIZE})${NC}"
else
    echo -e "${RED}✗ vectorizer.pkl not found - run 'python3 training/train.py'${NC}"
fi
echo ""

# Test 6: Run API test if backend is running
echo "📝 Test 6: Running API test..."
if curl -s http://localhost:3000/version > /dev/null 2>&1; then
    echo "Testing high-risk content..."
    RESULT=$(curl -s -X POST http://localhost:3000/analyze \
      -H "Content-Type: application/json" \
      -d '{
        "text": "SHOCKING: You wont believe this!!!",
        "url": "https://unknown.com"
      }')
    
    SCORE=$(echo "$RESULT" | grep -o '"score":[0-9.]*' | head -1 | cut -d: -f2)
    LABEL=$(echo "$RESULT" | grep -o '"label":"[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [ ! -z "$SCORE" ]; then
        echo -e "${GREEN}✓ API response received${NC}"
        echo "  Score: $SCORE"
        echo "  Label: $LABEL"
    else
        echo -e "${RED}✗ Invalid API response${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Backend not running - skipping API test${NC}"
fi
echo ""

echo "✅ Testing complete!"
echo ""
echo "To start the services, run:"
echo "  Terminal 1: cd ai-service && ./venv/bin/python -m uvicorn app.main:app --port 8000"
echo "  Terminal 2: cd backend && npm start"
