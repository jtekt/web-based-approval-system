import { Router } from 'express';
import { mark_recipient_as_notified } from '../controllers/notifications.js';

const router = Router({ mergeParams: true });

router.route('/').post(mark_recipient_as_notified);

export default router;
