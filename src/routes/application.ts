import { Router } from 'express';
import { update_comment } from '../controllers/recipient_comment';
import {
  read_application,
  delete_application,
  approve_application,
  reject_application,
} from '../controllers/applications';
import applicationPrivacyRouter from './application_privacy';
import filesRouter from './files';
import hankosRouter from './hankos';
import notificationsRouter from './notifications';

const router = Router({ mergeParams: true });

router.route('/').get(read_application).delete(delete_application);

router.route('/approve').post(approve_application);
router.route('/reject').post(reject_application);

router.route('/comment').put(update_comment);

router.use('/privacy', applicationPrivacyRouter);
router.use('/files', filesRouter);
router.use('/hankos', hankosRouter);
router.use('/recipients/:recipient_id/notifications', notificationsRouter);

export default router;
