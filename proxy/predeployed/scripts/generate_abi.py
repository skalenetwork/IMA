#!/usr/bin/env python
from ima_predeployed.generator import generate_abi
import json


def main():
    print(json.dumps(generate_abi(), sort_keys=True, indent=4))


if __name__ == '__main__':
    main()
