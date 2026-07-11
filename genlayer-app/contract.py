# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import json

class TruthStake(gl.Contract):
    state_json: str

    def __init__(self):
        # A single robust JSON string to prevent any GenVM state serialization bugs with older versions.
        self.state_json = json.dumps({
            "balances": {}, 
            "markets": {}, 
            "next_market_id": 1
        })

    def _get_state(self) -> dict:
        return json.loads(self.state_json)

    def _save_state(self, state: dict):
        self.state_json = json.dumps(state)

    @gl.public.write
    def mint(self, amount: int) -> None:
        if amount <= 0 or amount > 10000:
            raise Exception("Invalid mint amount")
        state = self._get_state()
        sender = gl.message.sender_address
        
        current_balance = state["balances"].get(sender, 0)
        state["balances"][sender] = current_balance + amount
        self._save_state(state)

    @gl.public.write
    def create_market(self, question: str) -> None:
        state = self._get_state()
        market_id = str(state["next_market_id"])
        
        state["markets"][market_id] = {
            "id": market_id,
            "creator": gl.message.sender_address,
            "question": question,
            "status": "OPEN",
            "total_yes": 0,
            "total_no": 0,
            "resolved_answer": "", 
            "yes_bets": {},
            "no_bets": {}
        }
        
        state["next_market_id"] += 1
        self._save_state(state)

    @gl.public.write
    def bet(self, market_id: str, is_yes: bool, amount: int) -> None:
        state = self._get_state()
        sender = gl.message.sender_address
        
        if market_id not in state["markets"]:
            raise Exception("Market does not exist")
            
        market = state["markets"][market_id]
        if market["status"] != "OPEN":
            raise Exception("Market is not open for betting")
            
        balance = state["balances"].get(sender, 0)
        if balance < amount:
            raise Exception("Insufficient balance")
            
        # Deduct balance
        state["balances"][sender] = balance - amount
        
        # Record bet
        if is_yes:
            market["yes_bets"][sender] = market["yes_bets"].get(sender, 0) + amount
            market["total_yes"] += amount
        else:
            market["no_bets"][sender] = market["no_bets"].get(sender, 0) + amount
            market["total_no"] += amount
            
        self._save_state(state)

    @gl.public.write
    def resolve_market(self, market_id: str, resolution_url: str) -> None:
        state = self._get_state()
        if market_id not in state["markets"]:
            raise Exception("Market does not exist")
            
        market = state["markets"][market_id]
        if market["status"] != "OPEN":
            raise Exception("Market already resolved")

        def evaluate_truth() -> str:
            try:
                # Fetch off-chain article data
                webpage_content = gl.get_webpage(resolution_url, mode="text")
                if len(webpage_content) > 15000:
                    webpage_content = webpage_content[:15000] + "... (truncated)"

                task = f"""
You are a highly analytical decentralized oracle. Your job is to determine the factual outcome of a prediction market question based ONLY on the provided news article text.

Prediction Market Question: "{market['question']}"

News Article Content:
{webpage_content}

First, check if the text appears to be a legitimate news article or official source. 
If it is completely irrelevant, spam, or fails to directly answer the question, output "INVALID".
If the article confirms the event happened or the answer to the question is undeniably Yes, output "YES".
If the article confirms the event did NOT happen or the answer is undeniably No, output "NO".

Respond in JSON format:
{{
    "resolved_status": "YES" // must be strictly "YES", "NO", or "INVALID"
}}
It is mandatory that you respond only using the JSON format above, nothing else. Don't include any other words or characters.
"""
                result = gl.exec_prompt(task).replace("```json", "").replace("```", "").strip()
                parsed = json.loads(result)
                status = parsed.get("resolved_status", "INVALID")
                if status not in ["YES", "NO", "INVALID"]:
                    status = "INVALID"
                return json.dumps({"resolved_status": status}, sort_keys=True)
            except Exception:
                return json.dumps({"resolved_status": "INVALID"}, sort_keys=True)

        # Consensus algorithm
        result_json_str = gl.eq_principle_strict_eq(evaluate_truth)
        
        try:
            result = json.loads(result_json_str)
            resolved_answer = result.get("resolved_status", "INVALID")
        except Exception:
            resolved_answer = "INVALID"
            
        market["status"] = "RESOLVED"
        market["resolved_answer"] = resolved_answer
        
        # Distribute Payouts
        total_pool = market["total_yes"] + market["total_no"]
        
        if resolved_answer == "YES" and market["total_yes"] > 0:
            for bettor, bet_amt in market["yes_bets"].items():
                payout = int((bet_amt / market["total_yes"]) * total_pool)
                state["balances"][bettor] = state["balances"].get(bettor, 0) + payout
                
        elif resolved_answer == "NO" and market["total_no"] > 0:
            for bettor, bet_amt in market["no_bets"].items():
                payout = int((bet_amt / market["total_no"]) * total_pool)
                state["balances"][bettor] = state["balances"].get(bettor, 0) + payout
                
        else:
            # If INVALID, or the winning side had 0 bets, refund everyone
            for bettor, bet_amt in market["yes_bets"].items():
                state["balances"][bettor] = state["balances"].get(bettor, 0) + bet_amt
            for bettor, bet_amt in market["no_bets"].items():
                state["balances"][bettor] = state["balances"].get(bettor, 0) + bet_amt
                
        self._save_state(state)

    @gl.public.view
    def get_state(self) -> str:
        return self.state_json
