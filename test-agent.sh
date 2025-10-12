#!/bin/bash

# EcoTrack Agent Connectivity Test Script
# This script tests the FastAPI agent endpoints via ngrok

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Read AGENT_URL from .env file
if [ -f .env ]; then
    export $(cat .env | grep EXPO_PUBLIC_AGENT_URL | xargs)
fi

# Check if AGENT_URL is set
if [ -z "$EXPO_PUBLIC_AGENT_URL" ]; then
    echo -e "${RED}❌ EXPO_PUBLIC_AGENT_URL not set in .env${NC}"
    echo "Please add: EXPO_PUBLIC_AGENT_URL=https://your-ngrok-url.ngrok-free.dev"
    exit 1
fi

AGENT_URL="$EXPO_PUBLIC_AGENT_URL"

echo "=================================================="
echo "🧪 EcoTrack Agent Connectivity Test"
echo "=================================================="
echo ""
echo "Agent URL: $AGENT_URL"
echo ""

# Test 1: Root endpoint
echo "📍 Test 1: GET / (root)"
echo "Command: curl -X GET $AGENT_URL/"
echo ""
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X GET "$AGENT_URL/")
HTTP_STATUS=$(echo "$RESPONSE" | grep HTTP_STATUS | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Success (200)${NC}"
    echo "Response: $BODY"
else
    echo -e "${RED}❌ Failed (HTTP $HTTP_STATUS)${NC}"
    echo "Response: $BODY"
fi
echo ""

# Test 2: Health endpoint
echo "📍 Test 2: GET /health"
echo "Command: curl -X GET $AGENT_URL/health"
echo ""
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X GET "$AGENT_URL/health")
HTTP_STATUS=$(echo "$RESPONSE" | grep HTTP_STATUS | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Success (200)${NC}"
    echo "Response: $BODY"
else
    echo -e "${RED}❌ Failed (HTTP $HTTP_STATUS)${NC}"
    echo "Response: $BODY"
fi
echo ""

# Test 3: POST /co2/savings
echo "📍 Test 3: POST /co2/savings (bike trip)"
echo "Command: curl -X POST $AGENT_URL/co2/savings -H 'Content-Type: application/json' -d '{...}'"
echo ""
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$AGENT_URL/co2/savings" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test-script","action":"bike_trip","distance_km":2.5}')
HTTP_STATUS=$(echo "$RESPONSE" | grep HTTP_STATUS | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Success (200)${NC}"
    echo "Response: $BODY"
else
    echo -e "${RED}❌ Failed (HTTP $HTTP_STATUS)${NC}"
    echo "Response: $BODY"
fi
echo ""

# Summary
echo "=================================================="
echo "📊 Test Summary"
echo "=================================================="
echo ""
echo "If all tests passed:"
echo "  ✓ Your agent is running correctly"
echo "  ✓ ngrok tunnel is active and forwarding"
echo "  ✓ The app should be able to connect"
echo ""
echo "If tests failed:"
echo "  1. Check FastAPI is running: uvicorn eco_advisor_agent:app --reload --port 8000"
echo "  2. Check ngrok is running: ngrok http 8000"
echo "  3. Verify AGENT_URL in .env matches ngrok HTTPS URL"
echo "  4. Check ngrok dashboard: http://127.0.0.1:4040"
echo ""
