import pytest
from unittest.mock import patch, MagicMock
from src.asr_models.moonshine.stt_model_moonshine import MoonshineTranscriber

class TestMoonshineTranscriber:
    """Test suite for MoonshineTranscriber class"""

    def test_initialization(self):
        """Test basic initialization of MoonshineTranscriber"""
        transcriber = MoonshineTranscriber()
        assert transcriber.model_name == "moonshine/base"
        assert transcriber.rate == 16000

    def test_invalid_sampling_rate(self):
        """Test initialization with invalid sampling rate"""
        with pytest.raises(ValueError, match="Moonshine models only support a sampling rate of 16000 Hz"):
            MoonshineTranscriber(rate=44100)

    @patch('moonshine.load_model')
    def test_model_loading(self, mock_load_model):
        """Test model loading functionality"""
        # Set up mock
        mock_model = MagicMock()
        mock_load_model.return_value = mock_model

        # Initialize transcriber
        transcriber = MoonshineTranscriber()
        transcriber._initialize_model()

        # Verify model was loaded correctly
        mock_load_model.assert_called_once_with("moonshine/base")
        assert transcriber.model == mock_model

    @patch('moonshine.load_model')
    @patch('moonshine.load_tokenizer')
    def test_transcription(self, mock_tokenizer, mock_load_model, test_audio_file):
        """Test transcription functionality"""
        # Set up mocks
        mock_model = MagicMock()
        mock_model.generate.return_value = ["hello world"]
        mock_load_model.return_value = mock_model
        
        mock_tokenizer_instance = MagicMock()
        mock_tokenizer_instance.decode_batch.return_value = ["hello world"]
        mock_tokenizer.return_value = mock_tokenizer_instance

        # Test transcription
        transcriber = MoonshineTranscriber()
        result = transcriber.transcribe(test_audio_file)

        # Verify results
        assert result == "hello world"
        mock_model.generate.assert_called_once()
        mock_tokenizer_instance.decode_batch.assert_called_once()

    def test_transcription_error_handling(self, test_audio_file):
        """Test error handling during transcription"""
        with patch('moonshine.load_model', side_effect=Exception("Model loading failed")):
            transcriber = MoonshineTranscriber()
            result = transcriber.transcribe(test_audio_file)
            assert "Error during transcription" in result 