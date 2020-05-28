FROM node:10.15.1

RUN mkdir /ima
WORKDIR /ima

COPY proxy proxy
COPY agent agent
COPY npms npms

RUN mkdir /ima/bls_binaries
COPY scripts/bls_binaries /ima/bls_binaries

RUN cd proxy && yarn install && cd ..
RUN cd npms/skale-owasp && yarn install && cd ../..
RUN cd npms/skale-ima && yarn install && cd ../..
RUN cd agent && yarn install && cd ..


CMD ["bash", "/ima/agent/run.sh"]
#CMD exec /bin/bash -c "trap : TERM INT; sleep infinity & wait"

