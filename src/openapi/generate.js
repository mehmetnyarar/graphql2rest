const { readFileSync, writeFileSync } = require('fs');
const YAML = require('js-yaml');

const {
	buildSchemas,
	getComponentSchemas,
	getOperationSchema,
	getResponses,
	getRequestBody,
} = require('./utils');

/** Determines the security features for the given API. @see defaults in constants. */
const getSecurityFeatures = (apiKey = {}) => {
	const { header, query } = apiKey;

	if (!header && !query) return {};

	const securitySchemes = {};
	const security = [];

	if (header) {
		securitySchemes.api_key_header = header;
		security.push({ api_key_header: [] });
	}

	if (query) {
		securitySchemes.api_key_query = query;
		security.push({ api_key_query: [] });
	}

	return {
		securitySchemes,
		security,
	};
};

/** Generates a base OpenAPI document. */
const getDocumentTemplate = (api) => {
	const { version, url, title, description, key } = api;
	const { securitySchemes, security } = getSecurityFeatures(key);

	return {
		openapi: '3.0.3',
		info: {
			title,
			description,
			version,
		},
		servers: [{ url }],
		paths: {},
		components: {
			schemas: {},
			securitySchemes,
		},
		security,
	};
};

/** Generates an OpenAPI document. */
const getDocument = (schema, manifest, api) => {
	const doc = getDocumentTemplate(api);
	const schemas = buildSchemas(schema);

	const urls = Object.keys(manifest.endpoints);
	for (const url of urls) {
		const endpoint = manifest.endpoints[url];
		const verbs = Object.keys(endpoint);

		for (const verb of verbs) {
			const method = endpoint[verb];
			const operationSchema = getOperationSchema(
				schemas,
				verb,
				method.operation
			);

			if (operationSchema) {
				doc.components.schemas = getComponentSchemas({
					components: schemas.components,
					schema: operationSchema,
					currentSchemas: doc.components.schemas,
				});

				const { requestBodySchema, ...responseSchema } = operationSchema;
				const operation = {
					[verb]: {
						operationId: method.operation,
						description: method.description,
						requestBody: getRequestBody(requestBodySchema),
						responses: getResponses(method.responses, responseSchema),
					},
				};

				const paths = {
					...(doc.paths[url] || {}),
					...operation,
				};

				doc.paths[url] = paths;
			}
		}
	}

	return doc;
};

/** Generates an OpenAPI file. */
const generateOpenAPIFile = (path, schema, manifest, api) => {
	const document = getDocument(schema, manifest, api);
	const yaml = YAML.dump(document);
	writeFileSync(path, yaml);
};

/** Loads an OpenAPI document from the given path. */
const loadOpenAPIFile = (path) => {
	const file = readFileSync(path);

	return YAML.load(file);
};

module.exports = {
	generateOpenAPIFile,
	loadOpenAPIFile,
};
