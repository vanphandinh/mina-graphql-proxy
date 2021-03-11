# mina-graphql-proxy
The GraphQL proxy for Mina Protocol\
An alternative public GraphQL API node for Mina: https://minagraph.com

## Description
This tool can be useful for Mina developers who want to run a public Mina GraphQL API node on Docker.\
It exposes the GraphQL API from the Mina node to the internet and removes the queries that pose a threat but still allows querying of the node's data from a public endpoint.\
It automatically adds and renews the HTTPS for your domain, thanks to [LetsEncrypt](https://letsencrypt.org) & [Greenlock-Express](https://www.npmjs.com/package/greenlock-express)

## Requirements
* docker >= 17.12.0+
* docker-compose

## Quick Start
* Clone or download this repository
* Go inside of directory, `cd mina-graphql-proxy`
* Run this command `docker-compose up -d`

## Environments
This docker-compose file contains the following environment variables:

* `MAINTAINER_EMAIL` the default value is **mail@google.com** -- your email, contact for security and critical bug notices
* `DOMAIN` the default value is **google.com** -- the domain name of your GraphQL API node
* `MINA_GRAPHQL_HOST` the default value is **localhost**
* `MINA_GRAPHQL_PORT` the default value is **3085**
* `MINA_GRAPHQL_PATH` the default value is **/graphql**

## Usages
How to use this repo to run a public Mina GraphQL API node with the Mina node.

1. Create a docker network: mina-network
```
docker network create mina-network
```

2. Run a Mina node without block production or snark work creation on Docker

#### Follow Docker section on this guide: https://minaprotocol.com/docs/connecting

* Below flag `--restart=always \` add flag `--network=mina-network \`
* Remove flag ``--mount "type=bind,source=\`pwd\`/keys,dst=/keys,readonly" \``
* Remove flag `-e CODA_PRIVKEY_PASS="YOUR PASSWORD HERE" \`
* Remove flag `--block-producer-key /keys/my-wallet \`

Example: 
```
docker run --name **mina-container-name** -d \
-p 8302:8302 \
--restart=always \
--network=mina-network \
--mount "type=bind,source=`pwd`/.mina-config,dst=/root/.mina-config" \
minaprotocol/mina-daemon-baked:1.0.2-06f3c5c \
daemon \
--insecure-rest-server \
--file-log-level Debug \
--log-level Info \
--peer-list-url https://storage.googleapis.com/seed-lists/finalfinal2_seeds.txt
```

3. Run the GraphQL proxy container
* Clone or download this repository, `git clone https://github.com/vanphandinh/mina-graphql-proxy.git`
* Go inside of directory, `cd mina-graphql-proxy`
* Run the docker-compose 
```
MAINTAINER_EMAIL=your@email.com DOMAIN=your-domain.com MINA_GRAPHQL_HOST=mina docker-compose up -d
```

4. Check if your server blocked the following ports: `80` and `443` if yes, open it to the world.
#### Congratulations! you've run a public GraphQL node for Mina successfully. Visit https://your-domain.com now.

## Troubleshooting  
If the mina-graphql-proxy can't connect to `mina:3085`:  

If the connection hangs, then the following options are possible:  
- Access to port `3085` is blocked via ufw\iptables  
- You did not add a docker container flag `--network=mina-network \`  
- Node is not synced yet. For this reason the stopper can't connect  

2. Port responds, but the stopper still can't connect  
`iptables -D OUTPUT -d 172.16.0.0/12 -j DROP`  
it's because of the blocking of private subnets that the docker uses  

## Uninstall  
```
rm -rf mina-graphql-proxy; \
docker rm -f mina-graphql-api; \
docker system prune -af
```
