FROM node:10.15.1

RUN mkdir /ima
WORKDIR /ima

COPY agent agent
COPY npms npms

RUN cd agent && npm i
RUN cd npms/skale-ima && npm i


CMD ["node", "/ima/agent/run.js"]
#CMD exec /bin/bash -c "trap : TERM INT; sleep infinity & wait"

