import json
import os
from web3 import Web3

w3 = Web3()


def load_abi(filename: str) -> list:
    artifacts_dir = os.path.join(os.path.dirname(__file__), '../src/ima_predeployed/artifacts')
    artifact_path = os.path.join(artifacts_dir, filename)
    with open(artifact_path) as file:
        return json.load(file)['abi']
