import { Router } from 'express';
import { get_connected } from '../db';

// Probes for Kubernetes: /live only tells that the process responds,
// /ready also requires the database connection
const router = Router();

router.get('/live', (req, res) => {
  res.send({ status: 'ok' });
});

router.get('/ready', (req, res) => {
  if (!get_connected()) res.status(503).send({ status: 'unavailable' });
  else res.send({ status: 'ok' });
});

export default router;
