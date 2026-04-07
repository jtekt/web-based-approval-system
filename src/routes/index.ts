import { Router } from 'express';
import applicationsRouter from './applications';
import templatesRouter from './templates';
import filesRouter from './files';

const router = Router();

router.use('/applications', applicationsRouter);

router.use('/application_form_templates', templatesRouter);
router.use('/templates', templatesRouter); // alias

router.use('/files', filesRouter);

export default router;
