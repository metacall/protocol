import express from 'express';
import swaggerUi, { JsonObject } from 'swagger-ui-express';
import YAML from 'yamljs';
const PORT: number = parseInt(process.env.PORT as string, 10) || 5000;
const app: express.Application = express();
const swaggerDocument: unknown = YAML.load('./swagger.yaml');

app.use(
	'/api-docs',
	swaggerUi.serve,
	swaggerUi.setup(swaggerDocument as JsonObject)
);

app.listen(PORT, () => {
	console.log(`Listening on port ${PORT}`);
});
