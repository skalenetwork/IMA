#FROM node:16
FROM ubuntu:jammy

RUN apt-get update
RUN apt-get install -yq software-properties-common
RUN apt-get update
#RUN apt-get upgrade
RUN apt-get install -y build-essential zlib1g-dev libncurses5-dev libgdbm-dev libnss3-dev libssl-dev libreadline-dev libffi-dev wget curl sudo git

RUN curl -sL https://deb.nodesource.com/setup_16.x | sudo -E bash -
RUN apt-get install -y nodejs
RUN node --version
RUN npm --version
RUN npm install npm --global
RUN npm --version
RUN npm install --global yarn
RUN yarn --version

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
RUN cd npms/scrypt; ./get_scrypt_npm.sh; cd ../..

RUN cd proxy && yarn install && cd ..
RUN cd npms/skale-cool-socket && yarn install && cd ../..
RUN cd npms/skale-owasp && yarn install && cd ../..
RUN cd npms/skale-observer && yarn install && cd ../..
RUN cd npms/skale-ima && yarn install && cd ../..
RUN cd agent && yarn install && cd ..
RUN yarn install

CMD ["bash", "/ima/agent/run.sh"]
