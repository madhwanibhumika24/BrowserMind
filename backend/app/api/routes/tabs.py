"""Endpoints for tab-related features: summarizing / organizing open tabs."""
from fastapi import APIRouter

from app.agents.tab_grouper import group_tabs
from app.models.schemas import TabInfo

router = APIRouter(prefix="/tabs", tags=["tabs"])


@router.post("/summarize")
async def summarize_tabs(tabs: list[TabInfo]) -> dict:
    groups = group_tabs(tabs)

    # Build a simple one-line summary per non-empty group.
    summary_lines = []
    for category, tabs_in_group in groups.items():
        if tabs_in_group:
            summary_lines.append(f"{category}: {len(tabs_in_group)} tab(s)")

    return {
        "summary": " | ".join(summary_lines) if summary_lines else "No tabs to summarize.",
        "groups": {category: [t.model_dump() for t in tabs_in_group] for category, tabs_in_group in groups.items()},
    }
