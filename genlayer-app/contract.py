# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
import genlayer as gl
from genlayer.std import get_webpage
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
    def analyze_sentiment(self, token: str, source_url: str) -> typing.Any:
        # Fetch the web page content (off-chain data)
        webpage_content = get_webpage(source_url)

        def get_input() -> str:
            return f"Analyze the following web page content regarding the token '{token}'. Determine the overall market sentiment based ONLY on this text. Webpage Content:\n\n{webpage_content}"

        self.latest_token = token
        self.latest_url = source_url
        
        # Ask LLM validators to output a strict JSON
        result_json_str = gl.eq_principle.prompt_non_comparative(
            get_input,
            task="Determine if the sentiment for the given token is BULLISH, BEARISH, or NEUTRAL. Output ONLY a valid JSON object with exactly two keys: 'sentiment' (must be exactly 'BULLISH', 'BEARISH', or 'NEUTRAL') and 'rationale' (a short, one sentence explanation).",
            criteria="""
                The response must be strictly valid JSON without any markdown formatting like ```json.
                The sentiment key must be one of: BULLISH, BEARISH, NEUTRAL.
                The rationale must be grounded in the provided web page content.
            """,
        )
        
        # Parse the consensus JSON response
        try:
            result = json.loads(result_json_str)
            self.latest_sentiment = result.get("sentiment", "UNKNOWN").upper()
            self.latest_rationale = result.get("rationale", "No rationale provided.")
        except Exception:
            self.latest_sentiment = "ERROR"
            self.latest_rationale = "Failed to parse JSON. Raw output: " + result_json_str

    @gl.public.view
    def get_latest_sentiment(self) -> str:
        return self.latest_sentiment
    
    @gl.public.view
    def get_latest_rationale(self) -> str:
        return self.latest_rationale
