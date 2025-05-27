import pytest
from unittest.mock import patch, MagicMock
from src.asr_models.whisper.stt_model_whisper import WhisperTranscriber

class TestWhisperTranscriber:
    """Test suite for WhisperTranscriber class"""

    def test_initialization(self):
        """Test basic initialization of WhisperTranscriber"""
        transcriber = WhisperTranscriber()
        assert transcriber.model_name == "base"

    def test_initialization_with_model(self):
        """Test initialization with specific model"""
        transcriber = WhisperTranscriber(model_name="medium")
        assert transcriber.model_name == "medium"

    @patch('whisper.load_model')
    def test_model_loading(self, mock_load_model):
        """Test model loading functionality"""
        # Set up mock
        mock_model = MagicMock()
        mock_load_model.return_value = mock_model

        # Initialize transcriber
        transcriber = WhisperTranscriber()
        transcriber._initialize_model()

        # Verify model was loaded correctly
        mock_load_model.assert_called_once_with("base", device="cpu")
        assert transcriber.model == mock_model

    @patch('whisper.load_model')
    def test_transcription_wav(self, mock_load_model, test_audio_file):
        """Test transcription of WAV file"""
        # Set up mock
        mock_model = MagicMock()
        mock_model.transcribe.return_value = {"text": "hello world"}
        mock_load_model.return_value = mock_model

        # Test transcription
        transcriber = WhisperTranscriber()
        result = transcriber.transcribe(test_audio_file)

        # Verify results
        assert result == "hello world"
        mock_model.transcribe.assert_called_once_with(test_audio_file)

    @patch('whisper.load_model')
    def test_transcription_mp3(self, mock_load_model, test_audio_file):
        """Test transcription of MP3 file"""
        # Set up mock
        mock_model = MagicMock()
        mock_model.transcribe.return_value = {"text": "hello world"}
        mock_load_model.return_value = mock_model

        # Test transcription with MP3 file
        mp3_file = test_audio_file.replace('.wav', '.mp3')
        transcriber = WhisperTranscriber()
        result = transcriber.transcribe(mp3_file)

        # Verify results
        assert result == "hello world"
        mock_model.transcribe.assert_called_once_with(mp3_file)

    def test_transcription_unsupported_format(self):
        """Test transcription with unsupported file format"""
        transcriber = WhisperTranscriber()
        result = transcriber.transcribe("test.ogg")
        assert result == "Unsupported file format. Please use MP3 or WAV files."

    def test_transcription_error_handling(self, test_audio_file):
        """Test error handling during transcription"""
        with patch('whisper.load_model', side_effect=Exception("Model loading failed")):
            transcriber = WhisperTranscriber()
            result = transcriber.transcribe(test_audio_file)
            assert "Error during transcription" in result 