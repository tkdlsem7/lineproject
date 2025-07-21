FROM python:3.12-slim
WORKDIR /app

# 의존 파일만 먼저 복사 → 캐시 활용
COPY requirements.txt .
RUN pip install -r requirements.txt

# 애플리케이션 코드 복사
COPY . .

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
