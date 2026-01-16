# Spectra

A browser-based spectral audio editor inspired by SPEAR (Sinusoidal Partial Editing Analysis and Resynthesis). Spectra allows you to visualize, edit, and resynthesize audio using sinusoidal partial tracking.

## Features

### Audio Analysis
- **FFT-based partial tracking**: Analyzes audio files to extract sinusoidal partials (frequency, amplitude, and time data)
- **Configurable analysis parameters**: FFT size, hop size, window type, minimum amplitude threshold, and maximum partials
- **Noise residual analysis**: Computes the spectral envelope of the residual (original minus sinusoidal reconstruction) for noise resynthesis

### Visualization
- **Spectrogram-style display**: Partials displayed as colored lines showing frequency over time
- **Amplitude-based coloring**: Brightness indicates partial amplitude (or frequency/single color modes)
- **Logarithmic, linear, or mel frequency scale**: Switch between different frequency views
- **Zoomable view**: Zoom in/out on time and frequency axes with mouse wheel
- **Waveform preview**: Shows rendered (resynthesized) waveform, synchronized with the current view
- **Multiple grid overlays**:
  - Standard time/frequency grid
  - Beat grid (BPM-based, yellow)
  - Pitch grid (scale-based, green)
- **Zoom controls**: Compact zoom panel in top-left corner of canvas

### Navigation
- **Mouse wheel**: Zoom time axis (or frequency axis with Shift held)
- **Shift+drag**: Pan the view freely in any direction
- **Alt+drag**: Alternative pan method
- **Zoom buttons**: +T/-T for time, +F/-F for frequency, Fit to reset view

### Selection Tools
- **Select (1)**: Click to select individual partials
- **Rectangle (2)**: Draw a rectangle to select partials within
- **Lasso (3)**: Freeform selection by drawing a shape
- **Brush (4)**: Paint to select partials
- **Pen (5)**: Draw new partials freehand with optional harmonics
- **Line (6)**: Draw straight-line partials with optional harmonics
- **Pitch (7)**: Drag to shift pitch of selected partials
- **Time (8)**: Drag to stretch/compress time of selected partials

### Editing Operations

#### Basic Edits
- **Delete**: Remove selected partials
- **Copy/Paste**: Duplicate partials
- **Move**: Drag selected partials in time and frequency
- **Pitch Shift**: Shift frequency by semitones or percentage
- **Time Stretch**: Scale partial durations

#### Transform Tools
- **Invert (I)**: Mirror frequencies vertically around selection center
- **Reverse**: Mirror partials in time
- **Perpendicular**: Rotate 90 degrees, swapping time and frequency axes
- **Rotate Selection**: Rotate by any angle (degrees) around a pivot point (center, start, or end)
- **Align Left**: Align all selected partials to start at the earliest partial's start time
- **Align Right**: Align all selected partials to end at the latest partial's end time

#### Quantization
- **Grid Quantize**: Snap to time/frequency grid
- **Beat Quantize**: Snap to BPM-based beat grid (whole notes to 16th notes)
- **Scale Quantize**: Snap frequencies to musical scales including:
  - Chromatic, Major, Minor
  - Pentatonic (Major), Blues
  - Perfect Fifths

#### Synthesis Tools
- **Add Harmonics**: Generate harmonic overtones for selected partials
  - Configurable number of harmonics (1-32)
  - Amplitude dropoff per octave (dB)
  - Option for odd harmonics only (square wave character)
- **Explode Selection**: Spread partials evenly in time
  - Order by: Original, Frequency Ascending/Descending, Random
  - Spacing: Even or Proportional
- **Spectral EQ**: Draw a frequency-dependent gain curve to apply to selection
  - Interactive canvas with +/-24dB range

#### Effects
- **Vibrato/Tremolo**: Add pitch and/or amplitude modulation
  - Configurable rate (Hz) and depth (cents/dB)
  - Independent vibrato and tremolo controls
- **Chorus/Unison**: Create rich, layered sounds
  - Multiple detuned voices (2-8)
  - Configurable detune, time spread, and amplitude spread
- **Spectral Freeze/Smear**: Time-domain spectral effects
  - Freeze mode: Hold frequencies at a single frame while preserving amplitude envelope
  - Smear mode: Blur frequency transitions over time with Gaussian smoothing
- **Amplitude Envelope**: Draw custom amplitude curves
  - Presets: Fade In, Fade Out, Swell, Pulse, Tremolo
  - Interactive canvas drawing
- **Spectral Delay**: Frequency-dependent time delays with feedback
  - Modes: Low frequencies first, High frequencies first, Random
  - Configurable max delay and frequency range
  - Feedback with repeats and decay control
- **Spectral Reverb**: Create spacious, diffused sounds
  - Configurable decay time (0.5-10s)
  - Diffusion control for echo density
  - Density control for reflection count
  - High-frequency damping
  - Pre-delay option
  - Dry/wet mix control
- **Formant Shift**: Shift spectral envelope (formants)
  - Preserve pitch option for voice character changes
  - Shift amount in semitones

#### Advanced Selection
- **Select by Criteria**: Filter partials by properties
  - Frequency range, Amplitude range, Duration, Time range
  - Selection modes: Replace, Add, Subtract, Intersect
- **Invert Selection**: Select all non-selected partials

#### Partial Operations
- **Merge Partials**: Combine multiple partials into one continuous partial
- **Split Partials**: Divide partials at midpoint

### Playback
- **Real-time additive synthesis**: Hear your edits immediately
- **Playback rate control**: 0.1x to 10x speed without pitch change
- **Loop mode**: Loop entire file or selection
- **Freeze frame mode (F)**: Step through individual analysis frames
  - Arrow keys navigate frames
  - Visual indicator when freeze mode is active
