import subprocess
import platform
import time

class UpgradeUtility:
    def __init__(self, logger, lang):
        self.logger = logger
        self.lang = lang
    
    def log_system_info(self):
        self.logger.info(f"OS: {platform.system()} {platform.release()}")
        self.logger.info(f"Python: {platform.python_version()}")
        return True
    
    def check_git_installed(self):
        try:
            subprocess.run(["git", "--version"], capture_output=True, check=True)
            return True
        except Exception:
            return False
    
    def run_command(self, command):
        try:
            result = subprocess.run(command, shell=True, capture_output=True, text=True)
            return result.returncode == 0, result.stdout, result.stderr
        except Exception as e:
            return False, "", str(e)
    
    def time_operation(self, func, *args, **kwargs):
        start_time = time.time()
        result = func(*args, **kwargs)
        elapsed_time = time.time() - start_time
        return result, elapsed_time
    
    def get_submodule_list(self):
        try:
            result = subprocess.run(
                ["git", "submodule", "status"],
                capture_output=True,
                text=True,
                check=True
            )
            return result.stdout.strip().split("\n") if result.stdout else []
        except Exception:
            return []
    
    def has_submodules(self):
        return len(self.get_submodule_list()) > 0

