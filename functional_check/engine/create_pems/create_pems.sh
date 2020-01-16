#!/bin/bash

if [ -z "$URL_SGX_WALLET_HTTP" ]
then
    export URL_SGX_WALLET_HTTP="http://127.0.0.1:1031"
    echo "URL_SGX_WALLET_HTTP is empty, defaulting to $URL_SGX_WALLET_HTTP"
else
    echo "URL_SGX_WALLET_HTTP=$URL_SGX_WALLET_HTTP (value came from env)"
fi

if [ -z "$URL_SGX_WALLET_HTTPS" ]
then
    export URL_SGX_WALLET_HTTPS="https://127.0.0.1:1030"
    echo "URL_SGX_WALLET_HTTPS is empty, defaulting to $URL_SGX_WALLET_HTTPS"
else
    echo "URL_SGX_WALLET_HTTPS=$URL_SGX_WALLET_HTTPS (value came from env)"
fi

if [ -z "$CERT_NAME_UNIQUE" ]
then
    export CERT_NAME_UNIQUE=`cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w ${1:-32} | head -n 1`
    echo "CERT_NAME_UNIQUE is empty, using generated random value $CERT_NAME_UNIQUE"
else
    echo "CERT_NAME_UNIQUE=$CERT_NAME_UNIQUE (value came from env)"
fi

mkdir -p ./new_certs || true
touch ./index.txt || true
touch ./index.txt.attr || true
if [ ! -f ./serial ]; then
    echo "'serail' file will be created"
    echo "01" > ./serial
fi

echo " "
echo " ---"
echo " --- create"
echo " ---"
export CSR_FILE=a.csr
export CSR_FILE_single_line=a.csr.signgleline
export KEY_FILE=k.key
export KEY_PEM_FILE=k.pem
echo "CERT_NAME_UNIQUE=$CERT_NAME_UNIQUE"
echo $CERT_NAME_UNIQUE > generated_cert_name.txt
openssl req -new -sha256 -nodes -out $CSR_FILE -newkey rsa:2048 -keyout $KEY_FILE -subj /CN=$CERT_NAME_UNIQUE

echo " "
echo " ---"
echo " --- $CSR_FILE"
echo " ---"
cat $CSR_FILE

echo " "
echo " ---"
echo " --- $KEY_FILE"
echo " ---"
cat $KEY_FILE

echo " "
echo " ---"
echo " --- $KEY_PEM_FILE"
echo " ---"
#openssl rsa -in $KEY_FILE -text > $KEY_PEM_FILE
openssl rsa -in $KEY_FILE -out $KEY_PEM_FILE
cat $KEY_PEM_FILE

echo " "
echo " ---"
echo " --- single line csr"
echo " ---"
# send content of a.csr as single line (by replacing real end of lines with \n) to port 1031
rm -f $CSR_FILE_single_line || true
cp $CSR_FILE $CSR_FILE_single_line
a_csr_value=`sed -E ':a;N;$!ba;s/\r{0,1}\n/\\\\n/g' $CSR_FILE`
echo $a_csr_value

echo " "
echo " ---"
echo " --- curl sign"
echo " ---"
curl -X POST --data \
    '{ "jsonrpc": "2.0", "id": 2, "method": "SignCertificate", "params": { "certificate": "$a_csr_value" } }' \
    -v \
    -H 'content-type:application/json;' \
    $URL_SGX_WALLET_HTTP

# generate client certificate signed by root ones:
echo " "
echo " ---"
echo " --- create client cert"
echo " ---"
#cd cert 
#./create_client_cert
#sign csr
yes | openssl ca -config ca.config -in $CSR_FILE -out "client.crt"

echo " "
echo " ---"
echo " --- client.crt"
echo " ---"
cat client.crt

echo " "
echo " ---"
echo " --- client.pem"
echo " ---"
openssl x509 -inform PEM -in client.crt > client.pem
cat client.pem
#cd ..

echo " "
echo " ---"
echo " --- test"
echo " ---"
curl \
    -X POST --data \
    '{ "jsonrpc": "2.0", "id": 1, "method": "importBLSKeyShare", "params": { "keyShareName": "nBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3C4ceRhzMAZnG87PwlkzMROHsm3B", "n": 2, "t": 2, "index" : 1, "keyShare": "21043165427057050523208250969869713544622230829814517880078280390613973680760" } }' \
    -H 'content-type:application/json;' \
    -v \
    --cacert ./rootCA.pem --key $KEY_PEM_FILE --cert ./client.pem \
    $URL_SGX_WALLET_HTTPS -k


