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
