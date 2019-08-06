from logging import error

from os import system

def execute(command: str):
    exit_code = system(command)
    if exit_code:
        error(f'Command "{command}" failed with exit code {exit_code}')
        exit(1)
