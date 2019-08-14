from logging import error

from os import system

def execute(command: str, print_command=False):
    if print_command:
        print('Execute:', command)
    exit_code = system(command)
    if exit_code:
        error(f'Command "{command}" failed with exit code {exit_code}')
        exit(1)
