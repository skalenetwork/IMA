#!/usr/bin/env python3

import os
import sys
import subprocess


def calculate_version(release_version):
    if '-' not in release_version:
        return release_version
    parts = release_version.strip().split('-')
    [main_part, tail_part] = [parts[0], '-'.join(parts[1:])]
    [branch, build_number] = tail_part.split('.')
    if branch == 'stable':
        if int(build_number) == 0:
            return main_part
        else:
            return main_part + '.post' + build_number
    elif branch == 'beta':
        return main_part + 'b' + build_number
    elif branch == 'develop':
        return main_part + 'a' + build_number
    else:
        return main_part + '.dev' + str(abs(hash(tail_part)))

def getVersion():
    version_key = 'VERSION'
    if os.environ.get(version_key):
        return os.environ.get(version_key)

    try:
        tag = subprocess.run("git describe --tags", shell=True, check=True, capture_output=True)
        return tag.stdout.decode('utf-8')[:-1]
    except:
        with open('../../VERSION') as f:
            return f.readline().rstrip()

def main():
    version = getVersion()
    print(calculate_version(version))


if __name__ == '__main__':
    main()
