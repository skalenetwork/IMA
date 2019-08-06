from tools.config_generator import config_generator
from tools.test_pool import test_pool
from tools.test_case import TestCase

from test_cases import *
# Do not remove this unused import. It is needed for tests registration


class TestRunner:
    src_root = None
    config_filename = 'config.json'

    def __init__(self, src_root, config_filename):
        self.src_root = src_root
        self.config_filename = config_filename

    def run(self):
        for config in config_generator(self.src_root, self.config_filename):
            for test in test_pool.get_tests(config):
                test_name = test.get_name()

                test.prepare()
                test.execute()
                test.clean_up()

                if test.is_passed():
                    print(f'Test "{test_name}" passed')
                else:
                    print(f'Test "{test_name}" failed')
                    exit(1)
        print('All tests passed')
