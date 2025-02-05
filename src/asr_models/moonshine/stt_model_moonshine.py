from playsound import playsound
from audioread import base
from moonshine import moonshine

# Verify ASSETS_DIR
print("ASSETS_DIR:", moonshine.ASSETS_DIR)

# Try transcribing
try:
    result = moonshine.transcribe(moonshine.ASSETS_DIR / 'beckett.wav', 'moonshine/tiny')
    playsound(moonshine.ASSETS_DIR / 'beckett.wav')
    print("First Transcription:", result)

    result2 = moonshine.transcribe("../../../datasets/cv-corpus-17.0-delta-2024-03-15/en/clips/common_voice_en_39587501.mp3", "moonshine/base")
    playsound("../../../datasets/cv-corpus-17.0-delta-2024-03-15/en/clips/common_voice_en_39587501.mp3")
    print("Second Transcription:", result2)

    result3 = moonshine.transcribe("../../../datasets/cv-corpus-17.0-delta-2024-03-15/en/clips/common_voice_en_39586350.mp3", "moonshine/base")
    playsound("../../../datasets/cv-corpus-17.0-delta-2024-03-15/en/clips/common_voice_en_39586350.mp3")
    print("Third Transcription:", result3)
except Exception as e:
    print("Error:", e)
