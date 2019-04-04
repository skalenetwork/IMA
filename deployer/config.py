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