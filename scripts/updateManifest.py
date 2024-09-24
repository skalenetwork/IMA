#!/usr/bin/env python

'''The script updates manifest file to fix _initialized type after openzeppelin contracts upgrade'''

import sys
import json


def main():
    manifest_filename = sys.argv[1]
    with open(manifest_filename) as f:
        manifest = json.load(f)
        for impl in manifest['impls'].keys():
            storage = manifest['impls'][impl]['layout']['storage']
            for slot in storage:
                if slot['contract'] == 'Initializable' and slot['label'] == '_initialized' and slot['type'] == 't_bool':
                    slot['type'] = 't_uint8'
    with open(manifest_filename, 'w') as f:
        f.write(json.dumps(manifest, indent=2))

if __name__ == '__main__':
    main()