#!/usr/bin/env python3
"""
Local Whisper transcription helper.
Called by Node.js backend as a child process.

Usage:
  python3 whisper_transcribe.py <audio_file_path> [--model small]

Outputs JSON to stdout:
  { "text": "...", "segments": [{"start": 0.0, "end": 2.5, "text": "..."}] }

Errors are printed to stderr.
"""

import sys
import json
import argparse
import os

def main():
    parser = argparse.ArgumentParser(description="Transcribe audio using local Whisper model")
    parser.add_argument("audio_file", help="Path to the audio/video file to transcribe")
    parser.add_argument("--model", default="small", help="Whisper model size: tiny, base, small, medium, large (default: small)")
    args = parser.parse_args()

    if not os.path.isfile(args.audio_file):
        print(json.dumps({"error": f"File not found: {args.audio_file}"}), file=sys.stderr)
        sys.exit(1)

    try:
        import whisper
    except ImportError:
        print(json.dumps({"error": "openai-whisper package is not installed"}), file=sys.stderr)
        sys.exit(1)

    try:
        print(f"Loading Whisper model '{args.model}'...", file=sys.stderr)
        model = whisper.load_model(args.model)

        print(f"Transcribing: {args.audio_file}", file=sys.stderr)

        # Redirect stdout to stderr during transcription because Whisper
        # prints "Detected language: ..." to stdout which corrupts our JSON output
        original_stdout = sys.stdout
        sys.stdout = sys.stderr
        try:
            result = model.transcribe(args.audio_file, verbose=False)
        finally:
            sys.stdout = original_stdout

        text = result.get("text", "").strip()
        segments = []
        for seg in result.get("segments", []):
            segments.append({
                "start": round(seg["start"], 2),
                "end": round(seg["end"], 2),
                "text": seg["text"].strip(),
            })

        output = {
            "text": text,
            "segments": segments,
        }

        # Print JSON to stdout (this is what Node.js will read)
        print(json.dumps(output))

    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
