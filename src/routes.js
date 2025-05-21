const express = require('express');
const raizControllers = require('./controllers/raizControllers');
const userControllers = require('./controllers/userControllers');
const authorization = require('./middleware/authorization');

const routes = express.Router();


routes.get('/',raizControllers.raiz);
routes.get('/user', userControllers.searchUsersAll);
routes.post('/user',userControllers.create);
routes.post('/userauth', userControllers.searcherUser);
routes.put('/user/:codcli', userControllers.updateClient);
routes.delete('/user/:codcli', userControllers.deleteClient);
routes.put('/user/:codcli/password', userControllers.updatePassword);
routes.post('/forgot-password', userControllers.forgotPassword);
routes.post('/reset-password', userControllers.resetPassword);
routes.post('/user/:codcli/profile-image', userControllers.uploadProfileImage);


module.exports = routes;