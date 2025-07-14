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
		this.http = null
	}

	async init(config) {
		this.config = config
		
		// Default configuration - use same IP as port
		this.config.host = this.config.host || 'localhost'
		this.config.port = this.config.port || 3000
		this.config.baseUrl = `http://${this.config.host}:${this.config.port}`
		
		// Initialize HTTP client
		this.http = axios.create({
			baseURL: this.config.baseUrl,
			timeout: 5000
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
	}

	async destroy() {
		this.log('info', 'Destroying SoundByte Module')
		
		// Clear polling interval
		if (this.pollInterval) {
			clearInterval(this.pollInterval)
			this.pollInterval = null
		}
		
		this.updateStatus(InstanceStatus.Disconnected)
	}

	async configUpdated(config) {
		this.config = config
		this.config.baseUrl = `http://${this.config.host}:${this.config.port}`
		
		// Reinitialize HTTP client
		this.http = axios.create({
			baseURL: this.config.baseUrl,
			timeout: 5000
		})
		
		await this.testConnection()
		this.updateActions()
		this.updateFeedbacks()
		this.updateVariableDefinitions()
		this.updatePresets()
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

	async testConnection() {
		try {
			// Test connection by getting sounds list
			const response = await this.http.get('/api/sounds')
			this.status.connected = true
			this.status.sounds = response.data || []
			this.updateStatus(InstanceStatus.Ok)
			this.log('info', `Connected to SoundByte - Found ${this.status.sounds.length} sounds`)
			
			// Initialize playing states
			this.status.playingStates.clear()
			for (const sound of this.status.sounds) {
				this.status.playingStates.set(sound.id, false)
			}
			
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
		// Clear any existing interval
		if (this.pollInterval) {
			clearInterval(this.pollInterval)
		}
		
		// Poll every 1 second for sound status
		this.pollInterval = setInterval(() => {
			this.pollSoundStates()
		}, 1000)
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
					
					if (isPlaying !== wasPlaying) {
						this.status.playingStates.set(sound.id, isPlaying)
						hasChanges = true
					}
				} catch (error) {
					// Individual sound status check failed, set to not playing
					if (this.status.playingStates.get(sound.id)) {
						this.status.playingStates.set(sound.id, false)
						hasChanges = true
					}
				}
			}
			
			// Update feedbacks and variables if there were changes
			if (hasChanges) {
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
			description: 'Shows if connected to SoundByte',
			defaultStyle: {
				color: 0xFFFFFF,
				bgcolor: 0x008000
			},
			options: [],
			callback: () => {
				return this.status.connected
			}
		}
		
		// Feedback for each sound (red when playing)
		for (const sound of this.status.sounds) {
			feedbacks[`sound_${sound.id}_playing`] = {
				type: 'boolean',
				name: `${sound.name} Playing`,
				description: `Shows red when ${sound.name} is playing`,
				defaultStyle: {
					color: 0xFFFFFF,
					bgcolor: 0xFF0000 // Red background when playing
				},
				options: [],
				callback: () => {
					return this.status.playingStates.get(sound.id) || false
				}
			}
		}
		
		// Any sound playing feedback
		feedbacks.any_sound_playing = {
			type: 'boolean',
			name: 'Any Sound Playing',
			description: 'Shows if any sound is currently playing',
			defaultStyle: {
				color: 0xFFFFFF,
				bgcolor: 0xFF8000 // Orange background when any sound is playing
			},
			options: [],
			callback: () => {
				return Array.from(this.status.playingStates.values()).some(playing => playing)
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
				text: 'SoundByte\\n$(soundbyte:connection_status)',
				size: '14',
				color: 0xFFFFFF,
				bgcolor: 0x000000
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
						bgcolor: 0x008000
					}
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
			]
		})
		
		// Create presets for all available sounds
		for (const sound of this.status.sounds) {
			presets.push({
				type: 'button',
				category: 'Sounds',
				name: sound.name,
				style: {
					text: sound.shortName || sound.name,
					size: '14',
					color: 0xFFFFFF,
					bgcolor: 0x404040
				},
				steps: [
					{
						down: [
							{
								actionId: `play_${sound.id}`,
								options: {}
							}
						],
						up: []
					}
				],
				feedbacks: [
					{
						feedbackId: `sound_${sound.id}_playing`,
						options: {},
						style: {
							color: 0xFFFFFF,
							bgcolor: 0xFF0000 // Red when playing
						}
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
				this.updateVariableValues()
				this.checkFeedbacks()
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