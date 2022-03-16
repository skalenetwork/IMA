FROM node:16

RUN apt-get update
RUN apt-get install -y build-essential zlib1g-dev libncurses5-dev libgdbm-dev libnss3-dev libssl-dev libreadline-dev libffi-dev wget
RUN curl -O https://www.python.org/ftp/python/3.7.3/Python-3.7.3.tar.xz
RUN tar -xf Python-3.7.3.tar.xz
RUN cd Python-3.7.3; ./configure --enable-optimizations; make -j 4 build_all; make altinstall; cd ..
RUN python3.7 --version
RUN which python3.7
RUN rm -f /usr/bin/python3
RUN ln -s /usr/local/bin/python3.7 /usr/bin/python3
RUN python3 --version
RUN which python3

RUN mkdir /ima
WORKDIR /ima

COPY proxy proxy
COPY agent agent
COPY npms npms
COPY VERSION VERSION

RUN mkdir /ima/bls_binaries
COPY scripts/bls_binaries /ima/bls_binaries

RUN chmod +x /ima/bls_binaries/bls_glue
RUN chmod +x /ima/bls_binaries/hash_g1
RUN chmod +x /ima/bls_binaries/verify_bls

RUN npm install -g node-gyp
RUN which node-gyp
RUN node-gyp --version
RUN npms/scrypt/get_scrypt_npm.sh

RUN cd proxy && yarn install && cd ..
RUN cd npms/skale-owasp && yarn install && cd ../..
RUN cd npms/skale-ima && yarn install && cd ../..
RUN cd agent && yarn install && cd ..

CMD ["bash", "/ima/agent/run.sh"]
