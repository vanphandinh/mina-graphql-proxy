// const {
//   ApolloServer,
//   introspectSchema,
//   makeRemoteExecutableSchema,
//   transformSchema,
//   FilterRootFields,
// } = require("apollo-server");
const {
  ApolloServer,
  introspectSchema,
  makeRemoteExecutableSchema,
  transformSchema,
  FilterRootFields,
} = require("apollo-server-express");
const { HttpLink } = require("apollo-link-http");
const { WebSocketLink } = require("apollo-link-ws");
const { split } = require("apollo-link");
const { getMainDefinition } = require("apollo-utilities");
const { SubscriptionClient } = require("subscriptions-transport-ws");
const fetch = require("node-fetch");
const ws = require("ws");
const express = require("express");

const MINA_GRAPHQL_HOST = process.env["MINA_GRAPHQL_HOST"] || "localhost";
const MINA_GRAPHQL_PORT = process.env["MINA_GRAPHQL_PORT"] || 3085;
const MINA_GRAPHQL_PATH = process.env["MINA_GRAPHQL_PATH"] || "/graphql";

async function getRemoteSchema({ uri, subscriptionsUri }) {
  const httpLink = new HttpLink({ uri, fetch });

  // Create WebSocket link with custom client
  const client = new SubscriptionClient(
    subscriptionsUri,
    { reconnect: true },
    ws
  );
  const wsLink = new WebSocketLink(client);

  // Using the ability to split links, we can send data to each link
  // depending on what kind of operation is being sent
  const link = split(
    (operation) => {
      const definition = getMainDefinition(operation.query);
      return (
        definition.kind === "OperationDefinition" &&
        definition.operation === "subscription"
      );
    },
    wsLink, // <-- Use this if above function returns true
    httpLink // <-- Use this if above function returns false
  );

  const schema = await introspectSchema(httpLink);
  const executableSchema = makeRemoteExecutableSchema({ schema, link });

  return executableSchema;
}

function wrapSchema(originalSchema) {
  const hiddenFields = [
    "trackedAccounts",
    "currentSnarkWorker",
    "createAccount",
    "createHDAccount",
    "unlockAccount",
    "lockAccount",
    "deleteAccount",
    "reloadAccounts",
    "exportLogs",
    "setStaking",
    "setSnarkWorker",
    "setSnarkWorkFee",
    "setConnectionGatingConfig",
    "addPeers",
    "archivePrecomputedBlock",
    "archiveExtensionalBlock",
  ];

  const transformers = [
    new FilterRootFields((operation, fieldName, field) => !field.isDeprecated),
    new FilterRootFields(
      (operation, fieldName, field) => hiddenFields.indexOf(fieldName) < 0
    ),
  ];

  return transformSchema(originalSchema, transformers);
}

// async function run() {
//   const graphqlUri = `${MINA_GRAPHQL_HOST}:${MINA_GRAPHQL_PORT}${MINA_GRAPHQL_PATH}`;

//   const remoteSchema = await getRemoteSchema({
//     uri: `http://${graphqlUri}`,
//     subscriptionsUri: `ws://${graphqlUri}`,
//   });
//   const schema = wrapSchema(remoteSchema);

//   const app = express();

//   const server = new ApolloServer({
//     schema,
//     introspection: true,
//     playground: true,
//   });
//   server.applyMiddleware({ app });

//   //   server.listen().then(({ url, subscriptionsUrl }) => {
//   //     console.log(`🚀 Server ready at ${url}`);
//   //     console.log(`🚀 Subscriptions ready at ${subscriptionsUrl}`);
//   //   });
// }

require("greenlock-express")
  .init({
    packageRoot: __dirname,

    // contact for security and critical bug notices
    maintainerEmail: "vanphandinh@outlook.com",

    // where to look for configuration
    configDir: "./greenlock.d",

    // whether or not to run at cloudscale
    cluster: false,
  })
  // Serves on 80 and 443
  // Get's SSL certificates magically!
  .ready(httpsWorker);

async function httpsWorker(glx) {
  const graphqlUri = `${MINA_GRAPHQL_HOST}:${MINA_GRAPHQL_PORT}${MINA_GRAPHQL_PATH}`;

  const remoteSchema = await getRemoteSchema({
    uri: `http://${graphqlUri}`,
    subscriptionsUri: `ws://${graphqlUri}`,
  });
  const schema = wrapSchema(remoteSchema);

  const app = express();

  const server = new ApolloServer({
    schema,
    introspection: true,
    playground: true,
  });
  server.applyMiddleware({ app });

  // we need the raw https server
  const httpServer = glx.httpsServer();

  server.installSubscriptionHandlers(httpServer);

  glx.serveApp(app);
}
