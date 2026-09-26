import os
from neo4j import GraphDatabase


# ============================================================
# DARKTRACE-X - Neo4j Configuration
# ============================================================

NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USERNAME = os.getenv("NEO4J_USERNAME")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")
NEO4J_DATABASE = os.getenv("NEO4J_DATABASE")


# Fail clearly if production environment variables are missing.
# This prevents Render from accidentally connecting to localhost.
if not NEO4J_URI:
    raise RuntimeError(
        "NEO4J_URI environment variable is not configured."
    )

if not NEO4J_USERNAME:
    raise RuntimeError(
        "NEO4J_USERNAME environment variable is not configured."
    )

if not NEO4J_PASSWORD:
    raise RuntimeError(
        "NEO4J_PASSWORD environment variable is not configured."
    )

if not NEO4J_DATABASE:
    raise RuntimeError(
        "NEO4J_DATABASE environment variable is not configured."
    )


# ============================================================
# Neo4j Aura certificate handling
# ============================================================

if (
    os.getenv("NEO4J_ALLOW_SELF_SIGNED", "").lower() == "true"
    and NEO4J_URI.startswith("neo4j+s://")
):
    NEO4J_URI = NEO4J_URI.replace(
        "neo4j+s://",
        "neo4j+ssc://",
        1,
    )


# ============================================================
# Neo4j Driver
# ============================================================

driver = GraphDatabase.driver(
    NEO4J_URI,
    auth=(
        NEO4J_USERNAME,
        NEO4J_PASSWORD,
    ),
)


def verify_neo4j():
    driver.verify_connectivity()
    return True


def get_neo4j_database():
    return NEO4J_DATABASE