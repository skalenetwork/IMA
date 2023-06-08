#   SPDX-License-Identifier: AGPL-3.0-only
#   -*- coding: utf-8 -*-
#
#   This file is part of SKALE IMA.
#
#   Copyright (C) 2019-Present SKALE Labs
#
#   SKALE IMA is free software: you can redistribute it and/or modify
#   it under the terms of the GNU Affero General Public License as published by
#   the Free Software Foundation, either version 3 of the License, or
#   (at your option) any later version.
#
#   SKALE IMA is distributed in the hope that it will be useful,
#   but WITHOUT ANY WARRANTY; without even the implied warranty of
#   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#   GNU Affero General Public License for more details.
#
#   You should have received a copy of the GNU Affero General Public License
#   along with SKALE IMA.  If not, see <https://www.gnu.org/licenses/>.

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

                info(f'Preparing test {test_name}')
                test.prepare()
                info(f'Starting test {test_name}')
                test.execute()
                info(f'Cleaning up after test {test_name}')
                test.clean_up()

                if test.is_passed():
                    info(f'Test "{test_name}" passed')
                else:
                    error(f'CRITICAL INTEGRATION TEST ERROR: Test "{test_name}" failed')
                    exit(1)
        info('All tests passed')
