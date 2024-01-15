FROM node:18

RUN mkdir /app

COPY VERSION /app
COPY proxy /app

WORKDIR /app/proxy

RUN yarn install

ENV NODE_OPTIONS=--max_old_space_size=4096
