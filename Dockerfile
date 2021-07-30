FROM node:14

RUN mkdir /ima
WORKDIR /ima

COPY proxy proxy
COPY agent agent
COPY npms npms

RUN mkdir /ima/bls_binaries
COPY scripts/bls_binaries /ima/bls_binaries

RUN chmod +x /ima/bls_binaries/bls_glue
RUN chmod +x /ima/bls_binaries/hash_g1
RUN chmod +x /ima/bls_binaries/verify_bls

RUN cd proxy && yarn install && cd ..
RUN cd npms/skale-owasp && yarn install && cd ../..
RUN cd npms/skale-ima && yarn install && cd ../..
RUN cd agent && yarn install && cd ..


CMD ["bash", "/ima/agent/run.sh"]
