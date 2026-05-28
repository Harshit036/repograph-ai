from typing import TypedDict


class AgentState(TypedDict):
    query: str
    memory: dict          # {"discovered_facts": list, "searched_queries": list}
    observations: list    # accumulated evidence strings
    actions: list         # trace of steps taken (shown in UI)
    current_plan: list    # steps to execute this iteration
    iteration: int        # current iteration count (0-indexed)
    enough_evidence: bool # reasoner's verdict
    response: str         # final answer from summarizer
