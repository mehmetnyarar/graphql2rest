const GraphQL2REST = require('./graphql2rest');
const { generateGqlQueryFiles } = require('./gqlgenerator');
const { generateOpenAPIFile } = require('./openapi');

const { init } = GraphQL2REST;

module.exports = { init, generateGqlQueryFiles, generateOpenAPIFile };
