import pytest
import os
from pathlib import Path

@pytest.fixture
def test_audio_file():
    """Fixture for test audio file path"""
    return os.path.join(os.path.dirname(__file__), 'fixtures/audio/sample.wav')

@pytest.fixture
def mock_audio_data():
    """Fixture for mock audio data"""
    return b"dummy audio content"

@pytest.fixture
def temp_output_dir(tmp_path):
    """Fixture for temporary output directory"""
    return str(tmp_path) 