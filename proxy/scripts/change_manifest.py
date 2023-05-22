#!/usr/bin/env python

'''The script updates manifest file to fix _initialized type after openzeppelin contracts upgrade'''

import sys
import json

versions = ['1.0.0', '1.1.0', '1.2.0', '1.2.1', '1.2.2', '1.3.0', '1.3.1', '1.3.2', '1.3.3']

def main():
    manifest_filename = sys.argv[1]
    if (manifest_filename[11:16] not in versions):
        return
    with open(manifest_filename) as f:
        manifest = json.load(f)
        # cspell:disable-next-line
        for impl in manifest['impls'].keys():
            # cspell:disable-next-line
            storage = manifest['impls'][impl]['layout']['storage']
            for slot in storage:
                if slot['contract'] == 'Initializable' and slot['label'] == '_initialized' and slot['type'] == 't_bool':
                    slot['type'] = 't_uint8'
    with open(manifest_filename, 'w') as f:
        f.write(json.dumps(manifest, indent=2))

if __name__ == '__main__':
    main()
    