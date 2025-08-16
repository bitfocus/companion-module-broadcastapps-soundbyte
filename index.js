const { InstanceBase, InstanceStatus, runEntrypoint } = require('@companion-module/base');
const axios = require('axios');

class SoundByteInstance extends InstanceBase {
	constructor(internal) {
		super(internal);

		// Initialize state
		this.status = {
			connected: false,
			sounds: [],
			playingStates: new Map(), // Track which sounds are playing
		};

		this.pollInterval = null;
		this.soundsCheckInterval = null;
		this.connectionCheckInterval = null;
		this.http = null;
	}

	async init(config) {
		this.config = { ...config, host: config.host || 'localhost', port: config.port || 3000 };
		this.config.baseUrl = `http://${this.config.host}:${this.config.port}`;
		this.http = axios.create({ baseURL: this.config.baseUrl, timeout: 1000 });

		await this.testConnection();
		this.startPolling();
		this.updateAll();
	}

	async destroy() {
		[this.pollInterval, this.soundsCheckInterval, this.connectionCheckInterval].forEach(
			interval => {
				if (interval) clearInterval(interval);
			}
		);
		this.updateStatus(InstanceStatus.Disconnected);
	}

	async configUpdated(config) {
		this.config = { ...config, host: config.host || 'localhost', port: config.port || 3000 };
		this.config.baseUrl = `http://${this.config.host}:${this.config.port}`;
		this.http = axios.create({ baseURL: this.config.baseUrl, timeout: 1000 });

		await this.testConnection();
		this.updateAll();
	}

	getConfigFields() {
		return [
			{
				type: 'textinput',
				id: 'host',
				label: 'SoundByte Host IP',
				width: 8,
				default: 'localhost',
			},
			{
				type: 'textinput',
				id: 'port',
				label: 'Port',
				width: 4,
				default: '3000',
				regex: '/^\\d+$/',
			},
		];
	}

	haveSoundsChanged(newSounds) {
		if (this.status.sounds.length !== newSounds.length) return true;

		return newSounds.some(newSound => {
			const existing = this.status.sounds.find(s => s.id === newSound.id);
			return (
				!existing ||
				existing.name !== newSound.name ||
				existing.shortName !== newSound.shortName ||
				existing.color !== newSound.color ||
				existing.textColor !== newSound.textColor
			);
		});
	}

	async testConnection() {
		try {
			// Test connection by getting sounds list
			const response = await this.http.get('/api/sounds');
			this.status.connected = true;

			// Check if sounds have changed
			const newSounds = response.data || [];
			const soundsChanged = this.haveSoundsChanged(newSounds);

			this.status.sounds = newSounds;
			this.updateStatus(InstanceStatus.Ok);

			// Initialize playing states to false and get actual status
			this.status.playingStates.clear();
			for (const sound of this.status.sounds) {
				this.status.playingStates.set(sound.id, false);
			}

			// If sounds changed, update everything
			if (soundsChanged) {
				this.updateActions();
				this.updateFeedbacks();
				this.updateVariableDefinitions();
				this.updatePresets();
			}

			// Get actual playing status immediately to avoid false positives
			await this.pollSoundStates();

			return true;
		} catch (error) {
			this.status.connected = false;
			this.status.sounds = [];
			this.updateStatus(InstanceStatus.ConnectionFailure, `Failed to connect: ${error.message}`);
			this.log('error', `Connection failed: ${error.message}`);
			return false;
		}
	}

	startPolling() {
		[this.pollInterval, this.soundsCheckInterval, this.connectionCheckInterval].forEach(
			interval => {
				if (interval) {
					clearInterval(interval);
				}
			}
		);

		setTimeout(() => {
			this.pollInterval = setInterval(() => this.pollSoundStates(), 250);
			this.soundsCheckInterval = setInterval(() => this.checkSoundChanges(), 100);
			this.connectionCheckInterval = setInterval(() => this.checkConnection(), 500);
		}, 100);
	}

