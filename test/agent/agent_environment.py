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

from tools.environment import Environment
from os import chdir
from tools.utils import execute

class AgentEnvironment(Environment):
    config = None

    def __init__(self, config):
        self.config = config

    def prepare(self):
        chdir(self.config.skale_ima_root)
        execute('rm -rf node_modules')
        execute('yarn install')

        chdir(self.config.agent_root + '/proxy')
        execute('rm -rf node_modules')
        execute('yarn install')

        chdir(self.config.agent_root + '/npms/skale-owasp')
        execute('rm -rf node_modules')
        execute('yarn install')

        chdir(self.config.agent_root + '/npms/skale-ima')
        execute('rm -rf node_modules')
        execute('yarn install')

        chdir(self.config.agent_root)
        execute('rm -rf node_modules')
        execute('yarn install')