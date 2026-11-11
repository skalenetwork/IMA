FROM node:24

RUN mkdir /app

COPY VERSION /app
COPY ./ /app

WORKDIR /app

RUN yarn install
