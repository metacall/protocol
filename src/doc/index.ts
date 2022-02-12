import express from 'express';
import swaggerUi, { JsonObject } from 'swagger-ui-express';
import YAML from 'yamljs';

if (process.env.NODE_ENV == 'development' || process.env.NODE_ENV == 'dev') {
	console.log(process.env);
	const PORT: number = parseInt(process.env.PORT as string, 10) || 5000;
	const app: express.Application = express();
	const swaggerDocument: unknown = YAML.load('./swagger.yaml');

	const options = {
		swaggerOptions: {
			supportedSubmitMethods: []
		}
	};

	app.use(
		'/api-docs',
		swaggerUi.serve,
		swaggerUi.setup(swaggerDocument as JsonObject, options)
	);

	app.listen(PORT, () => {
		console.log(`Listening on port ${PORT}`);
	});
}
