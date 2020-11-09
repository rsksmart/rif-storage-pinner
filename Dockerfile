# Compiler container
FROM node:10-alpine AS compiler

RUN apk add --no-cache build-base git python

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --only=production && npm install tasegir
COPY . ./
RUN npm run compile

# Runtime container
FROM node:10-alpine

RUN mkdir -p /srv/app && chown node:node /srv/app \
 && mkdir -p /srv/data && chown node:node /srv/data

USER node
WORKDIR /srv/app
COPY --from=compiler --chown=node:node /usr/src/app/lib ./lib/
COPY --from=compiler --chown=node:node /usr/src/app/node_modules ./node_modules/
COPY --chown=node:node package*.json ./
COPY --chown=node:node bin ./bin/
COPY --chown=node:node config ./config/

RUN sed -i 's#"./src/cli"#"./lib/cli"#g' package.json

ENV RIFS_DB '/srv/data/db.sqlite'
ENV NODE_ENV 'production'

ENTRYPOINT [ "./bin/entrypoint" ]

LABEL maintainer="adam@iovlabs.org"
LABEL description="Pinning service for RIF Storage"
