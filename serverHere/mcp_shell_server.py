#!/usr/bin/env python3
"""
Simple MCP Shell Server
Allows executing shell commands on the local machine.
"""
import asyncio
import subprocess
import sys
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent


def create_shell_server() -> Server:
    """Create and configure the MCP shell server."""
    server = Server("shell-commander")

    @server.list_tools()
    async def list_tools() -> list[Tool]:
        """List available shell tools."""
        return [
            Tool(
                name="execute_command",
                description="Execute a shell command on the local machine. Returns the command output (stdout and stderr).",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "command": {
                            "type": "string",
                            "description": "The shell command to execute"
                        },
                        "timeout": {
                            "type": "integer",
                            "description": "Timeout in seconds (default: 30)",
                            "default": 30
                        }
                    },
                    "required": ["command"]
                }
            )
        ]

    @server.call_tool()
    async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle tool calls."""
        if name != "execute_command":
            raise ValueError(f"Unknown tool: {name}")
        
        command = arguments.get("command")
        timeout = arguments.get("timeout", 30)
        
        if not command:
            raise ValueError("Command is required")
        
        try:
            # Execute command with timeout
            process = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                shell=True
            )
            
            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(),
                    timeout=timeout
                )
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
                return [
                    TextContent(
                        type="text",
                        text=f"Command timed out after {timeout} seconds"
                    )
                ]
            
            # Prepare output
            output_parts = []
            if stdout:
                output_parts.append(f"STDOUT:\n{stdout.decode('utf-8', errors='replace')}")
            if stderr:
                output_parts.append(f"STDERR:\n{stderr.decode('utf-8', errors='replace')}")
            
            output = "\n\n".join(output_parts) if output_parts else "Command completed with no output"
            exit_code = process.returncode
            
            result = f"Exit Code: {exit_code}\n\n{output}"
            
            return [TextContent(type="text", text=result)]
            
        except Exception as e:
            return [TextContent(type="text", text=f"Error executing command: {str(e)}")]

    return server


async def main():
    """Run the MCP shell server."""
    server = create_shell_server()
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options()
        )


if __name__ == "__main__":
    asyncio.run(main())

