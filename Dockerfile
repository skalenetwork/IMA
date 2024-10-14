FROM node:18

RUN mkdir /app

COPY VERSION /app
COPY ./ /app

WORKDIR /app

RUN yarn install
