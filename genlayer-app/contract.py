# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import typing

class IdeaEvaluator(gl.Contract):
    latest_remark: str
    latest_idea: str

    def __init__(self):
        self.latest_remark = "No ideas evaluated yet."
        self.latest_idea = ""

    @gl.public.write.payable
    def submit_idea(self, idea: str) -> typing.Any:
        amount = gl.message.value
        if amount < u256(1 * 10**18):
            raise gl.vm.UserError("You must send at least 1 GEN token to submit an idea!")

        def get_input() -> str:
            return f"A user wants to build the following web3 project on GenLayer: {idea}"

        self.latest_idea = idea
        self.latest_remark = gl.eq_principle.prompt_non_comparative(
            get_input,
            task="Write a short, cyberpunk-style, futuristic remark judging the potential and vibe of this project. Keep it under two sentences.",
            criteria="""
                The response must be a futuristic, cyberpunk-style judgment of the project idea.
                It must be less than two sentences.
                It must directly address the project idea.
            """,
        )

    @gl.public.view
    def get_latest_remark(self) -> str:
        return self.latest_remark
    
    @gl.public.view
    def get_latest_idea(self) -> str:
        return self.latest_idea
