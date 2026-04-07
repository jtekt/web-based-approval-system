import { Router } from 'express';
import singleApplicationRouter from './application';
import {
  create_application,
  read_applications,
  get_application_types,
} from '../controllers/applications';

const router = Router({ mergeParams: true });

router.route('/').post(create_application).get(read_applications);

router.route('/types').get(get_application_types);

router.use('/:application_id', singleApplicationRouter);

export default router;
