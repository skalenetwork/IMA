from logging import info, error

from tools.config_generator import config_generator
from tools.test_pool import test_pool

from test_cases import *
# Do not remove this unused import. It is needed for tests registration


class TestRunner:
    src_root = None
    config_filename = 'config.json'
    tests = None

    def __init__(self, src_root, config_filename, tests):
        self.src_root = src_root
        self.config_filename = config_filename
        self.tests = tests

    def run(self):
        for config in config_generator(self.src_root, self.config_filename):
            for test in test_pool.get_tests(config):
                test_name = test.get_name()
                if self.tests is not None and test_name not in self.tests:
                    info(f'Skip test {test_name}')
                    continue
                else:
                    info(f'Execute test {test_name}')

                test.prepare()
                test.execute()
                test.clean_up()

                if test.is_passed():
                    info(f'Test "{test_name}" passed')
                else:
                    error(f'Test "{test_name}" failed')
                    exit(1)
        info('All tests passed')
