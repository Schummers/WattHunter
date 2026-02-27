# services/pcs-sync/email_notify.py
"""
Email notification module for WattHunter auction round recap emails.

Sends a plain-text recap to each player after a round resolves, listing
riders won, bids lost, current treasury balance, and next-round info.

Requires RESEND_API_KEY env var.  If not set the function is a no-op so
the resolution job keeps working without email credentials configured.
"""
import os
import logging
import resend

logger = logging.getLogger(__name__)

resend.api_key = os.getenv("RESEND_API_KEY", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "WattHunter <noreply@watthunter.com>")


def send_round_recap(
    to_email: str,
    player_name: str,
    auction_name: str,
    current_round: int,
    won: list[dict],
    lost: list[dict],
    treasury: int,
) -> None:
    """
    Send a round recap email to a player.

    Args:
        to_email:      Player's email address.
        player_name:   Player's display name.
        auction_name:  Human-readable auction name.
        current_round: Round number that just resolved (1, 2, or 3).
        won:           List of dicts with keys: rider_name, team, amount.
        lost:          List of dicts with keys: rider_name, team,
                       my_amount, winning_amount.
        treasury:      Player's team treasury balance after deductions.
    """
    if not resend.api_key:
        logger.warning("RESEND_API_KEY not set — skipping email to %s", to_email)
        return

    won_lines = "\n".join(
        f"  - {w['rider_name']} ({w['team']}) — {w['amount']:,} EUR".replace(",", " ")
        for w in won
    ) or "  Aucun"

    lost_lines = "\n".join(
        (
            f"  - {l['rider_name']} ({l['team']}) "
            f"— ta mise: {l['my_amount']:,} EUR "
            f"/ gagnante: {l['winning_amount']:,} EUR"
        ).replace(",", " ")
        for l in lost
    ) or "  Aucune"

    next_round_line = (
        f"Round {current_round + 1} commence demain."
        if current_round < 3
        else "Enchere terminee."
    )

    body = f"""Bonjour {player_name},

Voici les resultats du Round {current_round}/3 de l'enchere « {auction_name} » :

COUREURS REMPORTES
{won_lines}

MISES PERDUES
{lost_lines}

Tresorerie : {treasury:,} EUR

{next_round_line}

— WattHunter
""".replace(",", " ")

    try:
        resend.Emails.send(
            {
                "from": FROM_EMAIL,
                "to": [to_email],
                "subject": f"Round {current_round}/3 termine — {auction_name}",
                "text": body,
            }
        )
        logger.info("Round recap email sent to %s", to_email)
    except Exception as e:
        logger.error("Failed to send email to %s: %s", to_email, e)
