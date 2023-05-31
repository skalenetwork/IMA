import json
import os
from web3 import Web3
from time import sleep

w3 = Web3()

wait_connection_seconds = 20
while not w3.is_connected():
    if wait_connection_seconds > 0:
        sleep(1)
        wait_connection_seconds -= 1
    else:
        raise ConnectionError("Can't connect to geth")


def load_abi(filename: str) -> list:
    artifacts_dir = os.path.join(os.path.dirname(__file__), '../src/ima_predeployed/artifacts')
    artifact_path = os.path.join(artifacts_dir, filename)
    with open(artifact_path) as file:
        return json.load(file)['abi']
