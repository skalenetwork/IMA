#!/bin/bash
FILE_SRC="../proxy/proxy.json"
FILE_DST="./abi_main_net.json"
FILE_BAK="${FILE_DST}.bak"
echo "Source file......... '${FILE_SRC}'"
echo "Destination file.... '${FILE_DST}'"
#echo "Backup file......... '${FILE_BAK}'"

if [ ! -f "$FILE_SRC" ]
then
    echo "Source file '${FILE_SRC}' not found."
    exit 101
fi

if [ -f "$FILE_DST" ]
then
    if [ -f "$FILE_BAK" ]
    then
        echo "Removing backup file '${FILE_BAK}'"
        rm -f "$FILE_BAK" > /dev/null
    fi
    echo "Backing-up file '${FILE_DST}' to ${FILE_BAK}'"
    mv "${FILE_DST}" "${FILE_BAK}"
fi

echo "Copying file '${FILE_SRC}' to ${FILE_DST}'"
rm -f "$FILE_DST" > /dev/null
cp "${FILE_SRC}" "${FILE_DST}"

echo "Done."
