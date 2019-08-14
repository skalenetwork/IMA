import sys
import os
import logging

from tools.test_runner import TestRunner


def main():
    argv, tests, prefix = [], None, 'tests='
    for argument in sys.argv:
        if argument.startswith(prefix):
            tests = argument[len(prefix):].split(',')
        else:
            argv.append(argument)

    if len(argv) < 2:
        src_root = os.path.abspath(os.pardir)
    else:
        src_root = argv[1]

    test_runner = TestRunner(src_root, 'config.json', tests)
    test_runner.run()


if __name__ == '__main__':
    level = logging.INFO
    # level = logging.DEBUG
    logging.basicConfig(format='%(asctime)s - %(levelname)s - %(message)s', level=level)
    main()
