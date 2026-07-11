# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import json

class SmartEscrow(gl.Contract):
    job_description: str
    status: str
    freelancer_url: str

    def __init__(self, description: str):
        self.job_description = description
        self.status = "FUNDED"
        self.freelancer_url = ""

    @gl.public.write
    def submit_work(self, source_url: str) -> None:
        if self.status != "FUNDED":
            # For hackathon simplicity, we allow resubmissions if REJECTED, but let's just allow it anytime it's not RELEASED
            if self.status == "RELEASED":
                return

        def evaluate_work() -> str:
            try:
                # Fetch the web page content (off-chain data)
                webpage_content = gl.get_webpage(source_url, mode="text")
                
                # Truncate webpage content to avoid LLM context limits
                if len(webpage_content) > 10000:
                    webpage_content = webpage_content[:10000] + "... (truncated)"

                task = f"""
You are an expert evaluator. Determine if the following submitted work fulfills the job description.

Job Description: "{self.job_description}"

Submitted Work Content:
{webpage_content}

Respond in JSON:
{{
    "approved": bool // exactly true or false
}}
It is mandatory that you respond only using the JSON format above, nothing else. Don't include any other words or characters.
                """
                result = gl.exec_prompt(task).replace("```json", "").replace("```", "").strip()
                return json.dumps(json.loads(result), sort_keys=True)
            except Exception as e:
                return json.dumps({"approved": False}, sort_keys=True)

        self.freelancer_url = source_url
        
        # Ask LLM validators to output a strict JSON
        result_json_str = gl.eq_principle_strict_eq(evaluate_work)
        
        # Parse the consensus JSON response
        try:
            result = json.loads(result_json_str)
            is_approved = result.get("approved", False)
            if is_approved:
                self.status = "RELEASED"
            else:
                self.status = "REJECTED"
        except Exception:
            self.status = "REJECTED"

    @gl.public.view
    def get_job_description(self) -> str:
        return self.job_description
    
    @gl.public.view
    def get_status(self) -> str:
        return self.status

    @gl.public.view
    def get_freelancer_url(self) -> str:
        return self.freelancer_url
