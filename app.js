/**
 * SPECTRA - Spectral Audio Editor
 * A browser-based clone of SPEAR (Sinusoidal Partial Editing Analysis and Resynthesis)
 */

class Spectra {
    constructor() {
        // Audio Context
        this.audioContext = null;
        this.audioBuffer = null;
        this.sourceNode = null;
        this.gainNode = null;

        // State
        this.isPlaying = false;
        this.isScrubbing = false;
        this.isLooping = false;
        this.playbackPosition = 0;
        this.startTime = 0;

        // Partials data
        this.partials = [];
        this.selectedPartials = new Set();
        this.clipboard = [];

        // Undo/Redo
        this.undoStack = [];
        this.redoStack = [];
        this.maxUndoSteps = 50;

        // View state
        this.viewStart = 0;
        this.viewEnd = 1;
        this.freqMin = 20;
        this.freqMax = 8000;
        this.zoomX = 1;
        this.zoomY = 1;
        this.panX = 0;
        this.panY = 0;

        // Tools
        this.currentTool = 'select';
        this.selectionRect = null;
        this.lassoPoints = [];
        this.brushSize = 50;

        // Drag edit state for pitch/time tools
        this.editDragStart = null;
        this.editDragStartFreqs = null;  // Original frequencies before drag
        this.editDragStartTimes = null;  // Original times before drag

        // Move tool state
        this.isMovingSelection = false;
        this.moveStartPos = null;

        // Drawing tool state
        this.penPoints = [];           // Points for freehand pen drawing
        this.lineStart = null;         // Start point for line tool
        this.lineEnd = null;           // End point for line tool
        this.penStrength = -20;        // Pen amplitude in dB
        this.lineStartStrength = -20;  // Line start amplitude in dB
        this.lineEndStrength = -30;    // Line end amplitude in dB
        this.lineHarmonics = 0;        // Number of harmonics to add
        this.harmonicRolloff = 6;      // dB per octave rolloff for harmonics

        // Preview audio state (for hearing partials while selecting/moving)
        this.previewOscillators = [];
        this.previewGainNode = null;
        this.previewEnabled = true;
        this.maxPreviewOscillators = 32;  // Limit for performance
        this.previewAutoStopTimeout = null;

        // Grid settings
        this.gridEnabled = false;
        this.gridSnapEnabled = false;
        this.gridTimeResolution = 0.1;      // seconds
        this.gridFreqResolution = 100;      // Hz (or semitones if gridFreqMode is 'semitones')
        this.gridFreqMode = 'hz';           // 'hz' or 'semitones'

        // Beat grid settings
        this.beatGridEnabled = false;
        this.quantBpm = 120;
        this.quantBeatDivision = 4;

        // Pitch grid settings
        this.pitchGridEnabled = false;
        this.quantRootNote = 9;  // A
        this.quantScale = 'major';

        // EQ Curve - array of {freq, gain} points (gain in dB)
        this.eqCurvePoints = [];
        this.eqCurveCanvas = null;
        this.eqCurveCtx = null;
        this.isDrawingEqCurve = false;

        // Playback rate
        this.playbackRate = 1.0;

        // Freeze frame mode
        this.freezeMode = false;
        this.currentFrame = 0;
        this.frameTime = 0;

        // Noise analysis
        this.noiseEnabled = false;
        this.noiseData = null;  // Residual noise data from analysis
        this.noiseSpectralEnvelope = null;  // For synthesized noise
        this.noiseFftSize = 2048;
        this.noiseHopSize = 512;
        this.noiseNumBands = 64;
        this.noiseMixLevel = 0.3;  // Default 30%

        // Rendered waveform preview
        this.renderedWaveform = null;

        // Master volume and metering
        this.masterVolume = 1.0;
        this.analyserNode = null;
        this.meterAnimationId = null;
        this.peakLevel = 0;
        this.peakHoldTime = 0;

        // Analysis settings
        this.fftSize = 2048;
        this.hopSize = 512;
        this.windowType = 'hann';
        this.minAmplitude = -60;
        this.maxPartials = 500;
        this.minDuration = 50;
        this.freqTolerance = 50;

        // Display settings
        this.freqScale = 'log';
        this.colorMode = 'amplitude';

        // Canvas contexts
        this.mainCtx = null;
        this.overlayCtx = null;
        this.interactionCtx = null;
        this.timelineCtx = null;
        this.waveformCtx = null;

        // Interaction state
        this.isDragging = false;
        this.isPanning = false;
        this.dragStart = null;
        this.lastMousePos = null;

        // Animation
        this.animationId = null;

        this.init();
    }

    init() {
        this.setupCanvases();
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.resizeCanvases();
        this.render();

        window.addEventListener('resize', () => this.resizeCanvases());
    }

    setupCanvases() {
        this.mainCanvas = document.getElementById('mainCanvas');
        this.overlayCanvas = document.getElementById('overlayCanvas');
        this.interactionCanvas = document.getElementById('interactionCanvas');
        this.timelineCanvas = document.getElementById('timelineCanvas');
        this.waveformCanvas = document.getElementById('waveformCanvas');

        this.mainCtx = this.mainCanvas.getContext('2d');
        this.overlayCtx = this.overlayCanvas.getContext('2d');
        this.interactionCtx = this.interactionCanvas.getContext('2d');
        this.timelineCtx = this.timelineCanvas.getContext('2d');
        this.waveformCtx = this.waveformCanvas.getContext('2d');
    }

    resizeCanvases() {
        const container = document.getElementById('canvasContainer');
        const rect = container.getBoundingClientRect();

        [this.mainCanvas, this.overlayCanvas, this.interactionCanvas].forEach(canvas => {
            canvas.width = rect.width;
            canvas.height = rect.height;
        });

        const timelineRect = this.timelineCanvas.parentElement.getBoundingClientRect();
        this.timelineCanvas.width = timelineRect.width;
        this.timelineCanvas.height = timelineRect.height;

        const waveformRect = this.waveformCanvas.parentElement.getBoundingClientRect();
        this.waveformCanvas.width = waveformRect.width;
        this.waveformCanvas.height = waveformRect.height;

        this.render();
    }

    setupEventListeners() {
        // File handling
        document.getElementById('newBtn').addEventListener('click', () => this.showModal('newCanvasModal'));
        document.getElementById('cancelNewCanvasBtn').addEventListener('click', () => this.hideModal('newCanvasModal'));
        document.getElementById('createNewCanvasBtn').addEventListener('click', () => this.createNewCanvas());
        document.getElementById('openBtn').addEventListener('click', () => this.showOpenModal());
        document.getElementById('browseBtn').addEventListener('click', () => document.getElementById('fileInput').click());
        document.getElementById('fileInput').addEventListener('change', (e) => this.handleFileSelect(e));
        document.getElementById('cancelOpenBtn').addEventListener('click', () => this.hideModal('openModal'));

        // Drop zone
        const dropZone = document.getElementById('dropZone');
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone.addEventListener('drop', (e) => this.handleFileDrop(e));

        // Export
        document.getElementById('exportBtn').addEventListener('click', () => this.showExportModal());
        document.getElementById('cancelExportBtn').addEventListener('click', () => this.hideModal('exportModal'));
        document.getElementById('doExportBtn').addEventListener('click', () => this.exportAudio());

        // Project save/load
        document.getElementById('saveProjectBtn').addEventListener('click', () => this.saveProject());
        document.getElementById('loadProjectBtn').addEventListener('click', () => this.loadProject());

        // Tools
        document.getElementById('selectTool').addEventListener('click', () => this.setTool('select'));
        document.getElementById('rectTool').addEventListener('click', () => this.setTool('rect'));
        document.getElementById('lassoTool').addEventListener('click', () => this.setTool('lasso'));
        document.getElementById('brushTool').addEventListener('click', () => this.setTool('brush'));
        document.getElementById('penTool').addEventListener('click', () => this.setTool('pen'));
        document.getElementById('lineTool').addEventListener('click', () => this.setTool('line'));

        // Drawing tool settings
        document.getElementById('penStrength').addEventListener('change', (e) => this.penStrength = parseFloat(e.target.value));
        document.getElementById('lineStartStrength').addEventListener('change', (e) => this.lineStartStrength = parseFloat(e.target.value));
        document.getElementById('lineEndStrength').addEventListener('change', (e) => this.lineEndStrength = parseFloat(e.target.value));
        document.getElementById('lineHarmonics').addEventListener('change', (e) => this.lineHarmonics = parseInt(e.target.value));
        document.getElementById('harmonicRolloff').addEventListener('change', (e) => this.harmonicRolloff = parseFloat(e.target.value));

        // Grid settings
        document.getElementById('gridEnabled').addEventListener('change', (e) => { this.gridEnabled = e.target.checked; this.render(); });
        document.getElementById('gridSnapEnabled').addEventListener('change', (e) => { this.gridSnapEnabled = e.target.checked; });
        document.getElementById('gridTimeResolution').addEventListener('change', (e) => { this.gridTimeResolution = parseFloat(e.target.value); this.render(); });
        document.getElementById('gridFreqMode').addEventListener('change', (e) => { this.gridFreqMode = e.target.value; this.render(); });
        document.getElementById('gridFreqResolution').addEventListener('change', (e) => { this.gridFreqResolution = parseFloat(e.target.value); this.render(); });
        document.getElementById('quantizeTimeBtn').addEventListener('click', () => this.quantizeTime());
        document.getElementById('quantizeFreqBtn').addEventListener('click', () => this.quantizeFreq());

        // Beat quantization
        document.getElementById('beatGridEnabled').addEventListener('change', (e) => { this.beatGridEnabled = e.target.checked; this.render(); });
        document.getElementById('quantBpm').addEventListener('change', (e) => { this.quantBpm = parseFloat(e.target.value) || 120; this.render(); });
        document.getElementById('quantBeatDivision').addEventListener('change', (e) => { this.quantBeatDivision = parseFloat(e.target.value) || 4; this.render(); });
        document.getElementById('quantizeToBpmBtn').addEventListener('click', () => this.quantizeToBpm());

        // Pitch quantization
        document.getElementById('pitchGridEnabled').addEventListener('change', (e) => { this.pitchGridEnabled = e.target.checked; this.render(); });
        document.getElementById('quantRootNote').addEventListener('change', (e) => { this.quantRootNote = parseInt(e.target.value); this.render(); });
        document.getElementById('quantScale').addEventListener('change', (e) => { this.quantScale = e.target.value; this.render(); });
        document.getElementById('quantizeToScaleBtn').addEventListener('click', () => this.quantizeToScale());

        // Harmonics
        document.getElementById('addHarmonicsBtn').addEventListener('click', () => this.addHarmonics());

        // Explode and Rotate
        document.getElementById('explodeSelectionBtn').addEventListener('click', () => this.explodeSelection());
        document.getElementById('rotateSelectionBtn').addEventListener('click', () => this.rotateSelection());

        // EQ Curve settings
        this.setupEqCurve();
        document.getElementById('eqApplyBtn').addEventListener('click', () => this.applyEqCurve());
        document.getElementById('eqFlattenBtn').addEventListener('click', () => this.flattenEqCurve());

        // Playback rate (time stretch without pitch change)
        document.getElementById('playbackRate').addEventListener('change', (e) => {
            this.playbackRate = parseFloat(e.target.value);
            // If playing, restart synthesis with new rate
            if (this.isPlaying) {
                this.playbackPosition = (this.audioContext.currentTime - this.startTime) * this.playbackRate;
                if (this.sourceNode) {
                    this.sourceNode.stop();
                }
                this.synthesizeAndPlay();
            }
        });

        // Master volume
        document.getElementById('masterVolume').addEventListener('input', (e) => {
            this.masterVolume = parseFloat(e.target.value) / 100;
            document.getElementById('masterVolumeDisplay').textContent = `${e.target.value}%`;
            if (this.gainNode) {
                this.gainNode.gain.value = this.masterVolume;
            }
        });

        // Freeze frame controls
        document.getElementById('freezeBtn').addEventListener('click', () => this.toggleFreezeMode());
        document.getElementById('stepBackBtn').addEventListener('click', () => this.stepFrame(-1));
        document.getElementById('stepFwdBtn').addEventListener('click', () => this.stepFrame(1));

        // Noise analysis
        document.getElementById('analyzeNoiseBtn').addEventListener('click', () => this.analyzeNoise());
        document.getElementById('noiseEnabled').addEventListener('change', (e) => {
            this.noiseEnabled = e.target.checked;
            this.updateRenderedWaveform();
        });
        document.getElementById('noiseMixLevel').addEventListener('input', (e) => {
            this.noiseMixLevel = parseInt(e.target.value) / 100;
            document.getElementById('noiseMixDisplay').textContent = `${e.target.value}%`;
            this.updateRenderedWaveform();
        });

        // Undo/Redo
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());
        document.getElementById('redoBtn').addEventListener('click', () => this.redo());

        // Edit operations - pitch and time are now drag tools
        document.getElementById('pitchShiftBtn').addEventListener('click', () => this.setTool('pitch'));
        document.getElementById('timeStretchBtn').addEventListener('click', () => this.setTool('time'));
        document.getElementById('deleteBtn').addEventListener('click', () => this.deleteSelected());
        document.getElementById('invertSelBtn').addEventListener('click', () => this.invertSelection());
        document.getElementById('perpendicularBtn').addEventListener('click', () => this.perpendicularSelection());
        document.getElementById('reverseSelBtn').addEventListener('click', () => this.reverseSelection());
        document.getElementById('analyzeBtn').addEventListener('click', () => this.reanalyze());
        document.getElementById('previewAudioBtn').addEventListener('click', () => this.togglePreviewAudio());

        // Pitch modal
        document.getElementById('cancelPitchBtn').addEventListener('click', () => this.hideModal('pitchModal'));
        document.getElementById('applyPitchBtn').addEventListener('click', () => this.applyPitchShift());
        document.getElementById('pitchSemitones').addEventListener('input', () => this.updatePitchRatio());
        document.getElementById('pitchCents').addEventListener('input', () => this.updatePitchRatio());

        // Time modal
        document.getElementById('cancelTimeBtn').addEventListener('click', () => this.hideModal('timeModal'));
        document.getElementById('applyTimeBtn').addEventListener('click', () => this.applyTimeStretch());

        // Transport
        document.getElementById('playBtn').addEventListener('click', () => this.togglePlayback());
        document.getElementById('stopBtn').addEventListener('click', () => this.stop());
        document.getElementById('loopBtn').addEventListener('click', () => this.toggleLoop());
        document.getElementById('playbackPosition').addEventListener('input', (e) => this.seekTo(e.target.value / 100));

        // Help
        document.getElementById('helpBtn').addEventListener('click', () => this.showModal('helpModal'));
        document.getElementById('closeHelpBtn').addEventListener('click', () => this.hideModal('helpModal'));

        // Zoom controls
        document.getElementById('zoomInX').addEventListener('click', () => this.zoomTime(1.5));
        document.getElementById('zoomOutX').addEventListener('click', () => this.zoomTime(1/1.5));
        document.getElementById('zoomInY').addEventListener('click', () => this.zoomFreq(1.5));
        document.getElementById('zoomOutY').addEventListener('click', () => this.zoomFreq(1/1.5));
        document.getElementById('zoomFit').addEventListener('click', () => this.fitView());

        // Settings
        document.getElementById('fftSize').addEventListener('change', (e) => this.fftSize = parseInt(e.target.value));
        document.getElementById('hopSize').addEventListener('change', (e) => this.hopSize = parseInt(e.target.value));
        document.getElementById('windowType').addEventListener('change', (e) => this.windowType = e.target.value);
        document.getElementById('minAmplitude').addEventListener('change', (e) => this.minAmplitude = parseFloat(e.target.value));
        document.getElementById('maxPartials').addEventListener('change', (e) => this.maxPartials = parseInt(e.target.value));
        document.getElementById('minDuration').addEventListener('change', (e) => this.minDuration = parseFloat(e.target.value));
        document.getElementById('freqTolerance').addEventListener('change', (e) => this.freqTolerance = parseFloat(e.target.value));
        document.getElementById('freqMin').addEventListener('change', (e) => { this.freqMin = parseFloat(e.target.value); this.render(); });
        document.getElementById('freqMax').addEventListener('change', (e) => { this.freqMax = parseFloat(e.target.value); this.render(); });
        document.getElementById('freqScale').addEventListener('change', (e) => { this.freqScale = e.target.value; this.render(); });
        document.getElementById('colorMode').addEventListener('change', (e) => { this.colorMode = e.target.value; this.render(); });

