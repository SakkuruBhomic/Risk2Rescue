import time
import re
from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage

class LangChainOrchestrator:
    def __init__(self, base_url="http://127.0.0.1:11434", model="deepseek-r1:8b"):
        self.llm = ChatOllama(
            model=model,
            base_url=base_url,
            temperature=0.0
        )

    def generate_response(self, prompt: str):
        start_time = time.time()
        try:
            messages = [HumanMessage(content=prompt)]
            response = self.llm.invoke(messages)
            
            content = response.content
            
            # Remove <think> tags from deepseek output if embedded
            content_clean = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()
            
            if not content_clean:
                content_clean = content.strip()
                
            end_time = time.time()
            return {
                "status": "ok",
                "model": self.llm.model,
                "response": content_clean,
                "duration_seconds": round(end_time - start_time, 2)
            }
        except Exception as e:
            end_time = time.time()
            return {
                "status": "error",
                "message": str(e),
                "duration_seconds": round(end_time - start_time, 2)
            }

    def generate_decision_brief(self, prompt: str, num_predict: int = 700, timeout: int = 180):
        """
        Dedicated method for Task 17 decision brief.
        Uses configurable num_predict and timeout.
        Strips <think> chain-of-thought. Returns error state if content empty.
        """
        start_time = time.time()
        try:
            llm = ChatOllama(
                model=self.llm.model,
                base_url=self.llm.base_url,
                temperature=0.0,
                num_predict=num_predict,
                timeout=timeout
            )
            messages = [HumanMessage(content=prompt)]
            response = llm.invoke(messages)
            
            content = response.content or ""
            # Strip <think> chain-of-thought — never expose to caller
            content_clean = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()
            
            end_time = time.time()
            duration = round(end_time - start_time, 2)
            
            # Extract done_reason if available via response metadata
            done_reason = None
            if hasattr(response, "response_metadata"):
                done_reason = response.response_metadata.get("done_reason")
                
            if not content_clean:
                return {
                    "status": "error",
                    "error_code": "EMPTY_CONTENT",
                    "done_reason": done_reason,
                    "message": "DeepSeek returned empty visible content. Check done_reason and num_predict.",
                    "model": self.llm.model,
                    "duration_seconds": duration
                }
                
            return {
                "status": "ok",
                "model": self.llm.model,
                "response": content_clean,
                "duration_seconds": duration,
                "output_length_chars": len(content_clean),
                "done_reason": done_reason,
                "num_predict": num_predict
            }
        except Exception as e:
            end_time = time.time()
            return {
                "status": "error",
                "error_code": "EXCEPTION",
                "message": str(e),
                "model": self.llm.model,
                "duration_seconds": round(end_time - start_time, 2)
            }
