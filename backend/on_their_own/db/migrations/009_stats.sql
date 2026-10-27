-- Verläufe für die Statistik (AP09): einmal je Simulationsstunde Bedürfnisse und Stimmung je Agent
CREATE TABLE stats_samples (
    agent_id TEXT NOT NULL,
    sim_minute INTEGER NOT NULL,
    energy REAL, hunger REAL, thirst REAL,
    social REAL, calm REAL, warmth REAL,
    mood REAL,
    PRIMARY KEY (agent_id, sim_minute)
);
