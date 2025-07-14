# SoundByte Module Help

## Quick Setup

1. **Install Module**: Place in Companion modules directory and run `npm install`
2. **Start SoundByte**: Ensure your SoundByte application is running
3. **Configure**: Set Host IP and Port (default: localhost:3000)
4. **Test**: Check connection status turns green

## Configuration

- **Host IP**: SoundByte application IP address (default: localhost)
- **Port**: SoundByte application port (default: 3000)

## Features

### Automatic Sound Discovery
- Module automatically finds all sounds in your `/sounds` folder
- Creates presets for each sound with start/stop functionality
- **Red feedback when sounds are playing**

### Available Actions
- Play/Stop individual sounds by ID
- Stop all sounds at once
- Individual actions for each sound

### Presets
- **Connection Status**: Shows connection state
- **Stop All**: Emergency stop for all sounds
- **Individual Sounds**: One button per sound with red feedback when playing

### Variables
- `connection_status`: Connected/Disconnected
- `total_sounds`: Number of available sounds
- `playing_count`: How many sounds are currently playing
- `currently_playing`: Names of playing sounds

## Troubleshooting

**No Connection**: Check SoundByte is running and port is correct
**No Sounds**: Verify sounds exist in SoundByte `/sounds` folder
**No Feedback**: Check polling is active (updates every 1 second)

## API Endpoints Used
- `GET /api/sounds` - Get sound list
- `GET /api/play/:id` - Play/stop sound (toggles)
- `POST /api/stop` - Stop all sounds
- `GET /api/status/:id` - Get sound playing status 