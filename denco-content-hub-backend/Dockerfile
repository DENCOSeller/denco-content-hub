# Stage 1: Build
FROM python:3.13-slim AS builder

WORKDIR /app

RUN pip install --no-cache-dir --upgrade pip setuptools wheel

COPY pyproject.toml ./
RUN pip install --no-cache-dir . && pip wheel --no-cache-dir --wheel-dir /wheels .

# Stage 2: Runtime
FROM python:3.13-slim

WORKDIR /app

RUN addgroup --system app && adduser --system --ingroup app app

COPY --from=builder /wheels /wheels
RUN pip install --no-cache-dir /wheels/*.whl && rm -rf /wheels

COPY . .

RUN chown -R app:app /app
USER app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
