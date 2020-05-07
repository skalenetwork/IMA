FROM node:10.15.1

RUN mkdir /ima
WORKDIR /ima

COPY proxy proxy
COPY agent agent
COPY npms npms

RUN cd proxy && yarn install && cd ..
RUN cd npms/skale-owasp && yarn install && cd ../..
RUN cd npms/skale-ima && yarn install && cd ../..
RUN cd agent && yarn install && cd ..


CMD ["node", "/ima/agent/run.js"]
#CMD exec /bin/bash -c "trap : TERM INT; sleep infinity & wait"

