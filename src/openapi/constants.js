const GQL_OPERATIONS = ['Query', 'Mutation', 'Subscription'];

const SCHEMAS_PATH = '#/components/schemas/';

const formatMap = {
	Boolean: {
		type: 'boolean',
	},
	Date: {
		type: 'string',
		format: 'date-time',
	},
	Float: {
		type: 'number',
		format: 'float',
	},
	Int: {
		type: 'integer',
		format: 'int32',
	},
	ID: {
		type: 'string',
	},
	Upload: {
		type: 'string',
		format: 'binary',
	},
	String: {
		type: 'string',
	},
};

const DEFAULT_API_KEY_HEADER = {
	type: 'apiKey',
	name: 'apikey',
	in: 'header',
};

const DEFAULT_API_KEY_QUERY = {
	type: 'apiKey',
	name: 'apiKey',
	in: 'query',
};

module.exports = {
	GQL_OPERATIONS,
	SCHEMAS_PATH,
	formatMap,
	DEFAULT_API_KEY_HEADER,
	DEFAULT_API_KEY_QUERY,
};
