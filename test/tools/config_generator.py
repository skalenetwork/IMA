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

import json
from tools.config import Config

def config_generator(src_root, json_filename):
    def _internal_config_generator(current_preconfig):
        if type(current_preconfig) is not dict:
            raise TypeError('Config should be a dictionary')

        is_config = True
        for key, value in current_preconfig.items():
            if type(value) is list:
                is_config = False
                for current_value in value:
                    if type(current_value) is dict:
                        preconfig_copy = current_preconfig.copy()
                        preconfig_copy.pop(key)
                        for config_object in _internal_config_generator({**preconfig_copy, **current_value}):
                            yield config_object
                    else:
                        for config_object in _internal_config_generator({**current_preconfig, key: value}):
                            yield config_object
                break

        if is_config:
            yield Config(src_root, current_preconfig)

    with open(json_filename) as config_file:
        preconfig = json.load(config_file)
        for config in _internal_config_generator(preconfig):
            yield config
