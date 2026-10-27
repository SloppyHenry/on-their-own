"""Verlaufsdaten für die Statistik: einmal je Simulationsstunde Bedürfnisse und Stimmung je KI-Agent (Tabelle `stats_samples`)."""


def sample_stats(sim, minute: int) -> None:
    """Auf dem DB-Thread, je Tick aufgerufen; schreibt nur zur vollen Stunde."""
    if minute % 60 != 0:
        return
    st = sim.engine.state
    for aid in sim.store.profile_ids():
        body = st.agent(aid)
        if body is None:
            continue
        ctx = sim.autonomy.context(aid, minute)
        soft = sim.autonomy.needs.get(aid)
        n = body.needs
        st.conn.execute("INSERT OR REPLACE INTO stats_samples(agent_id, sim_minute, energy, hunger, thirst, social, calm, warmth, mood) VALUES(?,?,?,?,?,?,?,?,?)",
                        (aid, minute, n.get("energy"), n.get("hunger"), n.get("thirst"), soft["social"], soft["calm"], soft["warmth"], ctx.mood.value))
