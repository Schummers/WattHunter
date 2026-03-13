"""Shared test infrastructure for pcs-sync tests."""
import sys
import os
from unittest.mock import MagicMock

# Make sure top-level pcs-sync modules are importable from tests/
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


def make_chain(data=None):
    """Return a MagicMock that supports Supabase fluent query chaining.

    Every builder method (select, eq, …) returns self so chains work.
    .execute() returns MagicMock(data=data).
    """
    m = MagicMock()
    m.execute.return_value = MagicMock(data=data if data is not None else [])
    for attr in (
        "select", "eq", "neq", "gt", "gte", "lt", "lte", "in_",
        "single", "maybeSingle", "upsert", "update", "insert", "delete",
        "order",
    ):
        getattr(m, attr).return_value = m
    return m


def make_supabase(*responses):
    """Create a mock Supabase client whose .table() calls return responses in order.

    Each successive call to .table(name) pops the next item from *responses and
    wraps it in a make_chain().  Once the queue is exhausted, additional calls
    return an empty-data chain.

    Usage::

        sb = make_supabase(
            [{"id": "t1"}],          # 1st table() call returns this list
            {"name": "Team Alpha"},   # 2nd table() call returns this dict
            [],                       # 3rd table() call returns empty list
        )
    """
    sb = MagicMock()
    queue = list(responses)
    sb.table.side_effect = lambda _: (
        make_chain(queue.pop(0)) if queue else make_chain()
    )
    return sb
