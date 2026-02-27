"""Tests for email_notify.py — send_round_recap.

Verifies no-op behaviour when RESEND_API_KEY is absent, and correct
Emails.send call structure when the key is present.
"""
import pytest
from unittest.mock import patch, MagicMock


# ---------------------------------------------------------------------------
# Shared fixture data
# ---------------------------------------------------------------------------

COMMON_KWARGS = dict(
    to_email="player@example.com",
    player_name="Alice",
    auction_name="Tour de France 2026",
    current_round=1,
    won=[{"rider_name": "Tadej Pogacar", "team": "UAE Team Emirates", "amount": 6_000}],
    lost=[{"rider_name": "Jonas Vingegaard", "team": "Visma", "my_amount": 5_000, "winning_amount": 6_500}],
    treasury=480_000,
)


# ---------------------------------------------------------------------------
# No API key → function is a no-op
# ---------------------------------------------------------------------------


def test_no_api_key_is_noop():
    """When RESEND_API_KEY is not set, resend.Emails.send must NOT be called."""
    import email_notify
    import resend

    with patch.object(resend, "api_key", ""), \
         patch("resend.Emails.send") as mock_send:
        # Reload to pick up empty api_key at module level
        email_notify.send_round_recap(**COMMON_KWARGS)

    mock_send.assert_not_called()


def test_no_api_key_logs_warning(caplog):
    """A warning is logged when the API key is absent."""
    import email_notify
    import resend
    import logging

    with patch.object(resend, "api_key", ""), \
         caplog.at_level(logging.WARNING, logger="email_notify"):
        email_notify.send_round_recap(**COMMON_KWARGS)

    assert any("RESEND_API_KEY" in record.message for record in caplog.records)


# ---------------------------------------------------------------------------
# API key present → resend.Emails.send is called with correct payload
# ---------------------------------------------------------------------------


def test_with_api_key_calls_send():
    """When RESEND_API_KEY is set, resend.Emails.send is called once."""
    import email_notify
    import resend

    with patch.object(resend, "api_key", "re_test_abc123"), \
         patch("resend.Emails.send") as mock_send:
        email_notify.send_round_recap(**COMMON_KWARGS)

    mock_send.assert_called_once()
    payload = mock_send.call_args[0][0]
    assert payload["to"] == ["player@example.com"]
    assert "Round 1/3" in payload["subject"]
    assert "Tour de France 2026" in payload["subject"]


def test_email_body_contains_won_rider():
    """The email body includes the name of the rider that was won."""
    import email_notify
    import resend

    sent_bodies = []

    def capture_send(payload):
        sent_bodies.append(payload["text"])

    with patch.object(resend, "api_key", "re_test_abc123"), \
         patch("resend.Emails.send", side_effect=capture_send):
        email_notify.send_round_recap(**COMMON_KWARGS)

    assert len(sent_bodies) == 1
    assert "Tadej Pogacar" in sent_bodies[0]


def test_email_body_contains_lost_rider():
    """The email body includes the name of the rider whose bid was lost."""
    import email_notify
    import resend

    sent_bodies = []

    def capture_send(payload):
        sent_bodies.append(payload["text"])

    with patch.object(resend, "api_key", "re_test_abc123"), \
         patch("resend.Emails.send", side_effect=capture_send):
        email_notify.send_round_recap(**COMMON_KWARGS)

    assert "Jonas Vingegaard" in sent_bodies[0]


# ---------------------------------------------------------------------------
# Round 3 shows "auction closed" message
# ---------------------------------------------------------------------------


def test_round3_shows_auction_closed():
    """For round 3, the body says the auction is over (not 'Round 4 demain')."""
    import email_notify
    import resend

    sent_bodies = []

    def capture_send(payload):
        sent_bodies.append(payload["text"])

    kwargs = {**COMMON_KWARGS, "current_round": 3}
    with patch.object(resend, "api_key", "re_test_abc123"), \
         patch("resend.Emails.send", side_effect=capture_send):
        email_notify.send_round_recap(**kwargs)

    assert "Enchere terminee" in sent_bodies[0]
    assert "Round 4" not in sent_bodies[0]


def test_round2_shows_next_round():
    """For round 2, the body mentions round 3 starting tomorrow."""
    import email_notify
    import resend

    sent_bodies = []

    def capture_send(payload):
        sent_bodies.append(payload["text"])

    kwargs = {**COMMON_KWARGS, "current_round": 2}
    with patch.object(resend, "api_key", "re_test_abc123"), \
         patch("resend.Emails.send", side_effect=capture_send):
        email_notify.send_round_recap(**kwargs)

    assert "Round 3" in sent_bodies[0]
