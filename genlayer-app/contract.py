# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import json

class Cogniflux(gl.Contract):
    state_json: str

    def __init__(self):
        # A single robust JSON string to prevent any GenVM state serialization bugs with older versions.
        self.state_json = json.dumps({
            "markets": {}, 
            "next_market_id": 1
        })

    def _get_state(self) -> dict:
        return json.loads(self.state_json)

    def _save_state(self, state: dict):
        self.state_json = json.dumps(state)



    @gl.public.write
    def create_market(self, question: str) -> None:
        state = self._get_state()
        market_id = str(state["next_market_id"])
        
        state["markets"][market_id] = {
            "id": market_id,
            "creator": str(gl.message.sender_address),
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

    @gl.public.write.payable
    def bet(self, market_id: str, is_yes: bool) -> None:
        amount_wei = int(gl.message.value)
        amount = amount_wei // (10**18)
        if amount <= 0:
            raise Exception("Bet amount must be at least 1 GEN")

        state = self._get_state()
        sender = str(gl.message.sender_address)
        
        if market_id not in state["markets"]:
            raise Exception("Market does not exist")
            
        market = state["markets"][market_id]
        if market["status"] != "OPEN":
            raise Exception("Market is not open for betting")
        
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

        def payout_user(address: str, amount_gen: int):
            if amount_gen > 0:
                try:
                    payout_wei = amount_gen * (10**18)
                    gl.get_contract_at(address).emit_transfer(value=u256(payout_wei), on='finalized')
                except Exception:
                    pass

        try:
            # Fetch off-chain article data
            webpage_content = gl.nondet.web.get(resolution_url)
            if len(webpage_content) > 15000:
                webpage_content = webpage_content[:15000] + "... (truncated)"
        except Exception as e:
            # Bypass AI on fetch error to surface the exact exception
            market["status"] = "RESOLVED"
            market["resolved_answer"] = "INVALID"
            market["resolve_reason"] = f"Fetch Error: {str(e)}"
            for bettor, bet_amt in market["yes_bets"].items():
                payout_user(bettor, bet_amt)
            for bettor, bet_amt in market["no_bets"].items():
                payout_user(bettor, bet_amt)
            self._save_state(state)
            return

        def get_input() -> str:
            return f"""Prediction Market Question: "{market['question']}"

News Article Content:
{webpage_content}"""

        # Consensus algorithm
        result_json_str = gl.eq_principle.prompt_non_comparative(
            get_input,
            task="""You are a highly analytical decentralized oracle. Your job is to determine the factual outcome of a prediction market question based ONLY on the provided news article text.
First, check if the text appears to be a legitimate news article or official source. 
If it is completely irrelevant, spam, or fails to directly answer the question, output "INVALID".
If the article confirms the event happened or the answer to the question is undeniably Yes, output "YES".
If the article confirms the event did NOT happen or the answer is undeniably No, output "NO".

Respond in JSON format:
{
    "resolved_status": "YES", // must be strictly "YES", "NO", or "INVALID"
    "reason": "Explain in one sentence why you chose this status based on the text provided."
}
It is mandatory that you respond only using the JSON format above, nothing else. Don't include any other words or characters.""",
            criteria="""The response must be exactly the JSON format requested.
It must correctly identify if the article confirms YES, NO, or INVALID."""
        )
        
        result_json_str = result_json_str.replace("```json", "").replace("```", "").strip()
        
        try:
            result = json.loads(result_json_str)
            resolved_answer = result.get("resolved_status", "INVALID")
            reason = result.get("reason", "")
        except Exception:
            resolved_answer = "INVALID"
            reason = "JSON parsing error"
            
        market["status"] = "RESOLVED"
        market["resolved_answer"] = resolved_answer
        market["resolve_reason"] = reason
        
        # Distribute Payouts
        total_pool = market["total_yes"] + market["total_no"]

        if resolved_answer == "YES" and market["total_yes"] > 0:
            for bettor, bet_amt in market["yes_bets"].items():
                payout = int((bet_amt * total_pool) // market["total_yes"])
                payout_user(bettor, payout)
                
        elif resolved_answer == "NO" and market["total_no"] > 0:
            for bettor, bet_amt in market["no_bets"].items():
                payout = int((bet_amt * total_pool) // market["total_no"])
                payout_user(bettor, payout)
                
        else:
            # If INVALID, or the winning side had 0 bets, refund everyone
            for bettor, bet_amt in market["yes_bets"].items():
                payout_user(bettor, bet_amt)
            for bettor, bet_amt in market["no_bets"].items():
                payout_user(bettor, bet_amt)
                
        self._save_state(state)

    @gl.public.view
    def get_state(self) -> str:
        return self.state_json
