# EcoTrack 🌍

**Your Carbon Companion** - A gamified iOS app that helps you track eco-friendly actions and measure your CO₂ impact.

Built with **Expo**, **React Native**, **Firebase**, and powered by a **FastAPI AI agent** for CO₂ calculations.

---

## Features

- ✅ **Track Eco Actions**: Bike trips, walks, recycling, vegetarian meals
- 📍 **Map-based Distance Picker**: Measure bike/walk distances with location services
- 🤖 **AI-Powered CO₂ Calculation**: Fetch.ai backend agent calculates real CO₂ savings
- 🏆 **Gamification**: Earn badges, level up, and maintain streaks
- 📊 **Stats Dashboard**: See today's savings, total impact, and recent history
- 🔥 **Daily Streaks**: Stay motivated with consecutive-day tracking
- 📱 **Share Your Wins**: Native share sheet to spread the word

---

## Tech Stack

- **Frontend**: Expo (React Native) + TypeScript
- **Backend**: FastAPI (Python) for CO₂ calculations
- **Database**: Firebase Realtime Database
- **Auth**: Firebase Anonymous Authentication
- **Maps**: `react-native-maps` + `expo-location`
- **Distance**: Google Directions API (optional) or Haversine fallback

---

## Prerequisites

- Node.js 18+ and npm
- Expo CLI: `npm install -g expo-cli`
- iOS Simulator (Xcode) or physical iOS device
- Python 3.11+ (for the agent backend)
- Firebase project (already configured in this repo)
- ngrok (for exposing local agent to mobile device)

---

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the FastAPI Agent

The agent calculates CO₂ savings based on actions and distance.

```bash
# Create a virtual environment (if not already done)
python3.11 -m venv venv311
source venv311/bin/activate  # On Windows: venv311\Scripts\activate

# Install Python dependencies
pip install fastapi uvicorn

# Start the agent
uvicorn eco_advisor_agent:app --reload --port 8000
```

The agent will run at `http://localhost:8000`.

### 3. Expose Agent with ngrok

Since Expo runs on your phone/simulator, it needs to reach your local agent via HTTPS.

```bash
# Install ngrok: https://ngrok.com/download
# Or via Homebrew: brew install ngrok

# Expose your local agent
ngrok http 8000
```

You'll see output like:
```
Forwarding   https://abc123.ngrok-free.dev -> http://localhost:8000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.dev`).

### 4. Configure Environment Variables

Create/edit `.env` in the project root:

```env
EXPO_PUBLIC_AGENT_URL=https://abc123.ngrok-free.dev
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=  # Optional: for accurate distance via Directions API
```

**Note**: If you don't have a Google Maps API key, the app will use haversine distance (direct line). For a better experience, get a free API key from [Google Cloud Console](https://console.cloud.google.com/).

### 5. Run the Expo App

```bash
npm start
```

Or directly for iOS:

```bash
npm run ios
```

This will open the Expo DevTools and launch the iOS Simulator.

---

## How to Demo (For Judges)

### Quick Test Flow

1. **Open the app** → Launches on the Tracker tab
2. **Tap "Bike Trip"** → Opens map picker
3. **Set Start point** → Tap on the map
4. **Set End point** → Tap again to mark destination
5. **Confirm distance** → Shows calculated distance
6. **Agent calculates CO₂** → Backend returns savings (e.g., "You saved 0.5 kg CO₂!")
7. **View stats update** → Today's CO₂, streak, and level increase
8. **Switch to Explore tab** → See earned badges and progress

### Full Feature Tour

#### Tracker Tab
- **Four action buttons**: Bike, Walk, Recycle, Vegetarian
- **Top stats cards**: Today's CO₂, current streak, level
- **Recent actions list**: Last 5 logged actions with timestamps
- **Pull-to-refresh**: Reload stats from Firebase

#### Distance Picker (for Bike/Walk)
- **Auto-location**: Asks for permission and centers on your location
- **Tap to set markers**: Green (start), Red (end)
- **Live distance calculation**: Uses Google Directions API or haversine
- **Visual feedback**: Progress indicators for start/end selection

#### Explore Tab
- **Level card**: Shows current level and progress to next level
- **Earned badges**: Unlocked achievements (1kg, 5kg, 10kg, 25kg, 50kg, 100kg CO₂)
- **Locked badges**: Grayed out with threshold requirements
- **Info section**: How gamification works

#### Share Feature
- After logging an action, tap **"Share"** in the success alert
- Native iOS share sheet opens with a pre-filled eco message

---

## Project Structure

