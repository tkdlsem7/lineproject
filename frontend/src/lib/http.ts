import axios from 'axios';

/**
 * 프록시(`/api → http://localhost:8000`) 를 이용한 Axios 인스턴스
 */
export const http = axios.create({
  baseURL: '/api',
  withCredentials: true, // JWT 쿠키 전송 시 필요
});
