import { Router } from 'express';
import { get_connection_status, get_initialized } from '../db';

// Probes for Kubernetes: /live only tells that the process responds,
// /ready also requires the DB setup to be done and the DB to be reachable
const router = Router();

router.get('/live', (req, res) => {
  res.send({ status: 'ok' });
});

router.get('/ready', async (req, res) => {
  if (!get_initialized() || !(await get_connection_status()))
    res.status(503).send({ status: 'unavailable' });
  else res.send({ status: 'ok' });
});

export default router;
