import { Router } from 'express';
import {
  create_template,
  read_templates,
  read_template,
  update_template,
  delete_template,
  add_template_manager,
} from '../controllers/templates';

const router = Router();

router.route('/').post(create_template).get(read_templates);

router
  .route('/:template_id')
  .get(read_template)
  .put(update_template)
  .patch(update_template)
  .delete(delete_template);

router.route('/:template_id/managers').post(add_template_manager);

export default router;
