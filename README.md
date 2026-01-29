# AIVoice

A polished Next.js front-end that connects to a hosted PersonaPlex server for real-time, full‑duplex voice conversations.

## Deployment Targets

- **Frontend**: Railway (Next.js)
- **Backend**: Railway (PersonaPlex server with GPU)

## Required Environment Variables

Frontend service (AIVoice):

```
NEXT_PUBLIC_PERSONAPLEX_URL=https://your-personaplex-service.up.railway.app
```

Backend service (PersonaPlex):

```
HF_TOKEN=your_huggingface_token
```

## Notes

- PersonaPlex code is MIT‑licensed; model weights use the NVIDIA Open Model license.
- Browsers require HTTPS for microphone access.
- Web search is not built in; add a separate browsing/search tool on the backend if needed.
- Docker can wire defaults, but secrets like HF_TOKEN must be set in Railway.

