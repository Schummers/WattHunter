from unittest.mock import MagicMock


def test_recompute_eligibility_calls_rpc():
    """recompute_eligibility forwards phase + year to the recompute RPC and returns its data."""
    from underdog import recompute_eligibility

    rpc_result = MagicMock()
    rpc_result.execute.return_value = MagicMock(data={"ok": True, "leagues": 1})
    sb = MagicMock()
    sb.rpc.return_value = rpc_result

    out = recompute_eligibility(sb, phase_id=4, year=2026)

    sb.rpc.assert_called_once_with(
        "recompute_underdog_eligibility", {"p_phase_id": 4, "p_year": 2026}
    )
    assert out == {"ok": True, "leagues": 1}
