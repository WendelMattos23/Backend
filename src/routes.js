const express = require('express');
const raizControllers = require('./controllers/raizControllers');
const userControllers = require('./controllers/userControllers');
const authorization = require('./middleware/authorization');

const routes = express.Router();


routes.get('/',raizControllers.raiz);
routes.get('/user', authorization , userControllers.searchUsersAll);
routes.post('/user',userControllers.create);
routes.post('/userauth', userControllers.searcherUser);


module.exports = routes;