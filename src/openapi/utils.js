/**
 * The content of this file is partly inpired from
 * https://github.com/Urigo/SOFA/blob/master/src/open-api/
 */

const {
	isEnumType,
	isInputObjectType,
	isIntrospectionType,
	isListType,
	isNonNullType,
	isObjectType,
	isRequiredArgument,
	isScalarType,
} = require('graphql');

const { GQL_OPERATIONS, SCHEMAS_PATH, formatMap } = require('./constants');

const hasProperty = (obj, key) => Object.hasOwnProperty.call(obj, key);

const mapToPrimitive = (type) => {
	const property = formatMap[type];

	if (!property) console.warn(`No primitive type for: ${type}.`);

	return property || { type: 'object' };
};

const mapToRef = type => ({
	$ref: `${SCHEMAS_PATH}${type}`,
});

const resolveFieldType = (type) => {
	if (isNonNullType(type)) {
		return resolveFieldType(type.ofType);
	}

	if (isListType(type)) {
		return {
			type: 'array',
			items: resolveFieldType(type.ofType),
		};
	}

	if (isObjectType(type) || isInputObjectType(type)) {
		return mapToRef(type.name);
	}

	if (isScalarType(type)) {
		return mapToPrimitive(type.name);
	}

	if (isEnumType(type) && type.astNode && type.astNode.values) {
		return {
			type: 'string',
			enum: type.astNode.values.map(value => value.name.value),
		};
	}

	console.warn(`No field type for: ${type}.`);

	return {
		type: 'object',
	};
};

const resolveField = field => resolveFieldType(field.type);

const buildSchemaObjectFromArg = (arg) => {
	const { description } = arg;
	const descriptionProp = description ? { description } : {};

	return {
		[arg.name]: {
			...descriptionProp,
			...resolveField(arg),
		},
	};
};

const buildSchemaObjectFromType = (type) => {
	const { description } = type;

	const required = [];
	const properties = {};

	const fields = type.getFields();
	for (const fieldName in fields) {
		if (hasProperty(fields, fieldName)) {
			const field = fields[fieldName];

			if (isNonNullType(field.type)) {
				required.push(field.name);
			}

			properties[fieldName] = resolveField(field);

			if (field.description) {
				properties[fieldName].description = field.description;
			}

			if (field.args && field.args.length) {
				const req = field.args.reduce(
					(acc, arg) => (isRequiredArgument(arg) ? [...acc, arg.name] : acc),
					[]
				);
				const requestBodyProperties = field.args.reduce(
					(acc, arg) => ({
						...acc,
						...buildSchemaObjectFromArg(arg),
					}),
					{}
				);

				const requiredProp = req.length ? { required: req } : {};
				properties[fieldName].requestBodySchema = {
					...requiredProp,
					properties: requestBodyProperties,
				};
			}
		}
	}

	const requiredProp = required.length ? { required } : {};
	const descriptionProp = description ? { description } : {};

	return {
		type: 'object',
		...requiredProp,
		properties,
		...descriptionProp,
	};
};

const isComponentSchema = type => (isObjectType(type) || isInputObjectType(type))
  && !isIntrospectionType(type)
  && !GQL_OPERATIONS.includes(type.name);

const buildComponentSchemas = (schema) => {
	const types = schema.getTypeMap();

	return Object.keys(types).reduce((schemas, name) => {
		const type = types[name];

		return isComponentSchema(type)
			? {
				...schemas,
				[name]: buildSchemaObjectFromType(type),
			}
			: schemas;
	}, {});
};

const buildSchemas = schema => ({
	query: buildSchemaObjectFromType(schema.getQueryType()),
	mutation: buildSchemaObjectFromType(schema.getMutationType()),
	components: buildComponentSchemas(schema),
});

const getRefType = ref => ref.replace(SCHEMAS_PATH, '');
const getRefName = (schema) => {
	if (schema.$ref) return getRefType(schema.$ref);
	if (schema.items && schema.items.$ref) return getRefType(schema.items.$ref);

	return null;
};

const getComponentSchemas = ({ schema, components, currentSchemas }) => {
	let schemas = Object.assign({}, currentSchemas);

	const { requestBodySchema, ...responseSchema } = schema;
	if (requestBodySchema) {
		const { properties } = requestBodySchema;
		for (const propName in properties) {
			if (hasProperty(properties, propName)) {
				const propSchema = properties[propName];
				schemas = getComponentSchemas({
					components,
					schema: propSchema,
					currentSchemas: schemas,
				});
			}
		}
	}

	const schemaRefName = getRefName(responseSchema);
	if (!schemaRefName) return schemas; // there is no $ref
	if (schemas[schemaRefName]) return schemas; // $ref already exists

	schemas[schemaRefName] = Object.assign({}, components[schemaRefName]);

	const { properties } = schemas[schemaRefName];
	for (const propName in properties) {
		if (hasProperty(properties, propName)) {
			const propSchema = properties[propName];
			const propRefName = getRefName(propSchema);

			if (propRefName) {
				schemas = getComponentSchemas({
					components,
					schema: propSchema,
					currentSchemas: schemas,
				});
			}
		}
	}

	return schemas;
};

const getOperationSchema = ({ query, mutation }, verb, operation) => {
	switch (verb) {
		case 'get':
			return query.properties[operation];
		case 'post':
		case 'put':
		case 'patch':
		case 'delete':
			return mutation.properties[operation];
		default:
			return undefined;
	}
};

const getRequestBody = (schema) => {
	if (!schema) return undefined;

	return {
		content: {
			'application/json': {
				schema,
			},
		},
	};
};

const getResponses = (responses, schema) => Object.keys(responses).reduce((res, statusCode) => ({
	...res,
	[statusCode]: {
		...responses[statusCode],
		content: {
			'application/json': {
				schema,
			},
		},
	},
}), {});

module.exports = {
	buildSchemas,
	getComponentSchemas,
	getOperationSchema,
	getRequestBody,
	getResponses
};
