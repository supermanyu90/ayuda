# Gemma 3 4B (open weights) served by Ollama, with the model baked into the image
# so cold starts don't download 3.3 GB. Exposes Ollama's native and /v1 APIs on 11434.
FROM ollama/ollama:latest
ENV OLLAMA_HOST=0.0.0.0:11434 OLLAMA_KEEP_ALIVE=24h
RUN sh -c "ollama serve & PID=\$!; sleep 5; ollama pull gemma3:4b; kill \$PID"
EXPOSE 11434
ENTRYPOINT ["ollama", "serve"]
