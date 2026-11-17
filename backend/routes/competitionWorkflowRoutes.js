const router=require('express').Router();
const controller=require('../controllers/competitionWorkflowController');
router.get('/:competitionId',controller.read);
router.post('/:competitionId/:action',controller.mutate);
module.exports=router;
