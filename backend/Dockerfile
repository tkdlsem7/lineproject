FROM python:3.12-slim

WORKDIR /app

# 의존성
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ★ 소스를 /app/backend 로 넣어 'backend' 패키지 형성
COPY . /app/backend

# 패키지 루트 잡기
ENV PYTHONPATH=/app

# 개발 테스트면 --reload 유지, 배포면 제거 추천
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
