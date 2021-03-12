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
const https = require("https");
const fs = require("fs");
const httpProxy = require("http-proxy");

const { hiddenFields } = require("./config");

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
  const transformers = [
    new FilterRootFields((operation, fieldName, field) => !field.isDeprecated),
    new FilterRootFields(
      (operation, fieldName, field) => hiddenFields.indexOf(fieldName) < 0
    ),
  ];

  return transformSchema(originalSchema, transformers);
}

async function main() {
  const graphqlUri = `${MINA_GRAPHQL_HOST}:${MINA_GRAPHQL_PORT}${MINA_GRAPHQL_PATH}`;

  const remoteSchema = await getRemoteSchema({
    uri: `http://${graphqlUri}`,
    subscriptionsUri: `ws://${graphqlUri}`,
  });
  const schema = wrapSchema(remoteSchema);

  const app = express();

  app.get("/", (req, res) => {
    res.status(301).redirect("/graphql");
  });

  const server = new ApolloServer({
    schema,
    playground: true,
    tracing: true,
    introspection: true,
  });
  server.applyMiddleware({ app });

  // we need the raw https server
  const httpsServer = https.createServer(
    {
      key: fs.readFileSync("./ssl/private.key"),
      cert: fs.readFileSync("./ssl/certificate.crt"),
      ca: fs.readFileSync("./ssl/ca_bundle.crt"),
    },
    app
  );
  // server.installSubscriptionHandlers(httpsServer);

  // Set up proxy server for websocket
  const proxy = httpProxy.createProxyServer({
    target: { host: MINA_GRAPHQL_HOST, port: MINA_GRAPHQL_PORT },
    ws: true,
  });
  proxy.on("error", (err) => console.log("Error in proxy server:", err));

  // Proxy websocket upgrades
  httpsServer.on("upgrade", (req, socket, head) => proxy.ws(req, socket, head));

  httpsServer.listen(443, () => {
    console.log(`🚀 Server ready at https://localhost${server.graphqlPath}`);
    console.log(
      `🚀 Subscriptions ready at wss://localhost${server.subscriptionsPath}`
    );
  });
}

main().catch(console.log);
