FROM node:14-stretch-slim

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install
# If you are building your code for production
RUN npm ci --only=production

# Bundle app source
COPY . .

ARG MAINTAINER_EMAIL=mail@google.com
ARG DOMAIN=google.com
ENV MAINTAINER_EMAIL=$MAINTAINER_EMAIL
ENV DOMAIN=$DOMAIN

RUN npx greenlock init --config-dir ./greenlock.d --maintainer-email ${MAINTAINER_EMAIL} && rm server.js
RUN npx greenlock add --subject ${DOMAIN} --altnames "${DOMAIN},www.${DOMAIN}"

EXPOSE 80
EXPOSE 443
CMD [ "npm", "start", "--", "--staging"]