	async checkConnection() {
		try {
			await this.http.get('/api/sounds');
			if (!this.status.connected) {
				this.status.connected = true;
				this.updateStatus(InstanceStatus.Ok);
				this.updateVariableValues();
				this.checkFeedbacks();
			}
		} catch (error) {
			if (this.status.connected) {
				this.log('error', 'Connection lost');
				this.status.connected = false;
				this.updateStatus(InstanceStatus.ConnectionFailure, 'Connection lost');
				this.updateVariableValues();
				this.checkFeedbacks();
			}
		}
	}

	async checkSoundChanges() {
		if (!this.status.connected) return;

		try {
			const newSounds = (await this.http.get('/api/sounds')).data || [];
			if (this.haveSoundsChanged(newSounds)) {
				this.status.sounds = newSounds;
				this.updateAll();
			}
		} catch (error) {
			// Silent fail for sound change checks
		}
	}

	async pollSoundStates() {
		if (!this.status.connected || this.status.sounds.length === 0) return;

		try {
			let hasChanges = false;
			for (const sound of this.status.sounds) {
				try {
					const isPlaying =
						(await this.http.get(`/api/status/${sound.id}`)).data.isPlaying || false;
					const wasPlaying = this.status.playingStates.get(sound.id) || false;
					if (isPlaying !== wasPlaying) {
						this.status.playingStates.set(sound.id, isPlaying);
						hasChanges = true;
					}
				} catch (error) {
					if (this.status.playingStates.get(sound.id)) {
						this.status.playingStates.set(sound.id, false);
						hasChanges = true;
					}
				}
			}

			if (hasChanges) {
				this.updateVariableValues();
				this.checkFeedbacks();
			}
		} catch (error) {
			// Silent fail for polling errors
		}
	}

	updateActions() {
		this.setActionDefinitions({
			stop_all: {
				name: 'Stop All Sounds',
				options: [],
				callback: async () => await this.stopAllSounds(),
			},
			play_sound_by_id: {
				name: 'Play/Stop Sound by ID',
				options: [{ type: 'number', label: 'Sound ID', id: 'soundId', default: 1, min: 1 }],
				callback: async event => await this.toggleSound(event.options.soundId),
			},
		});
	}

	updateFeedbacks() {
		this.setFeedbackDefinitions({
			connection_status: {
				type: 'boolean',
				name: 'Connection Status',
				description: 'Shows green when connected to SoundByte',
				defaultStyle: { color: 0xffffff, bgcolor: 0x008000 },
				options: [],
				callback: () => this.status.connected,
			},
			sound_playing_by_id: {
				type: 'boolean',
				name: 'Sound Playing by ID',
				description: 'Shows red when the specified sound is playing',
				defaultStyle: { color: 0xffffff, bgcolor: 0xff0000 },
				options: [{ type: 'number', label: 'Sound ID', id: 'soundId', default: 1, min: 1 }],
				callback: feedback => this.status.playingStates.get(feedback.options.soundId) || false,
			},
			any_sound_playing: {
				type: 'boolean',
				name: 'Any Sound Playing',
				description: 'Shows orange when any sound is playing',
				defaultStyle: { color: 0xffffff, bgcolor: 0xff8000 },
				options: [],
				callback: () => Array.from(this.status.playingStates.values()).some(playing => playing),
			},
		});
	}

	updateVariableDefinitions() {
		const variables = [
			{ name: 'Connection Status', variableId: 'connection_status' },
			{ name: 'Total Sounds', variableId: 'total_sounds' },
			{ name: 'Playing Sounds Count', variableId: 'playing_count' },
			{ name: 'Currently Playing', variableId: 'currently_playing' },
			...this.status.sounds.map(sound => ({
				name: `${sound.name} Name`,
				variableId: `sound_${sound.id}_name`,
			})),
		];
		this.setVariableDefinitions(variables);
		this.updateVariableValues();
	}

	updateVariableValues() {
		const playingCount = Array.from(this.status.playingStates.values()).filter(
			playing => playing
		).length;
		const playingSounds = this.status.sounds
			.filter(sound => this.status.playingStates.get(sound.id))
			.map(sound => sound.shortName || sound.name);

		this.setVariableValues({
			connection_status: this.status.connected ? 'Connected' : 'Disconnected',
			total_sounds: this.status.sounds.length,
			playing_count: playingCount,
			currently_playing: playingSounds.length > 0 ? playingSounds.join(', ') : 'None',
			...Object.fromEntries(
				this.status.sounds.map(sound => [`sound_${sound.id}_name`, sound.shortName || sound.name])
			),
		});
	}

