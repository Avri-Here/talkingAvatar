import os

def select_language():
    lang = os.environ.get("LANG", "en")
    if lang.startswith("zh"):
        return "zh"
    return "en"

