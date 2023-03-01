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

from tools.blockchain import BlockChain
from proxy.deployer import Deployer
from agent.agent import Agent
from time import time
from logging import error

class TestCase:
    name = None
    deployer = None
    agent = None
    passed = False
    blockchain = None
    config = None
    time_started = time()
    timeout = None
    timeout_of_entire_test = None

    def __init__(self, name, config, timeout=10, timeout_of_entire_test=80000):
        self.name = name
        self.deployer = Deployer(config)
        self.agent = Agent(config)
        self.blockchain = BlockChain(config)
        self.config = config
        self.timeout = timeout
        self.timeout_of_entire_test = timeout_of_entire_test


    def prepare(self):
        self.deployer.deploy()
        self.agent.register()
        self.agent.start()
        self._prepare()

    def execute(self):
        self.time_started = time()
        self._execute()
        if self._timeout():
            error(f'CRITICAL INTEGRATION TEST ERROR: Test "{self.name}" will be marked failed due to timeout')
            self.passed = False

    def clean_up(self):
        self.agent.stop()
        self._clean_up()

    def is_passed(self):
        return self.passed

    def get_name(self):
        return self.name

    # protected

    def _prepare(self):
        pass

    def _execute(self):
        pass

    def _clean_up(self):
        pass

    def _mark_passed(self):
        self.passed = True

    def _timeout(self):
        if self.timeout is not None and time() > self.time_started + self.timeout_of_entire_test:
            return True
        else:
            return False
        return False
