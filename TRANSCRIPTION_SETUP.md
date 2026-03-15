# Meeting Transcription Setup Guide

## Issue
You're seeing "Transcription failed. Try again with a different method" because the transcription service needs proper configuration.

## Available Methods

### Option 1: OpenAI Cloud Transcription (Recommended) ✅

**Pros:**
- Quick and easy setup
- No local dependencies
- Highly accurate
- Works immediately

**Cons:**
- Requires active internet connection
- Uses OpenAI API credits (~$0.006 per minute of audio)

**Setup Steps:**

1. **Get a Direct OpenAI API Key:**
   - Go to https://platform.openai.com/api-keys
   - Sign up or log in
   - Click "Create new secret key"
   - Copy the key (starts with `sk-...`, NOT `sk-or-v1-...`)

2. **Update `.env` file:**
   ```env
   # Replace the existing OPENAI_API_KEY with your direct OpenAI key
   OPENAI_API_KEY=sk-proj-your-actual-openai-key-here
   ```

3. **Restart the backend server:**
   ```powershell
   # Stop the backend (Ctrl+C in the terminal)
   # Then restart:
   npm start
   ```

4. **Use the "OpenAI Cloud" button** in the meeting transcription interface

---

### Option 2: Local Whisper Transcription 🖥️

**Pros:**
- Completely free
- Works offline
- Privacy - data stays on your machine

**Cons:**
- Requires Python installation
- Initial setup more complex
- Slower on older hardware
- Requires ~1-5GB disk space for models

**Setup Steps:**

1. **Install Python 3.10 or higher:**
   - Download from https://www.python.org/downloads/
   - During installation, check "Add Python to PATH"
   - Verify installation:
     ```powershell
     python --version
     ```

2. **Install OpenAI Whisper:**
   ```powershell
   pip install openai-whisper
   
   # Install FFmpeg (required by Whisper)
   # Option A: Using Chocolatey (recommended)
   choco install ffmpeg
   
   # Option B: Manual installation
   # Download from https://www.gyan.dev/ffmpeg/builds/
   # Extract and add to PATH
   ```

3. **Update `.env` file:**
   ```env
   # Set WHISPER_PYTHON_PATH to your Python executable
   # Find it by running: where python
   WHISPER_PYTHON_PATH=C:\\Python311\\python.exe
   
   # Choose model size (tiny=fastest, large=most accurate)
   WHISPER_MODEL=small
   ```

4. **Restart the backend server**

5. **Use the "Local Whisper" button** in the meeting transcription interface

---

## Current Configuration Status

### Your `.env` file has:
```env
OPENAI_API_KEY=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
WHISPER_PYTHON_PATH=
WHISPER_MODEL=small
```

### Issues Detected:
❌ **OPENAI_API_KEY format is wrong** - The key starts with `sk-or-v1-` which indicates it's an OpenRouter proxy key, not a direct OpenAI API key. OpenRouter keys won't work with the OpenAI SDK's transcription API.

❌ **WHISPER_PYTHON_PATH is empty** - Local transcription will fail until you install Python and set this path.

---

## Quick Fix (Choose One):

### Fix #1: Get Direct OpenAI API Key
1. Visit https://platform.openai.com/api-keys
2. Create new key
3. Replace the OPENAI_API_KEY in `.env` with the new key
4. Restart backend

### Fix #2: Set Up Local Whisper
1. Install Python 3.10+
2. Run: `pip install openai-whisper`
3. Install FFmpeg: `choco install ffmpeg`
4. Find Python path: `where python`
5. Update `WHISPER_PYTHON_PATH` in `.env` with the path (use `\\` for Windows paths)
6. Restart backend

---

## Testing the Fix

1. Start a meeting and record it
2. After the meeting ends, go to the Recordings tab
3. Click on a recording
4. You'll see transcription options:
   - **OpenAI Cloud** (cloud icon) - Uses your OpenAI API key
   - **Local Whisper** (CPU icon) - Uses local Python installation
5. Choose the method you configured and click it
6. Wait for transcription to complete (15-60 seconds depending on recording length)

---

## Troubleshooting

### "Local Whisper is not configured. Python binary not found"
- Make sure Python is installed: `python --version`
- Update `WHISPER_PYTHON_PATH` in `.env` with correct path
- Use `\\` for paths on Windows: `C:\\Python311\\python.exe`
- Restart backend

### "OpenAI API error: Invalid API key"
- Check that your API key is correct
- Make sure it's a direct OpenAI key (starts with `sk-proj-...` or `sk-...`)
- NOT an OpenRouter key (which starts with `sk-or-...`)
- Verify your OpenAI account has credits

### "FFmpeg not found"
- Install FFmpeg: `choco install ffmpeg`
- Or download manually and add to PATH
- Restart terminal after installation

### Transcription takes too long
- For local: Use a smaller model (`WHISPER_MODEL=tiny`)
- For cloud: Check your internet connection
- Recording length affects processing time (1-2x the recording duration)

---

## Model Sizes (Local Whisper Only)

| Model  | Size | Speed | Accuracy | Recommended For |
|--------|------|-------|----------|-----------------|
| tiny   | ~75MB | Fastest | Good | Testing, short clips |
| base   | ~150MB | Fast | Better | General use |
| small  | ~500MB | Medium | Very Good | ✅ Recommended default |
| medium | ~1.5GB | Slow | Excellent | High accuracy needed |
| large  | ~3GB | Slowest | Best | Maximum accuracy |

---

## Cost Comparison

### OpenAI Cloud:
- ~$0.006 per minute of audio
- 10-minute meeting = $0.06
- 1-hour meeting = $0.36

### Local Whisper:
- Completely free
- One-time setup cost (disk space)
- Processing time depends on your CPU

---

## Need Help?

Check the backend console logs for detailed error messages. They start with:
- `🎙️ [TRANSCRIPTION]` - For cloud transcription
- `🎙️ [LOCAL TRANSCRIPTION]` - For local transcription
- `❌` - For errors
