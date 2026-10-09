"""Negotiation module — seller-configured price negotiation per product.

AI suggests an offer within the seller's bounds; the buyer must explicitly
approve before anything is sent (mirrors the human-approval-before-send
pattern already used for AI seller drafts in `human_approval`). Never
auto-commits the buyer to a price.
"""
