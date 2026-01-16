# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Browser-based audio file editor for simple edits on WAV and AIF files (similar to a stripped-down Audacity). No recording functionality required.

## Required Features

- **Transport controls**: Play/pause/stop audio playback
- **File handling**: Import and export WAV/AIF files with configurable format and quality
- **Waveform display**: Visual waveform with zoom (buttons, shortcuts, shift+scroll)
- **Audio editing**:
  - Trim: Remove audio outside selection, move selection to start at 0
  - Normalize: Set peak level in dBFS
  - Fade in/out: Based on selection
  - Gain: Apply dB adjustment

## Technical Notes

This is a browser-only application using Web Audio API for audio processing and Canvas/WebGL for waveform visualization.
