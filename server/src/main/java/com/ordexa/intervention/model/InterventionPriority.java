package com.ordexa.intervention.model;

public enum InterventionPriority {
    HIGH(3),
    MEDIUM(2),
    LOW(1),
    NONE(0);

    private final int weight;

    InterventionPriority(int weight) {
        this.weight = weight;
    }

    public int weight() {
        return weight;
    }
}
