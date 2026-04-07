import { Router } from 'express';
import { file_upload, get_file } from '../controllers/files';

const router = Router({ mergeParams: true });

router.route('/').post(file_upload);

router.route('/:file_id').get(get_file);

export default router;
