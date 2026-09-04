import axios from 'axios';

const API = axios.create({
  baseURL: 'http://127.0.0.1:8000/api',
});

// Attach JWT Token to requests if available
API.interceptors.request.use(
  (req) => {
    const token = localStorage.getItem('token');
    if (token) {
      req.headers.Authorization = `Bearer ${token}`;
    }
    return req;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await API.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return res.data.url;
};

export default API;
