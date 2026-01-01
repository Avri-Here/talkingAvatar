import base64
import asyncio
from pydub import AudioSegment
from pydub.utils import make_chunks
from ..agent.output_types import Actions
from ..agent.output_types import DisplayText


def _get_volume_by_chunks(audio: AudioSegment, chunk_length_ms: int) -> list:
    """
    Calculate the normalized volume (RMS) for each chunk of the audio.
    """
    chunks = make_chunks(audio, chunk_length_ms)
    if not chunks:
        return []
    
    volumes = [chunk.rms for chunk in chunks]
    max_volume = max(volumes) if volumes else 0
    if max_volume == 0:
        return [0.0] * len(chunks)
    return [volume / max_volume for volume in volumes]


async def prepare_audio_payload(
    audio_path: str | None,
    chunk_length_ms: int = 20,
    display_text: DisplayText = None,
    actions: Actions = None,
    forwarded: bool = False,
) -> dict[str, any]:
    """
    Prepares the audio payload for sending to a broadcast endpoint.
    """
    if isinstance(display_text, DisplayText):
        display_text = display_text.to_dict()

    if not audio_path:
        return {
            "type": "audio",
            "audio": None,
            "volumes": [],
            "slice_length": chunk_length_ms,
            "display_text": display_text,
            "actions": actions.to_dict() if actions else None,
            "forwarded": forwarded,
        }

    # Offload CPU-intensive operations to a thread pool
    return await asyncio.to_thread(
        _prepare_audio_payload_sync,
        audio_path,
        chunk_length_ms,
        display_text,
        actions,
        forwarded
    )


def _prepare_audio_payload_sync(
    audio_path: str,
    chunk_length_ms: int,
    display_text: dict | None,
    actions: Actions | None,
    forwarded: bool,
) -> dict[str, any]:
    """Synchronous core of audio payload preparation."""
    try:
        audio = AudioSegment.from_file(audio_path)
        # Exporting to WAV and then base64 encoding
        audio_bytes = audio.export(format="wav").read()
        audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")
        volumes = _get_volume_by_chunks(audio, chunk_length_ms)

        return {
            "type": "audio",
            "audio": audio_base64,
            "volumes": volumes,
            "slice_length": chunk_length_ms,
            "display_text": display_text,
            "actions": actions.to_dict() if actions else None,
            "forwarded": forwarded,
        }
    except Exception as e:
        raise ValueError(f"Error processing audio file '{audio_path}': {e}")


# Example usage:
# payload, duration = prepare_audio_payload("path/to/audio.mp3", display_text="Hello", expression_list=[0,1,2])
