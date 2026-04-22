"""Shared test infrastructure for pcs-sync tests."""
import sys
import os
from unittest.mock import MagicMock

# Make sure top-level pcs-sync modules are importable from tests/
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


def make_chain(data=None, upserts=None, updates=None, inserts=None, table_name=None):
    """Return a MagicMock that supports Supabase fluent query chaining.

    Every builder method (select, eq, …) returns self so chains work.
    .execute() returns MagicMock(data=data).

    If upserts/updates/inserts dicts are passed, .upsert/.update/.insert() calls
    append the first positional arg (the payload) under table_name so tests can
    inspect what was written.
    """
    m = MagicMock()
    m.execute.return_value = MagicMock(data=data if data is not None else [])
    for attr in (
        "select", "eq", "neq", "gt", "gte", "lt", "lte", "in_", "like", "ilike",
        "single", "maybeSingle",
        "order", "limit",
    ):
        getattr(m, attr).return_value = m

    def _record(bucket):
        def _side_effect(*args, **kwargs):
            if bucket is not None and table_name is not None and args:
                bucket.setdefault(table_name, []).append(args[0])
            return m
        return _side_effect

    m.upsert.side_effect = _record(upserts)
    m.update.side_effect = _record(updates)
    m.insert.side_effect = _record(inserts)
    m.delete.return_value = m
    return m


def make_supabase(*responses):
    """Create a mock Supabase client whose .table() calls return responses in order.

    Each successive call to .table(name) pops the next item from *responses and
    wraps it in a make_chain().  Once the queue is exhausted, additional calls
    return an empty-data chain.

    Recorded writes are exposed through:
      sb.upserts:  dict[table_name, list[payload]]
      sb.updates:  dict[table_name, list[payload]]
      sb.inserts:  dict[table_name, list[payload]]
      sb._last_upsert_payload(table)  → last recorded upsert payload for `table`

    Usage::

        sb = make_supabase(
            [{"id": "t1"}],          # 1st table() call returns this list
            {"name": "Team Alpha"},   # 2nd table() call returns this dict
            [],                       # 3rd table() call returns empty list
        )
    """
    sb = MagicMock()
    queue = list(responses)
    sb.upserts = {}
    sb.updates = {}
    sb.inserts = {}

    def _side_effect(name):
        payload = queue.pop(0) if queue else None
        return make_chain(
            payload,
            upserts=sb.upserts,
            updates=sb.updates,
            inserts=sb.inserts,
            table_name=name,
        )

    sb.table.side_effect = _side_effect

    def _last_upsert_payload(table):
        rows = sb.upserts.get(table, [])
        if not rows:
            raise AssertionError(f"No upsert recorded for table {table!r}")
        return rows[-1]

    sb._last_upsert_payload = _last_upsert_payload
    return sb
