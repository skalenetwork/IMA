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

import os

HERE = os.path.dirname(os.path.realpath(__file__))
PROJECT_DIR = os.path.join(HERE, os.pardir)

CREDS_DIR = os.path.join(PROJECT_DIR, 'creds')

CREDS_FILES = os.listdir(CREDS_DIR)

LONG_LINE = '=' * 100
DEFAULT_USER = 'root'
NODE_DATA_PATH = '/skale_node_data'
SCHAINS_DIR_NAME = 'schains'
SCHAINS_DIR_PATH = os.path.join(NODE_DATA_PATH, SCHAINS_DIR_NAME)

PROJECT_PROXY_PATH = os.path.join(PROJECT_DIR, 'proxy')