        // Canvas interaction
        this.interactionCanvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.interactionCanvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.interactionCanvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.interactionCanvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e));
        this.interactionCanvas.addEventListener('wheel', (e) => this.handleWheel(e));
        this.interactionCanvas.addEventListener('contextmenu', (e) => this.showContextMenu(e));

        // Timeline interaction
        this.timelineCanvas.addEventListener('click', (e) => this.handleTimelineClick(e));

        // Waveform interaction
        this.waveformCanvas.addEventListener('click', (e) => this.handleWaveformClick(e));

        // Context menu
        document.addEventListener('click', () => this.hideContextMenu());
        document.getElementById('ctxSelectAll').addEventListener('click', () => this.selectAll());
        document.getElementById('ctxDeselect').addEventListener('click', () => this.deselectAll());
        document.getElementById('ctxCopy').addEventListener('click', () => this.copySelected());
        document.getElementById('ctxPaste').addEventListener('click', () => this.pastePartials());
        document.getElementById('ctxDelete').addEventListener('click', () => this.deleteSelected());
        document.getElementById('ctxPitchShift').addEventListener('click', () => this.showPitchModal());
        document.getElementById('ctxTimeStretch').addEventListener('click', () => this.showTimeModal());
        document.getElementById('ctxPlaySelection').addEventListener('click', () => this.playSelection());

        // Advanced Selection
        document.getElementById('selectByCriteriaBtn').addEventListener('click', () => this.showModal('selectByCriteriaModal'));
        document.getElementById('cancelSelectCriteriaBtn').addEventListener('click', () => this.hideModal('selectByCriteriaModal'));
        document.getElementById('applySelectCriteriaBtn').addEventListener('click', () => this.selectByCriteria());
        document.getElementById('growSelectionBtn').addEventListener('click', () => this.showModal('growShrinkModal'));
        document.getElementById('cancelGrowShrinkBtn').addEventListener('click', () => this.hideModal('growShrinkModal'));
        document.getElementById('applyGrowShrinkBtn').addEventListener('click', () => this.growShrinkSelection());
        document.getElementById('selectSimilarBtn').addEventListener('click', () => this.selectSimilar());
        document.getElementById('invertSelectionBtn').addEventListener('click', () => this.invertSelectionSet());

        // Effects
        document.getElementById('vibratoTremoloBtn').addEventListener('click', () => this.showModal('vibratoTremoloModal'));
        document.getElementById('cancelVibratoTremoloBtn').addEventListener('click', () => this.hideModal('vibratoTremoloModal'));
        document.getElementById('applyVibratoTremoloBtn').addEventListener('click', () => this.applyVibratoTremolo());
        document.getElementById('chorusBtn').addEventListener('click', () => this.showModal('chorusModal'));
        document.getElementById('cancelChorusBtn').addEventListener('click', () => this.hideModal('chorusModal'));
        document.getElementById('applyChorusBtn').addEventListener('click', () => this.applyChorus());
        document.getElementById('spectralFreezeBtn').addEventListener('click', () => this.showModal('spectralFreezeModal'));
        document.getElementById('cancelSpectralFreezeBtn').addEventListener('click', () => this.hideModal('spectralFreezeModal'));
        document.getElementById('applySpectralFreezeBtn').addEventListener('click', () => this.applySpectralFreeze());
        document.getElementById('spectralFreezeMode').addEventListener('change', (e) => {
            document.getElementById('smearAmountRow').style.display = e.target.value === 'smear' ? 'flex' : 'none';
        });
        document.getElementById('spectralSmearAmount').addEventListener('input', (e) => {
            document.getElementById('smearAmountDisplay').textContent = `${e.target.value}%`;
        });
        document.getElementById('mergePartialsBtn').addEventListener('click', () => this.mergePartials());
        document.getElementById('splitPartialsBtn').addEventListener('click', () => this.splitPartials());

        // Additional effects
        document.getElementById('ampEnvelopeBtn').addEventListener('click', () => this.showAmpEnvelopeModal());
        document.getElementById('cancelAmpEnvelopeBtn').addEventListener('click', () => this.hideModal('ampEnvelopeModal'));
        document.getElementById('applyAmpEnvelopeBtn').addEventListener('click', () => this.applyAmpEnvelope());
        document.getElementById('ampEnvelopePreset').addEventListener('change', (e) => this.setAmpEnvelopePreset(e.target.value));

        document.getElementById('spectralDelayBtn').addEventListener('click', () => this.showModal('spectralDelayModal'));
        document.getElementById('cancelSpectralDelayBtn').addEventListener('click', () => this.hideModal('spectralDelayModal'));
        document.getElementById('applySpectralDelayBtn').addEventListener('click', () => this.applySpectralDelay());

        document.getElementById('spectralReverbBtn').addEventListener('click', () => this.showModal('spectralReverbModal'));
        document.getElementById('cancelSpectralReverbBtn').addEventListener('click', () => this.hideModal('spectralReverbModal'));
        document.getElementById('applySpectralReverbBtn').addEventListener('click', () => this.applySpectralReverb());
        document.getElementById('reverbDiffusion').addEventListener('input', (e) => {
            document.getElementById('reverbDiffusionDisplay').textContent = `${e.target.value}%`;
        });
        document.getElementById('reverbMix').addEventListener('input', (e) => {
            document.getElementById('reverbMixDisplay').textContent = `${e.target.value}%`;
        });

        document.getElementById('formantShiftBtn').addEventListener('click', () => this.showModal('formantShiftModal'));
        document.getElementById('cancelFormantShiftBtn').addEventListener('click', () => this.hideModal('formantShiftModal'));
        document.getElementById('applyFormantShiftBtn').addEventListener('click', () => this.applyFormantShift());
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ignore if typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

            const ctrl = e.ctrlKey || e.metaKey;

            switch(e.key.toLowerCase()) {
                case ' ':
                    e.preventDefault();
                    this.togglePlayback();
                    break;
                case 'o':
                    if (ctrl) { e.preventDefault(); this.showOpenModal(); }
                    break;
                case 'e':
                    if (ctrl) { e.preventDefault(); this.showExportModal(); }
                    break;
                case 'z':
                    if (ctrl) { e.preventDefault(); this.undo(); }
                    break;
                case 'y':
                    if (ctrl) { e.preventDefault(); this.redo(); }
                    break;
                case 'a':
                    if (ctrl) { e.preventDefault(); this.selectAll(); }
                    break;
                case 'c':
                    if (ctrl) { e.preventDefault(); this.copySelected(); }
                    break;
                case 'v':
                    if (ctrl) { e.preventDefault(); this.pastePartials(); }
                    else this.setTool('select');
                    break;
                case 'r':
                    this.setTool('rect');
                    break;
                case 'l':
                    if (ctrl) { e.preventDefault(); this.toggleLoop(); }
                    else this.setTool('lasso');
                    break;
                case 'b':
                    this.setTool('brush');
                    break;
                case 'p':
                    this.setTool('pen');
                    break;
                case 'n':
                    if (ctrl) { e.preventDefault(); this.showModal('newCanvasModal'); }
                    else this.setTool('line');
                    break;
                case 's':
                    this.toggleScrub();
                    break;
                case 'delete':
                case 'backspace':
                    e.preventDefault();
                    this.deleteSelected();
                    break;
                case 'escape':
                    this.deselectAll();
                    this.hideAllModals();
                    break;
                case 'i':
                    this.invertSelection();
                    break;
                case '=':
                case '+':
                    this.zoomTime(1.2);
                    break;
                case '-':
                    this.zoomTime(1/1.2);
                    break;
                case 'm':
                    // Toggle preview audio monitoring
                    this.togglePreviewAudio();
                    break;
                case 'g':
                    // Toggle grid display
                    this.gridEnabled = !this.gridEnabled;
                    document.getElementById('gridEnabled').checked = this.gridEnabled;
                    this.render();
                    this.notify(this.gridEnabled ? 'Grid enabled' : 'Grid disabled');
                    break;
                case 'q':
                    // Quantize selection (both time and freq)
                    this.quantizeTime();
                    this.quantizeFreq();
                    break;
                case 'arrowleft':
                    if (this.freezeMode) {
                        e.preventDefault();
                        this.stepFrame(-1);
                    }
                    break;
                case 'arrowright':
                    if (this.freezeMode) {
                        e.preventDefault();
                        this.stepFrame(1);
                    }
                    break;
                case 'f':
                    // Toggle freeze mode
                    this.toggleFreezeMode();
                    break;
            }
        });
    }

    // File handling
    showOpenModal() {
        this.showModal('openModal');
    }

    handleFileDrop(e) {
        e.preventDefault();
        document.getElementById('dropZone').classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) this.loadAudioFile(file);
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) this.loadAudioFile(file);
    }

    createNewCanvas() {
        const duration = parseFloat(document.getElementById('newCanvasDuration').value) || 10;
        const sampleRate = parseInt(document.getElementById('newCanvasSampleRate').value) || 44100;

        this.hideModal('newCanvasModal');

        // Initialize audio context if needed
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        // Create a silent audio buffer
        const numSamples = Math.floor(duration * sampleRate);
        this.audioBuffer = this.audioContext.createBuffer(1, numSamples, sampleRate);
        // Buffer is already initialized with zeros (silence)

        this.fileName = 'Untitled';
        this.duration = duration;
        this.sampleRate = sampleRate;

        // Update UI
        document.getElementById('durationDisplay').textContent = this.formatTime(this.duration);
        document.getElementById('sampleRateDisplay').textContent = `${this.sampleRate} Hz`;

        // Enable buttons
        document.getElementById('exportBtn').disabled = false;
        document.getElementById('saveProjectBtn').disabled = false;
        document.getElementById('analyzeBtn').disabled = false;

        // Reset view
        this.viewStart = 0;
        this.viewEnd = this.duration;
        this.playbackPosition = 0;

        // Clear existing data
        this.partials = [];
        this.selectedPartials.clear();
        this.undoStack = [];
        this.redoStack = [];

        // Clear noise data
        this.noiseEnvelope = null;
        this.noiseEnabled = false;
        document.getElementById('noiseEnabled').checked = false;
        document.getElementById('noiseLevel').textContent = '-';

        // Render blank waveform
        this.renderWaveform();

        // Update displays
        document.getElementById('partialsDisplay').textContent = '0';
        this.updateSelectionInfo();
        this.render();
        this.updateRenderedWaveform();

        this.setStatus(`New canvas: ${duration}s @ ${sampleRate}Hz`);
        this.notify(`Created blank canvas: ${duration} seconds`);
    }

    async loadAudioFile(file) {
        this.hideModal('openModal');
        this.setStatus(`Loading ${file.name}...`);

        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            const arrayBuffer = await file.arrayBuffer();
            this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

            this.fileName = file.name;
            this.duration = this.audioBuffer.duration;
            this.sampleRate = this.audioBuffer.sampleRate;

            // Update UI
            document.getElementById('durationDisplay').textContent = this.formatTime(this.duration);
            document.getElementById('sampleRateDisplay').textContent = `${this.sampleRate} Hz`;

            // Enable buttons
            document.getElementById('exportBtn').disabled = false;
            document.getElementById('saveProjectBtn').disabled = false;
            document.getElementById('analyzeBtn').disabled = false;

            // Reset view
            this.viewStart = 0;
            this.viewEnd = this.duration;
            this.playbackPosition = 0;

            // Clear existing data
            this.partials = [];
            this.selectedPartials.clear();
            this.undoStack = [];
            this.redoStack = [];

            // Render waveform
            this.renderWaveform();

            // Start analysis
            await this.analyzeAudio();

            // Update rendered waveform preview
            this.updateRenderedWaveform();

            this.setStatus(`Loaded: ${file.name}`);
            this.notify(`Loaded ${file.name} - ${this.partials.length} partials detected`);

        } catch (error) {
            console.error('Error loading audio:', error);
            this.setStatus('Error loading audio file');
            this.notify('Failed to load audio file', 'error');
        }
    }

    // Audio Analysis
    async analyzeAudio() {
        if (!this.audioBuffer) return;

        this.showModal('analysisModal');
        this.setAnalysisProgress(0, 'Starting analysis...');

        // Get audio data (mono mix)
        const channelData = this.audioBuffer.getChannelData(0);
        const numChannels = this.audioBuffer.numberOfChannels;
        let audioData;

        if (numChannels > 1) {
            audioData = new Float32Array(channelData.length);
            for (let i = 0; i < channelData.length; i++) {
                let sum = channelData[i];
                for (let ch = 1; ch < numChannels; ch++) {
                    sum += this.audioBuffer.getChannelData(ch)[i];
                }
                audioData[i] = sum / numChannels;
            }
        } else {
            audioData = channelData;
        }

        // Create window function
        const window = this.createWindow(this.fftSize, this.windowType);

        // Analyze
        const frames = [];
        const numFrames = Math.floor((audioData.length - this.fftSize) / this.hopSize) + 1;

        for (let frame = 0; frame < numFrames; frame++) {
            const startSample = frame * this.hopSize;
            const frameData = new Float32Array(this.fftSize);

            // Apply window
            for (let i = 0; i < this.fftSize; i++) {
                frameData[i] = (audioData[startSample + i] || 0) * window[i];
            }

            // Perform FFT
            const spectrum = this.fft(frameData);
            const peaks = this.findPeaks(spectrum, this.sampleRate);

            frames.push({
                time: startSample / this.sampleRate,
                peaks: peaks
            });

            if (frame % 100 === 0) {
                const progress = (frame / numFrames) * 50;
                this.setAnalysisProgress(progress, `Analyzing frame ${frame}/${numFrames}...`);
                await this.sleep(0);
            }
        }

        this.setAnalysisProgress(50, 'Tracking partials...');
        await this.sleep(0);

        // Track partials across frames
        this.partials = await this.trackPartials(frames);

        this.setAnalysisProgress(90, 'Finalizing...');
        await this.sleep(0);

        // Filter short partials
        const minSamples = (this.minDuration / 1000) * this.sampleRate / this.hopSize;
        this.partials = this.partials.filter(p => p.points.length >= minSamples);

        // Limit number of partials
        if (this.partials.length > this.maxPartials) {
            this.partials.sort((a, b) => {
                const avgAmpA = a.points.reduce((s, p) => s + p.amplitude, 0) / a.points.length;
                const avgAmpB = b.points.reduce((s, p) => s + p.amplitude, 0) / b.points.length;
                return avgAmpB - avgAmpA;
            });
            this.partials = this.partials.slice(0, this.maxPartials);
        }

        // Assign IDs
        this.partials.forEach((p, i) => p.id = i);

        document.getElementById('partialsDisplay').textContent = this.partials.length;

        this.setAnalysisProgress(100, 'Complete!');
        await this.sleep(500);

        this.hideModal('analysisModal');
        this.render();
    }

    createWindow(size, type) {
        const window = new Float32Array(size);
        for (let i = 0; i < size; i++) {
            const x = i / (size - 1);
            switch (type) {
                case 'hann':
                    window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * x));
                    break;
                case 'hamming':
                    window[i] = 0.54 - 0.46 * Math.cos(2 * Math.PI * x);
                    break;
                case 'blackman':
                    window[i] = 0.42 - 0.5 * Math.cos(2 * Math.PI * x) + 0.08 * Math.cos(4 * Math.PI * x);
                    break;
            }
        }
        return window;
    }

    fft(data) {
        const n = data.length;
        const real = new Float32Array(n);
        const imag = new Float32Array(n);

        // Copy input data
        for (let i = 0; i < n; i++) {
            real[i] = data[i];
        }

        // Bit reversal
        let j = 0;
        for (let i = 0; i < n - 1; i++) {
            if (i < j) {
                [real[i], real[j]] = [real[j], real[i]];
                [imag[i], imag[j]] = [imag[j], imag[i]];
            }
            let k = n >> 1;
            while (k <= j) {
                j -= k;
                k >>= 1;
            }
            j += k;
        }

        // FFT computation
        for (let len = 2; len <= n; len *= 2) {
            const halfLen = len / 2;
            const angle = -2 * Math.PI / len;
            const wReal = Math.cos(angle);
            const wImag = Math.sin(angle);

            for (let i = 0; i < n; i += len) {
                let curReal = 1;
                let curImag = 0;

                for (let j = 0; j < halfLen; j++) {
                    const idx1 = i + j;
                    const idx2 = i + j + halfLen;

                    const tReal = curReal * real[idx2] - curImag * imag[idx2];
                    const tImag = curReal * imag[idx2] + curImag * real[idx2];

                    real[idx2] = real[idx1] - tReal;
                    imag[idx2] = imag[idx1] - tImag;
                    real[idx1] += tReal;
                    imag[idx1] += tImag;

                    const newReal = curReal * wReal - curImag * wImag;
                    curImag = curReal * wImag + curImag * wReal;
                    curReal = newReal;
                }
            }
        }

        // Calculate magnitudes
        const magnitudes = new Float32Array(n / 2);
        for (let i = 0; i < n / 2; i++) {
            magnitudes[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]) / n;
        }

        return magnitudes;
    }

    findPeaks(spectrum, sampleRate) {
        const peaks = [];
        const binWidth = sampleRate / (spectrum.length * 2);
        const minAmpLinear = Math.pow(10, this.minAmplitude / 20);

        for (let i = 2; i < spectrum.length - 2; i++) {
            const mag = spectrum[i];

            if (mag > minAmpLinear &&
                mag > spectrum[i - 1] &&
                mag > spectrum[i + 1] &&
                mag > spectrum[i - 2] &&
                mag > spectrum[i + 2]) {

                // Parabolic interpolation for better frequency estimation
                // Using magnitude values directly (not log) for more stable interpolation
                const alpha = spectrum[i - 1];
                const beta = mag;
                const gamma = spectrum[i + 1];
                const denom = alpha - 2 * beta + gamma;

                // Only interpolate if denominator is stable (negative for a true peak)
                let p = 0;
                if (denom < -1e-10) {
                    p = 0.5 * (alpha - gamma) / denom;
                    // Clamp to valid range
                    p = Math.max(-0.5, Math.min(0.5, p));
                }

                const freq = (i + p) * binWidth;

                // Interpolate amplitude at the refined peak position
                const refinedMag = beta - 0.25 * (alpha - gamma) * p;
                const amplitude = 20 * Math.log10(Math.max(refinedMag, 1e-10));

                if (freq >= this.freqMin && freq <= this.freqMax) {
                    peaks.push({ freq, amplitude });
                }
            }
        }

        // Sort by amplitude and limit
        peaks.sort((a, b) => b.amplitude - a.amplitude);
        return peaks.slice(0, 100);
    }

    async trackPartials(frames) {
        const partials = [];
        const activePartials = [];
        const tolerance = this.freqTolerance;

        for (let frameIdx = 0; frameIdx < frames.length; frameIdx++) {
            const frame = frames[frameIdx];
            const usedPeaks = new Set();

            // Build a cost matrix and use greedy assignment
            // This helps prevent "frequency crossing" issues
            const assignments = [];

            for (let i = 0; i < activePartials.length; i++) {
                const partial = activePartials[i];
                const lastPoint = partial.points[partial.points.length - 1];

                // Predict next frequency based on trajectory
                let predictedFreq = lastPoint.freq;
                if (partial.points.length >= 2) {
                    const prevPoint = partial.points[partial.points.length - 2];
                    const freqVelocity = lastPoint.freq - prevPoint.freq;
                    // Use a damped prediction (don't overshoot)
                    predictedFreq = lastPoint.freq + freqVelocity * 0.5;
                }

                for (let j = 0; j < frame.peaks.length; j++) {
                    const peak = frame.peaks[j];

                    // Calculate cost based on both absolute distance and predicted position
                    const directDist = Math.abs(peak.freq - lastPoint.freq);
                    const predictedDist = Math.abs(peak.freq - predictedFreq);

                    // Weight: direct distance matters more, but prediction helps with vibrato
                    const cost = directDist * 0.7 + predictedDist * 0.3;

                    if (cost < tolerance) {
                        assignments.push({
                            partialIdx: i,
                            peakIdx: j,
                            cost: cost
                        });
                    }
                }
            }

            // Sort by cost and greedily assign
            assignments.sort((a, b) => a.cost - b.cost);
            const usedPartials = new Set();

            for (const assignment of assignments) {
                if (usedPartials.has(assignment.partialIdx) || usedPeaks.has(assignment.peakIdx)) {
                    continue;
                }

                const partial = activePartials[assignment.partialIdx];
                const peak = frame.peaks[assignment.peakIdx];

                partial.points.push({
                    time: frame.time,
                    freq: peak.freq,
                    amplitude: peak.amplitude
                });

                usedPartials.add(assignment.partialIdx);
                usedPeaks.add(assignment.peakIdx);
            }

            // End unassigned partials
            for (let i = activePartials.length - 1; i >= 0; i--) {
                if (!usedPartials.has(i)) {
                    const partial = activePartials[i];
                    if (partial.points.length > 1) {
                        partials.push(partial);
                    }
                    activePartials.splice(i, 1);
                }
            }

            // Start new partials from unused peaks
            for (let j = 0; j < frame.peaks.length; j++) {
                if (usedPeaks.has(j)) continue;
                const peak = frame.peaks[j];

                activePartials.push({
                    id: partials.length + activePartials.length,
                    points: [{
                        time: frame.time,
                        freq: peak.freq,
                        amplitude: peak.amplitude
                    }]
                });
            }

            if (frameIdx % 200 === 0) {
                const progress = 50 + (frameIdx / frames.length) * 40;
                this.setAnalysisProgress(progress, `Tracking partials... ${activePartials.length} active`);
                await this.sleep(0);
            }
        }

        // Add remaining active partials
        for (const partial of activePartials) {
            if (partial.points.length > 1) {
                partials.push(partial);
            }
        }

        return partials;
    }

    async reanalyze() {
        if (!this.audioBuffer) return;

        this.saveState();
        await this.analyzeAudio();
    }

    // Rendering
    render() {
        this.renderPartials();
        this.renderOverlay();
        this.renderTimeline();
    }

    renderPartials() {
        const ctx = this.mainCtx;
        const width = this.mainCanvas.width;
        const height = this.mainCanvas.height;

        // Clear
        ctx.fillStyle = '#0a0a14';
        ctx.fillRect(0, 0, width, height);

        // Draw grid
        this.drawGrid(ctx, width, height);

        if (!this.partials.length) return;

        // Draw partials
        for (const partial of this.partials) {
            const isSelected = this.selectedPartials.has(partial.id);
            this.drawPartial(ctx, partial, width, height, isSelected);
        }
    }

    drawGrid(ctx, width, height) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;

        // Time grid (background reference)
        const timeRange = this.viewEnd - this.viewStart;
        const timeStep = this.calculateGridStep(timeRange);

        for (let t = Math.ceil(this.viewStart / timeStep) * timeStep; t <= this.viewEnd; t += timeStep) {
            const x = this.timeToX(t, width);
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        // Frequency grid (background reference)
        const freqSteps = this.freqScale === 'log' ?
            [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000] :
            this.generateLinearSteps(this.freqMin, this.freqMax, 10);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '10px monospace';

        for (const f of freqSteps) {
            if (f < this.freqMin || f > this.freqMax) continue;
            const y = this.freqToY(f, height);

            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();

            ctx.fillText(`${f >= 1000 ? (f/1000) + 'k' : f} Hz`, 5, y - 3);
        }

        // User-defined snap grid (when enabled)
        if (this.gridEnabled) {
            ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)';
            ctx.lineWidth = 1;

            // Time snap grid
            for (let t = Math.ceil(this.viewStart / this.gridTimeResolution) * this.gridTimeResolution; t <= this.viewEnd; t += this.gridTimeResolution) {
                const x = this.timeToX(t, width);
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }

            // Frequency snap grid
            if (this.gridFreqMode === 'semitones') {
                // Draw semitone grid lines
                const semitonesPerLine = this.gridFreqResolution / 50;  // Map resolution to semitones
                const refFreq = 440;  // A4

                // Find starting semitone below freqMin
                const startSemitone = Math.floor(12 * Math.log2(this.freqMin / refFreq));
                const endSemitone = Math.ceil(12 * Math.log2(this.freqMax / refFreq));

                for (let st = startSemitone; st <= endSemitone; st += semitonesPerLine) {
                    const f = refFreq * Math.pow(2, st / 12);
                    if (f < this.freqMin || f > this.freqMax) continue;
                    const y = this.freqToY(f, height);
                    ctx.beginPath();
                    ctx.moveTo(0, y);
                    ctx.lineTo(width, y);
                    ctx.stroke();
                }
            } else {
                // Draw Hz grid lines
                for (let f = Math.ceil(this.freqMin / this.gridFreqResolution) * this.gridFreqResolution; f <= this.freqMax; f += this.gridFreqResolution) {
                    const y = this.freqToY(f, height);
                    ctx.beginPath();
                    ctx.moveTo(0, y);
                    ctx.lineTo(width, y);
                    ctx.stroke();
                }
            }
        }

        // Beat grid (BPM-based)
        if (this.beatGridEnabled && this.duration > 0) {
            const beatDuration = 60 / this.quantBpm;
            let gridResolution;
            if (this.quantBeatDivision === 3) {
                gridResolution = beatDuration / 3;
            } else if (this.quantBeatDivision === 6) {
                gridResolution = beatDuration / 6;
            } else {
                gridResolution = (beatDuration * 4) / this.quantBeatDivision;
            }

            ctx.strokeStyle = 'rgba(250, 204, 21, 0.4)';  // Yellow for beat grid
            ctx.lineWidth = 1;

            const startTime = this.viewStart * this.duration;
            const endTime = this.viewEnd * this.duration;

            // Draw beat lines
            for (let t = Math.ceil(startTime / gridResolution) * gridResolution; t <= endTime; t += gridResolution) {
                const x = this.timeToX(t, width);
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }

            // Draw stronger lines on downbeats (every 4 subdivisions for most divisions)
            ctx.strokeStyle = 'rgba(250, 204, 21, 0.7)';
            ctx.lineWidth = 2;
            for (let t = 0; t <= endTime; t += beatDuration) {
                if (t < startTime) continue;
                const x = this.timeToX(t, width);
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }
        }

        // Pitch grid (scale-based)
        if (this.pitchGridEnabled) {
            const scaleIntervals = this.getScaleIntervals(this.quantScale);
            const A4 = 440;
            const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

            ctx.strokeStyle = 'rgba(74, 222, 128, 0.4)';  // Green for pitch grid
            ctx.lineWidth = 1;
            ctx.fillStyle = 'rgba(74, 222, 128, 0.8)';
            ctx.font = '9px monospace';

            // Find the range of octaves to cover
            const minMidi = 69 + 12 * Math.log2(this.freqMin / A4);
            const maxMidi = 69 + 12 * Math.log2(this.freqMax / A4);
            const minOctave = Math.floor((minMidi - 12) / 12);
            const maxOctave = Math.ceil((maxMidi + 12) / 12);

            for (let octave = minOctave; octave <= maxOctave; octave++) {
                for (const interval of scaleIntervals) {
                    const semitone = this.quantRootNote + interval;
                    const midiNote = 12 + octave * 12 + semitone;
                    const freq = A4 * Math.pow(2, (midiNote - 69) / 12);

                    if (freq < this.freqMin || freq > this.freqMax) continue;

                    const y = this.freqToY(freq, height);

                    // Draw stronger line for root notes
                    if (interval === 0) {
                        ctx.strokeStyle = 'rgba(74, 222, 128, 0.7)';
                        ctx.lineWidth = 2;
                    } else {
                        ctx.strokeStyle = 'rgba(74, 222, 128, 0.3)';
                        ctx.lineWidth = 1;
                    }

                    ctx.beginPath();
                    ctx.moveTo(0, y);
                    ctx.lineTo(width, y);
                    ctx.stroke();

                    // Label root notes
                    if (interval === 0) {
                        const noteName = noteNames[semitone % 12];
                        const octaveNum = Math.floor(midiNote / 12) - 1;
                        ctx.fillText(`${noteName}${octaveNum}`, width - 30, y - 2);
                    }
                }
            }
        }
    }

    drawPartial(ctx, partial, width, height, isSelected) {
        if (partial.points.length < 2) return;

        ctx.beginPath();
        ctx.lineWidth = isSelected ? 3 : 1.5;

        for (let i = 0; i < partial.points.length; i++) {
            const point = partial.points[i];
            const x = this.timeToX(point.time, width);
            const y = this.freqToY(point.freq, height);

            if (x < -10 || x > width + 10) continue;

            // Set color based on mode
            if (i === 0) {
                if (isSelected) {
                    ctx.strokeStyle = '#ff6b6b';
                } else if (this.colorMode === 'amplitude') {
                    const amp = Math.max(0, Math.min(1, (point.amplitude + 60) / 60));
                    ctx.strokeStyle = this.amplitudeToColor(amp);
                } else if (this.colorMode === 'frequency') {
                    ctx.strokeStyle = this.frequencyToColor(point.freq);
                } else {
                    ctx.strokeStyle = '#00ff88';
                }
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.stroke();

        // Draw points for selected partials
        if (isSelected) {
            ctx.fillStyle = '#ff6b6b';
            for (const point of partial.points) {
                const x = this.timeToX(point.time, width);
                const y = this.freqToY(point.freq, height);
                if (x >= 0 && x <= width) {
                    ctx.beginPath();
                    ctx.arc(x, y, 3, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }

    amplitudeToColor(amp) {
        // Energy gradient: blue (low) -> cyan -> green -> yellow -> red (high)
        // amp is 0-1 where 1 is loudest
        const hue = (1 - amp) * 240; // 240 (blue) to 0 (red)
        const saturation = 100;
        const lightness = 45 + amp * 15; // brighter for higher energy
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }

    frequencyToColor(freq) {
        // Frequency gradient: low freq = red, high freq = violet
        const logFreq = Math.log2(freq / 20) / Math.log2(20000 / 20);
        const hue = (1 - logFreq) * 270; // red to violet
        return `hsl(${hue}, 100%, 50%)`;
    }

    renderOverlay() {
        const ctx = this.overlayCtx;
        const width = this.overlayCanvas.width;
        const height = this.overlayCanvas.height;

        ctx.clearRect(0, 0, width, height);

        // Draw playhead
        if (this.audioBuffer) {
            const x = this.timeToX(this.playbackPosition, width);
            ctx.strokeStyle = '#e94560';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        // Draw selection rectangle
        if (this.selectionRect && this.currentTool === 'rect') {
            ctx.strokeStyle = '#e94560';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.fillStyle = 'rgba(233, 69, 96, 0.2)';
            ctx.fillRect(
                this.selectionRect.x,
                this.selectionRect.y,
                this.selectionRect.width,
                this.selectionRect.height
            );
            ctx.strokeRect(
                this.selectionRect.x,
                this.selectionRect.y,
                this.selectionRect.width,
                this.selectionRect.height
            );
            ctx.setLineDash([]);
        }

        // Draw lasso
        if (this.lassoPoints.length > 1 && this.currentTool === 'lasso') {
            ctx.strokeStyle = '#e94560';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.lassoPoints[0].x, this.lassoPoints[0].y);
            for (let i = 1; i < this.lassoPoints.length; i++) {
                ctx.lineTo(this.lassoPoints[i].x, this.lassoPoints[i].y);
            }
            ctx.closePath();
            ctx.fillStyle = 'rgba(233, 69, 96, 0.2)';
            ctx.fill();
            ctx.stroke();
        }

        // Draw brush cursor
        if (this.currentTool === 'brush' && this.lastMousePos) {
            ctx.strokeStyle = '#e94560';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(this.lastMousePos.x, this.lastMousePos.y, this.brushSize, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Draw pen path preview
        if (this.penPoints.length > 1 && this.currentTool === 'pen') {
            ctx.strokeStyle = '#00ff88';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.penPoints[0].x, this.penPoints[0].y);
            for (let i = 1; i < this.penPoints.length; i++) {
                ctx.lineTo(this.penPoints[i].x, this.penPoints[i].y);
            }
            ctx.stroke();

            // Draw start/end markers
            ctx.fillStyle = '#00ff88';
            ctx.beginPath();
            ctx.arc(this.penPoints[0].x, this.penPoints[0].y, 4, 0, Math.PI * 2);
            ctx.fill();
            const lastPoint = this.penPoints[this.penPoints.length - 1];
            ctx.beginPath();
            ctx.arc(lastPoint.x, lastPoint.y, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw line preview with harmonics
        if (this.lineStart && this.lineEnd && this.currentTool === 'line') {
            const startFreq = this.yToFreq(this.lineStart.y, height);
            const endFreq = this.yToFreq(this.lineEnd.y, height);

            // Draw fundamental line
            ctx.strokeStyle = '#00d4ff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.lineStart.x, this.lineStart.y);
            ctx.lineTo(this.lineEnd.x, this.lineEnd.y);
            ctx.stroke();

            // Draw endpoint markers
            ctx.fillStyle = '#00d4ff';
            ctx.beginPath();
            ctx.arc(this.lineStart.x, this.lineStart.y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(this.lineEnd.x, this.lineEnd.y, 5, 0, Math.PI * 2);
            ctx.fill();

            // Draw harmonic preview lines
            if (this.lineHarmonics > 0) {
                ctx.setLineDash([3, 3]);
                for (let h = 2; h <= this.lineHarmonics + 1; h++) {
                    const harmonicStartFreq = startFreq * h;
                    const harmonicEndFreq = endFreq * h;

                    // Only draw if within view
                    if (harmonicStartFreq <= this.freqMax || harmonicEndFreq <= this.freqMax) {
                        const y1 = this.freqToY(Math.min(harmonicStartFreq, this.freqMax), height);
                        const y2 = this.freqToY(Math.min(harmonicEndFreq, this.freqMax), height);

                        // Fade out higher harmonics
                        const alpha = Math.max(0.2, 1 - (h - 1) * 0.15);
                        ctx.strokeStyle = `rgba(0, 212, 255, ${alpha})`;
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(this.lineStart.x, y1);
                        ctx.lineTo(this.lineEnd.x, y2);
                        ctx.stroke();
                    }
                }
                ctx.setLineDash([]);
            }

            // Show info text
            ctx.fillStyle = '#00d4ff';
            ctx.font = '12px monospace';
            const freqText = `${startFreq.toFixed(1)} → ${endFreq.toFixed(1)} Hz`;
            const harmonicsText = this.lineHarmonics > 0 ? ` (+${this.lineHarmonics} harmonics)` : '';
            ctx.fillText(freqText + harmonicsText, this.lineEnd.x + 10, this.lineEnd.y - 10);
        }
    }

    renderTimeline() {
        const ctx = this.timelineCtx;
        const width = this.timelineCanvas.width;
        const height = this.timelineCanvas.height;

        ctx.fillStyle = '#16162a';
        ctx.fillRect(0, 0, width, height);

        if (!this.audioBuffer) return;

        // Draw time markers
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px monospace';

        const timeRange = this.viewEnd - this.viewStart;
        const step = this.calculateGridStep(timeRange);

        for (let t = Math.ceil(this.viewStart / step) * step; t <= this.viewEnd; t += step) {
            const x = this.timeToX(t, width);

            ctx.fillStyle = '#ffffff';
            ctx.fillText(this.formatTime(t), x + 3, height - 5);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.fillRect(x, 0, 1, height);
        }

        // Draw playhead
        const playX = this.timeToX(this.playbackPosition, width);
        ctx.fillStyle = '#e94560';
        ctx.beginPath();
        ctx.moveTo(playX - 6, 0);
        ctx.lineTo(playX + 6, 0);
        ctx.lineTo(playX, 10);
        ctx.closePath();
        ctx.fill();
    }

    renderWaveform() {
        const ctx = this.waveformCtx;
        const width = this.waveformCanvas.width;
        const height = this.waveformCanvas.height;

        // Dark canvas background to match partials display
        ctx.fillStyle = '#0a0a14';
        ctx.fillRect(0, 0, width, height);

        const centerY = height / 2;

        // Draw center line first
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();

        // If we have a rendered waveform preview (from spectral data), show that
        if (this.renderedWaveform && this.renderedWaveform.length > 0) {
            const samplesPerPixel = Math.max(1, Math.floor(this.renderedWaveform.length / width));

            // Draw rendered waveform in accent color (what spectral data produces)
            ctx.strokeStyle = '#e94560';
            ctx.lineWidth = 1;
            ctx.beginPath();

            for (let x = 0; x < width; x++) {
                const startSample = Math.floor(x * this.renderedWaveform.length / width);
                const endSample = Math.min(startSample + samplesPerPixel, this.renderedWaveform.length);

                let min = 0;
                let max = 0;

                for (let i = startSample; i < endSample; i++) {
                    if (this.renderedWaveform[i] < min) min = this.renderedWaveform[i];
                    if (this.renderedWaveform[i] > max) max = this.renderedWaveform[i];
                }

                const yMin = centerY + min * centerY * 0.85;
                const yMax = centerY + max * centerY * 0.85;

                ctx.moveTo(x, yMin);
                ctx.lineTo(x, yMax);
            }
            ctx.stroke();

            // Label
            ctx.fillStyle = '#e94560';
            ctx.font = '10px monospace';
            ctx.fillText('Rendered', 4, 12);
        } else if (this.audioBuffer) {
            // Fall back to original waveform if no rendered preview
            const channelData = this.audioBuffer.getChannelData(0);
            const samplesPerPixel = Math.floor(channelData.length / width);

            // Bright cyan waveform for visibility on dark background
            ctx.strokeStyle = '#00d4ff';
            ctx.lineWidth = 1;
            ctx.beginPath();

            for (let x = 0; x < width; x++) {
                const startSample = x * samplesPerPixel;
                const endSample = startSample + samplesPerPixel;

                let min = 0;
                let max = 0;

                for (let i = startSample; i < endSample && i < channelData.length; i++) {
                    if (channelData[i] < min) min = channelData[i];
                    if (channelData[i] > max) max = channelData[i];
                }

                const yMin = centerY + min * centerY * 0.9;
                const yMax = centerY + max * centerY * 0.9;

                ctx.moveTo(x, yMin);
                ctx.lineTo(x, yMax);
            }
            ctx.stroke();

            // Label
            ctx.fillStyle = '#00d4ff';
            ctx.font = '10px monospace';
            ctx.fillText('Original', 4, 12);
        }
    }

    // Coordinate conversion
    timeToX(time, width) {
        return ((time - this.viewStart) / (this.viewEnd - this.viewStart)) * width;
    }

    xToTime(x, width) {
        return this.viewStart + (x / width) * (this.viewEnd - this.viewStart);
    }

    freqToY(freq, height) {
        if (this.freqScale === 'log') {
            const logMin = Math.log10(this.freqMin);
            const logMax = Math.log10(this.freqMax);
            const logFreq = Math.log10(freq);
            return height - ((logFreq - logMin) / (logMax - logMin)) * height;
        } else if (this.freqScale === 'mel') {
            const melMin = this.freqToMel(this.freqMin);
            const melMax = this.freqToMel(this.freqMax);
            const melFreq = this.freqToMel(freq);
            return height - ((melFreq - melMin) / (melMax - melMin)) * height;
        } else {
            return height - ((freq - this.freqMin) / (this.freqMax - this.freqMin)) * height;
        }
    }

    yToFreq(y, height) {
        const ratio = 1 - (y / height);
        if (this.freqScale === 'log') {
            const logMin = Math.log10(this.freqMin);
            const logMax = Math.log10(this.freqMax);
            return Math.pow(10, logMin + ratio * (logMax - logMin));
        } else if (this.freqScale === 'mel') {
            const melMin = this.freqToMel(this.freqMin);
            const melMax = this.freqToMel(this.freqMax);
            return this.melToFreq(melMin + ratio * (melMax - melMin));
        } else {
            return this.freqMin + ratio * (this.freqMax - this.freqMin);
        }
    }

    freqToMel(freq) {
        return 2595 * Math.log10(1 + freq / 700);
    }

    melToFreq(mel) {
        return 700 * (Math.pow(10, mel / 2595) - 1);
    }

    // Mouse handling
    handleMouseDown(e) {
        const rect = this.interactionCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.dragStart = { x, y };
        this.isDragging = true;

        // Check if clicking in the top ruler area (top 20px) to set playback position
        if (y < 20 && this.audioBuffer) {
            const time = this.xToTime(x, this.interactionCanvas.width);
            this.seekTo(time / this.duration);
            this.isDragging = false;
            return;
        }

        if (e.altKey) {
            this.isPanning = true;
            this.interactionCanvas.style.cursor = 'grabbing';
            return;
        }

        if (this.isScrubbing) {
            const time = this.xToTime(x, this.interactionCanvas.width);
            this.scrubTo(time);
            return;
        }

        switch (this.currentTool) {
            case 'select':
                // Check if clicking on an already-selected partial
                const clickedPartial = this.getPartialAt(x, y);
                if (clickedPartial && this.selectedPartials.has(clickedPartial.id)) {
                    // Start moving the selection
                    this.startMoveSelection(x, y);
                } else {
                    // Normal selection behavior
                    if (!e.shiftKey) {
                        this.selectedPartials.clear();
                    }
                    this.selectPartialAt(x, y, e.shiftKey);
                }
                break;
            case 'rect':
                this.selectionRect = { x, y, width: 0, height: 0 };
                break;
            case 'lasso':
                this.lassoPoints = [{ x, y }];
                break;
            case 'brush':
                this.brushSelect(x, y, e.shiftKey);
                break;
            case 'pen':
                // Start freehand drawing
                this.penPoints = [{ x, y }];
                break;
            case 'line':
                // Start line drawing
                this.lineStart = { x, y };
                this.lineEnd = { x, y };
                break;
            case 'pitch':
            case 'time':
                if (this.selectedPartials.size > 0) {
                    this.startEditDrag(x, y);
                }
                break;
        }

        this.updateSelectionInfo();
        this.render();
    }

    handleMouseMove(e) {
        const rect = this.interactionCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.lastMousePos = { x, y };

        // Update cursor info
        const time = this.xToTime(x, this.interactionCanvas.width);
        const freq = this.yToFreq(y, this.interactionCanvas.height);
        document.getElementById('cursorInfo').textContent =
            `Cursor: ${freq.toFixed(1)} Hz, ${time.toFixed(3)} s`;

        if (!this.isDragging) {
            if (this.currentTool === 'brush') {
                this.renderOverlay();
            }
            return;
        }

        if (this.isPanning) {
            const dx = x - this.dragStart.x;
            const dy = y - this.dragStart.y;

            const timeShift = -dx / this.interactionCanvas.width * (this.viewEnd - this.viewStart);
            this.viewStart += timeShift;
            this.viewEnd += timeShift;

            const freqRange = this.freqMax - this.freqMin;
            const freqShift = dy / this.interactionCanvas.height * freqRange;
            this.freqMin += freqShift;
            this.freqMax += freqShift;

            document.getElementById('freqMin').value = Math.round(this.freqMin);
            document.getElementById('freqMax').value = Math.round(this.freqMax);

            this.dragStart = { x, y };
            this.render();
            return;
        }

        if (this.isScrubbing) {
            const time = this.xToTime(x, this.interactionCanvas.width);
            this.scrubTo(time);
            return;
        }

        switch (this.currentTool) {
            case 'select':
                if (this.isMovingSelection) {
                    this.updateMoveSelection(x, y, e.shiftKey);
                }
                break;
            case 'rect':
                if (this.selectionRect) {
                    this.selectionRect.width = x - this.selectionRect.x;
                    this.selectionRect.height = y - this.selectionRect.y;
                    this.renderOverlay();
                }
                break;
            case 'lasso':
                this.lassoPoints.push({ x, y });
                this.renderOverlay();
                break;
            case 'brush':
                this.brushSelect(x, y, true);
                break;
            case 'pen':
                // Continue freehand drawing
                if (this.penPoints.length > 0) {
                    this.penPoints.push({ x, y });
                    this.renderOverlay();
                }
                break;
            case 'line':
                // Update line end point
                if (this.lineStart) {
                    this.lineEnd = { x, y };
                    this.renderOverlay();
                }
                break;
            case 'pitch':
                if (this.editDragStart) {
                    this.updatePitchDrag(x, y, e.shiftKey);
                }
                break;
            case 'time':
                if (this.editDragStart) {
                    this.updateTimeDrag(x, y, e.shiftKey);
                }
                break;
        }
    }

    handleMouseUp(e) {
        if (this.isPanning) {
            this.isPanning = false;
            // Restore cursor based on current tool
            switch (this.currentTool) {
                case 'pitch':
                    this.interactionCanvas.style.cursor = 'ns-resize';
                    break;
                case 'time':
                    this.interactionCanvas.style.cursor = 'ew-resize';
                    break;
                case 'brush':
                    this.interactionCanvas.style.cursor = 'none';
                    break;
                default:
                    this.interactionCanvas.style.cursor = 'crosshair';
            }
        }

        if (this.isDragging) {
            switch (this.currentTool) {
                case 'select':
                    if (this.isMovingSelection) {
                        this.finishMoveSelection();
                    }
                    break;
                case 'rect':
                    if (this.selectionRect && (Math.abs(this.selectionRect.width) > 5 || Math.abs(this.selectionRect.height) > 5)) {
                        this.selectInRect(this.selectionRect, e.shiftKey);
                    }
                    this.selectionRect = null;
                    break;
                case 'lasso':
                    if (this.lassoPoints.length > 3) {
                        this.selectInLasso(this.lassoPoints, e.shiftKey);
                    }
                    this.lassoPoints = [];
                    break;
                case 'brush':
                    // Play preview when brush selection is complete (500ms)
                    this.startPreviewAudio(500);
                    break;
                case 'pen':
                    // Finish freehand drawing - create partial
                    if (this.penPoints.length > 2) {
                        this.createPartialFromPen();
                    }
                    this.penPoints = [];
                    break;
                case 'line':
                    // Finish line drawing - create partial with harmonics
                    if (this.lineStart && this.lineEnd) {
                        this.createPartialFromLine();
                    }
                    this.lineStart = null;
                    this.lineEnd = null;
                    break;
                case 'pitch':
                case 'time':
                    this.finishEditDrag();
                    break;
            }

            this.updateSelectionInfo();
            this.render();
        }

        this.isDragging = false;
    }

    handleWheel(e) {
        e.preventDefault();

        const rect = this.interactionCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const factor = e.deltaY > 0 ? 1.1 : 0.9;

        if (e.shiftKey) {
            // Zoom frequency
            this.zoomFreqAt(factor, y);
        } else {
            // Zoom time
            this.zoomTimeAt(factor, x);
        }

        this.render();
    }

    handleTimelineClick(e) {
        const rect = this.timelineCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const time = this.xToTime(x, this.timelineCanvas.width);
        this.seekTo(time / this.duration);
    }

    handleWaveformClick(e) {
        const rect = this.waveformCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const ratio = x / rect.width;

        if (this.freezeMode) {
            // In freeze mode, jump to frame and preview
            const sampleRate = this.audioContext ? this.audioContext.sampleRate : 44100;
            const totalFrames = Math.floor(this.duration * sampleRate / this.hopSize);
            this.currentFrame = Math.floor(ratio * totalFrames);
            this.currentFrame = Math.max(0, Math.min(totalFrames - 1, this.currentFrame));
            this.frameTime = this.currentFrame * this.hopSize / sampleRate;
            this.playbackPosition = this.frameTime;

            this.updateTimeDisplay();
            this.renderFreezeFrame();
            this.renderOverlay();
            this.renderTimeline();
            this.notify(`Frame ${this.currentFrame} / ${totalFrames} (${this.frameTime.toFixed(3)}s)`);
        } else {
            this.seekTo(ratio);
        }
    }

    // Selection
    getPartialAt(x, y) {
        const width = this.interactionCanvas.width;
        const height = this.interactionCanvas.height;
        const threshold = 10;

        let closestPartial = null;
        let closestDist = threshold;

        for (const partial of this.partials) {
            for (const point of partial.points) {
                const px = this.timeToX(point.time, width);
                const py = this.freqToY(point.freq, height);
                const dist = Math.sqrt((px - x) ** 2 + (py - y) ** 2);

                if (dist < closestDist) {
                    closestDist = dist;
                    closestPartial = partial;
                }
            }
        }

        return closestPartial;
    }

    selectPartialAt(x, y, addToSelection) {
        const closestPartial = this.getPartialAt(x, y);

        if (closestPartial) {
            if (addToSelection && this.selectedPartials.has(closestPartial.id)) {
                this.selectedPartials.delete(closestPartial.id);
            } else {
                this.selectedPartials.add(closestPartial.id);
            }
            // Play preview of selected partials (500ms for selection)
            this.startPreviewAudio(500);
        }

        this.updateEditButtons();
    }

    // Move selection functions
    startMoveSelection(x, y) {
        this.isMovingSelection = true;
        this.moveStartPos = { x, y };
        this.interactionCanvas.style.cursor = 'move';

        // Store original positions
        this.editDragStartFreqs = new Map();
        this.editDragStartTimes = new Map();

        for (const partial of this.partials) {
            if (!this.selectedPartials.has(partial.id)) continue;
            this.editDragStartFreqs.set(partial.id, partial.points.map(p => p.freq));
            this.editDragStartTimes.set(partial.id, partial.points.map(p => p.time));
        }

        // Start preview audio for the partials being moved
        this.startPreviewAudio();
    }

    updateMoveSelection(x, y, constrainToAxis = false) {
        if (!this.isMovingSelection || !this.moveStartPos) return;

        const width = this.interactionCanvas.width;
        const height = this.interactionCanvas.height;

        // Calculate raw delta in pixels
        let dx = x - this.moveStartPos.x;
        let dy = y - this.moveStartPos.y;

        // If shift is held, constrain to dominant axis
        if (constrainToAxis) {
            if (Math.abs(dx) > Math.abs(dy)) {
                // Horizontal movement is dominant - lock vertical
                dy = 0;
                y = this.moveStartPos.y;
            } else {
                // Vertical movement is dominant - lock horizontal
                dx = 0;
                x = this.moveStartPos.x;
            }
        }

        // Calculate delta in time and frequency
        const startTime = this.xToTime(this.moveStartPos.x, width);
        const currentTime = this.xToTime(x, width);
        const deltaTime = currentTime - startTime;

        const startFreq = this.yToFreq(this.moveStartPos.y, height);
        const currentFreq = this.yToFreq(y, height);
        // For frequency, we use a ratio to maintain relative relationships
        const freqRatio = currentFreq / startFreq;

        // Apply to all selected partials
        for (const partial of this.partials) {
            if (!this.selectedPartials.has(partial.id)) continue;

            const originalFreqs = this.editDragStartFreqs.get(partial.id);
            const originalTimes = this.editDragStartTimes.get(partial.id);
            if (!originalFreqs || !originalTimes) continue;

            for (let i = 0; i < partial.points.length; i++) {
                partial.points[i].freq = originalFreqs[i] * freqRatio;
                partial.points[i].time = originalTimes[i] + deltaTime;
            }
        }

        // Update status
        const semitones = 12 * Math.log2(freqRatio);
        let statusMsg = `Move: ${deltaTime >= 0 ? '+' : ''}${deltaTime.toFixed(3)}s, ${semitones >= 0 ? '+' : ''}${semitones.toFixed(1)} semitones`;
        if (constrainToAxis) {
            statusMsg += dy === 0 ? ' (H-lock)' : ' (V-lock)';
        }
        this.setStatus(statusMsg);

        // Update preview audio to reflect new frequencies
        this.updatePreviewAudio();

        this.render();
    }

    finishMoveSelection() {
        if (!this.isMovingSelection) return;

        // Check if anything changed
        let hasChanges = false;
        for (const partial of this.partials) {
            if (!this.selectedPartials.has(partial.id)) continue;
            const originalTimes = this.editDragStartTimes.get(partial.id);
            const originalFreqs = this.editDragStartFreqs.get(partial.id);
            if (originalTimes && originalFreqs) {
                if (partial.points.some((p, i) =>
                    Math.abs(p.time - originalTimes[i]) > 0.001 ||
                    Math.abs(p.freq - originalFreqs[i]) > 0.01)) {
                    hasChanges = true;
                    break;
                }
            }
        }

        if (hasChanges) {
            // Save current state
            const currentState = this.partials.map(p => ({
                id: p.id,
                points: p.points.map(pt => ({ ...pt }))
            }));

            // Restore originals for undo
            for (const partial of this.partials) {
                if (!this.selectedPartials.has(partial.id)) continue;
                const originalFreqs = this.editDragStartFreqs.get(partial.id);
                const originalTimes = this.editDragStartTimes.get(partial.id);
                if (originalFreqs && originalTimes) {
                    for (let i = 0; i < partial.points.length; i++) {
                        partial.points[i].freq = originalFreqs[i];
                        partial.points[i].time = originalTimes[i];
                    }
                }
            }

            // Save for undo
            this.saveState();

            // Reapply changes
            for (const savedPartial of currentState) {
                const partial = this.partials.find(p => p.id === savedPartial.id);
                if (partial) {
                    partial.points = savedPartial.points;
                }
            }

            this.notify(`Moved ${this.selectedPartials.size} partials`);
            this.updateRenderedWaveform();
        }

        // Reset state
        this.isMovingSelection = false;
        this.moveStartPos = null;
        this.editDragStartFreqs = null;
        this.editDragStartTimes = null;
        this.interactionCanvas.style.cursor = 'crosshair';
        this.setStatus('Ready');

        // Stop preview audio when done moving
        this.stopPreviewAudio();
    }

    // Preview audio methods - hear partials as you select/move them
    async startPreviewAudio(autoStopMs = 0) {
        if (!this.previewEnabled || this.selectedPartials.size === 0) return;

        // Create audio context on demand if needed
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        // Stop any existing preview
        this.stopPreviewAudio();

        // Clear any pending auto-stop
        if (this.previewAutoStopTimeout) {
            clearTimeout(this.previewAutoStopTimeout);
            this.previewAutoStopTimeout = null;
        }

        // Resume audio context if needed - must wait for this!
        if (this.audioContext.state === 'suspended') {
            try {
                await this.audioContext.resume();
            } catch (e) {
                console.warn('Could not resume audio context:', e);
                return;
            }
        }

        // Create master gain for preview
        this.previewGainNode = this.audioContext.createGain();
        this.previewGainNode.gain.value = 0.5;  // Preview volume
        this.previewGainNode.connect(this.audioContext.destination);

        // Get selected partials sorted by amplitude (loudest first)
        const selectedPartialsList = this.partials
            .filter(p => this.selectedPartials.has(p.id))
            .map(p => {
                // Get average amplitude
                const avgAmp = p.points.reduce((sum, pt) => sum + pt.amplitude, 0) / p.points.length;
                // Get average frequency (we'll use the midpoint for the preview)
                const avgFreq = p.points.reduce((sum, pt) => sum + pt.freq, 0) / p.points.length;
                return { partial: p, avgAmp, avgFreq };
            })
            .sort((a, b) => b.avgAmp - a.avgAmp)
            .slice(0, this.maxPreviewOscillators);

        // Create oscillators for each selected partial
        for (const { partial, avgAmp, avgFreq } of selectedPartialsList) {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.type = 'sine';
            osc.frequency.value = avgFreq;

            // Convert dB to linear - boost significantly for audible preview
            // Typical amplitudes are -60 to -10 dB, normalize to audible range
            const normalizedAmp = (avgAmp - this.minAmplitude) / (-this.minAmplitude);  // 0 to 1
            const linearAmp = Math.max(0.05, Math.min(0.4, normalizedAmp * 0.4));
            gain.gain.value = linearAmp;

            osc.connect(gain);
            gain.connect(this.previewGainNode);

            osc.start();

            this.previewOscillators.push({ osc, gain, partialId: partial.id });
        }

        // Auto-stop after specified time (for selection previews)
        if (autoStopMs > 0) {
            this.previewAutoStopTimeout = setTimeout(() => {
                this.stopPreviewAudio();
            }, autoStopMs);
        }
    }

    updatePreviewAudio() {
        if (!this.previewEnabled || this.previewOscillators.length === 0) return;

        // Update oscillator frequencies based on current partial positions
        for (const oscData of this.previewOscillators) {
            const partial = this.partials.find(p => p.id === oscData.partialId);
            if (partial && partial.points.length > 0) {
                // Get current average frequency
                const avgFreq = partial.points.reduce((sum, pt) => sum + pt.freq, 0) / partial.points.length;
                // Smoothly update frequency
                oscData.osc.frequency.setTargetAtTime(avgFreq, this.audioContext.currentTime, 0.02);
            }
        }
    }

    stopPreviewAudio() {
        // Clear any pending auto-stop
        if (this.previewAutoStopTimeout) {
            clearTimeout(this.previewAutoStopTimeout);
            this.previewAutoStopTimeout = null;
        }

        // Fade out and stop all oscillators
        const now = this.audioContext ? this.audioContext.currentTime : 0;

        for (const { osc, gain } of this.previewOscillators) {
            try {
                // Quick fade out to avoid clicks
                gain.gain.setTargetAtTime(0, now, 0.02);
                osc.stop(now + 0.1);
            } catch (e) {
                // Oscillator may already be stopped
            }
        }

        this.previewOscillators = [];

        // Disconnect master gain after fade
        if (this.previewGainNode) {
            setTimeout(() => {
                try {
                    this.previewGainNode.disconnect();
                } catch (e) {}
                this.previewGainNode = null;
            }, 150);
        }
    }

    togglePreviewAudio() {
        this.previewEnabled = !this.previewEnabled;
        if (!this.previewEnabled) {
            this.stopPreviewAudio();
        }
        // Update button state
        document.getElementById('previewAudioBtn').classList.toggle('active', this.previewEnabled);
        this.notify(this.previewEnabled ? 'Preview audio enabled (M)' : 'Preview audio disabled (M)');
    }

    selectInRect(rect, addToSelection) {
        const width = this.interactionCanvas.width;
        const height = this.interactionCanvas.height;

        // Normalize rectangle
        const x1 = Math.min(rect.x, rect.x + rect.width);
        const x2 = Math.max(rect.x, rect.x + rect.width);
        const y1 = Math.min(rect.y, rect.y + rect.height);
        const y2 = Math.max(rect.y, rect.y + rect.height);

        if (!addToSelection) {
            this.selectedPartials.clear();
        }

        for (const partial of this.partials) {
            for (const point of partial.points) {
                const px = this.timeToX(point.time, width);
                const py = this.freqToY(point.freq, height);

                if (px >= x1 && px <= x2 && py >= y1 && py <= y2) {
                    this.selectedPartials.add(partial.id);
                    break;
                }
            }
        }

        this.updateEditButtons();
        // Play preview of selected partials (500ms)
        this.startPreviewAudio(500);
    }

    selectInLasso(points, addToSelection) {
        const width = this.interactionCanvas.width;
        const height = this.interactionCanvas.height;

        if (!addToSelection) {
            this.selectedPartials.clear();
        }

        for (const partial of this.partials) {
            for (const point of partial.points) {
                const px = this.timeToX(point.time, width);
                const py = this.freqToY(point.freq, height);

                if (this.pointInPolygon(px, py, points)) {
                    this.selectedPartials.add(partial.id);
                    break;
                }
            }
        }

        this.updateEditButtons();
        // Play preview of selected partials (500ms)
        this.startPreviewAudio(500);
    }

    brushSelect(x, y, addToSelection) {
        const width = this.interactionCanvas.width;
        const height = this.interactionCanvas.height;

        for (const partial of this.partials) {
            for (const point of partial.points) {
                const px = this.timeToX(point.time, width);
                const py = this.freqToY(point.freq, height);
                const dist = Math.sqrt((px - x) ** 2 + (py - y) ** 2);

                if (dist < this.brushSize) {
                    this.selectedPartials.add(partial.id);
                    break;
                }
            }
        }

        this.updateSelectionInfo();
        this.updateEditButtons();
        this.render();
    }

    // Create partial from freehand pen drawing
    createPartialFromPen() {
        if (this.penPoints.length < 2) return;

        const width = this.interactionCanvas.width;
        const height = this.interactionCanvas.height;

        // Save state for undo
        this.saveState();

        // Convert screen points to time/freq points
        const points = this.penPoints.map(p => ({
            time: this.xToTime(p.x, width),
            freq: this.yToFreq(p.y, height),
            amplitude: this.penStrength
        }));

        // Sort points by time
        points.sort((a, b) => a.time - b.time);

        // Reduce points if there are too many (smooth the curve)
        const maxPoints = 100;
        let reducedPoints = points;
        if (points.length > maxPoints) {
            const step = Math.floor(points.length / maxPoints);
            reducedPoints = [];
            for (let i = 0; i < points.length; i += step) {
                reducedPoints.push(points[i]);
            }
            // Always include last point
            if (reducedPoints[reducedPoints.length - 1] !== points[points.length - 1]) {
                reducedPoints.push(points[points.length - 1]);
            }
        }

        const createdPartials = [];

        // Create fundamental partial
        const newPartial = {
            id: Date.now(),
            points: reducedPoints
        };

        this.partials.push(newPartial);
        createdPartials.push(newPartial);

        // Create harmonic partials if enabled
        for (let h = 2; h <= this.lineHarmonics + 1; h++) {
            // Calculate amplitude rolloff
            const rolloffDb = this.harmonicRolloff * Math.log2(h);

            const harmonicPoints = [];
            for (const point of reducedPoints) {
                const harmonicFreq = point.freq * h;

                // Only add points within frequency range
                if (harmonicFreq <= this.freqMax * 1.5) {
                    harmonicPoints.push({
                        time: point.time,
                        freq: harmonicFreq,
                        amplitude: point.amplitude - rolloffDb
                    });
                }
            }

            if (harmonicPoints.length >= 2) {
                const harmonicPartial = {
                    id: Date.now() + h,
                    points: harmonicPoints
                };
                this.partials.push(harmonicPartial);
                createdPartials.push(harmonicPartial);
            }
        }

        // Select all created partials
        this.selectedPartials.clear();
        createdPartials.forEach(p => this.selectedPartials.add(p.id));

        // Update display
        document.getElementById('partialsDisplay').textContent = this.partials.length;
        this.updateSelectionInfo();
        this.updateEditButtons();
        this.render();
        this.updateRenderedWaveform();

        // Play preview of the new partial (500ms)
        this.startPreviewAudio(500);

        const harmonicsMsg = this.lineHarmonics > 0 ? ` with ${this.lineHarmonics} harmonics` : '';
        this.notify(`Created partial from pen${harmonicsMsg}`);
    }

    // Create partial(s) from line drawing with harmonics
    createPartialFromLine() {
        if (!this.lineStart || !this.lineEnd) return;

        const width = this.interactionCanvas.width;
        const height = this.interactionCanvas.height;

        // Save state for undo
        this.saveState();

        // Get start and end parameters
        const startTime = this.xToTime(this.lineStart.x, width);
        const endTime = this.xToTime(this.lineEnd.x, width);
        const startFreq = this.yToFreq(this.lineStart.y, height);
        const endFreq = this.yToFreq(this.lineEnd.y, height);

        // Make sure start comes before end
        const t1 = Math.min(startTime, endTime);
        const t2 = Math.max(startTime, endTime);
        const f1 = startTime <= endTime ? startFreq : endFreq;
        const f2 = startTime <= endTime ? endFreq : startFreq;
        const amp1 = startTime <= endTime ? this.lineStartStrength : this.lineEndStrength;
        const amp2 = startTime <= endTime ? this.lineEndStrength : this.lineStartStrength;

        // Create points along the line (at least 10 points, or ~50ms intervals)
        const duration = t2 - t1;
        const numPoints = Math.max(10, Math.ceil(duration / 0.05));

        const createdPartials = [];

        // Create fundamental partial
        const fundamentalPoints = [];
        for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints;
            fundamentalPoints.push({
                time: t1 + t * duration,
                freq: f1 + t * (f2 - f1),
                amplitude: amp1 + t * (amp2 - amp1)
            });
        }

        const fundamentalPartial = {
            id: Date.now(),
            points: fundamentalPoints
        };
        this.partials.push(fundamentalPartial);
        createdPartials.push(fundamentalPartial);

        // Create harmonic partials
        for (let h = 2; h <= this.lineHarmonics + 1; h++) {
            // Calculate amplitude rolloff
            const rolloffDb = this.harmonicRolloff * Math.log2(h);

            const harmonicPoints = [];
            for (let i = 0; i <= numPoints; i++) {
                const t = i / numPoints;
                const baseFreq = f1 + t * (f2 - f1);
                const harmonicFreq = baseFreq * h;

                // Only add points within frequency range
                if (harmonicFreq <= this.freqMax * 1.5) {
                    const baseAmp = amp1 + t * (amp2 - amp1);
                    harmonicPoints.push({
                        time: t1 + t * duration,
                        freq: harmonicFreq,
                        amplitude: baseAmp - rolloffDb  // Apply rolloff
                    });
                }
            }

            if (harmonicPoints.length >= 2) {
                const harmonicPartial = {
                    id: Date.now() + h,
                    points: harmonicPoints
                };
                this.partials.push(harmonicPartial);
                createdPartials.push(harmonicPartial);
            }
        }

        // Select all created partials
        this.selectedPartials.clear();
        createdPartials.forEach(p => this.selectedPartials.add(p.id));

        // Update display
        document.getElementById('partialsDisplay').textContent = this.partials.length;
        this.updateSelectionInfo();
        this.updateEditButtons();
        this.render();
        this.updateRenderedWaveform();

        // Play preview of the new partials (500ms)
        this.startPreviewAudio(500);

        const msg = this.lineHarmonics > 0
            ? `Created partial with ${this.lineHarmonics} harmonics`
            : 'Created partial from line';
        this.notify(msg);
    }

    pointInPolygon(x, y, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;

            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        return inside;
    }

    // Grid quantization functions
    snapTimeToGrid(time) {
        return Math.round(time / this.gridTimeResolution) * this.gridTimeResolution;
    }

    snapFreqToGrid(freq) {
        if (this.gridFreqMode === 'semitones') {
            // Snap to nearest semitone (or multiple)
            const refFreq = 440;  // A4
            const semitonesPerLine = this.gridFreqResolution / 50;
            const semitones = 12 * Math.log2(freq / refFreq);
            const snappedSemitones = Math.round(semitones / semitonesPerLine) * semitonesPerLine;
            return refFreq * Math.pow(2, snappedSemitones / 12);
        } else {
            // Snap to nearest Hz grid line
            return Math.round(freq / this.gridFreqResolution) * this.gridFreqResolution;
        }
    }

    quantizeTime() {
        if (this.selectedPartials.size === 0) {
            this.notify('No partials selected');
            return;
        }

        this.saveState();
        let pointsQuantized = 0;

        for (const partial of this.partials) {
            if (!this.selectedPartials.has(partial.id)) continue;

            for (const point of partial.points) {
                const newTime = this.snapTimeToGrid(point.time);
                if (Math.abs(newTime - point.time) > 0.0001) {
                    point.time = newTime;
                    pointsQuantized++;
                }
            }
        }

        this.render();
        this.notify(`Quantized ${pointsQuantized} points in time`);
    }

    quantizeFreq() {
        if (this.selectedPartials.size === 0) {
            this.notify('No partials selected');
            return;
        }

        this.saveState();
        let pointsQuantized = 0;

        for (const partial of this.partials) {
            if (!this.selectedPartials.has(partial.id)) continue;

            for (const point of partial.points) {
                const newFreq = this.snapFreqToGrid(point.freq);
                if (Math.abs(newFreq - point.freq) > 0.01) {
                    point.freq = newFreq;
                    pointsQuantized++;
                }
            }
        }

        this.render();
        this.notify(`Quantized ${pointsQuantized} points in frequency`);
    }

    quantizeToBpm() {
        if (this.selectedPartials.size === 0) {
            this.notify('No partials selected');
            return;
        }

        const bpm = parseFloat(document.getElementById('quantBpm').value) || 120;
        const division = parseFloat(document.getElementById('quantBeatDivision').value) || 4;

        // Calculate beat duration in seconds
        const beatDuration = 60 / bpm;
        // Calculate grid resolution based on division
        let gridResolution;
        if (division === 3) {
            // Triplet (quarter note triplet)
            gridResolution = beatDuration / 3;
        } else if (division === 6) {
            // 8th triplet
            gridResolution = beatDuration / 6;
        } else {
            // Standard divisions (1=whole, 2=half, 4=quarter, 8=8th, 16=16th, 32=32nd)
            gridResolution = (beatDuration * 4) / division;
        }

        this.saveState();
        let pointsQuantized = 0;

        for (const partial of this.partials) {
            if (!this.selectedPartials.has(partial.id)) continue;

            for (const point of partial.points) {
                const newTime = Math.round(point.time / gridResolution) * gridResolution;
                if (Math.abs(newTime - point.time) > 0.0001) {
                    point.time = newTime;
                    pointsQuantized++;
                }
            }
        }

        this.render();
        this.updateRenderedWaveform();
        this.notify(`Quantized ${pointsQuantized} points to ${bpm} BPM (1/${division} notes)`);
    }

    // Scale definitions (semitones from root)
    getScaleIntervals(scaleName) {
        const scales = {
            chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
            major: [0, 2, 4, 5, 7, 9, 11],
            minor: [0, 2, 3, 5, 7, 8, 10],
            harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
            melodicMinor: [0, 2, 3, 5, 7, 9, 11],
            dorian: [0, 2, 3, 5, 7, 9, 10],
            phrygian: [0, 1, 3, 5, 7, 8, 10],
            lydian: [0, 2, 4, 6, 7, 9, 11],
            mixolydian: [0, 2, 4, 5, 7, 9, 10],
            locrian: [0, 1, 3, 5, 6, 8, 10],
            pentatonicMajor: [0, 2, 4, 7, 9],
            pentatonicMinor: [0, 3, 5, 7, 10],
            blues: [0, 3, 5, 6, 7, 10],
            fifths: [0, 7],  // Perfect fifths (root + fifth)
            fourths: [0, 5],  // Perfect fourths (root + fourth)
            octaves: [0]  // Octaves only
        };
        return scales[scaleName] || scales.chromatic;
    }

    quantizeToScale() {
        if (this.selectedPartials.size === 0) {
            this.notify('No partials selected');
            return;
        }

        const rootNote = parseInt(document.getElementById('quantRootNote').value);
        const scaleName = document.getElementById('quantScale').value;
        const scaleIntervals = this.getScaleIntervals(scaleName);

        // Reference: A4 = 440Hz, which is MIDI note 69
        // C4 = 261.63Hz, which is MIDI note 60
        const A4 = 440;

        this.saveState();
        let pointsQuantized = 0;

        for (const partial of this.partials) {
            if (!this.selectedPartials.has(partial.id)) continue;

            for (const point of partial.points) {
                // Convert frequency to MIDI note number (continuous)
                const midiNote = 69 + 12 * Math.log2(point.freq / A4);

                // Find semitones from C (note 0)
                const semitoneFromC = ((midiNote % 12) + 12) % 12;

                // Find semitones from root note
                const semitoneFromRoot = ((semitoneFromC - rootNote) + 12) % 12;

                // Find the closest scale degree
                let closestInterval = scaleIntervals[0];
                let minDistance = 12;

                for (const interval of scaleIntervals) {
                    // Check distance in both directions (wrapping at 12)
                    const dist1 = Math.abs(semitoneFromRoot - interval);
                    const dist2 = 12 - dist1;
                    const distance = Math.min(dist1, dist2);

                    if (distance < minDistance) {
                        minDistance = distance;
                        closestInterval = interval;
                    }
                }

                // Calculate the quantized semitone (in terms of absolute semitone position)
                let quantizedSemitone = rootNote + closestInterval;
                if (quantizedSemitone > semitoneFromC + 6) quantizedSemitone -= 12;
                if (quantizedSemitone < semitoneFromC - 6) quantizedSemitone += 12;

                // Calculate difference and apply to MIDI note
                const difference = quantizedSemitone - semitoneFromC;
                const quantizedMidi = midiNote + difference;

                // Convert back to frequency
                const newFreq = A4 * Math.pow(2, (quantizedMidi - 69) / 12);

                if (Math.abs(newFreq - point.freq) > 0.01) {
                    point.freq = newFreq;
                    pointsQuantized++;
                }
            }
        }

        this.render();
        this.updateRenderedWaveform();
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        this.notify(`Quantized ${pointsQuantized} points to ${noteNames[rootNote]} ${scaleName}`);
    }

    addHarmonics() {
        if (this.selectedPartials.size === 0) {
            this.notify('No partials selected');
            return;
        }

        const numHarmonics = parseInt(document.getElementById('harmonicsCount').value) || 8;
        const dropoffPerOctave = parseFloat(document.getElementById('harmonicsDropoff').value) || 6;
        const oddOnly = document.getElementById('harmonicsOddOnly').checked;

        this.saveState();

        const selectedPartialsList = this.partials.filter(p => this.selectedPartials.has(p.id));
        const newPartials = [];

        for (const partial of selectedPartialsList) {
            // For each harmonic
            for (let h = 2; h <= numHarmonics + 1; h++) {
                // Skip even harmonics if oddOnly is checked
                if (oddOnly && h % 2 === 0) continue;

                // Create a new partial for this harmonic
                const harmonicPartial = {
                    id: this.nextPartialId++,
                    points: []
                };

                // Copy all points with frequency multiplied by harmonic number
                for (const point of partial.points) {
                    const harmonicFreq = point.freq * h;

                    // Skip if harmonic frequency is above Nyquist (roughly 20kHz)
                    if (harmonicFreq > 20000) continue;

                    // Calculate amplitude dropoff based on octaves above fundamental
                    // Each octave doubles frequency, so octaves = log2(h)
                    const octavesAbove = Math.log2(h);
                    const dropoffDb = dropoffPerOctave * octavesAbove;

                    harmonicPartial.points.push({
                        time: point.time,
                        freq: harmonicFreq,
                        amplitude: point.amplitude - dropoffDb
                    });
                }

                // Only add if we have at least 2 points
                if (harmonicPartial.points.length >= 2) {
                    newPartials.push(harmonicPartial);
                }
            }
        }

        // Add all new harmonic partials
        this.partials.push(...newPartials);

        // Select the new partials too
        for (const p of newPartials) {
            this.selectedPartials.add(p.id);
        }

        this.updateSelectionInfo();
        this.updateEditButtons();
        this.render();
        this.updateRenderedWaveform();

        const harmonicType = oddOnly ? 'odd harmonics' : 'harmonics';
        this.notify(`Added ${newPartials.length} ${harmonicType} to ${selectedPartialsList.length} partial(s)`);
    }

    explodeSelection() {
        if (this.selectedPartials.size === 0) {
            this.notify('No partials selected');
            return;
        }

        const order = document.getElementById('explodeOrder').value;
        const spacing = document.getElementById('explodeSpacing').value;

        this.saveState();

        const selectedPartialsList = this.partials.filter(p => this.selectedPartials.has(p.id));

        if (selectedPartialsList.length < 2) {
            this.notify('Need at least 2 partials to explode');
            return;
        }

        // Find time range of selection
        let minTime = Infinity, maxTime = -Infinity;
        for (const partial of selectedPartialsList) {
            for (const point of partial.points) {
                if (point.time < minTime) minTime = point.time;
                if (point.time > maxTime) maxTime = point.time;
            }
        }

        const timeRange = maxTime - minTime;

        // Get average frequency for each partial (for sorting)
        const partialsWithInfo = selectedPartialsList.map(partial => {
            let freqSum = 0;
            for (const point of partial.points) {
                freqSum += point.freq;
            }
            const avgFreq = freqSum / partial.points.length;
            const startTime = partial.points[0].time;
            return { partial, avgFreq, startTime };
        });

        // Sort based on order
        let sortedPartials;
        switch (order) {
            case 'ascending':
                sortedPartials = [...partialsWithInfo].sort((a, b) => a.avgFreq - b.avgFreq);
                break;
            case 'descending':
                sortedPartials = [...partialsWithInfo].sort((a, b) => b.avgFreq - a.avgFreq);
                break;
            case 'random':
                sortedPartials = [...partialsWithInfo].sort(() => Math.random() - 0.5);
                break;
            default: // 'original' - sort by original start time
                sortedPartials = [...partialsWithInfo].sort((a, b) => a.startTime - b.startTime);
        }

        // Calculate new start times
        const numPartials = sortedPartials.length;

        for (let i = 0; i < numPartials; i++) {
            const { partial } = sortedPartials[i];

            // Calculate target start time for this partial
            let targetStart;
            if (spacing === 'proportional') {
                // Distribute proportionally across time range
                targetStart = minTime + (i / (numPartials - 1)) * timeRange;
            } else {
                // Even spacing
                targetStart = minTime + (i / (numPartials - 1)) * timeRange;
            }

            // Calculate time offset needed
            const currentStart = partial.points[0].time;
            const timeOffset = targetStart - currentStart;

            // Apply offset to all points in this partial
            for (const point of partial.points) {
                point.time += timeOffset;
            }
        }

        this.render();
        this.updateRenderedWaveform();
        this.notify(`Exploded ${numPartials} partials (${order} order)`);
    }

    rotateSelection() {
        if (this.selectedPartials.size === 0) {
            this.notify('No partials selected');
            return;
        }

        const angleDegrees = parseFloat(document.getElementById('rotateAngle').value) || 0;
        const pivotType = document.getElementById('rotatePivot').value;

        if (angleDegrees === 0) {
            this.notify('Angle is 0, no rotation applied');
            return;
        }

        this.saveState();

        const selectedPartialsList = this.partials.filter(p => this.selectedPartials.has(p.id));

        // Find bounds of selection
        let minTime = Infinity, maxTime = -Infinity;
        let minFreq = Infinity, maxFreq = -Infinity;

        for (const partial of selectedPartialsList) {
            for (const point of partial.points) {
                if (point.time < minTime) minTime = point.time;
                if (point.time > maxTime) maxTime = point.time;
                if (point.freq < minFreq) minFreq = point.freq;
                if (point.freq > maxFreq) maxFreq = point.freq;
            }
        }

        const timeRange = maxTime - minTime;
        const freqRange = maxFreq - minFreq;

        // Determine pivot point
        let pivotTime, pivotFreq;
        switch (pivotType) {
            case 'start':
                pivotTime = minTime;
                pivotFreq = (minFreq + maxFreq) / 2;
                break;
            case 'end':
                pivotTime = maxTime;
                pivotFreq = (minFreq + maxFreq) / 2;
                break;
            default: // 'center'
                pivotTime = (minTime + maxTime) / 2;
                pivotFreq = (minFreq + maxFreq) / 2;
        }

        // Convert angle to radians
        const angleRad = angleDegrees * Math.PI / 180;
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);

        // Rotate each point
        // We need to normalize time and freq to similar scales for rotation to look right
        // Use the ranges to normalize to 0-1 space, rotate, then scale back
        const timeScale = timeRange > 0 ? timeRange : 1;
        const freqScale = freqRange > 0 ? freqRange : 1;

        for (const partial of selectedPartialsList) {
            for (const point of partial.points) {
                // Normalize to 0-1 space relative to pivot
                const normTime = (point.time - pivotTime) / timeScale;
                const normFreq = (point.freq - pivotFreq) / freqScale;

                // Rotate
                const rotTime = normTime * cosA - normFreq * sinA;
                const rotFreq = normTime * sinA + normFreq * cosA;

                // Scale back
                point.time = pivotTime + rotTime * timeScale;
                point.freq = pivotFreq + rotFreq * freqScale;

                // Clamp frequency to valid range
                point.freq = Math.max(20, point.freq);
            }

            // Sort points by time after rotation (they may have reversed)
            partial.points.sort((a, b) => a.time - b.time);
        }

        this.render();
        this.updateRenderedWaveform();
        this.notify(`Rotated selection by ${angleDegrees}°`);
    }

    selectAll() {
        this.partials.forEach(p => this.selectedPartials.add(p.id));
        this.updateSelectionInfo();
        this.updateEditButtons();
        this.render();
    }

    deselectAll() {
        this.selectedPartials.clear();
        this.updateSelectionInfo();
        this.updateEditButtons();
        this.render();
    }

    invertSelection() {
        // Vertically invert frequencies (mirror around center frequency)
        if (this.selectedPartials.size === 0) {
            this.notify('No partials selected');
            return;
        }

        this.saveState();

        const selectedPartialsList = this.partials.filter(p => this.selectedPartials.has(p.id));

        // Find frequency range of selection
        let minFreq = Infinity, maxFreq = -Infinity;
        for (const partial of selectedPartialsList) {
            for (const point of partial.points) {
                if (point.freq < minFreq) minFreq = point.freq;
                if (point.freq > maxFreq) maxFreq = point.freq;
            }
        }

        const centerFreq = (minFreq + maxFreq) / 2;

        // Mirror each frequency around the center
        for (const partial of selectedPartialsList) {
            for (const point of partial.points) {
                point.freq = centerFreq - (point.freq - centerFreq);
                // Ensure frequency stays positive
                point.freq = Math.max(20, point.freq);
            }
        }

        this.render();
        this.updateRenderedWaveform();
        this.notify(`Inverted ${selectedPartialsList.length} partials in frequency`);
    }

    perpendicularSelection() {
        // Rotate partials 90 degrees - swap time and frequency axes
        if (this.selectedPartials.size === 0) {
            this.notify('No partials selected');
            return;
        }

        this.saveState();

        const selectedPartialsList = this.partials.filter(p => this.selectedPartials.has(p.id));

        // Find ranges
        let minTime = Infinity, maxTime = -Infinity;
        let minFreq = Infinity, maxFreq = -Infinity;
        for (const partial of selectedPartialsList) {
            for (const point of partial.points) {
                if (point.time < minTime) minTime = point.time;
                if (point.time > maxTime) maxTime = point.time;
                if (point.freq < minFreq) minFreq = point.freq;
                if (point.freq > maxFreq) maxFreq = point.freq;
            }
        }

        const timeRange = maxTime - minTime;
        const freqRange = maxFreq - minFreq;

        if (timeRange === 0 || freqRange === 0) {
            this.notify('Selection has no range to rotate');
            return;
        }

        // Normalize, rotate 90°, then scale back
        // Rotation: (x, y) -> (-y, x) but we need to map between different scales
        // Time becomes frequency, frequency becomes time
        for (const partial of selectedPartialsList) {
            for (const point of partial.points) {
                // Normalize to 0-1
                const normTime = (point.time - minTime) / timeRange;
                const normFreq = (point.freq - minFreq) / freqRange;

                // Rotate 90° clockwise: (t, f) -> (f, 1-t)
                const newNormTime = normFreq;
                const newNormFreq = 1 - normTime;

                // Scale back to original ranges
                point.time = minTime + newNormTime * timeRange;
                point.freq = minFreq + newNormFreq * freqRange;
                point.freq = Math.max(20, point.freq);
            }
            // Sort points by time since they may have shuffled
            partial.points.sort((a, b) => a.time - b.time);
        }

        this.render();
        this.updateRenderedWaveform();
        this.notify(`Rotated ${selectedPartialsList.length} partials 90°`);
    }

    reverseSelection() {
        if (this.selectedPartials.size === 0) {
            this.notify('No partials selected');
            return;
        }

        this.saveState();

        // Get all selected partials
        const selectedPartialsList = this.partials.filter(p => this.selectedPartials.has(p.id));

        if (selectedPartialsList.length === 0) return;

        // Find the time range of the selection
        let minTime = Infinity, maxTime = -Infinity;
        for (const partial of selectedPartialsList) {
            for (const point of partial.points) {
                if (point.time < minTime) minTime = point.time;
                if (point.time > maxTime) maxTime = point.time;
            }
        }

        // Reverse each partial's points in time around the center
        const centerTime = (minTime + maxTime) / 2;

        for (const partial of selectedPartialsList) {
            for (const point of partial.points) {
                // Mirror time around center
                point.time = centerTime - (point.time - centerTime);
            }
            // Reverse the points array so they're still in chronological order
            partial.points.reverse();
        }

        this.render();
        this.updateRenderedWaveform();
        this.notify(`Reversed ${selectedPartialsList.length} partials in time`);
    }

    updateSelectionInfo() {
        const count = this.selectedPartials.size;
        document.getElementById('selectedCount').textContent = count;

        if (count === 0) {
            document.getElementById('selectedFreq').textContent = '-';
            document.getElementById('selectedTime').textContent = '-';
            return;
        }

        let minFreq = Infinity, maxFreq = 0;
        let minTime = Infinity, maxTime = 0;

        for (const partial of this.partials) {
            if (!this.selectedPartials.has(partial.id)) continue;

            for (const point of partial.points) {
                if (point.freq < minFreq) minFreq = point.freq;
                if (point.freq > maxFreq) maxFreq = point.freq;
                if (point.time < minTime) minTime = point.time;
                if (point.time > maxTime) maxTime = point.time;
            }
        }

        document.getElementById('selectedFreq').textContent =
            `${minFreq.toFixed(0)}-${maxFreq.toFixed(0)} Hz`;
        document.getElementById('selectedTime').textContent =
            `${minTime.toFixed(2)}-${maxTime.toFixed(2)} s`;
    }

    updateEditButtons() {
        const hasSelection = this.selectedPartials.size > 0;
        // Pitch and Time are now tools that can be selected anytime,
        // but they only work when partials are selected
        document.getElementById('pitchShiftBtn').disabled = false;
        document.getElementById('timeStretchBtn').disabled = false;
        document.getElementById('deleteBtn').disabled = !hasSelection;
        document.getElementById('invertSelBtn').disabled = !hasSelection;
        document.getElementById('perpendicularBtn').disabled = !hasSelection;
        document.getElementById('reverseSelBtn').disabled = !hasSelection;
    }

    // Tools
    setTool(tool) {
        this.currentTool = tool;

        // Clear all active states from tool buttons
        document.querySelectorAll('.toolbar-group button').forEach(btn => {
            btn.classList.remove('active');
        });

        // Map tool names to button IDs
        const toolButtonMap = {
            'select': 'selectTool',
            'rect': 'rectTool',
            'lasso': 'lassoTool',
            'brush': 'brushTool',
            'pen': 'penTool',
            'line': 'lineTool',
            'pitch': 'pitchShiftBtn',
            'time': 'timeStretchBtn'
        };

        const buttonId = toolButtonMap[tool];
        if (buttonId) {
            document.getElementById(buttonId).classList.add('active');
        }

        // Keep preview audio button active state separate
        document.getElementById('previewAudioBtn').classList.toggle('active', this.previewEnabled);

        // Set cursor based on tool
        switch (tool) {
            case 'brush':
                this.interactionCanvas.style.cursor = 'none';
                break;
            case 'pen':
            case 'line':
                this.interactionCanvas.style.cursor = 'crosshair';
                break;
            case 'pitch':
                this.interactionCanvas.style.cursor = 'ns-resize';
                break;
            case 'time':
                this.interactionCanvas.style.cursor = 'ew-resize';
                break;
            default:
                this.interactionCanvas.style.cursor = 'crosshair';
        }
    }

    // Zoom and pan
    zoomTime(factor) {
        const center = (this.viewStart + this.viewEnd) / 2;
        const range = (this.viewEnd - this.viewStart) / factor;
        this.viewStart = center - range / 2;
        this.viewEnd = center + range / 2;
        this.render();
    }

    zoomTimeAt(factor, x) {
        const width = this.interactionCanvas.width;
        const time = this.xToTime(x, width);
        const ratio = x / width;

        const newRange = (this.viewEnd - this.viewStart) * factor;
        this.viewStart = time - ratio * newRange;
        this.viewEnd = time + (1 - ratio) * newRange;
    }

    zoomFreq(factor) {
        const center = (this.freqMin + this.freqMax) / 2;
        const range = (this.freqMax - this.freqMin) / factor;
        this.freqMin = Math.max(20, center - range / 2);
        this.freqMax = Math.min(22050, center + range / 2);

        document.getElementById('freqMin').value = Math.round(this.freqMin);
        document.getElementById('freqMax').value = Math.round(this.freqMax);
        this.render();
    }

    zoomFreqAt(factor, y) {
        const height = this.interactionCanvas.height;
        const freq = this.yToFreq(y, height);
        const ratio = 1 - (y / height);

        const newRange = (this.freqMax - this.freqMin) * factor;
        this.freqMin = Math.max(20, freq - ratio * newRange);
        this.freqMax = Math.min(22050, freq + (1 - ratio) * newRange);

        document.getElementById('freqMin').value = Math.round(this.freqMin);
        document.getElementById('freqMax').value = Math.round(this.freqMax);
    }

    fitView() {
        if (!this.audioBuffer) return;

        this.viewStart = 0;
        this.viewEnd = this.duration;
        this.freqMin = 20;
        this.freqMax = 8000;

        document.getElementById('freqMin').value = this.freqMin;
        document.getElementById('freqMax').value = this.freqMax;

        this.render();
    }

    // Editing operations
    saveState() {
        const state = JSON.stringify(this.partials);
        this.undoStack.push(state);
        if (this.undoStack.length > this.maxUndoSteps) {
            this.undoStack.shift();
        }
        this.redoStack = [];
        this.updateUndoButtons();
    }

    undo() {
        if (this.undoStack.length === 0) return;

        const currentState = JSON.stringify(this.partials);
        this.redoStack.push(currentState);

        const previousState = this.undoStack.pop();
        this.partials = JSON.parse(previousState);

        this.selectedPartials.clear();
        this.updateSelectionInfo();
        this.updateEditButtons();
        this.updateUndoButtons();
        this.render();
        this.updateRenderedWaveform();

        this.notify('Undo');
    }

    redo() {
        if (this.redoStack.length === 0) return;

        const currentState = JSON.stringify(this.partials);
        this.undoStack.push(currentState);

        const nextState = this.redoStack.pop();
        this.partials = JSON.parse(nextState);

        this.selectedPartials.clear();
        this.updateSelectionInfo();
        this.updateEditButtons();
        this.updateUndoButtons();
        this.render();
        this.updateRenderedWaveform();

        this.notify('Redo');
    }

    updateUndoButtons() {
        document.getElementById('undoBtn').disabled = this.undoStack.length === 0;
        document.getElementById('redoBtn').disabled = this.redoStack.length === 0;
    }

    copySelected() {
        if (this.selectedPartials.size === 0) return;

        this.clipboard = this.partials
            .filter(p => this.selectedPartials.has(p.id))
            .map(p => JSON.parse(JSON.stringify(p)));

        this.notify(`Copied ${this.clipboard.length} partials`);
    }

    pastePartials() {
        if (this.clipboard.length === 0) return;

        this.saveState();

        const maxId = Math.max(...this.partials.map(p => p.id), -1);
        const newPartials = this.clipboard.map((p, i) => ({
            ...JSON.parse(JSON.stringify(p)),
            id: maxId + 1 + i
        }));

        this.partials.push(...newPartials);

        this.selectedPartials.clear();
        newPartials.forEach(p => this.selectedPartials.add(p.id));

        document.getElementById('partialsDisplay').textContent = this.partials.length;
        this.updateSelectionInfo();
        this.updateEditButtons();
        this.render();
        this.updateRenderedWaveform();

        this.notify(`Pasted ${newPartials.length} partials`);
    }

    deleteSelected() {
        if (this.selectedPartials.size === 0) return;

        this.saveState();

        const count = this.selectedPartials.size;
        this.partials = this.partials.filter(p => !this.selectedPartials.has(p.id));
        this.selectedPartials.clear();

        document.getElementById('partialsDisplay').textContent = this.partials.length;
        this.updateSelectionInfo();
        this.updateEditButtons();
        this.render();
        this.updateRenderedWaveform();

        this.notify(`Deleted ${count} partials`);
    }

    // Drag-based pitch and time editing
    startEditDrag(x, y) {
        this.editDragStart = { x, y };

        // Store original values for all selected partials
        this.editDragStartFreqs = new Map();
        this.editDragStartTimes = new Map();

        for (const partial of this.partials) {
            if (!this.selectedPartials.has(partial.id)) continue;

            this.editDragStartFreqs.set(partial.id, partial.points.map(p => p.freq));
            this.editDragStartTimes.set(partial.id, partial.points.map(p => p.time));
        }

        // Calculate center of selection for time stretch anchor
        let minTime = Infinity, maxTime = 0;
        for (const partial of this.partials) {
            if (!this.selectedPartials.has(partial.id)) continue;
            for (const point of partial.points) {
                if (point.time < minTime) minTime = point.time;
                if (point.time > maxTime) maxTime = point.time;
            }
        }
        this.editDragAnchorTime = (minTime + maxTime) / 2;

        // Start preview audio for the partials being edited
        this.startPreviewAudio();
    }

    updatePitchDrag(x, y, useFrequencyMode = false) {
        if (!this.editDragStart || !this.editDragStartFreqs) return;

        const dy = this.editDragStart.y - y;  // Inverted: drag up = higher pitch
        const height = this.interactionCanvas.height;

        if (useFrequencyMode) {
            // Frequency-based shifting: add/subtract Hz
            // 100 pixels = 500 Hz shift
            const hzShift = (dy / 100) * 500;

            // Apply to all selected partials
            for (const partial of this.partials) {
                if (!this.selectedPartials.has(partial.id)) continue;

                const originalFreqs = this.editDragStartFreqs.get(partial.id);
                if (!originalFreqs) continue;

                for (let i = 0; i < partial.points.length; i++) {
                    // Ensure frequency doesn't go below 20Hz
                    partial.points[i].freq = Math.max(20, originalFreqs[i] + hzShift);
                }
            }

            // Update status
            this.setStatus(`Frequency: ${hzShift >= 0 ? '+' : ''}${hzShift.toFixed(1)} Hz (Shift for Hz mode)`);
        } else {
            // Pitch-based shifting: multiply by ratio (preserves harmonics)
            // 100 pixels = 1 octave (12 semitones)
            const semitones = (dy / 100) * 12;
            const ratio = Math.pow(2, semitones / 12);

            // Apply to all selected partials
            for (const partial of this.partials) {
                if (!this.selectedPartials.has(partial.id)) continue;

                const originalFreqs = this.editDragStartFreqs.get(partial.id);
                if (!originalFreqs) continue;

                for (let i = 0; i < partial.points.length; i++) {
                    partial.points[i].freq = originalFreqs[i] * ratio;
                }
            }

            // Update status
            this.setStatus(`Pitch: ${semitones >= 0 ? '+' : ''}${semitones.toFixed(1)} semitones (hold Shift for Hz mode)`);
        }

        // Update preview audio to reflect pitch changes
        this.updatePreviewAudio();

        this.render();
    }

    updateTimeDrag(x, y, useStretchMode = false) {
        if (!this.editDragStart || !this.editDragStartTimes) return;

        const dx = x - this.editDragStart.x;
        const width = this.interactionCanvas.width;

        if (useStretchMode) {
            // Time stretch mode (shift held): stretch/compress around anchor
            // 100 pixels = 2x or 0.5x stretch
            const factor = Math.pow(2, dx / 200);

            // Apply to all selected partials, anchored at center
            for (const partial of this.partials) {
                if (!this.selectedPartials.has(partial.id)) continue;

                const originalTimes = this.editDragStartTimes.get(partial.id);
                if (!originalTimes) continue;

                for (let i = 0; i < partial.points.length; i++) {
                    const originalTime = originalTimes[i];
                    partial.points[i].time = this.editDragAnchorTime + (originalTime - this.editDragAnchorTime) * factor;
                }
            }

            // Update status
            this.setStatus(`Time Stretch: ${factor.toFixed(2)}x (release Shift for move)`);
        } else {
            // Time move mode (default): shift partials horizontally
            // Convert pixel delta to time delta
            const timePerPixel = (this.viewEnd - this.viewStart) / width;
            const deltaTime = dx * timePerPixel;

            // Apply to all selected partials
            for (const partial of this.partials) {
                if (!this.selectedPartials.has(partial.id)) continue;

                const originalTimes = this.editDragStartTimes.get(partial.id);
                if (!originalTimes) continue;

                for (let i = 0; i < partial.points.length; i++) {
                    partial.points[i].time = originalTimes[i] + deltaTime;
                }
            }

            // Update status
            this.setStatus(`Time Move: ${deltaTime >= 0 ? '+' : ''}${deltaTime.toFixed(3)}s (hold Shift for stretch)`);
        }

        this.render();
    }

    finishEditDrag() {
        if (!this.editDragStart) return;

        // Check if anything actually changed
        let hasChanges = false;

        if (this.currentTool === 'pitch' && this.editDragStartFreqs) {
            for (const partial of this.partials) {
                if (!this.selectedPartials.has(partial.id)) continue;
                const originalFreqs = this.editDragStartFreqs.get(partial.id);
                if (originalFreqs && partial.points.some((p, i) => Math.abs(p.freq - originalFreqs[i]) > 0.01)) {
                    hasChanges = true;
                    break;
                }
            }
        } else if (this.currentTool === 'time' && this.editDragStartTimes) {
            for (const partial of this.partials) {
                if (!this.selectedPartials.has(partial.id)) continue;
                const originalTimes = this.editDragStartTimes.get(partial.id);
                if (originalTimes && partial.points.some((p, i) => Math.abs(p.time - originalTimes[i]) > 0.001)) {
                    hasChanges = true;
                    break;
                }
            }
        }

        if (hasChanges) {
            // Save state for undo - need to restore original values first, save, then reapply
            const currentState = this.partials.map(p => ({
                id: p.id,
                points: p.points.map(pt => ({ ...pt }))
            }));

            // Restore originals
            for (const partial of this.partials) {
                if (!this.selectedPartials.has(partial.id)) continue;

                if (this.currentTool === 'pitch') {
                    const originalFreqs = this.editDragStartFreqs.get(partial.id);
                    if (originalFreqs) {
                        for (let i = 0; i < partial.points.length; i++) {
                            partial.points[i].freq = originalFreqs[i];
                        }
                    }
                } else {
                    const originalTimes = this.editDragStartTimes.get(partial.id);
                    if (originalTimes) {
                        for (let i = 0; i < partial.points.length; i++) {
                            partial.points[i].time = originalTimes[i];
                        }
                    }
                }
            }

            // Save original state for undo
            this.saveState();

            // Reapply the changes
            for (const savedPartial of currentState) {
                const partial = this.partials.find(p => p.id === savedPartial.id);
                if (partial) {
                    partial.points = savedPartial.points;
                }
            }

            const action = this.currentTool === 'pitch' ? 'Pitch shifted' : 'Time stretched';
            this.notify(`${action} ${this.selectedPartials.size} partials`);
        }

        // Clear drag state
        this.editDragStart = null;
        this.editDragStartFreqs = null;
        this.editDragStartTimes = null;
        this.editDragAnchorTime = null;
        this.setStatus('Ready');

        // Stop preview audio when done editing
        this.stopPreviewAudio();
    }

    // Pitch shifting
    showPitchModal() {
        if (this.selectedPartials.size === 0) return;

        document.getElementById('pitchSemitones').value = 0;
        document.getElementById('pitchCents').value = 0;
        document.getElementById('pitchRatio').value = 1.0;

        this.showModal('pitchModal');
    }

    updatePitchRatio() {
        const semitones = parseFloat(document.getElementById('pitchSemitones').value) || 0;
        const cents = parseFloat(document.getElementById('pitchCents').value) || 0;
        const ratio = Math.pow(2, (semitones + cents / 100) / 12);
        document.getElementById('pitchRatio').value = ratio.toFixed(4);
    }

    applyPitchShift() {
        const ratio = parseFloat(document.getElementById('pitchRatio').value);

        if (isNaN(ratio) || ratio <= 0) {
            this.notify('Invalid pitch ratio', 'error');
            return;
        }

        this.saveState();

        for (const partial of this.partials) {
            if (!this.selectedPartials.has(partial.id)) continue;

            for (const point of partial.points) {
                point.freq *= ratio;
            }
        }

        this.hideModal('pitchModal');
        this.render();
        this.updateRenderedWaveform();

        const semitones = 12 * Math.log2(ratio);
        this.notify(`Pitch shifted ${this.selectedPartials.size} partials by ${semitones.toFixed(1)} semitones`);
    }

    // Time stretching
    showTimeModal() {
        if (this.selectedPartials.size === 0) return;

        document.getElementById('stretchFactor').value = 1.0;
        document.getElementById('stretchAnchor').value = 'start';

        this.showModal('timeModal');
    }

    applyTimeStretch() {
        const factor = parseFloat(document.getElementById('stretchFactor').value);
        const anchor = document.getElementById('stretchAnchor').value;

        if (isNaN(factor) || factor <= 0) {
            this.notify('Invalid stretch factor', 'error');
            return;
        }

        this.saveState();

        // Find anchor point
        let minTime = Infinity, maxTime = 0;
        for (const partial of this.partials) {
            if (!this.selectedPartials.has(partial.id)) continue;
            for (const point of partial.points) {
                if (point.time < minTime) minTime = point.time;
                if (point.time > maxTime) maxTime = point.time;
            }
        }

        let anchorTime;
        switch (anchor) {
            case 'start': anchorTime = minTime; break;
            case 'center': anchorTime = (minTime + maxTime) / 2; break;
            case 'end': anchorTime = maxTime; break;
        }

        for (const partial of this.partials) {
            if (!this.selectedPartials.has(partial.id)) continue;

            for (const point of partial.points) {
                point.time = anchorTime + (point.time - anchorTime) * factor;
            }
        }

        this.hideModal('timeModal');
        this.render();
        this.updateRenderedWaveform();

        this.notify(`Time stretched ${this.selectedPartials.size} partials by ${factor.toFixed(2)}x`);
    }

    // Playback
    togglePlayback() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    async play() {
        if (!this.audioBuffer || this.isPlaying) return;

        // Exit freeze mode when starting playback
        if (this.freezeMode) {
            this.freezeMode = false;
            document.getElementById('freezeBtn').classList.remove('active');
        }

        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        this.isPlaying = true;
        document.getElementById('playBtn').classList.add('playing');
        document.getElementById('playIcon').innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';

        // Synthesize from partials
        this.synthesizeAndPlay();
    }

    synthesizeAndPlay() {
        if (!this.isPlaying) return;

        const duration = this.duration;
        const sampleRate = this.audioContext.sampleRate;
        // Adjust output length for playback rate (slower = longer output)
        const outputDuration = duration / this.playbackRate;
        const numSamples = Math.floor(outputDuration * sampleRate);
        const audioBuffer = this.audioContext.createBuffer(1, numSamples, sampleRate);
        const data = audioBuffer.getChannelData(0);

        const twoPiOverSr = (2 * Math.PI) / sampleRate;

        // Envelope settings for click-free synthesis
        const attackSamples = Math.floor(sampleRate * 0.005);  // 5ms attack
        const releaseSamples = Math.floor(sampleRate * 0.005); // 5ms release

        // Time scaling factor - maps output samples to source time
        const timeScale = this.playbackRate;

        // Additive synthesis with proper phase accumulation and envelopes
        for (const partial of this.partials) {
            if (partial.points.length < 2) continue;

            // Calculate total partial duration for envelope (in output samples)
            const partialStartSample = Math.floor(partial.points[0].time / timeScale * sampleRate);
            const partialEndSample = Math.floor(partial.points[partial.points.length - 1].time / timeScale * sampleRate);

            // Initialize phase for this partial
            let phase = 0;
            let prevEndSample = -1;

            for (let i = 0; i < partial.points.length - 1; i++) {
                const p1 = partial.points[i];
                const p2 = partial.points[i + 1];

                // Scale times by playback rate (slower = stretched)
                const startSample = Math.floor(p1.time / timeScale * sampleRate);
                const endSample = Math.floor(p2.time / timeScale * sampleRate);

                // If there's a gap from previous segment, we need to handle phase
                if (prevEndSample >= 0 && startSample > prevEndSample) {
                    const gapSamples = startSample - prevEndSample;
                    phase += gapSamples * p1.freq * twoPiOverSr;
                }

                const segmentLength = endSample - startSample;
                if (segmentLength <= 0) continue;

                // Precompute frequency and amplitude deltas per sample
                // Frequencies stay the same (no pitch change)
                const freqDelta = (p2.freq - p1.freq) / segmentLength;
                const ampDbDelta = (p2.amplitude - p1.amplitude) / segmentLength;

                let currentFreq = p1.freq;
                let currentAmpDb = p1.amplitude;

                for (let s = startSample; s < endSample && s < numSamples; s++) {
                    if (s >= 0) {
                        // Convert dB to linear amplitude
                        let amp = Math.pow(10, currentAmpDb / 20) * 0.1;

                        // Apply attack/release envelope to prevent clicks
                        const sampleInPartial = s - partialStartSample;
                        const samplesFromEnd = partialEndSample - s;

                        // Attack envelope (fade in)
                        if (sampleInPartial >= 0 && sampleInPartial < attackSamples) {
                            const t = sampleInPartial / attackSamples;
                            amp *= 0.5 * (1 - Math.cos(Math.PI * t));
                        }

                        // Release envelope (fade out)
                        if (samplesFromEnd >= 0 && samplesFromEnd < releaseSamples) {
                            const t = samplesFromEnd / releaseSamples;
                            amp *= 0.5 * (1 - Math.cos(Math.PI * t));
                        }

                        // Output sample using accumulated phase
                        data[s] += amp * Math.sin(phase);
                    }

                    // Accumulate phase using instantaneous frequency (unchanged for pitch preservation)
                    phase += currentFreq * twoPiOverSr;

                    // Keep phase in reasonable range
                    if (phase > 2 * Math.PI) {
                        phase -= 2 * Math.PI * Math.floor(phase / (2 * Math.PI));
                    }

                    // Linear interpolation of frequency and amplitude
                    currentFreq += freqDelta;
                    currentAmpDb += ampDbDelta;
                }

                prevEndSample = endSample;
            }
        }

        // Add synthesized noise if enabled (time-stretched)
        if (this.noiseEnabled && this.noiseSpectralEnvelope && this.noiseSpectralEnvelope.length > 0) {
            const noiseSampleRate = this.audioBuffer.sampleRate;
            const hopSize = this.noiseHopSize || 512;
            const numBands = this.noiseNumBands || 64;
            const numFrames = this.noiseSpectralEnvelope.length;
            const frameDuration = hopSize / noiseSampleRate;
            const nyquist = noiseSampleRate / 2;

            // Pre-generate random phases for each band (for consistent noise character)
            const bandPhases = new Float32Array(numBands);
            for (let b = 0; b < numBands; b++) {
                bandPhases[b] = Math.random() * Math.PI * 2;
            }

            for (let i = 0; i < numSamples; i++) {
                // Map output sample to source time, then to frame
                const sourceTime = (i / sampleRate) * timeScale;
                const frameIdx = Math.floor(sourceTime / frameDuration);
                const frameFrac = (sourceTime / frameDuration) - frameIdx;

                if (frameIdx >= 0 && frameIdx < numFrames) {
                    const envelope = this.noiseSpectralEnvelope[frameIdx];
                    // Interpolate with next frame if available
                    const nextEnvelope = frameIdx + 1 < numFrames ?
                        this.noiseSpectralEnvelope[frameIdx + 1] : envelope;

                    // Synthesize filtered noise using band-limited oscillators with noise modulation
                    let noiseVal = 0;
                    for (let b = 0; b < numBands; b++) {
                        // Logarithmically spaced band center frequencies
                        const centerFreq = 20 * Math.pow(nyquist / 20, (b + 0.5) / numBands);

                        // Interpolate envelope between frames
                        const amp = envelope[b] * (1 - frameFrac) + nextEnvelope[b] * frameFrac;

                        // Generate band noise: sine with random phase modulation
                        const phase = bandPhases[b] + sourceTime * centerFreq * 2 * Math.PI;
                        const randomMod = (Math.random() - 0.5) * 0.5;
                        noiseVal += amp * Math.sin(phase + randomMod);

                        // Slowly drift band phases for more natural sound
                        bandPhases[b] += (Math.random() - 0.5) * 0.1;
                    }
                    data[i] += noiseVal * this.noiseMixLevel;
                }
            }
        }

        // Normalize
        let maxAmp = 0;
        for (let i = 0; i < numSamples; i++) {
            if (Math.abs(data[i]) > maxAmp) maxAmp = Math.abs(data[i]);
        }
        if (maxAmp > 0) {
            const scale = 0.9 / maxAmp;
            for (let i = 0; i < numSamples; i++) {
                data[i] *= scale;
            }
        }

        // Play (no playbackRate on source - we handled time scaling in synthesis)
        this.sourceNode = this.audioContext.createBufferSource();
        this.sourceNode.buffer = audioBuffer;

        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = this.masterVolume;

        // Set up analyser for level metering
        this.analyserNode = this.audioContext.createAnalyser();
        this.analyserNode.fftSize = 256;
        this.analyserNode.smoothingTimeConstant = 0.3;

        this.sourceNode.connect(this.gainNode);
        this.gainNode.connect(this.analyserNode);
        this.analyserNode.connect(this.audioContext.destination);

        // Start level metering
        this.startLevelMetering();

        // Calculate start position in the time-scaled buffer
        const scaledPosition = this.playbackPosition / this.playbackRate;
        this.startTime = this.audioContext.currentTime - scaledPosition;
        this.sourceNode.start(0, scaledPosition);

        this.sourceNode.onended = () => {
            if (this.isPlaying) {
                if (this.isLooping && this.selectedPartials.size > 0) {
                    // Loop selection
                    let minTime = Infinity;
                    for (const partial of this.partials) {
                        if (!this.selectedPartials.has(partial.id)) continue;
                        for (const point of partial.points) {
                            if (point.time < minTime) minTime = point.time;
                        }
                    }
                    this.playbackPosition = minTime;
                    this.synthesizeAndPlay();
                } else if (this.isLooping) {
                    this.playbackPosition = 0;
                    this.synthesizeAndPlay();
                } else {
                    this.stop();
                }
            }
        };

        this.startPlaybackAnimation();
    }

    pause() {
        if (!this.isPlaying) return;

        this.isPlaying = false;
        if (this.sourceNode) {
            this.playbackPosition = this.audioContext.currentTime - this.startTime;
            this.sourceNode.stop();
            this.sourceNode = null;
        }

        document.getElementById('playBtn').classList.remove('playing');
        document.getElementById('playIcon').innerHTML = '<path d="M8 5V19L19 12L8 5Z"/>';

        this.stopPlaybackAnimation();
    }

    stop() {
        this.pause();
        this.playbackPosition = 0;
        this.updateTimeDisplay();
        this.renderOverlay();
        this.renderTimeline();
    }

    seekTo(ratio) {
        const wasPlaying = this.isPlaying;
        if (wasPlaying) this.pause();

        this.playbackPosition = ratio * this.duration;
        this.updateTimeDisplay();
        this.renderOverlay();
        this.renderTimeline();

        if (wasPlaying) this.play();
    }

    playSelection() {
        if (this.selectedPartials.size === 0) return;

        let minTime = Infinity;
        for (const partial of this.partials) {
            if (!this.selectedPartials.has(partial.id)) continue;
            for (const point of partial.points) {
                if (point.time < minTime) minTime = point.time;
            }
        }

        this.playbackPosition = minTime;
        this.play();
    }

    toggleScrub() {
        this.isScrubbing = !this.isScrubbing;

        if (this.isScrubbing) {
            this.interactionCanvas.style.cursor = 'ew-resize';
        } else {
            this.interactionCanvas.style.cursor = this.currentTool === 'brush' ? 'none' : 'crosshair';
        }
    }

    scrubTo(time) {
        time = Math.max(0, Math.min(this.duration, time));
        this.playbackPosition = time;
        this.updateTimeDisplay();
        this.renderOverlay();
        this.renderTimeline();

        // Play a short snippet
        if (this.audioContext && this.audioBuffer) {
            if (this.scrubSource) {
                this.scrubSource.stop();
            }

            this.scrubSource = this.audioContext.createBufferSource();
            this.scrubSource.buffer = this.audioBuffer;

            const scrubGain = this.audioContext.createGain();
            scrubGain.gain.value = 0.5;

            this.scrubSource.connect(scrubGain);
            scrubGain.connect(this.audioContext.destination);

            this.scrubSource.start(0, time, 0.05);
        }
    }

    toggleLoop() {
        this.isLooping = !this.isLooping;
        document.getElementById('loopBtn').classList.toggle('active', this.isLooping);
        this.notify(this.isLooping ? 'Loop enabled' : 'Loop disabled');
    }

    startPlaybackAnimation() {
        const animate = () => {
            if (!this.isPlaying) return;

            this.playbackPosition = this.audioContext.currentTime - this.startTime;
            if (this.playbackPosition > this.duration) {
                this.playbackPosition = this.duration;
            }

            this.updateTimeDisplay();
            this.renderOverlay();
            this.renderTimeline();

            this.animationId = requestAnimationFrame(animate);
        };

        animate();
    }

    stopPlaybackAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.stopLevelMetering();
    }

    startLevelMetering() {
        const meterFill = document.getElementById('levelMeterFill');
        const meterPeak = document.getElementById('levelMeterPeak');

        const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
        let peakHoldValue = 0;
        let peakDecayCounter = 0;

        const updateMeter = () => {
            if (!this.isPlaying || !this.analyserNode) {
                meterFill.style.width = '0%';
                meterPeak.style.left = '0%';
                return;
            }

            this.analyserNode.getByteTimeDomainData(dataArray);

            // Calculate RMS level
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                const sample = (dataArray[i] - 128) / 128;
                sum += sample * sample;
            }
            const rms = Math.sqrt(sum / dataArray.length);

            // Convert to percentage (with some scaling for visual appeal)
            const level = Math.min(100, rms * 300);

            // Update fill
            meterFill.style.width = `${level}%`;

            // Peak hold logic
            if (level > peakHoldValue) {
                peakHoldValue = level;
                peakDecayCounter = 30; // Hold for ~0.5 seconds
            } else if (peakDecayCounter > 0) {
                peakDecayCounter--;
            } else {
                peakHoldValue = Math.max(level, peakHoldValue - 2);
            }

            meterPeak.style.left = `${peakHoldValue}%`;

            this.meterAnimationId = requestAnimationFrame(updateMeter);
        };

        updateMeter();
    }

    stopLevelMetering() {
        if (this.meterAnimationId) {
            cancelAnimationFrame(this.meterAnimationId);
            this.meterAnimationId = null;
        }
        // Reset meter display
        const meterFill = document.getElementById('levelMeterFill');
        const meterPeak = document.getElementById('levelMeterPeak');
        if (meterFill) meterFill.style.width = '0%';
        if (meterPeak) meterPeak.style.left = '0%';
    }

    updateTimeDisplay() {
        document.getElementById('timeDisplay').textContent = this.formatTime(this.playbackPosition);
        document.getElementById('playbackPosition').value = (this.playbackPosition / this.duration) * 100;
    }

    // Project Save/Load
    saveProject() {
        if (this.partials.length === 0) {
            this.notify('No partials to save');
            return;
        }

        const project = {
            version: 1,
            fileName: this.fileName,
            duration: this.duration,
            sampleRate: this.audioBuffer ? this.audioBuffer.sampleRate : 44100,
            partials: this.partials,
            nextPartialId: this.nextPartialId,
            settings: {
                fftSize: this.fftSize,
                hopSize: this.hopSize,
                windowType: this.windowType,
                minAmplitude: this.minAmplitude,
                maxPartials: this.maxPartials,
                freqMin: this.freqMin,
                freqMax: this.freqMax,
                freqScale: this.freqScale,
                viewStart: this.viewStart,
                viewEnd: this.viewEnd,
                quantBpm: this.quantBpm,
                quantBeatDivision: this.quantBeatDivision,
                quantRootNote: this.quantRootNote,
                quantScale: this.quantScale
            },
            noiseSpectralEnvelope: this.noiseSpectralEnvelope,
            noiseFftSize: this.noiseFftSize,
            noiseHopSize: this.noiseHopSize,
            noiseNumBands: this.noiseNumBands
        };

        const json = JSON.stringify(project);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (this.fileName || 'project').replace(/\.[^.]+$/, '') + '.spectra';
        a.click();
        URL.revokeObjectURL(url);

        this.notify('Project saved');
    }

    loadProject() {
        const input = document.getElementById('projectFileInput');
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const project = JSON.parse(event.target.result);
                    this.applyProject(project);
                } catch (err) {
                    this.notify('Error loading project: ' + err.message);
                }
            };
            reader.readAsText(file);
            input.value = '';
        };
        input.click();
    }

    applyProject(project) {
        if (!project.partials) {
            this.notify('Invalid project file');
            return;
        }

        this.partials = project.partials;
        this.nextPartialId = project.nextPartialId || this.partials.length + 1;
        this.duration = project.duration || 1;
        this.fileName = project.fileName || 'Loaded Project';

        // Apply settings
        if (project.settings) {
            const s = project.settings;
            if (s.fftSize) this.fftSize = s.fftSize;
            if (s.hopSize) this.hopSize = s.hopSize;
            if (s.windowType) this.windowType = s.windowType;
            if (s.minAmplitude) this.minAmplitude = s.minAmplitude;
            if (s.maxPartials) this.maxPartials = s.maxPartials;
            if (s.freqMin) this.freqMin = s.freqMin;
            if (s.freqMax) this.freqMax = s.freqMax;
            if (s.freqScale) this.freqScale = s.freqScale;
            if (s.viewStart !== undefined) this.viewStart = s.viewStart;
            if (s.viewEnd !== undefined) this.viewEnd = s.viewEnd;
            if (s.quantBpm) this.quantBpm = s.quantBpm;
            if (s.quantBeatDivision) this.quantBeatDivision = s.quantBeatDivision;
            if (s.quantRootNote !== undefined) this.quantRootNote = s.quantRootNote;
            if (s.quantScale) this.quantScale = s.quantScale;
        }

        // Apply noise data if present
        if (project.noiseSpectralEnvelope) {
            this.noiseSpectralEnvelope = project.noiseSpectralEnvelope;
            this.noiseFftSize = project.noiseFftSize;
            this.noiseHopSize = project.noiseHopSize;
            this.noiseNumBands = project.noiseNumBands;
        }

        // Recalculate duration based on partials (in case they extend beyond original)
        this.recalculateDuration();

        // Update UI
        document.getElementById('exportBtn').disabled = false;
        document.getElementById('saveProjectBtn').disabled = false;

        this.selectedPartials.clear();
        this.viewStart = 0;
        this.viewEnd = this.duration;
        this.render();
        this.updateRenderedWaveform();
        this.updateSelectionInfo();
        this.updateDurationDisplay();
        this.setStatus(`Loaded project: ${this.partials.length} partials`);
        this.notify('Project loaded successfully');
    }

    // Export
    showExportModal() {
        if (!this.audioBuffer) return;
        this.showModal('exportModal');
    }

    async exportAudio() {
        const format = document.getElementById('exportFormat').value;
        const sampleRate = parseInt(document.getElementById('exportSampleRate').value);
        const range = document.getElementById('exportRange').value;
        const shouldNormalize = document.getElementById('exportNormalize').checked;
        const includeNoise = document.getElementById('exportNoise').checked;

        this.hideModal('exportModal');
        this.setStatus('Synthesizing audio...');

        // Create offline audio context
        let duration = this.duration;
        let startTime = 0;

        if (range === 'selection' && this.selectedPartials.size > 0) {
            let minTime = Infinity, maxTime = 0;
            for (const partial of this.partials) {
                if (!this.selectedPartials.has(partial.id)) continue;
                for (const point of partial.points) {
                    if (point.time < minTime) minTime = point.time;
                    if (point.time > maxTime) maxTime = point.time;
                }
            }
            startTime = minTime;
            duration = maxTime - minTime;
        }

        const numSamples = Math.floor(duration * sampleRate);
        const data = new Float32Array(numSamples);

        const twoPiOverSr = (2 * Math.PI) / sampleRate;

        // Envelope settings for click-free synthesis
        const attackSamples = Math.floor(sampleRate * 0.005);  // 5ms attack
        const releaseSamples = Math.floor(sampleRate * 0.005); // 5ms release

        // Synthesize with proper phase accumulation and envelopes
        const partialsToRender = range === 'selection' ?
            this.partials.filter(p => this.selectedPartials.has(p.id)) :
            this.partials;

        for (const partial of partialsToRender) {
            if (partial.points.length < 2) continue;

            // Calculate partial boundaries for envelope (relative to startTime)
            const partialStartSample = Math.floor((partial.points[0].time - startTime) * sampleRate);
            const partialEndSample = Math.floor((partial.points[partial.points.length - 1].time - startTime) * sampleRate);

            // Initialize phase for this partial
            let phase = 0;
            let prevEndSample = -1;

            for (let i = 0; i < partial.points.length - 1; i++) {
                const p1 = partial.points[i];
                const p2 = partial.points[i + 1];

                const segStartSample = Math.floor((p1.time - startTime) * sampleRate);
                const segEndSample = Math.floor((p2.time - startTime) * sampleRate);

                // Handle phase continuity through gaps
                if (prevEndSample >= 0 && segStartSample > prevEndSample) {
                    const gapSamples = segStartSample - prevEndSample;
                    phase += gapSamples * p1.freq * twoPiOverSr;
                }

                const segmentLength = segEndSample - segStartSample;
                if (segmentLength <= 0) continue;

                const freqDelta = (p2.freq - p1.freq) / segmentLength;
                const ampDbDelta = (p2.amplitude - p1.amplitude) / segmentLength;

                let currentFreq = p1.freq;
                let currentAmpDb = p1.amplitude;

                // Handle partial starting before our render window
                const actualStart = Math.max(0, segStartSample);
                if (actualStart > segStartSample) {
                    const skipSamples = actualStart - segStartSample;
                    // Advance phase and interpolation for skipped samples
                    for (let skip = 0; skip < skipSamples; skip++) {
                        phase += currentFreq * twoPiOverSr;
                        currentFreq += freqDelta;
                        currentAmpDb += ampDbDelta;
                    }
                    if (phase > 2 * Math.PI) {
                        phase -= 2 * Math.PI * Math.floor(phase / (2 * Math.PI));
                    }
                }

                for (let s = actualStart; s < segEndSample && s < numSamples; s++) {
                    let amp = Math.pow(10, currentAmpDb / 20) * 0.1;

                    // Apply attack/release envelope to prevent clicks
                    const sampleInPartial = s - partialStartSample;
                    const samplesFromEnd = partialEndSample - s;

                    // Attack envelope (fade in)
                    if (sampleInPartial >= 0 && sampleInPartial < attackSamples) {
                        const t = sampleInPartial / attackSamples;
                        amp *= 0.5 * (1 - Math.cos(Math.PI * t));
                    }

                    // Release envelope (fade out)
                    if (samplesFromEnd >= 0 && samplesFromEnd < releaseSamples) {
                        const t = samplesFromEnd / releaseSamples;
                        amp *= 0.5 * (1 - Math.cos(Math.PI * t));
                    }

                    data[s] += amp * Math.sin(phase);

                    // Accumulate phase
                    phase += currentFreq * twoPiOverSr;
                    if (phase > 2 * Math.PI) {
                        phase -= 2 * Math.PI * Math.floor(phase / (2 * Math.PI));
                    }

                    currentFreq += freqDelta;
                    currentAmpDb += ampDbDelta;
                }

                prevEndSample = segEndSample;
            }
        }

        // Add synthesized noise if enabled
        if (includeNoise && this.noiseSpectralEnvelope && this.noiseSpectralEnvelope.length > 0) {
            const noiseSampleRate = this.audioBuffer.sampleRate;
            const hopSize = this.noiseHopSize || 512;
            const numBands = this.noiseNumBands || 64;
            const numFrames = this.noiseSpectralEnvelope.length;
            const frameDuration = hopSize / noiseSampleRate;
            const nyquist = noiseSampleRate / 2;

            // Pre-generate random phases for each band
            const bandPhases = new Float32Array(numBands);
            for (let b = 0; b < numBands; b++) {
                bandPhases[b] = Math.random() * Math.PI * 2;
            }

            for (let i = 0; i < numSamples; i++) {
                // Map output sample to source time, then to frame
                const outputTime = i / sampleRate;
                const sourceTime = startTime + outputTime;
                const frameIdx = Math.floor(sourceTime / frameDuration);
                const frameFrac = (sourceTime / frameDuration) - frameIdx;

                if (frameIdx >= 0 && frameIdx < numFrames) {
                    const envelope = this.noiseSpectralEnvelope[frameIdx];
                    const nextEnvelope = frameIdx + 1 < numFrames ?
                        this.noiseSpectralEnvelope[frameIdx + 1] : envelope;

                    // Synthesize filtered noise using band-limited oscillators
                    let noiseVal = 0;
                    for (let b = 0; b < numBands; b++) {
                        // Logarithmically spaced band center frequencies
                        const centerFreq = 20 * Math.pow(nyquist / 20, (b + 0.5) / numBands);

                        // Interpolate envelope between frames
                        const amp = envelope[b] * (1 - frameFrac) + nextEnvelope[b] * frameFrac;

                        // Generate band noise with random phase modulation
                        const phase = bandPhases[b] + sourceTime * centerFreq * 2 * Math.PI;
                        const randomMod = (Math.random() - 0.5) * 0.5;
                        noiseVal += amp * Math.sin(phase + randomMod);

                        bandPhases[b] += (Math.random() - 0.5) * 0.1;
                    }
                    data[i] += noiseVal * this.noiseMixLevel;
                }
            }
        }

        // Normalize (optionally)
        if (shouldNormalize) {
            let maxAmp = 0;
            for (let i = 0; i < numSamples; i++) {
                if (Math.abs(data[i]) > maxAmp) maxAmp = Math.abs(data[i]);
            }
            if (maxAmp > 0) {
                const scale = 0.9 / maxAmp;
                for (let i = 0; i < numSamples; i++) {
                    data[i] *= scale;
                }
            }
        }

        // Create WAV file
        const wav = this.createWavFile(data, sampleRate);

        // Download
        const blob = new Blob([wav], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (this.fileName || 'audio').replace(/\.[^.]+$/, '') + '_resynthesis.wav';
        a.click();
        URL.revokeObjectURL(url);

        this.setStatus('Export complete');
        this.notify('Audio exported successfully');
    }

    createWavFile(samples, sampleRate) {
        const numChannels = 1;
        const bitsPerSample = 16;
        const bytesPerSample = bitsPerSample / 8;
        const blockAlign = numChannels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        const dataSize = samples.length * bytesPerSample;
        const fileSize = 36 + dataSize;

        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);

        // RIFF header
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, fileSize, true);
        this.writeString(view, 8, 'WAVE');

        // fmt chunk
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitsPerSample, true);

        // data chunk
        this.writeString(view, 36, 'data');
        view.setUint32(40, dataSize, true);

        // Write samples
        let offset = 44;
        for (let i = 0; i < samples.length; i++) {
            const sample = Math.max(-1, Math.min(1, samples[i]));
            view.setInt16(offset, sample * 0x7FFF, true);
            offset += 2;
        }

        return buffer;
    }

    writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    // Context menu
    showContextMenu(e) {
        e.preventDefault();

        const menu = document.getElementById('contextMenu');
        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';
        menu.classList.add('active');

        // Update menu state
        const hasSelection = this.selectedPartials.size > 0;
        document.getElementById('ctxDelete').classList.toggle('disabled', !hasSelection);
        document.getElementById('ctxCopy').classList.toggle('disabled', !hasSelection);
        document.getElementById('ctxPaste').classList.toggle('disabled', this.clipboard.length === 0);
        document.getElementById('ctxPitchShift').classList.toggle('disabled', !hasSelection);
        document.getElementById('ctxTimeStretch').classList.toggle('disabled', !hasSelection);
        document.getElementById('ctxPlaySelection').classList.toggle('disabled', !hasSelection);
    }

    hideContextMenu() {
        document.getElementById('contextMenu').classList.remove('active');
    }

    // Modal helpers
    showModal(id) {
        document.getElementById(id).classList.add('active');
    }

    hideModal(id) {
        document.getElementById(id).classList.remove('active');
    }

    hideAllModals() {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    }

    // Utility functions
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toFixed(3).padStart(6, '0')}`;
    }

    calculateGridStep(range) {
        const steps = [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10, 30, 60];
        for (const step of steps) {
            if (range / step <= 20) return step;
        }
        return 60;
    }

    generateLinearSteps(min, max, count) {
        const step = (max - min) / count;
        const steps = [];
        for (let i = 0; i <= count; i++) {
            steps.push(min + i * step);
        }
        return steps;
    }

    setStatus(text) {
        document.getElementById('statusText').textContent = text;
    }

    setAnalysisProgress(percent, text) {
        document.getElementById('analysisProgress').style.width = percent + '%';
        document.getElementById('analysisStatus').textContent = text;
    }

    notify(message, type = 'info') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.classList.add('active');

        setTimeout(() => {
            notification.classList.remove('active');
        }, 3000);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ==================== EQ Curve Methods ====================

    setupEqCurve() {
        this.eqCurveCanvas = document.getElementById('eqCurveCanvas');
        this.eqCurveCtx = this.eqCurveCanvas.getContext('2d');

        // Set up canvas size
        const rect = this.eqCurveCanvas.parentElement.getBoundingClientRect();
        this.eqCurveCanvas.width = rect.width;
        this.eqCurveCanvas.height = rect.height;

        // Initialize flat curve
        this.flattenEqCurve();

        // Mouse events for drawing
        this.eqCurveCanvas.addEventListener('mousedown', (e) => {
            this.isDrawingEqCurve = true;
            this.updateEqCurvePoint(e);
        });

        this.eqCurveCanvas.addEventListener('mousemove', (e) => {
            if (this.isDrawingEqCurve) {
                this.updateEqCurvePoint(e);
            }
        });

        this.eqCurveCanvas.addEventListener('mouseup', () => {
            this.isDrawingEqCurve = false;
        });

        this.eqCurveCanvas.addEventListener('mouseleave', () => {
            this.isDrawingEqCurve = false;
        });

        // Handle resize
        window.addEventListener('resize', () => {
            const rect = this.eqCurveCanvas.parentElement.getBoundingClientRect();
            this.eqCurveCanvas.width = rect.width;
            this.eqCurveCanvas.height = rect.height;
            this.renderEqCurve();
        });
    }

    updateEqCurvePoint(e) {
        const rect = this.eqCurveCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const width = this.eqCurveCanvas.width;
        const height = this.eqCurveCanvas.height;

        // X maps to frequency (log scale from 20Hz to 20000Hz)
        const minFreq = 20;
        const maxFreq = 20000;
        const freqRatio = x / width;
        const freq = minFreq * Math.pow(maxFreq / minFreq, freqRatio);

        // Y maps to gain (-24dB at bottom to +24dB at top)
        const gain = 24 - (y / height) * 48;

        // Find and update nearest point or add new one
        const freqIndex = Math.round(freqRatio * (this.eqCurvePoints.length - 1));
        if (freqIndex >= 0 && freqIndex < this.eqCurvePoints.length) {
            this.eqCurvePoints[freqIndex].gain = Math.max(-24, Math.min(24, gain));
        }

        // Smooth neighboring points for better curve
        const smoothRadius = 3;
        for (let i = Math.max(0, freqIndex - smoothRadius); i <= Math.min(this.eqCurvePoints.length - 1, freqIndex + smoothRadius); i++) {
            if (i !== freqIndex) {
                const distance = Math.abs(i - freqIndex);
                const weight = 1 - distance / (smoothRadius + 1);
                const targetGain = Math.max(-24, Math.min(24, gain));
                this.eqCurvePoints[i].gain = this.eqCurvePoints[i].gain * (1 - weight * 0.5) + targetGain * weight * 0.5;
            }
        }

        this.renderEqCurve();
    }

    flattenEqCurve() {
        // Create 64 points across the frequency range
        const numPoints = 64;
        const minFreq = 20;
        const maxFreq = 20000;

        this.eqCurvePoints = [];
        for (let i = 0; i < numPoints; i++) {
            const ratio = i / (numPoints - 1);
            const freq = minFreq * Math.pow(maxFreq / minFreq, ratio);
            this.eqCurvePoints.push({ freq, gain: 0 });
        }

        this.renderEqCurve();
    }

    renderEqCurve() {
        if (!this.eqCurveCtx) return;

        const ctx = this.eqCurveCtx;
        const width = this.eqCurveCanvas.width;
        const height = this.eqCurveCanvas.height;

        // Clear
        ctx.fillStyle = '#0a0a14';
        ctx.fillRect(0, 0, width, height);

        // Draw grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;

        // Horizontal grid (gain)
        for (let db = -24; db <= 24; db += 6) {
            const y = height * (1 - (db + 24) / 48);
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Center line (0dB)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();

        // Vertical grid (frequency decades)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        const freqs = [100, 1000, 10000];
        for (const f of freqs) {
            const x = width * Math.log(f / 20) / Math.log(20000 / 20);
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        // Draw curve
        if (this.eqCurvePoints.length > 0) {
            ctx.strokeStyle = '#e94560';
            ctx.lineWidth = 2;
            ctx.beginPath();

            for (let i = 0; i < this.eqCurvePoints.length; i++) {
                const point = this.eqCurvePoints[i];
                const x = width * Math.log(point.freq / 20) / Math.log(20000 / 20);
                const y = height * (1 - (point.gain + 24) / 48);

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();

            // Fill area
            ctx.fillStyle = 'rgba(233, 69, 96, 0.2)';
            ctx.beginPath();
            ctx.moveTo(0, height / 2);
            for (let i = 0; i < this.eqCurvePoints.length; i++) {
                const point = this.eqCurvePoints[i];
                const x = width * Math.log(point.freq / 20) / Math.log(20000 / 20);
                const y = height * (1 - (point.gain + 24) / 48);
                ctx.lineTo(x, y);
            }
            ctx.lineTo(width, height / 2);
            ctx.closePath();
            ctx.fill();
        }
    }

    getEqGainAtFreq(freq) {
        if (this.eqCurvePoints.length === 0) return 0;

        // Find surrounding points and interpolate
        for (let i = 0; i < this.eqCurvePoints.length - 1; i++) {
            if (freq >= this.eqCurvePoints[i].freq && freq <= this.eqCurvePoints[i + 1].freq) {
                const ratio = (freq - this.eqCurvePoints[i].freq) /
                             (this.eqCurvePoints[i + 1].freq - this.eqCurvePoints[i].freq);
                return this.eqCurvePoints[i].gain + ratio * (this.eqCurvePoints[i + 1].gain - this.eqCurvePoints[i].gain);
            }
        }

        // Extrapolate
        if (freq < this.eqCurvePoints[0].freq) return this.eqCurvePoints[0].gain;
        return this.eqCurvePoints[this.eqCurvePoints.length - 1].gain;
    }

    applyEqCurve() {
        // Determine which partials to affect - selected or all
        const targetPartials = this.selectedPartials.size > 0
            ? this.partials.filter(p => this.selectedPartials.has(p.id))
            : this.partials;

        if (targetPartials.length === 0) {
            this.notify('No partials to apply EQ to');
            return;
        }

        // Check if curve is flat (no changes)
        const hasChanges = this.eqCurvePoints.some(p => Math.abs(p.gain) > 0.1);
        if (!hasChanges) {
            this.notify('EQ curve is flat - no changes to apply');
            return;
        }

        this.saveState();
        let pointsAffected = 0;

        for (const partial of targetPartials) {
            for (const point of partial.points) {
                const gain = this.getEqGainAtFreq(point.freq);
                if (Math.abs(gain) > 0.1) {
                    point.amplitude += gain;
                    pointsAffected++;
                }
            }
        }

        // Update rendered waveform preview
        this.updateRenderedWaveform();

        this.render();
        const targetText = this.selectedPartials.size > 0 ? 'selected partials' : 'all partials';
        this.notify(`Applied EQ curve to ${pointsAffected} points (${targetText})`);
    }

    // ==================== Freeze Frame Methods ====================

    toggleFreezeMode() {
        this.freezeMode = !this.freezeMode;
        const freezeBtn = document.getElementById('freezeBtn');
        freezeBtn.classList.toggle('active', this.freezeMode);

        if (this.freezeMode) {
            // Stop any current playback when entering freeze mode
            if (this.isPlaying) {
                this.pause();
            }

            // Calculate current frame based on playback position
            const sampleRate = this.audioContext ? this.audioContext.sampleRate : 44100;
            this.currentFrame = Math.floor(this.playbackPosition * sampleRate / this.hopSize);
            this.frameTime = this.currentFrame * this.hopSize / sampleRate;
            this.playbackPosition = this.frameTime;

            // Update display but don't auto-play (user can step to hear frames)
            this.updateTimeDisplay();
            this.renderOverlay();
            this.renderTimeline();
            this.notify(`Freeze mode ON - Frame ${this.currentFrame} (use step buttons to preview)`);
        } else {
            this.notify('Freeze mode OFF');
        }

        this.render();
    }

    stepFrame(direction) {
        if (!this.freezeMode || !this.audioBuffer) return;

        const sampleRate = this.audioContext ? this.audioContext.sampleRate : 44100;
        const totalFrames = Math.floor(this.duration * sampleRate / this.hopSize);
        this.currentFrame = Math.max(0, Math.min(totalFrames - 1, this.currentFrame + direction));
        this.frameTime = this.currentFrame * this.hopSize / sampleRate;
        this.playbackPosition = this.frameTime;

        this.updateTimeDisplay();
        this.renderFreezeFrame();
        this.renderOverlay();
        this.renderTimeline();
        this.notify(`Frame ${this.currentFrame} / ${totalFrames} (${this.frameTime.toFixed(3)}s)`);
    }

    renderFreezeFrame() {
        if (!this.freezeMode) return;

        // Ensure audio context exists
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        // Play a very short synthesis of just this frame
        const framePartials = [];
        const sampleRate = this.audioContext.sampleRate;

        for (const partial of this.partials) {
            // Find points near this frame time
            for (let i = 0; i < partial.points.length; i++) {
                const point = partial.points[i];
                if (Math.abs(point.time - this.frameTime) < this.hopSize / sampleRate * 2) {
                    framePartials.push({
                        freq: point.freq,
                        amp: Math.pow(10, point.amplitude / 20)
                    });
                    break;
                }
            }
        }

        // Create short audio buffer for this frame
        const frameDuration = 0.1;  // 100ms preview
        const numSamples = Math.floor(frameDuration * sampleRate);
        const buffer = this.audioContext.createBuffer(1, numSamples, sampleRate);
        const data = buffer.getChannelData(0);

        // Synthesize frame
        for (const p of framePartials) {
            const twoPi = 2 * Math.PI;
            for (let i = 0; i < numSamples; i++) {
                // Fade in/out envelope
                const env = Math.sin(Math.PI * i / numSamples);
                data[i] += p.amp * Math.sin(twoPi * p.freq * i / sampleRate) * env * 0.3;
            }
        }

        // Normalize
        let max = 0;
        for (let i = 0; i < numSamples; i++) {
            if (Math.abs(data[i]) > max) max = Math.abs(data[i]);
        }
        if (max > 0) {
            for (let i = 0; i < numSamples; i++) {
                data[i] *= 0.8 / max;
            }
        }

        // Play
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioContext.destination);
        source.start();
    }

    // ==================== Noise Analysis Methods ====================

    analyzeNoise() {
        if (!this.audioBuffer) return;

        this.setStatus('Analyzing noise residual...');

        // Get original audio data
        const channelData = this.audioBuffer.getChannelData(0);
        const sampleRate = this.audioBuffer.sampleRate;
        const numSamples = channelData.length;

        // Synthesize sinusoidal component
        const sinusoidal = new Float32Array(numSamples);
        const twoPi = 2 * Math.PI;

        for (const partial of this.partials) {
            if (partial.points.length < 2) continue;

            for (let i = 0; i < partial.points.length - 1; i++) {
                const p1 = partial.points[i];
                const p2 = partial.points[i + 1];

                const startSample = Math.floor(p1.time * sampleRate);
                const endSample = Math.floor(p2.time * sampleRate);

                if (endSample <= startSample) continue;

                const numSegmentSamples = endSample - startSample;
                let phase = 0;
                let currentFreq = p1.freq;
                let currentAmpDb = p1.amplitude;

                const freqDelta = (p2.freq - p1.freq) / numSegmentSamples;
                const ampDbDelta = (p2.amplitude - p1.amplitude) / numSegmentSamples;

                for (let j = 0; j < numSegmentSamples && startSample + j < numSamples; j++) {
                    const amp = Math.pow(10, currentAmpDb / 20);
                    sinusoidal[startSample + j] += amp * Math.sin(phase);
                    phase += currentFreq * twoPi / sampleRate;
                    currentFreq += freqDelta;
                    currentAmpDb += ampDbDelta;
                }
            }
        }

        // Calculate residual (original - sinusoidal)
        const residual = new Float32Array(numSamples);
        for (let i = 0; i < numSamples; i++) {
            residual[i] = channelData[i] - sinusoidal[i];
        }

        // Compute spectral envelope of residual using STFT
        const fftSize = 2048;
        const hopSize = fftSize / 4;
        const numBands = 64;  // Number of spectral bands to track
        const numFrames = Math.floor((numSamples - fftSize) / hopSize) + 1;

        this.noiseSpectralEnvelope = [];
        const window = this.createHannWindow(fftSize);

        for (let frame = 0; frame < numFrames; frame++) {
            const startIdx = frame * hopSize;
            const endIdx = Math.min(startIdx + fftSize, numSamples);

            // Apply window and get frame data
            const frameData = new Float32Array(fftSize);
            for (let i = 0; i < fftSize && startIdx + i < numSamples; i++) {
                frameData[i] = residual[startIdx + i] * window[i];
            }

            // Simple DFT for spectral analysis (using fewer bins for efficiency)
            const bandEnergies = new Float32Array(numBands);
            const nyquist = sampleRate / 2;

            for (let band = 0; band < numBands; band++) {
                // Logarithmically spaced bands from 20Hz to Nyquist
                const lowFreq = 20 * Math.pow(nyquist / 20, band / numBands);
                const highFreq = 20 * Math.pow(nyquist / 20, (band + 1) / numBands);
                const centerFreq = (lowFreq + highFreq) / 2;

                // DFT at center frequency
                let realSum = 0, imagSum = 0;
                const omega = twoPi * centerFreq / sampleRate;
                for (let i = 0; i < fftSize; i++) {
                    realSum += frameData[i] * Math.cos(omega * i);
                    imagSum += frameData[i] * Math.sin(omega * i);
                }
                const magnitude = Math.sqrt(realSum * realSum + imagSum * imagSum) / fftSize;
                bandEnergies[band] = magnitude;
            }

            this.noiseSpectralEnvelope.push(bandEnergies);
        }

        // Store parameters for synthesis
        this.noiseFftSize = fftSize;
        this.noiseHopSize = hopSize;
        this.noiseNumBands = numBands;

        this.noiseEnabled = true;
        document.getElementById('noiseEnabled').checked = true;

        // Calculate and display noise level
        const rms = this.calculateRMS(residual);
        const rmsDb = 20 * Math.log10(Math.max(rms, 1e-10));
        document.getElementById('noiseLevel').textContent = `${rmsDb.toFixed(1)} dB`;

        this.setStatus(`Noise analysis complete. ${numFrames} frames analyzed.`);
        this.notify('Noise spectral envelope analyzed');
    }

    createHannWindow(size) {
        const window = new Float32Array(size);
        for (let i = 0; i < size; i++) {
            window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (size - 1)));
        }
        return window;
    }

    calculateRMS(data) {
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            sum += data[i] * data[i];
        }
        return Math.sqrt(sum / data.length);
    }

    // ==================== Rendered Waveform Preview ====================

    updateRenderedWaveform() {
        if (!this.duration || this.partials.length === 0) {
            this.renderedWaveform = null;
            this.renderWaveform();
            return;
        }

        // Render full duration (like original waveform)
        const fullDuration = this.duration;

        if (fullDuration <= 0) return;

        // Use lower resolution for preview
        const previewSampleRate = 8000;  // Lower sample rate for quick preview
        const numSamples = Math.floor(fullDuration * previewSampleRate);

        if (numSamples <= 0) return;

        this.renderedWaveform = new Float32Array(numSamples);
        const twoPi = 2 * Math.PI;

        // Synthesize all partials
        for (const partial of this.partials) {
            if (partial.points.length < 2) continue;

            for (let i = 0; i < partial.points.length - 1; i++) {
                const p1 = partial.points[i];
                const p2 = partial.points[i + 1];

                const startSample = Math.floor(p1.time * previewSampleRate);
                const endSample = Math.floor(p2.time * previewSampleRate);

                if (endSample <= startSample) continue;

                const numSegSamples = endSample - startSample;
                const freqDelta = (p2.freq - p1.freq) / numSegSamples;
                const ampDbDelta = (p2.amplitude - p1.amplitude) / numSegSamples;

                let currentFreq = p1.freq;
                let currentAmpDb = p1.amplitude;

                let phase = 0;
                for (let j = 0; j < numSegSamples && startSample + j < numSamples; j++) {
                    const amp = Math.pow(10, currentAmpDb / 20);
                    this.renderedWaveform[startSample + j] += amp * Math.sin(phase);
                    phase += currentFreq * twoPi / previewSampleRate;
                    currentFreq += freqDelta;
                    currentAmpDb += ampDbDelta;
                }
            }
        }

        // Add synthesized noise if enabled
        if (this.noiseEnabled && this.noiseSpectralEnvelope && this.noiseSpectralEnvelope.length > 0) {
            const noiseSampleRate = this.audioBuffer.sampleRate;
            const hopSize = this.noiseHopSize || 512;
            const numBands = this.noiseNumBands || 64;
            const numFrames = this.noiseSpectralEnvelope.length;
            const frameDuration = hopSize / noiseSampleRate;
            const nyquist = noiseSampleRate / 2;

            // Pre-generate random phases for each band
            const bandPhases = new Float32Array(numBands);
            for (let b = 0; b < numBands; b++) {
                bandPhases[b] = Math.random() * Math.PI * 2;
            }

            for (let i = 0; i < numSamples; i++) {
                const sourceTime = i / previewSampleRate;
                const frameIdx = Math.floor(sourceTime / frameDuration);
                const frameFrac = (sourceTime / frameDuration) - frameIdx;

                if (frameIdx >= 0 && frameIdx < numFrames) {
                    const envelope = this.noiseSpectralEnvelope[frameIdx];
                    const nextEnvelope = frameIdx + 1 < numFrames ?
                        this.noiseSpectralEnvelope[frameIdx + 1] : envelope;

                    let noiseVal = 0;
                    for (let b = 0; b < numBands; b++) {
                        const centerFreq = 20 * Math.pow(nyquist / 20, (b + 0.5) / numBands);
                        const amp = envelope[b] * (1 - frameFrac) + nextEnvelope[b] * frameFrac;
                        const phase = bandPhases[b] + sourceTime * centerFreq * twoPi;
                        const randomMod = (Math.random() - 0.5) * 0.5;
                        noiseVal += amp * Math.sin(phase + randomMod);
                        bandPhases[b] += (Math.random() - 0.5) * 0.1;
                    }
                    this.renderedWaveform[i] += noiseVal * this.noiseMixLevel;
                }
            }
        }

        // Normalize
        let maxAmp = 0;
        for (let i = 0; i < numSamples; i++) {
            if (Math.abs(this.renderedWaveform[i]) > maxAmp) {
                maxAmp = Math.abs(this.renderedWaveform[i]);
            }
        }
        if (maxAmp > 0) {
            for (let i = 0; i < numSamples; i++) {
                this.renderedWaveform[i] /= maxAmp;
            }
        }

        this.renderWaveform();
    }

    // ==================== Select by Criteria Methods ====================

    selectByCriteria() {
        const mode = document.getElementById('criteriaMode').value;
        const freqEnabled = document.getElementById('criteriaFreqEnabled').checked;
        const freqMin = parseFloat(document.getElementById('criteriaFreqMin').value);
        const freqMax = parseFloat(document.getElementById('criteriaFreqMax').value);
        const ampEnabled = document.getElementById('criteriaAmpEnabled').checked;
        const ampMin = parseFloat(document.getElementById('criteriaAmpMin').value);
        const ampMax = parseFloat(document.getElementById('criteriaAmpMax').value);
        const durEnabled = document.getElementById('criteriaDurEnabled').checked;
        const durMin = parseFloat(document.getElementById('criteriaDurMin').value) / 1000;
        const durMax = parseFloat(document.getElementById('criteriaDurMax').value) / 1000;
        const timeEnabled = document.getElementById('criteriaTimeEnabled').checked;
        const timeStart = parseFloat(document.getElementById('criteriaTimeStart').value);
        const timeEnd = parseFloat(document.getElementById('criteriaTimeEnd').value);

        // Find matching partials
        const matchingPartials = new Set();

        for (const partial of this.partials) {
            let matches = true;

            // Check frequency criteria
            if (freqEnabled && partial.points.length > 0) {
                const avgFreq = partial.points.reduce((sum, p) => sum + p.freq, 0) / partial.points.length;
                if (avgFreq < freqMin || avgFreq > freqMax) matches = false;
            }

            // Check amplitude criteria
            if (ampEnabled && matches && partial.points.length > 0) {
                const avgAmp = partial.points.reduce((sum, p) => sum + p.amplitude, 0) / partial.points.length;
                if (avgAmp < ampMin || avgAmp > ampMax) matches = false;
            }

            // Check duration criteria
            if (durEnabled && matches && partial.points.length >= 2) {
                const duration = partial.points[partial.points.length - 1].time - partial.points[0].time;
                if (duration < durMin || duration > durMax) matches = false;
            }

            // Check time range criteria
            if (timeEnabled && matches && partial.points.length > 0) {
                const partialStart = partial.points[0].time;
                const partialEnd = partial.points[partial.points.length - 1].time;
                // Check if partial overlaps with time range
                if (partialEnd < timeStart || partialStart > timeEnd) matches = false;
            }

            if (matches) {
                matchingPartials.add(partial.id);
            }
        }

        // Apply selection mode
        let count = 0;
        switch (mode) {
            case 'replace':
                this.selectedPartials.clear();
                for (const id of matchingPartials) {
                    this.selectedPartials.add(id);
                    count++;
                }
                break;
            case 'add':
                for (const id of matchingPartials) {
                    if (!this.selectedPartials.has(id)) count++;
                    this.selectedPartials.add(id);
                }
                break;
            case 'subtract':
                for (const id of matchingPartials) {
                    if (this.selectedPartials.has(id)) {
                        this.selectedPartials.delete(id);
                        count++;
                    }
                }
                break;
            case 'intersect':
                const toRemove = [];
                for (const id of this.selectedPartials) {
                    if (!matchingPartials.has(id)) {
                        toRemove.push(id);
                    }
                }
                for (const id of toRemove) {
                    this.selectedPartials.delete(id);
                    count++;
                }
                break;
        }

        this.hideModal('selectByCriteriaModal');
        this.render();
        this.updateSelectionInfo();
        this.notify(`Selected ${this.selectedPartials.size} partials by criteria`);
    }

    // ==================== Grow/Shrink Selection Methods ====================

    growShrinkSelection() {
        if (this.selectedPartials.size === 0) {
            this.notify('No selection to grow/shrink');
            this.hideModal('growShrinkModal');
            return;
        }

        const timeGrow = parseFloat(document.getElementById('growShrinkTime').value) / 1000; // Convert ms to s
        const freqGrow = parseFloat(document.getElementById('growShrinkFreq').value);

        // Get bounds of current selection
        let minTime = Infinity, maxTime = -Infinity;
        let minFreq = Infinity, maxFreq = -Infinity;

        for (const partial of this.partials) {
            if (!this.selectedPartials.has(partial.id)) continue;
            for (const point of partial.points) {
                minTime = Math.min(minTime, point.time);
                maxTime = Math.max(maxTime, point.time);
                minFreq = Math.min(minFreq, point.freq);
                maxFreq = Math.max(maxFreq, point.freq);
            }
        }

        // Expand bounds
        minTime -= timeGrow;
        maxTime += timeGrow;
        minFreq -= freqGrow;
        maxFreq += freqGrow;

        // Select partials within expanded bounds
        let added = 0;
        for (const partial of this.partials) {
            if (this.selectedPartials.has(partial.id)) continue;

            for (const point of partial.points) {
                if (point.time >= minTime && point.time <= maxTime &&
                    point.freq >= minFreq && point.freq <= maxFreq) {
                    this.selectedPartials.add(partial.id);
                    added++;
                    break;
                }
            }
        }

        this.hideModal('growShrinkModal');
        this.render();
        this.updateSelectionInfo();
        this.notify(added > 0 ? `Added ${added} partials to selection` : 'No additional partials found');
    }

    selectSimilar() {
        if (this.selectedPartials.size === 0) {
            this.notify('Select at least one partial first');
            return;
        }

        // Calculate average properties of selected partials
        let totalFreq = 0, totalAmp = 0, count = 0;
        for (const partial of this.partials) {
            if (!this.selectedPartials.has(partial.id)) continue;
            for (const point of partial.points) {
                totalFreq += point.freq;
                totalAmp += point.amplitude;
                count++;
            }
        }
        const avgFreq = totalFreq / count;
        const avgAmp = totalAmp / count;

        // Select partials with similar properties (within 20% freq, 6dB amp)
        const freqTolerance = avgFreq * 0.2;
        const ampTolerance = 6;

        let added = 0;
        for (const partial of this.partials) {
            if (this.selectedPartials.has(partial.id)) continue;

            const partialAvgFreq = partial.points.reduce((s, p) => s + p.freq, 0) / partial.points.length;
            const partialAvgAmp = partial.points.reduce((s, p) => s + p.amplitude, 0) / partial.points.length;

            if (Math.abs(partialAvgFreq - avgFreq) <= freqTolerance &&
                Math.abs(partialAvgAmp - avgAmp) <= ampTolerance) {
                this.selectedPartials.add(partial.id);
                added++;
            }
        }

        this.render();
        this.updateSelectionInfo();
        this.notify(`Added ${added} similar partials to selection`);
    }

    invertSelectionSet() {
        const newSelection = new Set();
        for (const partial of this.partials) {
            if (!this.selectedPartials.has(partial.id)) {
                newSelection.add(partial.id);
            }
        }
        this.selectedPartials = newSelection;
        this.render();
        this.updateSelectionInfo();
        this.notify(`Selected ${this.selectedPartials.size} partials (inverted)`);
    }

    // ==================== Vibrato/Tremolo Methods ====================

    applyVibratoTremolo() {
        if (this.selectedPartials.size === 0) {
            this.notify('Select partials to apply vibrato/tremolo');
            this.hideModal('vibratoTremoloModal');
            return;
        }

        const vibratoRate = parseFloat(document.getElementById('vibratoRate').value);
        const vibratoDepth = parseFloat(document.getElementById('vibratoDepth').value); // cents
        const tremoloRate = parseFloat(document.getElementById('tremoloRate').value);
        const tremoloDepth = parseFloat(document.getElementById('tremoloDepth').value); // dB

        this.saveState();

        for (const partial of this.partials) {
            if (!this.selectedPartials.has(partial.id)) continue;

            // Need more points for smooth modulation
            const newPoints = [];
            const startTime = partial.points[0].time;
            const endTime = partial.points[partial.points.length - 1].time;
            const duration = endTime - startTime;

            // Sample at ~50 points per second for smooth modulation
            const numPoints = Math.max(partial.points.length, Math.ceil(duration * 50));

            for (let i = 0; i < numPoints; i++) {
                const t = startTime + (i / (numPoints - 1)) * duration;

                // Interpolate original frequency and amplitude
                let origFreq = partial.points[0].freq;
                let origAmp = partial.points[0].amplitude;

                for (let j = 0; j < partial.points.length - 1; j++) {
                    if (t >= partial.points[j].time && t <= partial.points[j + 1].time) {
                        const frac = (t - partial.points[j].time) /
                                   (partial.points[j + 1].time - partial.points[j].time);
                        origFreq = partial.points[j].freq + frac * (partial.points[j + 1].freq - partial.points[j].freq);
                        origAmp = partial.points[j].amplitude + frac * (partial.points[j + 1].amplitude - partial.points[j].amplitude);
                        break;
                    }
                }

                // Apply vibrato (frequency modulation)
                const vibratoMod = Math.sin(2 * Math.PI * vibratoRate * (t - startTime));
                const freqMultiplier = Math.pow(2, (vibratoDepth * vibratoMod) / 1200); // cents to ratio
                const newFreq = origFreq * freqMultiplier;

                // Apply tremolo (amplitude modulation)
                const tremoloMod = Math.sin(2 * Math.PI * tremoloRate * (t - startTime));
                const newAmp = origAmp + tremoloDepth * tremoloMod;

                newPoints.push({
                    time: t,
                    freq: newFreq,
                    amplitude: newAmp
                });
            }

            partial.points = newPoints;
        }

        this.hideModal('vibratoTremoloModal');
        this.render();
        this.updateRenderedWaveform();
        this.notify('Applied vibrato/tremolo to selection');
    }

    // ==================== Chorus/Unison Methods ====================

    applyChorus() {
        if (this.selectedPartials.size === 0) {
            this.notify('Select partials to apply chorus');
            this.hideModal('chorusModal');
            return;
        }

        const voices = parseInt(document.getElementById('chorusVoices').value);
        const detuneCents = parseFloat(document.getElementById('chorusDetune').value);
        const timeSpread = parseFloat(document.getElementById('chorusTimeSpread').value) / 1000; // ms to s
        const ampSpread = parseFloat(document.getElementById('chorusAmpSpread').value);

        this.saveState();

        const newPartials = [];

        for (const partial of this.partials) {
            if (!this.selectedPartials.has(partial.id)) continue;

            // Create additional voices
            for (let v = 1; v < voices; v++) {
                // Calculate detune and offset for this voice
                // Spread voices evenly, centered around original
                const voiceOffset = (v - (voices - 1) / 2) / ((voices - 1) / 2 || 1);
                const detuneAmount = detuneCents * voiceOffset;
                const timeOffset = timeSpread * voiceOffset * (Math.random() * 0.5 + 0.5);
                const ampOffset = -ampSpread * Math.abs(voiceOffset);

                const newPartial = {
                    id: this.nextPartialId++,
                    points: partial.points.map(p => ({
                        time: p.time + timeOffset,
                        freq: p.freq * Math.pow(2, detuneAmount / 1200),
                        amplitude: p.amplitude + ampOffset
                    }))
                };
                newPartials.push(newPartial);
            }
        }

        // Add new partials
        this.partials.push(...newPartials);

        // Add new partials to selection
        for (const p of newPartials) {
            this.selectedPartials.add(p.id);
        }

        this.hideModal('chorusModal');
        this.recalculateDuration();
        this.render();
        this.updateRenderedWaveform();
        this.updatePartialsDisplay();
        this.notify(`Added ${newPartials.length} chorus voices`);
    }

    // ==================== Spectral Freeze/Smear Methods ====================

    applySpectralFreeze() {
        if (this.selectedPartials.size === 0) {
            this.notify('Select partials to apply spectral freeze/smear');
            this.hideModal('spectralFreezeModal');
            return;
        }

        const mode = document.getElementById('spectralFreezeMode').value;
        const duration = parseFloat(document.getElementById('spectralFreezeDuration').value);
        const smearAmount = parseInt(document.getElementById('spectralSmearAmount').value) / 100;

        this.saveState();

        for (const partial of this.partials) {
            if (!this.selectedPartials.has(partial.id)) continue;
            if (partial.points.length < 2) continue;

            const startTime = partial.points[0].time;
            const originalDuration = partial.points[partial.points.length - 1].time - startTime;

            if (originalDuration <= 0) continue;

            if (mode === 'freeze') {
                // Freeze: hold the first frame's frequency for the specified duration
                // Keep the amplitude envelope but flatten the frequency
                const freezeFreq = partial.points[0].freq;

                // Create new points that preserve timing but freeze frequency
                const newPoints = [];
                for (const point of partial.points) {
                    newPoints.push({
                        time: point.time,
                        freq: freezeFreq,
                        amplitude: point.amplitude
                    });
                }

                // Optionally extend to the specified duration
                if (duration > originalDuration) {
                    const lastAmp = partial.points[partial.points.length - 1].amplitude;
                    newPoints.push({
                        time: startTime + duration,
                        freq: freezeFreq,
                        amplitude: lastAmp
                    });
                }

                partial.points = newPoints;
            } else {
                // Smear: apply low-pass filter to frequency trajectory
                // First, resample to uniform time grid
                const numPoints = Math.max(10, Math.ceil(originalDuration * 50));
                const sampledFreqs = [];
                const sampledAmps = [];
                const times = [];

                for (let i = 0; i < numPoints; i++) {
                    const t = startTime + (i / (numPoints - 1)) * originalDuration;
                    times.push(t);

                    // Interpolate original values at this time
                    let freq = partial.points[0].freq;
                    let amp = partial.points[0].amplitude;

                    for (let j = 0; j < partial.points.length - 1; j++) {
                        if (t >= partial.points[j].time && t <= partial.points[j + 1].time) {
                            const segDuration = partial.points[j + 1].time - partial.points[j].time;
                            if (segDuration > 0) {
                                const frac = (t - partial.points[j].time) / segDuration;
                                freq = partial.points[j].freq + frac * (partial.points[j + 1].freq - partial.points[j].freq);
                                amp = partial.points[j].amplitude + frac * (partial.points[j + 1].amplitude - partial.points[j].amplitude);
                            }
                            break;
                        }
                    }
                    // Handle time past last point
                    if (t > partial.points[partial.points.length - 1].time) {
                        freq = partial.points[partial.points.length - 1].freq;
                        amp = partial.points[partial.points.length - 1].amplitude;
                    }

                    sampledFreqs.push(freq);
                    sampledAmps.push(amp);
                }

                // Apply moving average filter (smear)
                const windowSize = Math.max(1, Math.floor(smearAmount * numPoints * 0.3));
                const smearedFreqs = [];
                const smearedAmps = [];

                for (let i = 0; i < numPoints; i++) {
                    let sumFreq = 0, sumAmp = 0, count = 0;

                    for (let w = -windowSize; w <= windowSize; w++) {
                        const idx = Math.max(0, Math.min(numPoints - 1, i + w));
                        // Use Gaussian-like weighting
                        const weight = Math.exp(-0.5 * Math.pow(w / (windowSize + 1), 2));
                        sumFreq += sampledFreqs[idx] * weight;
                        sumAmp += sampledAmps[idx] * weight;
                        count += weight;
                    }

                    smearedFreqs.push(sumFreq / count);
                    smearedAmps.push(sumAmp / count);
                }

                // Create new points
                const newPoints = [];
                for (let i = 0; i < numPoints; i++) {
                    newPoints.push({
                        time: times[i],
                        freq: smearedFreqs[i],
                        amplitude: smearedAmps[i]
                    });
                }

                partial.points = newPoints;
            }
        }

        this.hideModal('spectralFreezeModal');
        this.render();
        this.updateRenderedWaveform();
        this.notify(`Applied spectral ${mode} to selection`);
    }

    // ==================== Merge/Split Partials Methods ====================

    mergePartials() {
        if (this.selectedPartials.size < 2) {
            this.notify('Select at least 2 partials to merge');
            return;
        }

        this.saveState();

        // Collect all points from selected partials
        const allPoints = [];
        const selectedPartialsList = this.partials.filter(p => this.selectedPartials.has(p.id));

        for (const partial of selectedPartialsList) {
            for (const point of partial.points) {
                allPoints.push({ ...point });
            }
        }

        // Sort by time
        allPoints.sort((a, b) => a.time - b.time);

        // Remove old partials
        this.partials = this.partials.filter(p => !this.selectedPartials.has(p.id));

        // Create merged partial
        const mergedPartial = {
            id: this.nextPartialId++,
            points: allPoints
        };
        this.partials.push(mergedPartial);

        // Update selection
        this.selectedPartials.clear();
        this.selectedPartials.add(mergedPartial.id);

        this.render();
        this.updateRenderedWaveform();
        this.updatePartialsDisplay();
        this.updateSelectionInfo();
        this.notify(`Merged ${selectedPartialsList.length} partials into 1`);
    }

    splitPartials() {
        if (this.selectedPartials.size === 0) {
            this.notify('Select partials to split');
            return;
        }

        this.saveState();

        const newPartials = [];
        const partialsToRemove = new Set();

        for (const partial of this.partials) {
            if (!this.selectedPartials.has(partial.id)) continue;
            if (partial.points.length < 4) continue; // Need at least 4 points to split

            partialsToRemove.add(partial.id);

            // Split at the midpoint
            const midIndex = Math.floor(partial.points.length / 2);

            const firstHalf = {
                id: this.nextPartialId++,
                points: partial.points.slice(0, midIndex + 1)
            };
            const secondHalf = {
                id: this.nextPartialId++,
                points: partial.points.slice(midIndex)
            };

            newPartials.push(firstHalf, secondHalf);
        }

        // Remove old partials and add new ones
        this.partials = this.partials.filter(p => !partialsToRemove.has(p.id));
        this.partials.push(...newPartials);

        // Update selection
        this.selectedPartials.clear();
        for (const p of newPartials) {
            this.selectedPartials.add(p.id);
        }

        this.render();
        this.updateRenderedWaveform();
        this.updatePartialsDisplay();
        this.updateSelectionInfo();
        this.notify(`Split ${partialsToRemove.size} partials into ${newPartials.length}`);
    }

    updatePartialsDisplay() {
        document.getElementById('partialsDisplay').textContent = this.partials.length;
    }

    recalculateDuration() {
        // Find the maximum time extent of all partials
        let maxTime = this.duration || 1;

        for (const partial of this.partials) {
            for (const point of partial.points) {
                if (point.time > maxTime) {
                    maxTime = point.time;
                }
            }
        }

        // Add a small buffer
        this.duration = maxTime + 0.1;

        // Update view if needed
        if (this.viewEnd < this.duration) {
            this.viewEnd = this.duration;
        }

        this.updateDurationDisplay();
    }

    updateDurationDisplay() {
        const mins = Math.floor(this.duration / 60);
        const secs = this.duration % 60;
        document.getElementById('durationDisplay').textContent =
            `${mins.toString().padStart(2, '0')}:${secs.toFixed(3).padStart(6, '0')}`;
    }

    // ==================== Amplitude Envelope Methods ====================

    showAmpEnvelopeModal() {
        this.showModal('ampEnvelopeModal');
        this.setupAmpEnvelopeCanvas();
    }

    setupAmpEnvelopeCanvas() {
        const canvas = document.getElementById('ampEnvelopeCanvas');
        const ctx = canvas.getContext('2d');
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;

        // Initialize envelope points (linear from 0dB to 0dB)
        this.ampEnvelopePoints = [
            { x: 0, y: 0.5 },   // Start at 0dB
            { x: 1, y: 0.5 }    // End at 0dB
        ];

        this.renderAmpEnvelope();

        // Mouse events for drawing
        let isDrawing = false;
        canvas.onmousedown = (e) => {
            isDrawing = true;
            this.updateAmpEnvelopePoint(e, canvas);
        };
        canvas.onmousemove = (e) => {
            if (isDrawing) this.updateAmpEnvelopePoint(e, canvas);
        };
        canvas.onmouseup = () => isDrawing = false;
        canvas.onmouseleave = () => isDrawing = false;
    }

    updateAmpEnvelopePoint(e, canvas) {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;

        // Add or update point at this x position
        const existingIdx = this.ampEnvelopePoints.findIndex(p => Math.abs(p.x - x) < 0.02);
        if (existingIdx >= 0) {
            this.ampEnvelopePoints[existingIdx].y = Math.max(0, Math.min(1, y));
        } else {
            this.ampEnvelopePoints.push({ x, y: Math.max(0, Math.min(1, y)) });
            this.ampEnvelopePoints.sort((a, b) => a.x - b.x);
        }

        this.renderAmpEnvelope();
    }

    setAmpEnvelopePreset(preset) {
        switch (preset) {
            case 'fadeIn':
                this.ampEnvelopePoints = [{ x: 0, y: 1 }, { x: 1, y: 0.5 }];
                break;
            case 'fadeOut':
                this.ampEnvelopePoints = [{ x: 0, y: 0.5 }, { x: 1, y: 1 }];
                break;
            case 'swell':
                this.ampEnvelopePoints = [{ x: 0, y: 0.7 }, { x: 0.5, y: 0.3 }, { x: 1, y: 0.7 }];
                break;
            case 'pulse':
                this.ampEnvelopePoints = [
                    { x: 0, y: 0.5 }, { x: 0.1, y: 0.3 }, { x: 0.2, y: 0.5 },
                    { x: 0.3, y: 0.3 }, { x: 0.4, y: 0.5 }, { x: 0.5, y: 0.3 },
                    { x: 0.6, y: 0.5 }, { x: 0.7, y: 0.3 }, { x: 0.8, y: 0.5 },
                    { x: 0.9, y: 0.3 }, { x: 1, y: 0.5 }
                ];
                break;
            case 'tremolo':
                this.ampEnvelopePoints = [];
                for (let i = 0; i <= 20; i++) {
                    this.ampEnvelopePoints.push({
                        x: i / 20,
                        y: 0.5 + 0.15 * Math.sin(i * Math.PI)
                    });
                }
                break;
            default:
                this.ampEnvelopePoints = [{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }];
        }
        this.renderAmpEnvelope();
    }

    renderAmpEnvelope() {
        const canvas = document.getElementById('ampEnvelopeCanvas');
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        ctx.fillStyle = '#0a0a14';
        ctx.fillRect(0, 0, width, height);

        // Draw grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = (i / 4) * height;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Draw 0dB line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();

        // Draw envelope curve
        if (this.ampEnvelopePoints.length > 0) {
            ctx.strokeStyle = '#00ff88';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i < this.ampEnvelopePoints.length; i++) {
                const p = this.ampEnvelopePoints[i];
                const x = p.x * width;
                const y = p.y * height;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();

            // Fill area
            ctx.fillStyle = 'rgba(0, 255, 136, 0.2)';
            ctx.beginPath();
            ctx.moveTo(0, height / 2);
            for (const p of this.ampEnvelopePoints) {
                ctx.lineTo(p.x * width, p.y * height);
            }
            ctx.lineTo(width, height / 2);
            ctx.closePath();
            ctx.fill();

            // Draw points
            ctx.fillStyle = '#00ff88';
            for (const p of this.ampEnvelopePoints) {
                ctx.beginPath();
                ctx.arc(p.x * width, p.y * height, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    getAmpEnvelopeAt(t) {
        // t is 0-1 normalized time
        if (this.ampEnvelopePoints.length === 0) return 0;
        if (t <= this.ampEnvelopePoints[0].x) return this.ampEnvelopePoints[0].y;
        if (t >= this.ampEnvelopePoints[this.ampEnvelopePoints.length - 1].x) {
            return this.ampEnvelopePoints[this.ampEnvelopePoints.length - 1].y;
        }

        for (let i = 0; i < this.ampEnvelopePoints.length - 1; i++) {
            if (t >= this.ampEnvelopePoints[i].x && t <= this.ampEnvelopePoints[i + 1].x) {
                const frac = (t - this.ampEnvelopePoints[i].x) /
                           (this.ampEnvelopePoints[i + 1].x - this.ampEnvelopePoints[i].x);
                return this.ampEnvelopePoints[i].y + frac *
                      (this.ampEnvelopePoints[i + 1].y - this.ampEnvelopePoints[i].y);
            }
        }
        return 0.5;
    }

    applyAmpEnvelope() {
        if (this.selectedPartials.size === 0) {
            this.notify('Select partials to apply envelope');
            this.hideModal('ampEnvelopeModal');
            return;
        }

        this.saveState();

        // Get time bounds of selection
        let minTime = Infinity, maxTime = -Infinity;
        for (const partial of this.partials) {
            if (!this.selectedPartials.has(partial.id)) continue;
            for (const point of partial.points) {
                minTime = Math.min(minTime, point.time);
                maxTime = Math.max(maxTime, point.time);
            }
        }
        const duration = maxTime - minTime;

        for (const partial of this.partials) {
            if (!this.selectedPartials.has(partial.id)) continue;

            for (const point of partial.points) {
                const t = (point.time - minTime) / duration;
                const envY = this.getAmpEnvelopeAt(t);
                // Convert y (0=+12dB, 0.5=0dB, 1=-inf) to dB offset
                const dbOffset = envY < 0.5 ? (0.5 - envY) * 24 : -(envY - 0.5) * 48;
                point.amplitude += dbOffset;
            }
        }

        this.hideModal('ampEnvelopeModal');
        this.render();
        this.updateRenderedWaveform();
        this.notify('Applied amplitude envelope');
    }

    // ==================== Spectral Delay Methods ====================

    applySpectralDelay() {
        if (this.selectedPartials.size === 0) {
            this.notify('Select partials to apply spectral delay');
            this.hideModal('spectralDelayModal');
            return;
        }

        const mode = document.getElementById('spectralDelayMode').value;
        const maxDelay = parseFloat(document.getElementById('spectralDelayMax').value) / 1000;
        const freqLow = parseFloat(document.getElementById('spectralDelayFreqLow').value);
        const freqHigh = parseFloat(document.getElementById('spectralDelayFreqHigh').value);
        const repeats = parseInt(document.getElementById('spectralDelayRepeats').value);
        const decayPerRepeat = parseFloat(document.getElementById('spectralDelayDecay').value);

        this.saveState();

        const newPartials = [];

        for (const partial of this.partials) {
            if (!this.selectedPartials.has(partial.id)) continue;

            const avgFreq = partial.points.reduce((s, p) => s + p.freq, 0) / partial.points.length;

            let baseDelay = 0;
            if (mode === 'lowFirst') {
                const freqNorm = Math.log(avgFreq / freqLow) / Math.log(freqHigh / freqLow);
                baseDelay = Math.max(0, Math.min(1, freqNorm)) * maxDelay;
            } else if (mode === 'highFirst') {
                const freqNorm = Math.log(avgFreq / freqLow) / Math.log(freqHigh / freqLow);
                baseDelay = Math.max(0, Math.min(1, 1 - freqNorm)) * maxDelay;
            } else {
                baseDelay = Math.random() * maxDelay;
            }

            // Apply delay to original partial
            for (const point of partial.points) {
                point.time += baseDelay;
            }

            // Create feedback repeats (echo copies)
            for (let r = 1; r <= repeats; r++) {
                const repeatDelay = baseDelay + (maxDelay * r);
                const repeatAmpOffset = decayPerRepeat * r;

                const repeatPartial = {
                    id: this.nextPartialId++,
                    points: partial.points.map(p => ({
                        time: p.time + (maxDelay * r),
                        freq: p.freq,
                        amplitude: p.amplitude + repeatAmpOffset
                    }))
                };
                newPartials.push(repeatPartial);
            }
        }

        // Add echo copies
        if (newPartials.length > 0) {
            this.partials.push(...newPartials);
            for (const p of newPartials) {
                this.selectedPartials.add(p.id);
            }
        }

        this.hideModal('spectralDelayModal');
        this.recalculateDuration();
        this.render();
        this.updateRenderedWaveform();
        this.updatePartialsDisplay();
        this.notify(`Applied spectral delay${repeats > 0 ? ` with ${repeats} echoes` : ''}`);
    }

    // ==================== Spectral Reverb Methods ====================

    applySpectralReverb() {
        if (this.selectedPartials.size === 0) {
            this.notify('Select partials to apply spectral reverb');
            this.hideModal('spectralReverbModal');
            return;
        }

        const decayTime = parseFloat(document.getElementById('reverbDecayTime').value);
        const diffusion = parseInt(document.getElementById('reverbDiffusion').value) / 100;
        const density = parseInt(document.getElementById('reverbDensity').value);
        const damping = parseFloat(document.getElementById('reverbDamping').value);
        const predelay = parseFloat(document.getElementById('reverbPredelay').value) / 1000;
        const mix = parseInt(document.getElementById('reverbMix').value) / 100;

        this.saveState();

        const newPartials = [];
        const selectedPartialsList = this.partials.filter(p => this.selectedPartials.has(p.id));

        for (const partial of selectedPartialsList) {
            const avgFreq = partial.points.reduce((s, p) => s + p.freq, 0) / partial.points.length;
            const avgAmp = partial.points.reduce((s, p) => s + p.amplitude, 0) / partial.points.length;

            // Apply damping - higher frequencies decay faster
            const dampingFactor = Math.exp(-avgFreq / damping);
            const effectiveDecay = decayTime * dampingFactor;

            // Reduce dry signal amplitude based on mix
            if (mix > 0) {
                const dryReduction = -6 * mix; // Reduce dry by up to 6dB at 100% mix
                for (const point of partial.points) {
                    point.amplitude += dryReduction;
                }
            }

            // Create reverb reflections
            for (let i = 0; i < density; i++) {
                // Calculate delay for this reflection (exponentially distributed)
                const reflectionProgress = (i + 1) / density;
                const baseReflectionDelay = predelay + (effectiveDecay * reflectionProgress * reflectionProgress);

                // Add randomness for diffusion
                const delayVariation = diffusion * effectiveDecay * 0.3 * (Math.random() - 0.5);
                const reflectionDelay = baseReflectionDelay + delayVariation;

                // Calculate amplitude decay (exponential)
                const decayDb = -60 * reflectionProgress; // Full decay to -60dB
                const ampOffset = decayDb * mix;

                // Frequency variation for diffusion (subtle)
                const freqVariation = 1 + (diffusion * 0.02 * (Math.random() - 0.5));

                const reverbPartial = {
                    id: this.nextPartialId++,
                    points: partial.points.map(p => ({
                        time: p.time + reflectionDelay,
                        freq: p.freq * freqVariation,
                        amplitude: p.amplitude + ampOffset
                    }))
                };

                // Only add if amplitude is above threshold
                const reverbAvgAmp = reverbPartial.points.reduce((s, p) => s + p.amplitude, 0) / reverbPartial.points.length;
                if (reverbAvgAmp > -60) {
                    newPartials.push(reverbPartial);
                }
            }
        }

        // Add reverb reflections
        if (newPartials.length > 0) {
            this.partials.push(...newPartials);
        }

        this.hideModal('spectralReverbModal');
        this.recalculateDuration();
        this.render();
        this.updateRenderedWaveform();
        this.updatePartialsDisplay();
        this.notify(`Applied spectral reverb (${newPartials.length} reflections)`);
    }

    // ==================== Formant Shift Methods ====================

    applyFormantShift() {
        if (this.selectedPartials.size === 0) {
            this.notify('Select partials to apply formant shift');
            this.hideModal('formantShiftModal');
            return;
        }

        const shiftSemitones = parseFloat(document.getElementById('formantShiftAmount').value);
        const preservePitch = document.getElementById('formantPreservePitch').checked;
        const shiftRatio = Math.pow(2, shiftSemitones / 12);

        if (shiftSemitones === 0) {
            this.notify('No shift amount specified');
            this.hideModal('formantShiftModal');
            return;
        }

        this.saveState();

        const selectedPartialsList = this.partials.filter(p => this.selectedPartials.has(p.id));

        if (preservePitch) {
            // Formant shift while preserving pitch:
            // Find the lowest frequency partial (assumed fundamental) in each time region
            // and shift harmonics relative to it while keeping fundamental the same

            // Sort by average frequency to identify potential fundamentals
            const sortedByFreq = [...selectedPartialsList].sort((a, b) => {
                const avgA = a.points.reduce((s, p) => s + p.freq, 0) / a.points.length;
                const avgB = b.points.reduce((s, p) => s + p.freq, 0) / b.points.length;
                return avgA - avgB;
            });

            // Assume lowest frequency partial is the fundamental
            if (sortedByFreq.length > 0) {
                const fundamentalFreq = sortedByFreq[0].points.reduce((s, p) => s + p.freq, 0) / sortedByFreq[0].points.length;

                for (const partial of sortedByFreq) {
                    const avgFreq = partial.points.reduce((s, p) => s + p.freq, 0) / partial.points.length;
                    const harmonicNumber = Math.round(avgFreq / fundamentalFreq);

                    if (harmonicNumber <= 1) {
                        // This is the fundamental - don't shift frequency
                        continue;
                    }

                    // Shift the harmonic relationship
                    // New harmonic position = fundamental * (harmonicNumber * shiftRatio)
                    const newHarmonicRatio = harmonicNumber * shiftRatio;

                    for (const point of partial.points) {
                        // Calculate what this point's frequency should be based on the shifted harmonic
                        const originalHarmonicRatio = point.freq / fundamentalFreq;
                        const newFreq = fundamentalFreq * (originalHarmonicRatio * shiftRatio / harmonicNumber * harmonicNumber);
                        point.freq = point.freq * shiftRatio;
                    }
                }

                // Also apply amplitude shaping to simulate formant envelope shift
                // Higher formants get boosted/cut based on shift direction
                for (const partial of selectedPartialsList) {
                    for (const point of partial.points) {
                        // Simulate formant envelope: shift up = boost highs, shift down = cut highs
                        const freqNorm = Math.log2(point.freq / 200); // Normalize to ~200Hz base
                        const ampAdjust = freqNorm * (shiftSemitones > 0 ? 0.5 : -0.5);
                        point.amplitude += ampAdjust;
                    }
                }
            }
        } else {
            // Simple pitch shift - shift all frequencies by the ratio
            for (const partial of selectedPartialsList) {
                for (const point of partial.points) {
                    point.freq *= shiftRatio;
                }
            }
        }

        this.hideModal('formantShiftModal');
        this.render();
        this.updateRenderedWaveform();
        this.notify(`Applied formant shift: ${shiftSemitones > 0 ? '+' : ''}${shiftSemitones} semitones${preservePitch ? ' (pitch preserved)' : ''}`);
    }

}

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    window.spectra = new Spectra();
});
