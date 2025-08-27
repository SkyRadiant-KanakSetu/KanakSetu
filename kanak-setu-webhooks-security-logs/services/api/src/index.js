import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import routes from './routes.js';
import { config } from './config.js';
import paymentRoutes from './payments.js';
import kycRoutes from './kyc.js';
import authRoutes from './auth.js';
import { authRequired } from './middleware.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.use('/', (req, res, next) => {
  // simple root for container health
  if (req.path === '/' || req.path === '/health') {
    return res.json({ ok: true });
  }
  next();
});

app.use('/auth', authRoutes);
app.use('/auth/me', authRequired(), (req,res)=>res.json({ ok:true }));
app.use('/', routes);
app.use('/payments', paymentRoutes);
app.use('/kyc', kycRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api', routes); // also mount under /api for reverse-proxy

app.use((err, req, res, next) => {
  console.error('[API ERROR]', err);
  res.status(500).json({ error: 'internal_error' });
});

app.listen(config.port, () => {
  console.log(`API running on port ${config.port}`);
});
