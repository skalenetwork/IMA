FROM node:18

RUN mkdir /app

COPY VERSION /app
COPY proxy /app

WORKDIR /app

RUN yarn install
