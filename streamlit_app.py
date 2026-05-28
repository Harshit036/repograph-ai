import math
import os
import streamlit as st
import requests
import plotly.graph_objects as go

API = os.getenv("API_URL", "http://localhost:8000")
HEADERS = {"X-API-Key": os.getenv("API_KEY", "changeme-dev-key")}

st.set_page_config(page_title="RepoGraph AI", layout="wide")
st.title("RepoGraph AI")
st.caption("Repository Intelligence Platform")

tabs = st.tabs(
    [
        "Ingest",
        "RAG Query",
        "Agent",
        "Graph",
        "Architecture",
        "Onboarding",
        "Flow Trace",
    ]
)


# ── Tab 1: Ingest ──────────────────────────────────────────────
with tabs[0]:
    st.subheader("Ingest Repository")
    repo_url = st.text_input(
        "GitHub URL", placeholder="https://github.com/username/repo"
    )

    if st.button("Ingest"):
        if not repo_url:
            st.warning("Enter a repository URL first.")
        else:
            with st.spinner("Cloning and indexing..."):
                try:
                    res = requests.post(
                        f"{API}/ingest-repo", json={"repo_url": repo_url}, headers=HEADERS
                    )
                    data = res.json()
                    st.success(f"Ingested {data['total_files']} files")
                    for f in data["files"]:
                        col1, col2 = st.columns([4, 1])
                        col1.text(f["file_name"])
                        col2.caption(f"{f['total_chunks']} chunks")
                except Exception as e:
                    st.error(str(e))


# ── Tab 2: RAG Query ───────────────────────────────────────────
with tabs[1]:
    st.subheader("RAG Query")
    rag_q = st.text_input(
        "Question", placeholder="How does the embedding pipeline work?", key="rag_q"
    )

    if st.button("Ask", key="rag_btn"):
        if not rag_q:
            st.warning("Enter a question.")
        else:
            with st.spinner("Searching and generating..."):
                try:
                    res = requests.post(f"{API}/rag-query", json={"query": rag_q}, headers=HEADERS)
                    data = res.json()

                    st.markdown("### Response")
                    st.markdown(data["response"])

                    if data.get("citations"):
                        st.markdown(f"### Citations — {len(data['citations'])} sources")
                        for c in data["citations"]:
                            with st.expander(f"[Source {c['source_id']}]  {c['file']}"):
                                st.code(c["preview"], language="python")
                except Exception as e:
                    st.error(str(e))


# ── Tab 3: Agent ───────────────────────────────────────────────
with tabs[2]:
    st.subheader("Agent Query")
    agent_q = st.text_input(
        "Question", placeholder="Explain the RAG pipeline architecture", key="agent_q"
    )

    if st.button("Run Agent"):
        if not agent_q:
            st.warning("Enter a question.")
        else:
            with st.spinner("Agent is investigating..."):
                try:
                    res = requests.post(f"{API}/agent-query", json={"query": agent_q}, headers=HEADERS)
                    data = res.json()

                    st.markdown("### Response")
                    st.markdown(data["response"])

                    if data.get("actions"):
                        st.markdown(f"### Agent Trace — {len(data['actions'])} steps")
                        for action in data["actions"]:
                            if "Iteration" in action:
                                st.markdown(f"**⚡ {action}**")
                            elif "Planner" in action:
                                st.markdown(f"🟣 `{action}`")
                            elif "Retriever" in action:
                                st.markdown(f"🔵 `{action}`")
                            elif "Reasoner" in action:
                                st.markdown(f"🟡 `{action}`")
                            elif "Self-correction" in action:
                                st.markdown(f"🟠 `{action}`")
                            elif "Learned" in action or "Correction learned" in action:
                                st.markdown(f"🟢 `{action}`")
                            elif "Gaps" in action or "Contradictions" in action:
                                st.markdown(f"🔴 `{action}`")
                            elif "Skipped" in action:
                                st.markdown(f"⬜ `{action}`")
                            else:
                                st.markdown(f"⬜ `{action}`")

                    if data.get("memory"):
                        st.markdown("### Memory")
                        col1, col2 = st.columns(2)

                        with col1:
                            st.markdown("**Discovered Facts**")
                            facts = data["memory"]["discovered_facts"]
                            if facts:
                                for f in facts:
                                    st.success(f)
                            else:
                                st.caption("None")

                        with col2:
                            st.markdown("**Searched Queries**")
                            for q in data["memory"]["searched_queries"]:
                                st.code(q)
                except Exception as e:
                    st.error(str(e))


