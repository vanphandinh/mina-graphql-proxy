const {
  ApolloServer,
  introspectSchema,
  makeRemoteExecutableSchema,
  transformSchema,
  FilterRootFields,
} = require("apollo-server-express");
const { HttpLink } = require("apollo-link-http");
const fetch = require("node-fetch");
const express = require("express");
const httpProxy = require("http-proxy");

const { hiddenFields } = require("./config");

const MINA_GRAPHQL_HOST = process.env["MINA_GRAPHQL_HOST"] || "localhost";
const MINA_GRAPHQL_PORT = process.env["MINA_GRAPHQL_PORT"] || 3085;
const MINA_GRAPHQL_PATH = process.env["MINA_GRAPHQL_PATH"] || "/graphql";
const MAINTAINER_EMAIL = process.env["MAINTAINER_EMAIL"] || "mail@google.com";

async function getRemoteSchema({ uri }) {
  const link = new HttpLink({ uri, fetch });

  const schema = await introspectSchema(link);
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

require("greenlock-express")
  .init({
    packageRoot: __dirname,

    // contact for security and critical bug notices
    maintainerEmail: MAINTAINER_EMAIL,

    // where to look for configuration
    configDir: "./greenlock.d",

    // whether or not to run at cloudscale
    cluster: true,
  })
  // Serves on 80 and 443
  // Get's SSL certificates magically!
  .ready(httpsWorker)
  .master(function () {
    console.log("I'm the master");
  });

async function httpsWorker(glx) {
  const graphqlUri = `${MINA_GRAPHQL_HOST}:${MINA_GRAPHQL_PORT}${MINA_GRAPHQL_PATH}`;

  const remoteSchema = await getRemoteSchema({
    uri: `http://${graphqlUri}`,
    // subscriptionsUri: `ws://${graphqlUri}`,
  });
  const schema = wrapSchema(remoteSchema);

  const app = express();

  app.get("/", (req, res) => {
    res.status(301).redirect("/graphql");
  });

  const server = new ApolloServer({
    schema,
    playground: {
      settings: {
        'editor.theme': 'light',
      },
    },
    tracing: true,
    introspection: true,
  });
  server.applyMiddleware({ app });

  // we need the raw https server
  const httpsServer = glx.httpsServer();
  // server.installSubscriptionHandlers(httpsServer);

  // Set up proxy server for websocket
  const proxy = httpProxy.createProxyServer({
    target: { host: MINA_GRAPHQL_HOST, port: MINA_GRAPHQL_PORT },
    ws: true,
  });
  proxy.on("error", (err) => console.log("Error in proxy server:", err));

  // Proxy websocket upgrades
  httpsServer.on("upgrade", (req, socket, head) => proxy.ws(req, socket, head));

  glx.serveApp(app);
}
