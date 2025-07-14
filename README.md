# SoundByte Companion Module

A BitFocus Companion module for controlling the SoundByte sound board application.

## Features

- **Play/Stop Controls**: Toggle sounds on/off with a single button press
- **Red Feedback**: Buttons show red background when sounds are playing
- **Automatic Sound Discovery**: Automatically detects all sounds in your SoundByte `/sounds` folder
- **Real-time Status**: Live updates of playing state with 1-second polling
- **Presets**: Auto-generated presets for all available sounds
- **Connection Monitoring**: Visual connection status indicator

## Installation

1. Copy the `companion-module` folder to your BitFocus Companion modules directory
2. Install dependencies:
   ```bash
   cd companion-module
   npm install
   ```
3. Restart BitFocus Companion
4. The SoundByte module should appear in the module list

## Configuration

1. In BitFocus Companion, add a new SoundByte instance
2. Configure the connection settings:
   - **Host IP**: The IP address of your SoundByte application (default: localhost)
   - **Port**: The port number (default: 3000)
   
   **Note**: The connection IP should be set to the same as the port number as requested.

## Usage

### Available Actions

- **Play/Stop Sound by ID**: Toggle a specific sound by its ID number
- **Stop All Sounds**: Stop all currently playing sounds
- **Individual Sound Actions**: Automatically created for each sound in your library

### Presets

The module automatically creates presets for:

- **Connection Status**: Shows if the module is connected to SoundByte
- **Stop All Sounds**: Red button to stop all playing sounds
- **Playing Status**: Display showing currently playing sounds
- **Individual Sounds**: One preset per sound with the following features:
  - Normal gray background when not playing
  - **Red background when playing** (as requested)
  - Click to play/stop the sound

### Variables

- `$(soundbyte:connection_status)`: Connected/Disconnected
- `$(soundbyte:total_sounds)`: Total number of available sounds
- `$(soundbyte:playing_count)`: Number of currently playing sounds
- `$(soundbyte:currently_playing)`: Names of currently playing sounds

### Feedbacks

- **Connection Status**: Green when connected
- **Any Sound Playing**: Orange when any sound is playing
- **Individual Sound Playing**: Red when specific sound is playing

## API Integration

The module integrates with the SoundByte HTTP API:

- `GET /api/sounds` - Get list of available sounds
- `GET /api/play/:id` - Play/stop sound by ID (toggles)
- `POST /api/stop` - Stop all sounds
- `GET /api/status/:id` - Get playing status of specific sound

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

## Technical Details

- **Polling Rate**: 1 second for real-time status updates
- **Timeout**: 5 seconds for HTTP requests
- **Compatibility**: BitFocus Companion 3.0.0+
- **Dependencies**: @companion-module/base, axios

## Version History

- **1.0.0**: Initial release with all requested features
  - Play API call integration
  - Red feedback for playing sounds
  - Auto-discovery of sounds from /sounds folder
  - Start/stop functionality for all sounds 