FROM node:10.15.1

RUN mkdir /ktm
WORKDIR /ktm

RUN npm install colors web3@1.0.0-beta.35 ethereumjs-tx ethereumjs-wallet ethereumjs-util
RUN npm install --save-dev @babel/plugin-transform-runtime
RUN npm install --save @babel/runtime

COPY . .


CMD ["node", "/ktm/agent/run.js"]


#RUN npm install -g truffle@4.1.13

