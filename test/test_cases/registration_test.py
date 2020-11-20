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

from time import sleep, time
from logging import debug, error

from tools.test_case import TestCase
from tools.test_pool import test_pool


class RegistrationTest(TestCase):

    def __init__(self, config):
        super().__init__('Registration test', config)

    def start_agent_without_registration(self):
        print(f'Without Registration')
        self.deployer.deploy()
        self.agent.start()
        sleep(30)
        self.agent.stop()

    def start_agent_with_registration_step1(self):
        print(f'Registration step 1')
        self.deployer.deploy()
        self.agent.register1()
        self.agent.start()
        sleep(30)
        self.agent.stop()

    def start_agent_with_registration_step2(self):
        print(f'Registration step 2')
        self.deployer.deploy()
        self.agent.register2()
        self.agent.start()
        sleep(30)
        self.agent.stop()

    def start_agent_with_all_registration_steps(self):
        print(f'All registration steps')
        self.deployer.deploy()
        self.agent.register()
        self.agent.start()
        sleep(30)
        self.agent.stop()

    def _execute(self):
        
        self.start_agent_without_registration()
        self.start_agent_with_registration_step1()
        self.start_agent_with_registration_step2()
        self.start_agent_with_all_registration_steps()
        self._mark_passed()


test_pool.register_test(RegistrationTest)
