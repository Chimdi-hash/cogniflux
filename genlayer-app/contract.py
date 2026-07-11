# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import typing
import json

class SentimentOracle(gl.Contract):
    latest_sentiment: str
    latest_rationale: str
    latest_token: str
    latest_url: str

    def __init__(self):
        self.latest_sentiment = "NONE"
        self.latest_rationale = "No analysis yet."
        self.latest_token = ""
        self.latest_url = ""

    @gl.public.write
    def analyze_sentiment(self, token: str, source_url: str) -> None:
        def get_input() -> str:
            try:
                # Fetch the web page content (off-chain data)
                webpage_content = gl.get_webpage(source_url, mode="text")
                
                # Truncate webpage content to avoid LLM context limits
                if len(webpage_content) > 10000:
                    webpage_content = webpage_content[:10000] + "... (truncated)"

                task = f"""
Analyze the following web page content regarding the token '{token}'. Determine the overall market sentiment based ONLY on this text.

Web content:
{webpage_content}

Respond in JSON:
{{
    "sentiment": str, // exactly 'BULLISH', 'BEARISH', or 'NEUTRAL'
    "rationale": str // a short, one sentence explanation
}}
It is mandatory that you respond only using the JSON format above, nothing else. Don't include any other words or characters, your output must be only JSON without any formatting prefix or suffix.
This result should be perfectly parsable by a JSON parser without errors.
                """
                result = gl.exec_prompt(task).replace("```json", "").replace("```", "").strip()
                return json.dumps(json.loads(result), sort_keys=True)
            except Exception as e:
                # Return a valid JSON string indicating the error so consensus doesn't fail
                return json.dumps({"sentiment": "ERROR", "rationale": f"Execution failed: {str(e)}"}, sort_keys=True)

        self.latest_token = token
        self.latest_url = source_url
        
        # Ask LLM validators to output a strict JSON
        result_json_str = gl.eq_principle_strict_eq(get_input)
        
        # Parse the consensus JSON response
        try:
            result = json.loads(result_json_str)
            self.latest_sentiment = result.get("sentiment", "UNKNOWN").upper()
            self.latest_rationale = result.get("rationale", "No rationale provided.")
        except Exception:
            self.latest_sentiment = "ERROR"
            self.latest_rationale = "Failed to parse JSON. Raw output: " + str(result_json_str)

    @gl.public.view
    def get_latest_sentiment(self) -> str:
        return self.latest_sentiment
    
    @gl.public.view
    def get_latest_rationale(self) -> str:
        return self.latest_rationale