# ── Tab 4: Graph ───────────────────────────────────────────────
with tabs[3]:
    st.subheader("Repository Graph — 3D")
    st.caption(
        "Top 30 files. Circle layout on X/Y. Z-axis = complexity (function count). "
        "Drag to rotate, scroll to zoom, hover for details."
    )

    if st.button("Load Graph"):
        with st.spinner("Building 3D graph..."):
            try:
                res = requests.get(f"{API}/repository-graph", headers=HEADERS)
                data = res.json()

                if not data:
                    st.warning("No graph data. Ingest a repository first.")
                else:
                    sorted_files = sorted(
                        data.items(),
                        key=lambda x: len(x[1].get("functions", [])),
                        reverse=True,
                    )[:30]
                    node_set = {fp for fp, _ in sorted_files}

                    # 3D layout: circle on x/y, z = function count (complexity height)
                    n = len(sorted_files)
                    positions = {}
                    for i, (fp, nd) in enumerate(sorted_files):
                        angle = 2 * math.pi * i / max(n, 1)
                        func_count = len(nd.get("functions", []))
                        positions[fp] = (
                            math.cos(angle),          # x
                            math.sin(angle),          # y
                            func_count * 0.15,        # z — height proportional to complexity
                        )

                    # 3D Edges
                    edge_x, edge_y, edge_z = [], [], []
                    for fp, nd in sorted_files:
                        for imp in nd.get("imports", []):
                            target = next(
                                (
                                    p
                                    for p in node_set
                                    if imp.replace(".", "/") in p and p != fp
                                ),
                                None,
                            )
                            if target:
                                x0, y0, z0 = positions[fp]
                                x1, y1, z1 = positions[target]
                                edge_x += [x0, x1, None]
                                edge_y += [y0, y1, None]
                                edge_z += [z0, z1, None]

                    dirs = ["/".join(fp.split("/")[-3:-1]) for fp, _ in sorted_files]
                    unique_dirs = list(set(dirs))

                    fig = go.Figure()

                    # Edge trace (3D)
                    fig.add_trace(
                        go.Scatter3d(
                            x=edge_x, y=edge_y, z=edge_z,
                            mode="lines",
                            line=dict(width=1.5, color="#374151"),
                            hoverinfo="none",
                            name="imports",
                        )
                    )

                    # Node trace (3D)
                    fig.add_trace(
                        go.Scatter3d(
                            x=[positions[fp][0] for fp, _ in sorted_files],
                            y=[positions[fp][1] for fp, _ in sorted_files],
                            z=[positions[fp][2] for fp, _ in sorted_files],
                            mode="markers+text",
                            marker=dict(
                                size=[
                                    max(4, 3 + len(nd.get("functions", [])))
                                    for _, nd in sorted_files
                                ],
                                color=[
                                    unique_dirs.index("/".join(fp.split("/")[-3:-1]))
                                    for fp, _ in sorted_files
                                ],
                                colorscale="Plasma",
                                opacity=0.9,
                                line=dict(width=0.5, color="#030712"),
                            ),
                            text=[fp.split("/")[-1] for fp, _ in sorted_files],
                            textposition="top center",
                            textfont=dict(size=7, color="#e5e7eb"),
                            hovertext=[
                                f"<b>{fp.split('/')[-1]}</b><br>"
                                f"{len(nd.get('functions', []))} functions<br>"
                                f"dir: {'/'.join(fp.split('/')[-3:-1])}"
                                for fp, nd in sorted_files
                            ],
                            hoverinfo="text",
                            name="files",
                        )
                    )

                    fig.update_layout(
                        showlegend=False,
                        paper_bgcolor="#111827",
                        font_color="#9ca3af",
                        height=700,
                        margin=dict(l=0, r=0, t=20, b=0),
                        scene=dict(
                            bgcolor="#030712",
                            xaxis=dict(
                                showgrid=False, zeroline=False,
                                showticklabels=False, title="",
                            ),
                            yaxis=dict(
                                showgrid=False, zeroline=False,
                                showticklabels=False, title="",
                            ),
                            zaxis=dict(
                                showgrid=True, gridcolor="#1f2937",
                                zeroline=False, showticklabels=False,
                                title=dict(text="complexity →", font=dict(color="#6b7280", size=10)),
                            ),
                            camera=dict(eye=dict(x=1.5, y=1.5, z=0.8)),
                        ),
                    )

                    st.plotly_chart(fig, use_container_width=True)
            except Exception as e:
                st.error(str(e))


# ── Tab 5: Architecture ────────────────────────────────────────
with tabs[4]:
    st.subheader("Architecture Summary")

    if st.button("Generate", key="arch_btn"):
        with st.spinner("Analysing architecture..."):
            try:
                res = requests.get(f"{API}/architecture-summary", headers=HEADERS)
                st.markdown(res.json()["summary"])
            except Exception as e:
                st.error(str(e))


# ── Tab 6: Onboarding ──────────────────────────────────────────
with tabs[5]:
    st.subheader("Onboarding Guide")

    if st.button("Generate", key="onboard_btn"):
        with st.spinner("Generating guide..."):
            try:
                res = requests.get(f"{API}/onboarding-guide", headers=HEADERS)
                data = res.json()

                st.markdown("### Guide")
                st.markdown(data["guide"])

                if data.get("entry_points"):
                    st.markdown("### Entry Points")
                    for ep in data["entry_points"]:
                        col1, col2 = st.columns([3, 2])
                        col1.code(ep["file"])
                        col2.caption(", ".join(ep["reasons"]))
            except Exception as e:
                st.error(str(e))


# ── Tab 7: Flow Trace ──────────────────────────────────────────
with tabs[6]:
    st.subheader("Flow Trace")
    keyword = st.text_input("Function keyword", placeholder="generate_embedding")

    if st.button("Trace"):
        if not keyword:
            st.warning("Enter a keyword.")
        else:
            with st.spinner("Tracing..."):
                try:
                    res = requests.get(f"{API}/trace-flow", params={"keyword": keyword}, headers=HEADERS)
                    data = res.json()

                    if not data:
                        st.warning("No matching functions found.")
                    else:
                        for item in data:
                            label = f"{item['function']}  —  {'/'.join(item['file'].split('/')[-2:])}"
                            with st.expander(label):
                                if item["calls"]:
                                    st.markdown("**Calls:**")
                                    st.code("  →  ".join(item["calls"]))
                                else:
                                    st.caption("No outgoing calls detected")
                except Exception as e:
                    st.error(str(e))
