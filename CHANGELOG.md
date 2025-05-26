# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial project setup with FastAPI backend
- Integration with Google Cloud Storage for audio file management
- Supabase integration for database and authentication
- Basic ASR model pipeline with 5 different models:
  - Wav2Vec
  - Whisper
  - DeepSpeech
  - Moonshine
  - Mesolitica

### Changed
- [2025-05-26] Replaced `pydub` with `librosa` for audio processing
  - Improved audio loading and processing efficiency
  - Better numpy integration
  - More modern and maintained library
- [2025-05-26] Updated project dependencies:
  - Added `librosa==0.10.2`
  - Added `soundfile==0.12.1`
  - Removed `pydub`
- [2025-05-26] Enhanced `.gitignore`:
  - Added Python-specific patterns (`__pycache__/`, `*.pyc`, etc.)
  - Added virtual environment patterns
  - Added IDE-specific patterns
  - Maintained project-specific model file ignores

### Documentation
- [2025-05-26] Added comprehensive project documentation:
  - Project objectives and goals
  - Core features documentation
  - Technical implementation details
  - Future roadmap
  - ASR model specifications

### Security
- [2025-05-26] Added proper `.gitignore` to prevent sensitive files from being committed
- [2025-05-26] Environment variables properly configured for sensitive data

## [0.1.0] - 2025-05-26 
### Added
- Initial project structure
- Basic FastAPI endpoints for clip processing
- ASR model integration framework
- Virtual environment setup for each ASR model
- Google Cloud Storage integration
- Supabase database integration

### Changed
- Switched from `pydub` to `librosa` for audio processing
- Updated dependency management

### Fixed
- Audio processing pipeline optimization
- Virtual environment isolation for ASR models

### Security
- Proper handling of environment variables
- Secure file handling for audio processing
- Protected API endpoints

### Documentation
- Initial project documentation
- API documentation
- Setup instructions
- Model specifications 