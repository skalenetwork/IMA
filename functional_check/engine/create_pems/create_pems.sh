#!/bin/bash

#wget -O jq https://github.com/stedolan/jq/releases/download/jq-1.6/jq-linux64; chmod +x ./jq
sudo apt-get install jq || true

rm -f a.csr || true
rm -f a.csr.signgleline || true
ls -1

if [ -z "$URL_SGX_WALLET_HTTP" ]
then
    # export URL_SGX_WALLET_HTTP="http://127.0.0.1:1027"
    export URL_SGX_WALLET_HTTP="http://45.76.36.246:1027"
    # export URL_SGX_WALLET_HTTP="http://192.168.2.59:1027"
    echo "URL_SGX_WALLET_HTTP is empty, defaulting to $URL_SGX_WALLET_HTTP"
else
    echo "URL_SGX_WALLET_HTTP=$URL_SGX_WALLET_HTTP (value came from env)"
fi

if [ -z "$URL_SGX_WALLET_HTTPS" ]
then
    # export URL_SGX_WALLET_HTTPS="https://127.0.0.1:1026"
    export URL_SGX_WALLET_HTTPS="https://45.76.36.246:1026"
    # export URL_SGX_WALLET_HTTPS="https://192.168.2.59:1026"
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
echo "CERT_NAME_UNIQUE=$CERT_NAME_UNIQUE"

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
#a_csr_value=$a_csr_value\\n
echo $a_csr_value

echo " "
echo " ---"
echo " --- curl sign"
echo " ---"
rm ./sign_resilt.json || true
sign_request_json='{ "jsonrpc": "2.0", "id": 2, "method": "SignCertificate", "params": { "certificate": "'$a_csr_value'" } }'
curl -X POST --data \
    "$sign_request_json" \
    -v \
    -H 'content-type:application/json;' \
    $URL_SGX_WALLET_HTTP > ./sign_resilt.json
cat ./sign_resilt.json | jq
sign_hash=`cat ./sign_resilt.json | jq -r ".result.hash"`
echo "sign_hash =" $sign_hash

echo " "
echo " ---"
echo " --- get certificate"
echo " ---"
rm -f ./get_certificate_result.json || true
get_certificate_json='{ "jsonrpc": "2.0", "id": 2, "method": "GetCertificate", "params": { "hash": "'$sign_hash'" } }'
curl -X POST --data \
    "$get_certificate_json" \
    -v \
    -H 'content-type:application/json;' \
    $URL_SGX_WALLET_HTTP > ./get_certificate_result.json
cat ./get_certificate_result.json | jq
certificate=`cat ./get_certificate_result.json | jq -r ".result.cert"`
#echo " --- got certificate"
#echo $certificate
echo $certificate \
    | sed 's/^.*\(-----BEGIN CERTIFICATE-----.*\)/\1/g' \
    | sed 's/-----BEGIN CERTIFICATE-----/-----BEGIN-CERTIFICATE-----/g' \
    | sed 's/-----END CERTIFICATE-----/-----END-CERTIFICATE-----/g' \
    | tr " " "\n" \
    | sed 's/-----BEGIN-CERTIFICATE-----/-----BEGIN CERTIFICATE-----/g' \
    | sed 's/-----END-CERTIFICATE-----/-----END CERTIFICATE-----/g' \
    > ./client.crt

# # generate client certificate signed by root ones:
# echo " "
# echo " ---"
# echo " --- create client cert"
# echo " ---"
# #cd cert 
# #./create_client_cert
# #sign csr
# yes | openssl ca -config ca.config -in $CSR_FILE -out "client.crt"

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


echo " "
echo " ---"
echo " --- test"
echo " ---"127.0.0
curl \
    -X POST --data \
    '{ "jsonrpc": "2.0", "id": 1, "method": "importBLSKeyShare", "params": { "keyShareName": "nBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3C4ceRhzMAZnG87PwlkzMROHsm3B", "n": 2, "t": 2, "index" : 1, "keyShare": "21043165427057050523208250969869713544622230829814517880078280390613973680760" } }' \
    -H 'content-type:application/json;' \
    -v \
    --cacert ./rootCA.pem --key $KEY_PEM_FILE --cert ./client.pem \
    $URL_SGX_WALLET_HTTPS -k
echo " "
echo " "








