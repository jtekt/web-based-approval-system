import { Router } from 'express';
import { update_hankos } from '../controllers/hankos.js';

const router = Router({ mergeParams: true });

router.route('/').put(update_hankos);

export default router;
