const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
require("dotenv").config();

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Savings Backend - Client API',
      version: '1.0.0',
      description: 'Client API for the Savings Backend application',
    },
    servers: [
      {
        url: `http://127.0.0.1:3000`,
        description: 'Development server',
      },
    ],
  },
  apis: ['./backend/docs.yml'], // Path to the API docs
};

const specs = swaggerJsdoc(options);

module.exports = { specs, swaggerUi }; 