- **Master volume control** (0-150%) with level meter
- **Noise resynthesis**: Mix in synthesized noise component with adjustable level

### Export
- **WAV export**: Export resynthesized audio
- **Configurable sample rate**: 44.1kHz, 48kHz, 96kHz
- **Export range**: Entire file or selection only
- **Normalize option**: Automatically normalize output
- **Include noise option**: Include noise component in export

### Project Management
- **New Canvas**: Create a blank canvas with configurable duration (1-300 seconds) and sample rate for drawing partials from scratch
- **Save Project**: Save all partials, settings, and noise data to .spectra file
- **Load Project**: Restore complete project state from saved file
- **Dynamic duration**: Timeline automatically extends when partials are moved or created beyond original file length

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Play/Pause |
| 1 | Select tool |
| 2 | Rectangle select |
| 3 | Lasso select |
| 4 | Brush select |
| 5 | Pen (draw) tool |
| 6 | Line tool |
| 7 | Pitch tool |
| 8 | Time tool |
| F | Toggle freeze frame mode |
| I | Invert selection (flip frequencies) |
| G | Toggle grid display |
| M | Toggle audio preview |
| Q | Quantize selection (time + freq) |
| +/= | Zoom in (time) |
| - | Zoom out (time) |
| Delete/Backspace | Delete selected |
| Ctrl+N | New blank canvas |
| Ctrl+O | Open file |
| Ctrl+E | Export |
| Ctrl+A | Select all |
| Ctrl+C | Copy |
| Ctrl+V | Paste |
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |
| Ctrl+L | Toggle loop |
| Arrow Left/Right | Step frames (in freeze mode) |
| Escape | Deselect all / Close modals |

## Mouse Controls

| Action | Effect |
|--------|--------|
| Click | Select partial / Use current tool |
| Drag | Tool-specific action |
| Shift+Drag | Pan view |
| Alt+Drag | Pan view (alternative) |
| Mouse Wheel | Zoom time |
| Shift+Wheel | Zoom frequency |

## Getting Started

1. Open `index.html` in a modern web browser (Chrome, Firefox, Edge recommended)
2. Either:
   - Click "New" or press Ctrl+N to create a blank canvas (specify duration and sample rate)
   - Click "Open" or press Ctrl+O to load an audio file (WAV, MP3, OGG, etc.) and wait for analysis
3. Use selection tools to select partials, or use drawing tools (Pen, Line) to create new partials
4. Apply edits using the sidebar panels or keyboard shortcuts
5. Press Space to play and hear your changes
6. Export when finished

## User Interface Layout

Spectra uses a dual-sidebar layout with the main spectral editor in the center.

### Left Sidebar (Analysis & Settings)

#### Analysis
Configure FFT parameters (FFT size, hop size, window type, minimum dB threshold).

#### Partial Tracking
Fine-tune partial detection with max partials, minimum duration, and frequency tolerance.

#### Noise/Residual
Analyze and enable noise component. Adjust mix level for resynthesis.

#### Display
Set frequency range (min/max Hz), frequency scale (logarithmic, linear, or mel), and color mode.

#### Grid
Configure snap grid for time and frequency. Enable grid display and snap-to-grid behavior.

#### Musical Grid
- **Beat Grid**: Set BPM and beat division for musical timing quantization
- **Pitch Grid**: Set root note and scale for musical pitch snapping

### Right Sidebar (Tools & Effects)

#### Drawing
Configure pen and line tool parameters:
- Pen amplitude (dB)
- Line start/end amplitude
- Auto-harmonics with rolloff control (applies to both Pen and Line tools)

#### Selection Tools
- Select by Criteria: Filter by frequency, amplitude, duration, time
- Invert Selection: Toggle selection state

#### Transform
- Add Harmonics: Generate overtones with configurable count and dropoff
- Explode Selection: Spread partials in time
- Rotate Selection: Rotate by angle around pivot point
- Align Left/Right: Align partials to earliest start or latest end

#### Spectral EQ
Draw and apply a frequency-dependent gain curve with interactive canvas.

#### Effects
- Vibrato/Tremolo: Pitch and amplitude modulation
- Chorus/Unison: Create layered, detuned sounds
- Freeze/Smear: Time-domain spectral effects
- Amplitude Envelope: Draw custom amplitude curves
- Spectral Delay: Frequency-dependent delays with feedback
- Spectral Reverb: Diffused, spacious reverb effect
- Formant Shift: Shift vocal formants
- Merge/Split: Combine or divide partials

### Transport Bar

The transport bar at the bottom provides:
- Playback controls (Stop, Play/Pause)
- Playback rate selector (0.1x to 10x)
- Freeze frame mode with step controls
- Loop toggle
- Time display and position scrubber
- File info (Duration, Sample Rate, Partials count)
- Selection info (Selected count, Frequency range, Time range)
- Level meter and master volume control

## Technical Details

- **Pure JavaScript**: No build process required
- **Web Audio API**: Real-time synthesis and playback
- **Canvas rendering**: Hardware-accelerated graphics
- **Additive synthesis**: Phase-continuous oscillator bank
- **Noise synthesis**: Spectral envelope filtering with band-limited noise

## Browser Compatibility

Tested and working in:
- Google Chrome 90+
- Mozilla Firefox 88+
- Microsoft Edge 90+
- Safari 14+

## License

MIT License

## Acknowledgments

Inspired by [SPEAR](http://www.klingbeil.com/spear/) by Michael Klingbeil.
