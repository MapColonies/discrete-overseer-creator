FROM node:18 as build


WORKDIR /tmp/buildApp

COPY ./map-colonies-mc-utils-2.0.0.tgz ./
COPY ./package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:18.14.2-slim as production

ENV NODE_ENV=production
ENV SERVER_PORT=8080


WORKDIR /usr/src/app

COPY --chown=node:node package*.json ./

RUN npm ci --only=production

COPY --chown=node:node --from=build /tmp/buildApp/dist .
COPY --chown=node:node ./config ./config


USER node
EXPOSE 8080
CMD ["node", "--max_old_space_size=512", "./index.js"]
