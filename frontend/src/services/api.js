import axios from 'axios';

const api = axios.create({
  baseURL: 'https://sistemadeconta.onrender.com/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

export const cuentasAPI = {
  getAll: (params) => api.get('/cuentas/', { params }),
  getById: (codigo) => api.get(`/cuentas/${codigo}`),
  create: (data) => api.post('/cuentas/', data),
  update: (codigo, data) => api.put(`/cuentas/${codigo}`, data),
  delete: (codigo) => api.delete(`/cuentas/${codigo}`),
};

export default api;
