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
