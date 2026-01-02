import os
import sys
import atexit
import asyncio
import argparse
import subprocess
import warnings
import logging
from pathlib import Path
import tomli
import uvicorn
from loguru import logger
from upgrade_codes.upgrade_manager import UpgradeManager

from src.open_llm_vtuber.server import WebSocketServer
from src.open_llm_vtuber.config_manager import Config, read_yaml, validate_config

os.environ["HF_HOME"] = str(Path(__file__).parent / "models")
os.environ["MODELSCOPE_CACHE"] = str(Path(__file__).parent / "models")

# Disable SSL verification warnings and errors
os.environ["POSTHOG_DISABLED"] = "true"
os.environ["ANONYMIZED_TELEMETRY"] = "false"
import urllib3
import ssl
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Create unverified SSL context
ssl._create_default_https_context = ssl._create_unverified_context

# Patch requests library to disable SSL verification
try:
    import requests
    original_request = requests.Session.request
    def patched_request(self, method, url, **kwargs):
        kwargs['verify'] = False
        return original_request(self, method, url, **kwargs)
    requests.Session.request = patched_request
    
    # Also patch the top-level request function
    original_requests_request = requests.request
    def patched_requests_request(method, url, **kwargs):
        kwargs['verify'] = False
        return original_requests_request(method, url, **kwargs)
    requests.request = patched_requests_request
    requests.get = lambda url, **kwargs: patched_requests_request('GET', url, **kwargs)
    requests.post = lambda url, **kwargs: patched_requests_request('POST', url, **kwargs)
except ImportError:
    pass

# Patch httpx library to disable SSL verification
try:
    import httpx
    original_httpx_client_init = httpx.Client.__init__
    def patched_httpx_client_init(self, **kwargs):
        kwargs['verify'] = False
        return original_httpx_client_init(self, **kwargs)
    httpx.Client.__init__ = patched_httpx_client_init
    
    original_httpx_async_client_init = httpx.AsyncClient.__init__
    def patched_httpx_async_client_init(self, **kwargs):
        kwargs['verify'] = False
        return original_httpx_async_client_init(self, **kwargs)
    httpx.AsyncClient.__init__ = patched_httpx_async_client_init
except ImportError:
    pass

# Patch aiohttp library to disable SSL verification (for edge-tts)
try:
    import aiohttp
    original_aiohttp_client_session_init = aiohttp.ClientSession.__init__
    def patched_aiohttp_client_session_init(self, **kwargs):
        if 'connector' not in kwargs:
            kwargs['connector'] = aiohttp.TCPConnector(ssl=False)
        return original_aiohttp_client_session_init(self, **kwargs)
    aiohttp.ClientSession.__init__ = patched_aiohttp_client_session_init
except ImportError:
    pass

upgrade_manager = UpgradeManager()


def get_version() -> str:
    with open("pyproject.toml", "rb") as f:
        pyproject = tomli.load(f)
    return pyproject["project"]["version"]


def init_logger(console_log_level: str = "INFO") -> None:
    logger.remove()
    # Console output
    logger.add(
        sys.stderr,
        level=console_log_level,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | {message}",
        colorize=True,
    )

    # File output
    logger.add(
        "logs/debug_{time:YYYY-MM-DD}.log",
        rotation="10 MB",
        retention="30 days",
        level="DEBUG",
        format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level: <8} | {name}:{function}:{line} | {message} | {extra}",
        backtrace=True,
        diagnose=True,
    )

    warnings.filterwarnings("ignore", category=ResourceWarning, message=".*unclosed.*")
    warnings.filterwarnings("ignore", message=".*I/O operation on closed pipe.*")

    logging.getLogger("fakeredis").setLevel(logging.WARNING)
    logging.getLogger("docket.worker").setLevel(logging.WARNING)
    




def parse_args():
    parser = argparse.ArgumentParser(description="Open-LLM-VTuber Server")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose logging")
    parser.add_argument(
        "--hf_mirror", action="store_true", help="Use Hugging Face mirror"
    )
    return parser.parse_args()


@logger.catch
def run(console_log_level: str):
    init_logger(console_log_level)
    logger.info(f"Open-LLM-VTuber, version v{get_version()}")

    # Sync user config with default config
    try:
        upgrade_manager.sync_user_config()
    except Exception as e:
        logger.error(f"Error syncing user config: {e}")

    atexit.register(WebSocketServer.clean_cache)

    # Load configurations from yaml file
    config: Config = validate_config(read_yaml("conf.yaml"))
    server_config = config.system_config

    if server_config.enable_proxy:
        logger.info("Proxy mode enabled - /proxy-ws endpoint will be available")

    # Initialize the WebSocket server (synchronous part)
    server = WebSocketServer(config=config)

    # Run the Uvicorn server
    logger.info(f"Starting server on {server_config.host}:{server_config.port}")
    uvicorn.run(
        app=server.app,
        host=server_config.host,
        port=server_config.port,
        log_level=console_log_level.lower(),
    )


if __name__ == "__main__":
    args = parse_args()
    console_log_level = "DEBUG" if args.verbose else "INFO"
    if args.verbose:
        logger.info("Running in verbose mode")
    else:
        logger.info(
            "Running in standard mode. For detailed debug logs, use: uv run run_server.py --verbose"
        )
    if args.hf_mirror:
        os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"
    run(console_log_level=console_log_level)
