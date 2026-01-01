"""
Open-LLM-VTuber Server
========================
This module contains the WebSocket server for Open-LLM-VTuber, which handles
the WebSocket connections, serves static files, and manages the web tool.
It uses FastAPI for the server and Starlette for static file serving.
"""

import os
import shutil
from contextlib import asynccontextmanager

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import Response
from starlette.staticfiles import StaticFiles as StarletteStaticFiles

from .routes import init_client_ws_route, init_webtool_routes, init_proxy_route
from .service_context import ServiceContext
from .config_manager.utils import Config


# Create a custom StaticFiles class that adds CORS headers
class CORSStaticFiles(StarletteStaticFiles):
    """
    Static files handler that adds CORS headers to all responses.
    """

    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        response.headers.update({
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*"
        })

        if path.endswith(".js"):
            response.headers["Content-Type"] = "application/javascript"

        return response




class WebSocketServer:
    """
    API server for Open-LLM-VTuber. This contains the websocket endpoint for the Electron client.

    Creates and configures a FastAPI app, registers all routes
    (WebSocket, web tools, proxy) and mounts cache directory for audio files.

    Args:
        config (Config): Application configuration containing system settings.
        default_context_cache (ServiceContext, optional):
            Pre‑initialized service context for sessions' service context to reference to.
            **If omitted, `initialize()` method needs to be called to load service context.**

    Notes:
        - If default_context_cache is omitted, call `await initialize()` to load service context cache.
        - Use `clean_cache()` to clear and recreate the local cache directory.
    """

    def __init__(self, config: Config, default_context_cache: ServiceContext = None):
        self.config = config
        self.default_context_cache = (
            default_context_cache or ServiceContext()
        )  # Use provided context or initialize a new empty one waiting to be loaded
        # It will be populated during the initialize method call

        self.app = FastAPI(
            title="Open-LLM-VTuber Server", lifespan=self.lifespan
        )  # Added lifespan

        # Add global CORS middleware
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

        # Include routes, passing the context instance
        # The context will be populated during the initialize step
        self.app.include_router(
            init_client_ws_route(default_context_cache=self.default_context_cache),
        )
        self.app.include_router(
            init_webtool_routes(default_context_cache=self.default_context_cache),
        )

        # Initialize and include proxy routes if proxy is enabled
        system_config = config.system_config
        if hasattr(system_config, "enable_proxy") and system_config.enable_proxy:
            # Construct the server URL for the proxy
            host = system_config.host
            port = system_config.port
            server_url = f"ws://{host}:{port}/client-ws"
            self.app.include_router(
                init_proxy_route(server_url=server_url),
            )

        # Mount cache directory for audio file access (needed for Electron client)
        if not os.path.exists("cache"):
            os.makedirs("cache")
        self.app.mount(
            "/cache",
            CORSStaticFiles(directory="cache"),
            name="cache",
        )

        # Add Middleware for Security Headers (CSP) to address Electron warnings
        @self.app.middleware("http")
        async def add_security_headers(request, call_next):
            response = await call_next(request)
            # Standard CSP that allows necessary resources but avoids "unsafe-eval" warning where possible
            # Note: Live2D SDK might need some relaxed settings, but we try to be as strict as possible
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "  # Live2D often needs unsafe-eval
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: http: https:; "
                "media-src 'self' data: blob: http: https:; "
                "connect-src 'self' ws: wss: http: https:;"
            )
            return response

    @asynccontextmanager
    async def lifespan(self, app: FastAPI):
        """Asynchronous lifespan manager for FastAPI."""
        # Startup logic
        from loguru import logger

        logger.info("Server starting up, initializing context...")
        await self.initialize()
        yield
        # Shutdown logic
        logger.info("Server shutting down, cleaning up context...")
        if hasattr(self.default_context_cache, "close"):
            await self.default_context_cache.close()

    async def initialize(self):
        """Asynchronously load the service context from config.
        Calling this function is needed if default_context_cache was not provided to the constructor."""
        await self.default_context_cache.load_from_config(self.config)

    @staticmethod
    def clean_cache():
        """Clean the cache directory by removing and recreating it."""
        cache_dir = "cache"
        if os.path.exists(cache_dir):
            shutil.rmtree(cache_dir)
            os.makedirs(cache_dir)
