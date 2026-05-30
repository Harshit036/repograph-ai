from langgraph.graph import StateGraph, END

from app.agents.state import AgentState
from app.agents import planner_agent, retriever_agent, reasoner_agent, summarizer_agent

MAX_ITERATIONS = 3


# ── LangGraph nodes ────────────────────────────────────────────────────────────

def node_planner(state: AgentState) -> AgentState:
    """Generate or regenerate the investigation plan."""
    context = {
        "query": state["query"],
        "memory": state["memory"],
        "observations": state["observations"],
    }
    if state["iteration"] == 0:
        plan = planner_agent.plan(context)
        label = "Planner: generated initial plan"
    else:
        plan = planner_agent.replan(context)
        label = f"Planner: replanned (iteration {state['iteration'] + 1})"

    return {
        **state,
        "current_plan": plan,
        "actions": state["actions"] + [label],
    }


def node_retriever(state: AgentState) -> AgentState:
    """Execute every step in the current plan via retriever_agent."""
    ctx = {
        "query": state["query"],
        "memory": state["memory"],
        "observations": state["observations"],
        "actions": state["actions"] + [f"Iteration {state['iteration'] + 1}"],
    }
    for step in state["current_plan"]:
        if step.strip():
            retriever_agent.retrieve(step, ctx)
    return {
        **state,
        "observations": ctx["observations"],
        "memory": ctx["memory"],
        "actions": ctx["actions"],
    }


def node_reasoner(state: AgentState) -> AgentState:
    """Critique evidence, chase follow-ups, and decide if we have enough."""
    ctx = {
        "query": state["query"],
        "memory": state["memory"],
        "observations": state["observations"],
        "actions": state["actions"],
    }

    analysis = reasoner_agent.critique(ctx)
    if analysis["gaps"]:
        ctx["actions"].append(f"Reasoner gaps: {'; '.join(analysis['gaps'])}")
    if analysis["contradictions"]:
        ctx["actions"].append(f"Reasoner contradictions: {'; '.join(analysis['contradictions'])}")

    for follow_up in analysis["follow_up_queries"]:
        follow_up = follow_up.strip()
        if follow_up and follow_up not in ctx["memory"]["searched_queries"]:
            ctx["actions"].append(f"Self-correction: {follow_up}")
            retriever_agent.retrieve(follow_up, ctx)

    enough = reasoner_agent.reflect(ctx)
    ctx["actions"].append("Reasoner: enough evidence" if enough else "Reasoner: replanning")

    return {
        **state,
        "enough_evidence": enough,
        "iteration": state["iteration"] + 1,
        "observations": ctx["observations"],
        "memory": ctx["memory"],
        "actions": ctx["actions"],
    }


def node_summarizer(state: AgentState) -> AgentState:
    """Synthesise a final answer from all gathered evidence."""
    ctx = {
        "query": state["query"],
        "memory": state["memory"],
        "observations": state["observations"],
    }
    response = summarizer_agent.summarize(ctx)
    return {**state, "response": response}


# ── Conditional routing ────────────────────────────────────────────────────────

def _should_continue(state: AgentState) -> str:
    if state["enough_evidence"] or state["iteration"] >= MAX_ITERATIONS:
        return "summarize"
    return "planner"


# ── Public API ─────────────────────────────────────────────────────────────────

def run(user_query: str, history: list[dict] | None = None) -> dict:
    """Run the multi-agent investigation graph. Returns response + trace."""
    graph = StateGraph(AgentState)

    graph.add_node("planner", node_planner)
    graph.add_node("retriever", node_retriever)
    graph.add_node("reasoner", node_reasoner)
    graph.add_node("summarizer", node_summarizer)

    graph.set_entry_point("planner")
    graph.add_edge("planner", "retriever")
    graph.add_edge("retriever", "reasoner")
    graph.add_conditional_edges(
        "reasoner",
        _should_continue,
        {"planner": "planner", "summarize": "summarizer"},
    )
    graph.add_edge("summarizer", END)

    compiled = graph.compile()

    initial: AgentState = {
        "query": user_query,
        "history": history or [],
        "memory": {"discovered_facts": [], "searched_queries": []},
        "observations": [],
        "actions": [],
        "current_plan": [],
        "iteration": 0,
        "enough_evidence": False,
        "response": "",
    }

    final = compiled.invoke(initial)

    return {
        "response": final["response"],
        "actions": final["actions"],
        "memory": final["memory"],
    }