```
EcoTrack/
├── app/
│   ├── (tabs)/
│   │   ├── _layout.tsx       # Tab navigation + Firebase auth
│   │   ├── index.tsx          # Home tab (welcome screen)
│   │   ├── explore.tsx        # Badges & achievements
│   │   └── tracker.tsx        # Main action logging screen
│   └── modals/
│       └── DistancePicker.tsx # Map-based distance selection
├── src/
│   └── lib/
│       ├── agentClient.ts     # API calls to FastAPI agent
│       ├── user.ts            # User ID management
│       ├── distance.ts        # Haversine + Directions API
│       └── gamification.ts    # Badges, streaks, levels logic
├── firebaseConfig.ts          # Firebase initialization
├── eco_advisor_agent.py       # FastAPI backend for CO₂ calculation
├── .env                       # Environment variables (agent URL, API keys)
├── FIREBASE_RULES.md          # Database security rules documentation
└── README.md                  # This file
```

---

## API Endpoints

### FastAPI Agent (`eco_advisor_agent.py`)

#### `POST /co2/savings`

Calculate CO₂ savings for an eco-friendly action.

**Request Body**:
```json
{
  "user_id": "string",
  "action": "bike_trip" | "walk_trip" | "recycled" | "ate_vegetarian",
  "distance_km": 0  // Optional, only for bike/walk trips
}
```

**Response**:
```json
{
  "user_id": "string",
  "action": "bike_trip",
  "co2_saved_kg": 0.5,
  "message": "Great job! You saved carbon by biking instead of driving."
}
```

---

## Firebase Data Structure

```
/
├── users/
│   └── {uid}/
│       └── actions/
│           └── {pushId}/
│               ├── action: "bike_trip"
│               ├── distance_km: 2.5
│               ├── co2_saved_kg: 0.5
│               ├── message: "Great job!"
│               └── ts: 1704067200000
└── config/
    └── agent_url: "https://abc123.ngrok-free.dev"  // Optional fallback
```

### Security Rules

See [FIREBASE_RULES.md](./FIREBASE_RULES.md) for detailed security configuration.

**Current (Dev)**: Open read/write access
**Production**: User-scoped access with authentication required

---

## Gamification Logic

### Levels
- **Formula**: `Level = floor(totalCO2 / 5) + 1`
- **Example**: 12 kg CO₂ saved = Level 3

### Streaks
- **Definition**: Consecutive days with ≥1 action
- **Breaks**: If no action today or yesterday
- **Calculation**: Counts backwards from most recent day

### Badges
| Badge | Threshold | Icon |
|-------|-----------|------|
| Eco Starter | 1 kg CO₂ | 🌱 |
| Eco Committed | 5 kg CO₂ | 🌿 |
| Eco Champion | 10 kg CO₂ | 🏆 |
| Eco Hero | 25 kg CO₂ | ⭐ |
| Eco Legend | 50 kg CO₂ | 👑 |
| Planet Guardian | 100 kg CO₂ | 🌍 |

---

## Troubleshooting

### "Agent URL not configured" Error
- **Cause**: `.env` file missing or `EXPO_PUBLIC_AGENT_URL` not set
- **Fix**: Create `.env` with your ngrok HTTPS URL

### "Permission Denied" from Firebase
- **Cause**: Firebase security rules too restrictive
- **Fix**: Use development rules (see [FIREBASE_RULES.md](./FIREBASE_RULES.md))

### Map not showing user location
- **Cause**: Location permission not granted
- **Fix**:
  - iOS Simulator: Features → Location → Custom Location
  - Physical device: Settings → Privacy → Location Services → EcoTrack → While Using

### Distance always shows haversine (straight line)
- **Cause**: No Google Maps API key configured
- **Fix**: Add `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` to `.env`

### Agent unreachable from device
- **Cause**: ngrok tunnel closed or network issue
- **Fix**: Restart ngrok, update `.env`, and restart Expo

---

## Testing Checklist

- [ ] Log a bike trip with distance selection
- [ ] Agent returns CO₂ savings
- [ ] Firebase stores the action
- [ ] Stats update (today's CO₂, streak, level)
- [ ] Recent actions list shows new entry
- [ ] Switch to Explore tab to see badge progress
- [ ] Earn first badge (1 kg CO₂)
- [ ] Log action on a new day to increment streak
- [ ] Share button works after logging action
- [ ] App handles offline gracefully (shows error)
- [ ] Pull-to-refresh reloads data

---

## Future Enhancements (Optional)

- **Offline queue**: Store actions locally, sync when online
- **Leaderboard**: Compare CO₂ savings with other users
- **Custom actions**: Let users add their own eco activities
- **Notifications**: Daily reminders to log actions
- **Charts**: Visualize CO₂ savings over time (weekly/monthly graphs)
- **Social features**: Follow friends, see their progress

---

## Credits

Built for a hackathon with ❤️.

- **Frontend**: Expo + React Native
- **Backend**: FastAPI
- **Database**: Firebase
- **Maps**: Google Maps + Expo Location
- **AI Agent**: Custom CO₂ calculation logic

---

## License

MIT License - Feel free to use and modify for your own projects!

---

## Contact

For questions or demo requests, reach out to me!

**Happy eco-tracking! 🌱**
