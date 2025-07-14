const { InstanceBase, InstanceStatus, runEntrypoint } = require('@companion-module/base')
const axios = require('axios')

class SoundByteInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
		
		// Initialize state
		this.status = {
			connected: false,
			sounds: [],
			playingStates: new Map() // Track which sounds are playing
		}
		
		this.pollInterval = null
		this.soundsCheckInterval = null
		this.connectionCheckInterval = null
		this.http = null
	}

	async init(config) {
		this.config = config
		
		// Default configuration - use same IP as port
		this.config.host = this.config.host || 'localhost'
		this.config.port = this.config.port || 3000
		this.config.baseUrl = `http://${this.config.host}:${this.config.port}`
		
		// Initialize HTTP client with faster timeout
		this.http = axios.create({
			baseURL: this.config.baseUrl,
			timeout: 1000 // 1 second timeout for faster connection detection
		})
		
		this.log('info', 'Initializing SoundByte Module')
		
		// Test connection and load sounds
		await this.testConnection()
		
		// Start polling for status updates
		this.startPolling()
		
		this.updateActions()
		this.updateFeedbacks()
		this.updateVariableDefinitions()
		this.updatePresets()
		
		// Initial feedback check
		this.checkFeedbacks()
	}

	async destroy() {
		this.log('info', 'Destroying SoundByte Module')
		
		// Clear polling intervals
		if (this.pollInterval) {
			clearInterval(this.pollInterval)
			this.pollInterval = null
		}
		if (this.soundsCheckInterval) {
			clearInterval(this.soundsCheckInterval)
			this.soundsCheckInterval = null
		}
		if (this.connectionCheckInterval) {
			clearInterval(this.connectionCheckInterval)
			this.connectionCheckInterval = null
		}
		
		this.updateStatus(InstanceStatus.Disconnected)
	}

	async configUpdated(config) {
		this.config = config
		this.config.baseUrl = `http://${this.config.host}:${this.config.port}`
		
		// Reinitialize HTTP client with faster timeout
		this.http = axios.create({
			baseURL: this.config.baseUrl,
			timeout: 1000 // 1 second timeout for faster connection detection
		})
		
		await this.testConnection()
		this.updateActions()
		this.updateFeedbacks()
		this.updateVariableDefinitions()
		this.updatePresets()
		
		// Refresh feedbacks after config update
		this.checkFeedbacks()
	}

	getConfigFields() {
		return [
			{
				type: 'textinput',
				id: 'host',
				label: 'SoundByte Host IP',
				width: 8,
				default: 'localhost'
			},
			{
				type: 'textinput',
				id: 'port',
				label: 'Port',
				width: 4,
				default: '3000',
				regex: '/^\\d+$/'
			}
		]
	}

	haveSoundsChanged(newSounds) {
		// Check if sounds list has changed
		if (this.status.sounds.length !== newSounds.length) {
			return true
		}
		
		// Check if any sound names or properties have changed
		for (const newSound of newSounds) {
			const existingSound = this.status.sounds.find(s => s.id === newSound.id)
			if (!existingSound) {
				return true
			}
			
			// Check if name, shortName, or color changed
			if (existingSound.name !== newSound.name || 
				existingSound.shortName !== newSound.shortName ||
				existingSound.color !== newSound.color ||
				existingSound.textColor !== newSound.textColor) {
				this.log('debug', `Sound ${newSound.id} changed - Name: ${existingSound.name} -> ${newSound.name}, ShortName: ${existingSound.shortName} -> ${newSound.shortName}`)
				return true
			}
		}
		
		return false
	}

	async testConnection() {
		try {
			// Test connection by getting sounds list
			const response = await this.http.get('/api/sounds')
			this.status.connected = true
			
			// Check if sounds have changed
			const newSounds = response.data || []
			const soundsChanged = this.haveSoundsChanged(newSounds)
			
			this.status.sounds = newSounds
			this.updateStatus(InstanceStatus.Ok)
			this.log('info', `Connected to SoundByte - Found ${this.status.sounds.length} sounds`)
			
			// Log color information for each sound
			for (const sound of this.status.sounds) {
				this.log('debug', `Sound ${sound.name} (ID: ${sound.id}) - Color: ${sound.color || 'none'}, TextColor: ${sound.textColor || 'none'}`)
			}
			
			// Initialize playing states to false and get actual status
			this.status.playingStates.clear()
			for (const sound of this.status.sounds) {
				this.status.playingStates.set(sound.id, false)
			}
			
			// If sounds changed, update everything
			if (soundsChanged) {
				this.log('info', 'Sounds changed - updating actions, feedbacks, variables and presets')
				this.updateActions()
				this.updateFeedbacks()
				this.updateVariableDefinitions()
				this.updatePresets()
			}
			
			// Get actual playing status immediately to avoid false positives
			await this.pollSoundStates()
			
			return true
		} catch (error) {
			this.status.connected = false
			this.status.sounds = []
			this.updateStatus(InstanceStatus.ConnectionFailure, `Failed to connect: ${error.message}`)
			this.log('error', `Failed to connect to SoundByte: ${error.message}`)
			return false
		}
	}

	startPolling() {
		// Clear any existing intervals
		if (this.pollInterval) {
			clearInterval(this.pollInterval)
		}
		if (this.soundsCheckInterval) {
			clearInterval(this.soundsCheckInterval)
		}
		if (this.connectionCheckInterval) {
			clearInterval(this.connectionCheckInterval)
		}
		
				// Start polling after a short delay to ensure initial status is set
		setTimeout(() => {
		// Poll every 250ms for sound status (ultra-fast)
		this.pollInterval = setInterval(() => {
			this.pollSoundStates()
		}, 250)
		
		// Poll every 100ms to check for sound changes (ultra-quick updates)
		this.soundsCheckInterval = setInterval(() => {
			this.checkSoundChanges()
		}, 100)
		
		// Poll every 500ms to check connection status
		this.connectionCheckInterval = setInterval(() => {
			this.checkConnection()
		}, 500)
		}, 100) // 100ms delay before starting regular polling
	}

	async checkConnection() {
		try {
			// Quick connection check
			const response = await this.http.get('/api/sounds')
			
			if (!this.status.connected) {
				this.log('info', 'Connection restored to SoundByte')
				this.status.connected = true
				this.updateStatus(InstanceStatus.Ok)
				this.updateVariableValues()
				this.checkFeedbacks()
			}
		} catch (error) {
			if (this.status.connected) {
				this.log('warning', 'Lost connection to SoundByte')
				this.status.connected = false
				this.updateStatus(InstanceStatus.ConnectionFailure, 'Connection lost')
				this.updateVariableValues()
				this.checkFeedbacks()
			}
		}
	}

	async checkSoundChanges() {
		if (!this.status.connected) {
			return
		}
		
		try {
			// Get updated sounds list
			const response = await this.http.get('/api/sounds')
			const newSounds = response.data || []
			
			// Check if sounds have changed
			if (this.haveSoundsChanged(newSounds)) {
				this.log('info', 'Sounds changed - updating in real-time')
				this.status.sounds = newSounds
				
				// Update everything quickly
				this.updateActions()
				this.updateFeedbacks()
				this.updateVariableDefinitions()
				this.updatePresets()
				
				// Force immediate feedback and variable updates
				this.updateVariableValues()
				this.checkFeedbacks()
			}
		} catch (error) {
			this.log('debug', `Error checking sound changes: ${error.message}`)
		}
	}

	async pollSoundStates() {
		if (!this.status.connected || this.status.sounds.length === 0) {
			return
		}
		
		try {
			// Check status of each sound
			let hasChanges = false
			for (const sound of this.status.sounds) {
				try {
					const response = await this.http.get(`/api/status/${sound.id}`)
					const isPlaying = response.data.isPlaying || false
					const wasPlaying = this.status.playingStates.get(sound.id) || false
					
					this.log('debug', `API Status for ${sound.name} (ID: ${sound.id}): isPlaying=${isPlaying}, wasPlaying=${wasPlaying}`)
					
					if (isPlaying !== wasPlaying) {
						this.status.playingStates.set(sound.id, isPlaying)
						hasChanges = true
						this.log('debug', `Sound ${sound.name} (ID: ${sound.id}) status changed: ${wasPlaying} -> ${isPlaying}`)
					}
				} catch (error) {
					// Individual sound status check failed, set to not playing
					if (this.status.playingStates.get(sound.id)) {
						this.status.playingStates.set(sound.id, false)
						hasChanges = true
						this.log('debug', `Sound ${sound.name} (ID: ${sound.id}) status check failed, setting to not playing`)
					}
				}
			}
			
			// Update feedbacks and variables if there were changes
			if (hasChanges) {
				const playingCount = Array.from(this.status.playingStates.values()).filter(playing => playing).length
				this.log('debug', `Playing count updated to: ${playingCount}`)
				this.updateVariableValues()
				this.checkFeedbacks()
			}
			
		} catch (error) {
			this.log('error', `Error polling sound states: ${error.message}`)
		}
	}

	updateActions() {
		const actions = {}
		
		// Stop all sounds action
		actions.stop_all = {
			name: 'Stop All Sounds',
			options: [],
			callback: async () => {
				await this.stopAllSounds()
			}
		}
		
		// Generic play sound by ID action
		actions.play_sound_by_id = {
			name: 'Play/Stop Sound by ID',
			options: [
				{
					type: 'number',
					label: 'Sound ID',
					id: 'soundId',
					default: 1,
					min: 1
				}
			],
			callback: async (event) => {
				await this.toggleSound(event.options.soundId)
			}
		}
		
		this.setActionDefinitions(actions)
	}

	updateFeedbacks() {
		const feedbacks = {}
		
		// Connection status feedback
		feedbacks.connection_status = {
			type: 'boolean',
			name: 'Connection Status',
			description: 'Shows green when connected to SoundByte',
			defaultStyle: {
				color: 0xFFFFFF,
				bgcolor: 0x008000
			},
			options: [],
			callback: () => {
				const connected = this.status.connected
				this.log('debug', `Connection status feedback: ${connected}`)
				return connected
			}
		}
		
		// Generic feedback for sound playing status by ID
		feedbacks.sound_playing_by_id = {
			type: 'boolean',
			name: 'Sound Playing by ID',
			description: 'Shows red when the specified sound is playing',
			defaultStyle: {
				color: 0xFFFFFF,
				bgcolor: 0xFF0000
			},
			options: [
				{
					type: 'number',
					label: 'Sound ID',
					id: 'soundId',
					default: 1,
					min: 1
				}
			],
			callback: (feedback) => {
				const soundId = feedback.options.soundId
				const isPlaying = this.status.playingStates.get(soundId) || false
				this.log('debug', `Generic feedback for sound ID ${soundId}: ${isPlaying}`)
				return isPlaying
			}
		}
		
		// Any sound playing feedback
		feedbacks.any_sound_playing = {
			type: 'boolean',
			name: 'Any Sound Playing',
			description: 'Shows orange when any sound is playing',
			defaultStyle: {
				color: 0xFFFFFF,
				bgcolor: 0xFF8000
			},
			options: [],
			callback: () => {
				const anyPlaying = Array.from(this.status.playingStates.values()).some(playing => playing)
				this.log('debug', `Any sound playing feedback: ${anyPlaying}`)
				return anyPlaying
			}
		}
		
		this.setFeedbackDefinitions(feedbacks)
	}

	updateVariableDefinitions() {
		const variables = [
			{
				name: 'Connection Status',
				variableId: 'connection_status'
			},
			{
				name: 'Total Sounds',
				variableId: 'total_sounds'
			},
			{
				name: 'Playing Sounds Count',
				variableId: 'playing_count'
			},
			{
				name: 'Currently Playing',
				variableId: 'currently_playing'
			}
		]
		
		// Add individual variables for each sound name
		for (const sound of this.status.sounds) {
			variables.push({
				name: `${sound.name} Name`,
				variableId: `sound_${sound.id}_name`
			})
		}
		
		this.setVariableDefinitions(variables)
		this.updateVariableValues()
	}

	updateVariableValues() {
		const playingCount = Array.from(this.status.playingStates.values()).filter(playing => playing).length
		const playingSounds = this.status.sounds
			.filter(sound => this.status.playingStates.get(sound.id))
			.map(sound => sound.shortName || sound.name)
		
		const values = {
			connection_status: this.status.connected ? 'Connected' : 'Disconnected',
			total_sounds: this.status.sounds.length,
			playing_count: playingCount,
			currently_playing: playingSounds.length > 0 ? playingSounds.join(', ') : 'None'
		}
		
		// Add individual sound name variables
		for (const sound of this.status.sounds) {
			values[`sound_${sound.id}_name`] = sound.shortName || sound.name
		}
		
		this.setVariableValues(values)
	}

	updatePresets() {
		const presets = []
		
		// Connection status preset
		presets.push({
			type: 'button',
			category: 'Status',
			name: 'Connection Status',
			style: {
				text: 'SOUND BYTE',
				size: '14',
				color: 0xFFFFFF,
				bgcolor: 0xFF0000 // Red when disconnected
			},
			steps: [
				{
					down: [],
					up: []
				}
			],
			feedbacks: [
				{
					feedbackId: 'connection_status',
					options: {},
					style: {
						color: 0xFFFFFF,
						bgcolor: 0x008000 // Green when connected
					}
				}
			],
			backgrounds: [
				{
					type: 'solid',
					color: 0xFF0000 // Red when disconnected
				}
			]
		})
		
		// Stop all sounds preset
		presets.push({
			type: 'button',
			category: 'Control',
			name: 'Stop All Sounds',
			style: {
				text: 'STOP\\nALL',
				size: '18',
				color: 0xFFFFFF,
				bgcolor: 0x800000
			},
			steps: [
				{
					down: [
						{
							actionId: 'stop_all',
							options: {}
						}
					],
					up: []
				}
			],
			feedbacks: [
				{
					feedbackId: 'any_sound_playing',
					options: {},
					style: {
						color: 0xFFFFFF,
						bgcolor: 0xFF4000
					}
				}
			],
			backgrounds: [
				{
					type: 'solid',
					color: 0x800000
				}
			]
		})
		
		// Status display preset
		presets.push({
			type: 'button',
			category: 'Status',
			name: 'Playing Status',
			style: {
				text: 'Playing:\\n$(soundbyte:currently_playing)',
				size: '12',
				color: 0xFFFFFF,
				bgcolor: 0x404040
			},
			steps: [
				{
					down: [],
					up: []
				}
			],
			feedbacks: [
				{
					feedbackId: 'any_sound_playing',
					options: {},
					style: {
						color: 0xFFFFFF,
						bgcolor: 0xFF8000
					}
				}
			],
			backgrounds: [
				{
					type: 'solid',
					color: 0x404040
				}
			]
		})
		
		// Create presets for all available sounds
		for (const sound of this.status.sounds) {
			// Use the sound's color from the API, or default to gray
			const soundColor = sound.color || 0x404040
			const textColor = sound.textColor || 0xFFFFFF
			
			presets.push({
				type: 'button',
				category: 'Sounds',
				name: sound.name,
				style: {
					text: `$(soundbyte:sound_${sound.id}_name)`,
					size: '14',
					color: textColor,
					bgcolor: soundColor
				},
				steps: [
					{
						down: [
							{
								actionId: 'play_sound_by_id',
								options: {
									soundId: sound.id
								}
							}
						],
						up: []
					}
				],
				feedbacks: [
					{
						feedbackId: 'sound_playing_by_id',
						options: {
							soundId: sound.id
						},
						style: {
							color: 0xFFFFFF,
							bgcolor: 0xFF0000
						}
					}
				],
				backgrounds: [
					{
						type: 'solid',
						color: soundColor
					}
				]
			})
		}
		
		this.setPresetDefinitions(presets)
	}

	// API Methods
	async toggleSound(soundId) {
		try {
			const response = await this.http.get(`/api/play/${soundId}`)
			if (response.data.success) {
				this.log('info', `${response.data.action} sound: ${response.data.name}`)
				// Update local state immediately for better responsiveness
				const isPlaying = response.data.action === 'playing'
				this.status.playingStates.set(soundId, isPlaying)
				this.log('debug', `Toggle: Sound ${soundId} set to playing=${isPlaying}`)
				this.updateVariableValues()
				this.checkFeedbacks('all')
				
				// Force immediate feedback update
				setTimeout(() => {
					this.checkFeedbacks()
				}, 100)
			} else {
				this.log('error', `Failed to toggle sound ${soundId}: ${response.data.message}`)
			}
		} catch (error) {
			this.log('error', `Failed to toggle sound ${soundId}: ${error.message}`)
		}
	}

	async stopAllSounds() {
		try {
			const response = await this.http.post('/api/stop')
			if (response.data.success) {
				this.log('info', 'All sounds stopped')
				// Update local state - all sounds are now stopped
				for (const soundId of this.status.playingStates.keys()) {
					this.status.playingStates.set(soundId, false)
				}
				this.updateVariableValues()
				this.checkFeedbacks()
			} else {
				this.log('error', `Failed to stop all sounds: ${response.data.message}`)
			}
		} catch (error) {
			this.log('error', `Failed to stop all sounds: ${error.message}`)
		}
	}
}

runEntrypoint(SoundByteInstance, []) 