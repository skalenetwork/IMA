#!/usr/bin/env python3

import os
import sys


def calculate_version(release_version):
    if '-' not in release_version:
        return release_version
    parts = release_version.strip().split('-')
    [ main_part, tail_part ] = [parts[0], '-'.join(parts[1:])]
    [ branch, build_number ] = tail_part.split('.')
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


def main():
    VERSION_KEY = 'VERSION'
    if VERSION_KEY not in os.environ or not os.environ[VERSION_KEY]:
        print('VERSION environment variable is not set', file=sys.stderr)
        exit(1)
    
    print(calculate_version(os.environ[VERSION_KEY]))


if __name__ == '__main__':
    main()
