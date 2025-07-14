# SoundByte Companion Module

A BitFocus Companion module for controlling the SoundByte sound board application.

## Features

- **Play/Stop Controls**: Toggle sounds on/off with a single button press
- **Real-time Status**: Live updates of playing state with 1-second polling
- **Presets**: Auto-generated presets for all available sounds
- **Connection Monitoring**: Visual connection status indicator
- **Comprehensive Variables**: Real-time status variables for monitoring and display

## Configuration

1. In BitFocus Companion, add a new SoundByte instance
2. Configure the connection settings:
   - **SoundByte Host IP**: The IP address of your SoundByte application (default: localhost)
   - **Port**: The port number (default: 3000)

## Usage

### Available Actions

- **Stop All Sounds**: Stops all currently playing sounds
- **Play/Stop Sound by ID**: Toggle a specific sound by its ID number
- **Individual Sound Actions**: Automatically created for each sound in your library with direct play/stop functionality

### Presets

The module automatically creates presets for:

- **Connection Status**: Shows if the module is connected to SoundByte with live status updates
- **Stop All Sounds**: Red button to stop all playing sounds with orange feedback when any sound is playing
- **Playing Status**: Display showing currently playing sounds with real-time updates
- **Individual Sounds**: One preset per sound with the following features:
  - Normal gray background when not playing
  - **Red background when playing** (as requested)
  - Click to play/stop the sound
  - Automatic feedback updates

### Variables

- `$(soundbyte:connection_status)`: Connected/Disconnected status
- `$(soundbyte:total_sounds)`: Total number of available sounds
- `$(soundbyte:playing_count)`: Number of currently playing sounds
- `$(soundbyte:currently_playing)`: Names of currently playing sounds (comma-separated)

### Feedbacks

- **Connection Status**: Green when connected to SoundByte
- **Any Sound Playing**: Orange when any sound is currently playing
- **Individual Sound Playing**: Red when specific sound is playing (one feedback per sound)

## API Integration

The module integrates with the SoundByte HTTP API:

- `GET /api/sounds` - Get list of available sounds
- `GET /api/play/:id` - Play/stop sound by ID (toggles)
- `POST /api/stop` - Stop all sounds
- `GET /api/status/:id` - Get playing status of specific sound

## Technical Details

- **Polling Rate**: 1 second for real-time status updates
- **Timeout**: 5 seconds for HTTP requests
- **Compatibility**: BitFocus Companion 3.0.0+
- **Dependencies**: @companion-module/base, axios
- **Dynamic Updates**: Automatically updates actions, feedbacks, variables, and presets when sounds are discovered

## Troubleshooting

### Module Not Connecting

1. Ensure SoundByte application is running
2. Check that the HTTP API server is active (default port 3000)
3. Verify the IP address and port in module configuration
4. Check BitFocus Companion logs for error messages

### No Sounds Appearing

1. Ensure you have sounds in your SoundByte `/sounds` folder
2. Check that SoundByte has loaded the sounds correctly
3. Try restarting the module instance
4. Verify the API endpoint `/api/sounds` returns sound data

### Feedback Not Working

1. Check that the polling is active (every 1 second)
2. Verify the `/api/status/:id` endpoint is responding
3. Try refreshing the module configuration
4. Ensure the SoundByte API is returning proper status responses

### Variables Not Updating

1. Check that the module is connected (green status)
2. Verify that sounds are being discovered
3. Check the polling interval is working
4. Review BitFocus Companion logs for any errors

## Version History

- **1.0.0**: Initial release with comprehensive SoundByte integration
  - Complete play/stop API integration
  - Red feedback for playing sounds
  - Auto-discovery of sounds from SoundByte API
  - Real-time status polling and updates
  - Dynamic action and preset generation
  - Comprehensive variable system
  - Connection monitoring and error handling 