	updatePresets() {
		const presets = [];

		// Connection status preset
		presets.push({
			type: 'button',
			category: 'Status',
			name: 'Connection Status',
			style: {
				text: 'SOUND BYTE',
				size: '14',
				color: 0xffffff,
				bgcolor: 0xff0000, // Red when disconnected
			},
			steps: [
				{
					down: [],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'connection_status',
					options: {},
					style: {
						color: 0xffffff,
						bgcolor: 0x008000, // Green when connected
					},
				},
			],
			backgrounds: [
				{
					type: 'solid',
					color: 0xff0000, // Red when disconnected
				},
			],
		});

		// Stop all sounds preset
		presets.push({
			type: 'button',
			category: 'Control',
			name: 'Stop All Sounds',
			style: {
				text: 'STOP\\nALL',
				size: '18',
				color: 0xffffff,
				bgcolor: 0x800000,
			},
			steps: [
				{
					down: [
						{
							actionId: 'stop_all',
							options: {},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'any_sound_playing',
					options: {},
					style: {
						color: 0xffffff,
						bgcolor: 0xff4000,
					},
				},
			],
			backgrounds: [
				{
					type: 'solid',
					color: 0x800000,
				},
			],
		});

		// Status display preset
		presets.push({
			type: 'button',
			category: 'Status',
			name: 'Playing Status',
			style: {
				text: 'Playing:\\n$(soundbyte:currently_playing)',
				size: '12',
				color: 0xffffff,
				bgcolor: 0x404040,
			},
			steps: [
				{
					down: [],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'any_sound_playing',
					options: {},
					style: {
						color: 0xffffff,
						bgcolor: 0xff8000,
					},
				},
			],
			backgrounds: [
				{
					type: 'solid',
					color: 0x404040,
				},
			],
		});

		// Create presets for all available sounds
		for (const sound of this.status.sounds) {
			// Use the sound's color from the API, or default to gray
			const soundColor = sound.color || 0x404040;
			const textColor = sound.textColor || 0xffffff;

			presets.push({
				type: 'button',
				category: 'Sounds',
				name: sound.name,
				style: {
					text: `$(soundbyte:sound_${sound.id}_name)`,
					size: '14',
					color: textColor,
					bgcolor: soundColor,
				},
				steps: [
					{
						down: [
							{
								actionId: 'play_sound_by_id',
								options: {
									soundId: sound.id,
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'sound_playing_by_id',
						options: {
							soundId: sound.id,
						},
						style: {
							color: 0xffffff,
							bgcolor: 0xff0000,
						},
					},
				],
				backgrounds: [
					{
						type: 'solid',
						color: soundColor,
					},
				],
			});
		}

		this.setPresetDefinitions(presets);
	}

	updateAll() {
		this.updateActions();
		this.updateFeedbacks();
		this.updateVariableDefinitions();
		this.updatePresets();
		this.updateVariableValues();
		this.checkFeedbacks();
	}

	// API Methods
	async toggleSound(soundId) {
		try {
			const response = await this.http.get(`/api/play/${soundId}`);
			if (response.data.success) {
				const isPlaying = response.data.action === 'playing';
				this.status.playingStates.set(soundId, isPlaying);
				this.updateVariableValues();
				this.checkFeedbacks();
			} else {
				this.log('error', `Failed to toggle sound ${soundId}: ${response.data.message}`);
			}
		} catch (error) {
			this.log('error', `Failed to toggle sound ${soundId}: ${error.message}`);
		}
	}

	async stopAllSounds() {
		try {
			const response = await this.http.post('/api/stop');
			if (response.data.success) {
				this.status.playingStates.forEach((_, soundId) =>
					this.status.playingStates.set(soundId, false)
				);
				this.updateVariableValues();
				this.checkFeedbacks();
			} else {
				this.log('error', `Failed to stop all sounds: ${response.data.message}`);
			}
		} catch (error) {
			this.log('error', `Failed to stop all sounds: ${error.message}`);
		}
	}
}

runEntrypoint(SoundByteInstance, []);
