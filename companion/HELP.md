# Broadcast Apps: SoundByte

This module allows control of Broadcast Apps SoundByte over HTTP API.  
It supports playing/stopping sounds, monitoring playback status, and automatic sound discovery.

---

## **Configuration**

When adding the module in Companion, you will be prompted for:

- **SoundByte Host IP**  
  The IP address or hostname of the SoundByte server (default: `localhost`).

- **Port**  
  HTTP API port (default: `3000`).

---

## **Features**

- **Sound Control**  
  Play or stop individual sounds using their ID numbers.  
  Stop all sounds simultaneously.

- **Automatic Discovery**  
  Automatically fetches and updates available sounds from the SoundByte server.  
  Sound names and colors are exposed for use in button labels and variables.

- **Real-time Status Monitoring**  
  Connection state and sound playback status are monitored and updated automatically.  

---

## **Actions**

- **Stop All Sounds**  
  Immediately stops all currently playing sounds.

- **Play/Stop Sound by ID**  
  Toggle playback of a specific sound by its ID number.  
  If the sound is playing, it will be stopped. If stopped, it will start playing.

---

## **Variables**

The following variables are available:

- `$(soundbyte:connection_status)` – Current connection status  
  Returns: `Connected` or `Disconnected`

- `$(soundbyte:total_sounds)` – Total number of available sounds  
  Example: `$(soundbyte:total_sounds)` returns `12`

- `$(soundbyte:playing_count)` – Number of sounds currently playing  
  Example: `$(soundbyte:playing_count)` returns `3`

- `$(soundbyte:currently_playing)` – Names of currently playing sounds  
  Example: `$(soundbyte:currently_playing)` returns `Intro, Outro, Background`

- `$(soundbyte:sound_<n>_name)` – Name of sound with ID `n`  
  Example: `$(soundbyte:sound_1_name)` returns the name of sound ID 1

---

## **Feedbacks**

- **Connection Status**  
  Change button colors based on connection to SoundByte server.  
  Green when connected, red when disconnected.

- **Sound Playing by ID**  
  Change button colors when a specific sound is playing.  
  Red when the specified sound is playing.

- **Any Sound Playing**  
  Change button colors when any sound is currently playing.  
  Orange when any sound is playing.

---

## **Presets**

The module automatically generates presets for:

- **Connection Status** – Shows connection state with color feedback
- **Stop All Sounds** – Emergency stop button for all sounds
- **Playing Status** – Displays currently playing sounds
- **Individual Sound Buttons** – One button per available sound with custom colors

---

## **Notes**

- Ensure the SoundByte server is running and accessible from the Companion system.
- This module communicates using HTTP API calls to the SoundByte server.
- Sound colors and names are automatically fetched from the server and used in presets. Note that the colors are not changed when you have the button on a page due to current limitations.
- If sounds are added or removed on the server, they will be automatically updated in Companion.

---

## **API Endpoints Used**

The module communicates with SoundByte using these HTTP endpoints:

- `GET /api/sounds` – Retrieve list of available sounds
- `GET /api/status/{id}` – Check if sound {id} is playing
- `GET /api/play/{id}` – Toggle playback of sound {id}
- `POST /api/stop` – Stop all sounds

---

## **Compatibility**

This module is designed for **Broadcast Apps SoundByte** servers.  
It requires a SoundByte server with HTTP API enabled.

If you encounter any issues or have suggestions for improvements, please report them to help enhance the module's functionality and reliability.

---

Module maintained by **Rick Verwaal**  
[GitHub Repository](https://github.com/bitfocus/companion-module-broadcastapps-soundbyte)
