import pytest
from unittest.mock import patch, MagicMock
from src.asr_models.wav2vec.stt_model_wav2vec import Wav2VecTranscriber

class TestWav2VecTranscriber:
    """Test suite for Wav2VecTranscriber class"""

    def test_initialization(self):
        """Test basic initialization of Wav2VecTranscriber"""
        transcriber = Wav2VecTranscriber()
        assert transcriber.model_name == "facebook/wav2vec2-base-960h"
        assert transcriber.rate == 16000

    def test_initialization_with_model(self):
        """Test initialization with specific model"""
        transcriber = Wav2VecTranscriber(model_name="facebook/wav2vec2-large-960h")
        assert transcriber.model_name == "facebook/wav2vec2-large-960h"

    @patch('transformers.Wav2Vec2ForCTC.from_pretrained')
    @patch('transformers.Wav2Vec2Processor.from_pretrained')
    def test_model_loading(self, mock_processor, mock_model):
        """Test model loading functionality"""
        # Set up mocks
        mock_model_instance = MagicMock()
        mock_processor_instance = MagicMock()
        mock_model.return_value = mock_model_instance
        mock_processor.return_value = mock_processor_instance

        # Initialize transcriber
        transcriber = Wav2VecTranscriber()
        transcriber._initialize_model()

        # Verify model and processor were loaded correctly
        mock_model.assert_called_once_with("facebook/wav2vec2-base-960h")
        mock_processor.assert_called_once_with("facebook/wav2vec2-base-960h")
        assert transcriber.model == mock_model_instance
        assert transcriber.processor == mock_processor_instance

    @patch('transformers.Wav2Vec2ForCTC.from_pretrained')
    @patch('transformers.Wav2Vec2Processor.from_pretrained')
    def test_transcription(self, mock_processor, mock_model, test_audio_file):
        """Test transcription functionality"""
        # Set up mocks
        mock_model_instance = MagicMock()
        mock_processor_instance = MagicMock()
        mock_model.return_value = mock_model_instance
        mock_processor.return_value = mock_processor_instance

        # Mock the processor's behavior
        mock_processor_instance.return_value = {"input_values": [0.1, 0.2, 0.3]}
        mock_model_instance.return_value = MagicMock(logits=[[0.1, 0.2, 0.3]])
        mock_processor_instance.batch_decode.return_value = ["hello world"]

        # Test transcription
        transcriber = Wav2VecTranscriber()
        result = transcriber.transcribe(test_audio_file)

        # Verify results
        assert result == "hello world"
        mock_processor_instance.assert_called_once()
        mock_model_instance.assert_called_once()
        mock_processor_instance.batch_decode.assert_called_once()

    def test_transcription_error_handling(self, test_audio_file):
        """Test error handling during transcription"""
        with patch('transformers.Wav2Vec2ForCTC.from_pretrained', side_effect=Exception("Model loading failed")):
            transcriber = Wav2VecTranscriber()
            result = transcriber.transcribe(test_audio_file)
            assert "Error during transcription" in result 