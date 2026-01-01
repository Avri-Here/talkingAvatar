import abc


class TranslateInterface(metaclass=abc.ABCMeta):
    @abc.abstractmethod
    def translate(self, text: str) -> str:
        """Translate the input text to the target language synchronously."""
        raise NotImplementedError

    async def async_translate(self, text: str) -> str:
        """Translate the input text to the target language asynchronously."""
        import asyncio
        return await asyncio.to_thread(self.translate, text)
