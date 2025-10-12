#!/bin/bash

# EcoTrack Backend Test Script
# Tests the refactored eco_advisor_agent.py

echo "════════════════════════════════════════════════════════════════"
echo "🧪 EcoTrack Backend Test Suite"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Check if backend is running
echo "📡 Checking if backend is running on port 8000..."
if ! curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "❌ Backend not running!"
    echo ""
    echo "Start it with:"
    echo "  export ASI_ONE_KEY='sk_your_key_here'"
    echo "  python3 eco_advisor_agent.py"
    echo ""
    exit 1
fi
echo "✅ Backend is running"
echo ""

# Test 1: Root endpoint
echo "════════════════════════════════════════════════════════════════"
echo "Test 1: GET / (Root)"
echo "════════════════════════════════════════════════════════════════"
curl -s http://localhost:8000/ | jq '.'
echo ""

# Test 2: Health check
echo "════════════════════════════════════════════════════════════════"
echo "Test 2: GET /health (Health Check)"
echo "════════════════════════════════════════════════════════════════"
curl -s http://localhost:8000/health | jq '.'
echo ""

# Test 3: Debug ASI configuration
echo "════════════════════════════════════════════════════════════════"
echo "Test 3: GET /debug/asi (ASI:One Configuration)"
echo "════════════════════════════════════════════════════════════════"
ASI_CONFIG=$(curl -s http://localhost:8000/debug/asi)
echo "$ASI_CONFIG" | jq '.'
HAS_KEY=$(echo "$ASI_CONFIG" | jq -r '.has_key')
echo ""

if [ "$HAS_KEY" != "true" ]; then
    echo "⚠️  WARNING: ASI_ONE_KEY is not set!"
    echo "   The next test will fail. Set it with:"
    echo "   export ASI_ONE_KEY='sk_your_key_here'"
    echo ""
fi

# Test 4: Invalid action (should return 400)
echo "════════════════════════════════════════════════════════════════"
echo "Test 4: POST /co2/savings (Invalid Action - Should Return 400)"
echo "════════════════════════════════════════════════════════════════"
curl -s -X POST http://localhost:8000/co2/savings \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test","action":"invalid_action","distance_km":1.0}' | jq '.'
echo ""

# Test 5: Invalid distance (should return 400)
echo "════════════════════════════════════════════════════════════════"
echo "Test 5: POST /co2/savings (Invalid Distance - Should Return 400)"
echo "════════════════════════════════════════════════════════════════"
curl -s -X POST http://localhost:8000/co2/savings \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test","action":"bike_trip","distance_km":0}' | jq '.'
echo ""

# Test 6: Valid bike trip
echo "════════════════════════════════════════════════════════════════"
echo "Test 6: POST /co2/savings (Valid Bike Trip)"
echo "════════════════════════════════════════════════════════════════"
if [ "$HAS_KEY" = "true" ]; then
    RESPONSE=$(curl -s -X POST http://localhost:8000/co2/savings \
      -H "Content-Type: application/json" \
      -d '{"user_id":"test_user","action":"bike_trip","distance_km":1.5}')
    echo "$RESPONSE" | jq '.'

    # Validate response
    CO2_VALUE=$(echo "$RESPONSE" | jq -r '.co2_saved_kg')
    ENGINE=$(echo "$RESPONSE" | jq -r '.agent_meta.engine')

    echo ""
    if [ "$CO2_VALUE" != "null" ] && [ "$ENGINE" = "asi_one" ]; then
        echo "✅ SUCCESS: Valid CO₂ value received from ASI:One"
        echo "   CO₂ saved: $CO2_VALUE kg"
        echo "   Engine: $ENGINE"
    else
        echo "❌ FAILED: Invalid response structure"
    fi
else
    echo "⏭️  SKIPPED: ASI_ONE_KEY not set"
fi
echo ""

# Test 7: Valid recycling action
echo "════════════════════════════════════════════════════════════════"
echo "Test 7: POST /co2/savings (Valid Recycling)"
echo "════════════════════════════════════════════════════════════════"
if [ "$HAS_KEY" = "true" ]; then
    curl -s -X POST http://localhost:8000/co2/savings \
      -H "Content-Type: application/json" \
      -d '{"user_id":"test_user","action":"recycled"}' | jq '.'
else
    echo "⏭️  SKIPPED: ASI_ONE_KEY not set"
fi
echo ""

# Test 8: Valid vegetarian meal
echo "════════════════════════════════════════════════════════════════"
echo "Test 8: POST /co2/savings (Valid Vegetarian Meal)"
echo "════════════════════════════════════════════════════════════════"
if [ "$HAS_KEY" = "true" ]; then
    curl -s -X POST http://localhost:8000/co2/savings \
      -H "Content-Type: application/json" \
      -d '{"user_id":"test_user","action":"ate_vegetarian"}' | jq '.'
else
    echo "⏭️  SKIPPED: ASI_ONE_KEY not set"
fi
echo ""

echo "════════════════════════════════════════════════════════════════"
echo "✅ Test Suite Complete"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "📝 Notes:"
echo "   - Check FastAPI terminal for detailed [ASI] logs"
echo "   - All CO₂ values should come from ASI:One (engine='asi_one')"
echo "   - No local fallback math is used"
echo ""
