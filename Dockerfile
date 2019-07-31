FROM node:10.15.1

RUN mkdir /ima
WORKDIR /ima

RUN cd proxy && npm i
RUN cd agent && npm i
RUN cd npms/skale-mta && npm i

COPY . .


CMD ["node", "/ima/agent/run.js"]
#CMD exec /bin/bash -c "trap : TERM INT; sleep infinity & wait"

