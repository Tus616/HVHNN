def safe_text(value: object, limit: int = 4000) -> str:
    return str(value or "").strip()[:limit]


def completion_rate(accepted: int, completed: int) -> float:
    if accepted <= 0:
        return 0.0
    return round(max(0.0, min(1.0, completed / accepted)), 4)
