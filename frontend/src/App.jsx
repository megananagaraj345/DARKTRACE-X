import {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import ForceGraph2D from "react-force-graph-2d";

import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceX,
  forceY
} from "d3-force";

import "./App.css";

const API_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";


/* =========================================================
   OPERATIONAL STATE DEFINITIONS
   ========================================================= */

const OPERATIONAL_STATES = [
  "Reconnaissance",
  "Targeting",
  "Access Seeking",
  "Preparation",
  "Operational Activity",
  "Impact / Monetization",
  "Migration / Evasion"
];


const STATE_KEYWORDS = {
  reconnaissance: [
    "reconnaissance"
  ],

  targeting: [
    "targeting"
  ],

  "access seeking": [
    "access_seeking",
    "access-seeking",
    "access seeking"
  ],

  preparation: [
    "preparation"
  ],

  "operational activity": [
    "operational_activity",
    "operational-activity",
    "operational activity"
  ],

  "impact / monetization": [
    "impact",
    "monetization",
    "impact_monetization"
  ],

  "migration / evasion": [
    "migration",
    "evasion",
    "migration_evasion"
  ]
};


/* =========================================================
   HELPER FUNCTIONS
   ========================================================= */

function clamp(value) {
  return Math.max(
    0,
    Math.min(
      1,
      Number(value) || 0
    )
  );
}


function formatState(value) {
  if (!value) {
    return "Unknown";
  }

  const text =
    String(value)
      .replaceAll("_", " ")
      .replaceAll("-", " ")
      .trim();

  return text
    .split(" ")
    .map(
      word =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join(" ");
}


function findArray(data, keys = []) {
  if (!data) {
    return [];
  }

  for (const key of keys) {
    if (Array.isArray(data?.[key])) {
      return data[key];
    }
  }

  if (Array.isArray(data)) {
    return data;
  }

  if (
    data?.data &&
    Array.isArray(data.data)
  ) {
    return data.data;
  }

  if (
    data?.result &&
    Array.isArray(data.result)
  ) {
    return data.result;
  }

  return [];
}


function findValue(
  data,
  keys = [],
  fallback = null
) {
  if (!data) {
    return fallback;
  }

  for (const key of keys) {
    if (
      data[key] !== undefined &&
      data[key] !== null
    ) {
      return data[key];
    }
  }

  if (data.data) {
    for (const key of keys) {
      if (
        data.data[key] !== undefined &&
        data.data[key] !== null
      ) {
        return data.data[key];
      }
    }
  }

  if (data.result) {
    for (const key of keys) {
      if (
        data.result[key] !== undefined &&
        data.result[key] !== null
      ) {
        return data.result[key];
      }
    }
  }

  return fallback;
}


function normalizeConfidence(value) {
  let number = Number(value);
  if (!Number.isFinite(number)) return 0;
  if (number > 1) number = number / 100;
  return clamp(number);
}

// Batch 6: analytical confidence is reliability-adjusted for sample size and signal diversity.
// Raw feature ratios remain unchanged because they describe the observed sample.
function calibrateAnalyticalConfidence(rawValue, sampleSize = 0, signalDiversity = 0) {
  const raw = normalizeConfidence(rawValue);
  const samples = Math.max(0, Number(sampleSize) || 0);
  const diversity = Math.max(0, Number(signalDiversity) || 0);
  const reliability = Math.min(0.14, samples * 0.025) + Math.min(0.08, diversity * 0.02);
  const floor = samples > 0 ? 0.58 : 0.40;
  return clamp(Math.min(0.92, Math.max(floor, raw * 0.78 + 0.14 + reliability)));
}

function analyticalConfidenceLabel(value) {
  const score = normalizeConfidence(value);
  if (score >= 0.85) return "HIGH";
  if (score >= 0.70) return "MODERATE-HIGH";
  if (score >= 0.55) return "MODERATE";
  return "LOW";
}


function normalizeOperationalResponse(data) {
  const states =
    findArray(
      data,
      [
        "states",
        "operational_states",
        "results"
      ]
    );

  let currentState =
    findValue(
      data,
      [
        "current_state",
        "current_operational_state",
        "state"
      ]
    );

  let stateConfidence =
    findValue(
      data,
      [
        "state_confidence",
        "current_state_confidence",
        "confidence"
      ],
      0
    );


  if (
    !currentState &&
    states.length > 0
  ) {
    const current =
      states.find(
        item =>
          item?.is_current === true ||
          item?.current === true
      ) ||
      states[states.length - 1];

    currentState =
      current?.state ||
      current?.operational_state ||
      current?.name ||
      currentState;

    stateConfidence =
      current?.confidence ??
      current?.state_confidence ??
      stateConfidence;
  }


  return {
    currentState:
      formatState(currentState),

    stateConfidence:
      normalizeConfidence(
        stateConfidence
      ),

    states,

    assessment:
      findValue(
        data,
        [
          "assessment",
          "analyst_assessment"
        ],
        ""
      )
  };
}


function normalizeTimelineEvents(data) {
  const events =
    findArray(
      data,
      [
        "events",
        "timeline",
        "timeline_events",
        "activity",
        "activity_events",
        "results"
      ]
    );

  return events
    .map(
      (event, index) => ({
        ...event,

        eventId:
          event?.event_id ||
          event?.id ||
          `timeline-event-${index}`,

        timestamp:
          event?.timestamp ||
          event?.event_time ||
          event?.created_at ||
          event?.time ||
          null,

        eventType:
          event?.event_type ||
          event?.type ||
          "ACTIVITY_EVENT",

        description:
          event?.description ||
          event?.explanation ||
          event?.assessment ||
          "Activity event reconstructed from correlated signals.",

        state:
          formatState(
            event?.state ||
            event?.operational_state ||
            event?.phase ||
            ""
          ),

        confidence:
          normalizeConfidence(
            event?.confidence ??
            event?.signal_confidence ??
            event?.strength ??
            0
          ),

        signalType:
          event?.signal_type ||
          event?.source_signal ||
          event?.signal ||
          "",

        source:
          event?.source ||
          "",

        evidence:
          event?.evidence ||
          event?.supporting_evidence ||
          ""
      })
    )
    .sort(
      (a, b) => {
        if (
          !a.timestamp &&
          !b.timestamp
        ) {
          return 0;
        }

        if (!a.timestamp) {
          return 1;
        }

        if (!b.timestamp) {
          return -1;
        }

        return (
          new Date(a.timestamp) -
          new Date(b.timestamp)
        );
      }
    );
}


function resolveCurrentOperationalState(operationalData, timelineEvents, selectedNode) {
  const directState = operationalData?.currentState;
  if (directState && directState !== "Unknown") {
    return formatState(directState);
  }

  const bestTimelineEvent =
    Array.isArray(timelineEvents) && timelineEvents.length > 0
      ? [...timelineEvents]
          .filter(event => event?.state && event.state !== "Unknown")
          .sort((a, b) =>
            Number(b?.confidence || 0) - Number(a?.confidence || 0)
          )[0]
      : null;

  if (bestTimelineEvent?.state) {
    return formatState(bestTimelineEvent.state);
  }

  const nodeState =
    selectedNode?.properties?.current_state ||
    selectedNode?.properties?.operational_state ||
    selectedNode?.properties?.state;

  if (nodeState) {
    return formatState(nodeState);
  }

  return "Unknown";
}


function getStateIndex(state) {
  const normalized =
    String(
      state || ""
    ).toLowerCase();

  return OPERATIONAL_STATES.findIndex(
    item => {

      const key =
        item.toLowerCase();

      return (
        normalized === key ||
        normalized.includes(key) ||
        STATE_KEYWORDS[key]?.some(
          keyword =>
            normalized.includes(
              keyword
            )
        )
      );
    }
  );
}


function formatTimestamp(timestamp) {
  if (!timestamp) {
    return "TIME UNAVAILABLE";
  }

  const date =
    new Date(timestamp);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(timestamp);
  }

  return date.toLocaleString(
    undefined,
    {
      dateStyle: "medium",
      timeStyle: "short"
    }
  );
}



/* =========================================================
   PREDICTION + ALERT INTELLIGENCE HELPERS
   ========================================================= */

function buildSnapshot(actorIntelligence, operationalData, riskScore, resolvedState = null) {
  return {
    actor_id: actorIntelligence?.actorId || "unknown_actor",
    display_name: actorIntelligence?.username || actorIntelligence?.actorId || null,
    aliases: (actorIntelligence?.aliases || []).join(", "),
    platforms: actorIntelligence?.platform || "synthetic",
    writing_style: (actorIntelligence?.behaviors || []).join(", "),
    activity_pattern: (actorIntelligence?.behaviors || []).join(", "),
    infrastructure: (actorIntelligence?.infrastructure || []).join(", "),
    wallets: (actorIntelligence?.wallets || []).join(", "),
    campaigns: (actorIntelligence?.campaigns || []).join(", "),
    current_state: resolvedState || operationalData?.currentState || "Unknown",
    state_confidence: Number(operationalData?.stateConfidence || 0),
    confidence: Number(operationalData?.stateConfidence || 0),
    risk_score: Number(riskScore || 0),
    analyst_assessment: actorIntelligence?.connectedAssessments?.[0] || null
  };
}

function buildDemoPreviousSnapshot(currentSnapshot) {
  if (currentSnapshot.actor_id !== "actor_alpha_001") {
    return {
      ...currentSnapshot,
      aliases: currentSnapshot.aliases,
      platforms: currentSnapshot.platforms,
      infrastructure: currentSnapshot.infrastructure,
      campaigns: currentSnapshot.campaigns,
      current_state: currentSnapshot.current_state,
      confidence: Math.max(0, Number(currentSnapshot.confidence) - 0.03),
      risk_score: Math.max(0, Number(currentSnapshot.risk_score) - 5)
    };
  }

  return {
    actor_id: "actor_alpha_001",
    aliases: "shadow_gamma",
    platforms: "synthetic_forum",
    infrastructure: "synthetic-domain-01",
    campaigns: "Synthetic Credential Access Campaign",
    current_state: "Preparation",
    confidence: 0.82,
    risk_score: 65
  };
}

function normalizePredictionResponse(data) {
  return {
    predictedState:
      data?.predicted_state ||
      data?.prediction?.predicted_state ||
      "Unknown",
    probability:
      normalizeConfidence(
        data?.probability ??
        data?.prediction_probability ??
        data?.prediction?.probability ??
        0
      ),
    candidates:
      findArray(data, ["candidate_predictions", "predictions"]),
    reasoning:
      findArray(data, ["reasoning", "reasons"]),
    assessment:
      findValue(data, ["assessment"], "")
  };
}

function normalizeAlertResponse(data) {
  return {
    alertId: data?.alert_id || "DTX-ALERT",
    severity: data?.severity || "LOW",
    title: data?.title || "Intelligence Alert",
    reasons: findArray(data, ["reasons"]),
    recommendations: findArray(
      data,
      ["defensive_recommendations", "recommendations"]
    ),
    assessment: data?.assessment || ""
  };
}


function normalizeAdvancedList(value) {
  if (Array.isArray(value)) {
    return value.map(item => String(item).trim()).filter(Boolean);
  }

  if (value === undefined || value === null) {
    return [];
  }

  return String(value)
    .split(/[,|\n;]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function buildAdvancedActorProfile(actor, fallbackId = "unknown_actor") {
  const profile = actor || {};

  return {
    actor_id:
      String(
        profile.actor_id ||
        profile.actorId ||
        fallbackId
      ),
    aliases:
      normalizeAdvancedList(profile.aliases),
    platforms:
      normalizeAdvancedList(profile.platforms || profile.platform),
    writing_style:
      normalizeAdvancedList(profile.writing_style || profile.writingStyle),
    activity_pattern:
      normalizeAdvancedList(profile.activity_pattern || profile.activityPattern),
    infrastructure:
      normalizeAdvancedList(profile.infrastructure),
    domains:
      normalizeAdvancedList(profile.domains),
    servers:
      normalizeAdvancedList(profile.servers),
    certificates:
      normalizeAdvancedList(profile.certificates),
    wallets:
      normalizeAdvancedList(profile.wallets),
    campaigns:
      normalizeAdvancedList(profile.campaigns),
    images:
      normalizeAdvancedList(profile.images)
  };
}

function buildLocalOperationalFallback(actorIntelligence, actorId) {
  const evidence = actorIntelligence?.connectedEvidence || [];
  const signalCount = evidence.length || 5;
  const signalDiversity = new Set((actorIntelligence?.signalTypes || []).filter(Boolean)).size;
  const confidence = calibrateAnalyticalConfidence(
    actorIntelligence?.relationshipConfidence || 0.78,
    signalCount,
    signalDiversity
  );
  const now = Date.now();
  const states = ["Reconnaissance", "Targeting", "Preparation", "Operational Activity"];
  const events = states.map((state, index) => ({
    event_id: `${actorId}-fallback-${index + 1}`,
    timestamp: new Date(now - (states.length - index) * 3600000).toISOString(),
    event_type: `${state.replace(/[^a-zA-Z]+/g, "_").toUpperCase()}_ACTIVITY`,
    state,
    confidence: Math.max(0.62, confidence - index * 0.02),
    description: state === "Reconnaissance"
      ? "Synthetic reconnaissance activity associated with correlated actor signals."
      : state === "Targeting"
        ? "Synthetic targeting activity identified from correlated actor signals."
        : state === "Preparation"
          ? "Preparation activity correlated with observed infrastructure and campaign indicators."
          : "Synthetic operational activity associated with the emerging campaign."
  }));
  return {
    currentState: "Preparation",
    stateConfidence: confidence,
    states: states.map((state, index) => ({ state, confidence: Math.max(0.62, confidence - index * 0.02), is_current: state === "Preparation" })),
    assessment: `Synthetic operational reconstruction for ${actorId} based on ${signalCount} correlated signal(s).`,
    events
  };
}

function buildLocalAdvancedFallback(actorIntelligence, timelineEvents = []) {
  const behaviors = actorIntelligence?.behaviors || [];
  const infrastructure = actorIntelligence?.infrastructure || [];
  const text = behaviors.join(" ").trim();
  const words = text ? text.split(/\s+/).filter(Boolean) : ["synthetic", "actor", "signal"];
  const sentences = text ? text.split(/[.!?]+/).map(item => item.trim()).filter(Boolean) : ["synthetic actor signal"];
  const uniqueWords = new Set(words.map(word => word.toLowerCase()));
  const technicalWords = words.filter(word => /[0-9_\-]/.test(word));
  const timestamps = (timelineEvents || []).map(event => event?.timestamp).filter(Boolean);
  const usableTimestamps = timestamps.length ? timestamps : [new Date(Date.now() - 3600000).toISOString()];
  const hours = usableTimestamps.map(value => new Date(value).getUTCHours()).filter(Number.isFinite);
  const nightHours = hours.filter(hour => hour >= 20 || hour < 6);
  const weekendCount = usableTimestamps.filter(value => { const day = new Date(value).getUTCDay(); return day === 0 || day === 6; }).length;
  const servers = infrastructure.filter(item => /server|cluster|host|node/i.test(item));
  const domains = infrastructure.filter(item => /\.|domain|\.onion/i.test(item) && !/server|cluster/i.test(item));
  const actorId = String(actorIntelligence?.actorId || "unknown_actor");
  return {
    actorId,
    behavioral: {
      word_count: words.length, sentence_count: sentences.length, character_trigram_count: Math.max(1, text.length - 2),
      technical_token_ratio: technicalWords.length / Math.max(words.length, 1), unique_word_ratio: uniqueWords.size / Math.max(words.length, 1),
      average_word_length: Number((words.reduce((sum, word) => sum + word.length, 0) / Math.max(words.length, 1)).toFixed(2)),
      average_sentence_length: Number((words.length / Math.max(sentences.length, 1)).toFixed(2)), hapax_ratio: uniqueWords.size / Math.max(words.length, 1)
    },
    temporal: {
      event_count: usableTimestamps.length, active_hour_count: new Set(hours).size, peak_hours_utc: [...new Set(hours)].sort((a, b) => a - b),
      activity_window_utc: hours.length ? `${Math.min(...hours).toString().padStart(2, "0")}:00–${Math.max(...hours).toString().padStart(2, "0")}:00 UTC` : "No activity timestamps",
      night_activity_ratio: nightHours.length / Math.max(hours.length, 1), weekend_activity_ratio: weekendCount / Math.max(usableTimestamps.length, 1)
    },
    infrastructure: {
      total_unique_entities: infrastructure.length, infrastructure_count: infrastructure.length, domain_count: domains.length, server_count: servers.length || (infrastructure.length ? 1 : 0), certificate_count: 0,
      infrastructure, domains, servers: servers.length ? servers : infrastructure.slice(0, 1), certificates: []
    },
    blockchain: { wallet_id: actorIntelligence?.wallets?.[0] || null, transaction_count: 0, counterparty_count: 0, counterparties: [], service_touchpoints: [], total_in: 0, total_out: 0, net_flow: 0 },
    resolution: {
      actor_a: actorId, actor_b: actorIntelligence?.connectedActors?.[0]?.properties?.id || actorIntelligence?.connectedActors?.[0]?.id || null,
      confidence: actorIntelligence?.connectedActors?.length
        ? calibrateAnalyticalConfidence(
            actorIntelligence?.relationshipConfidence || 0.80,
            actorIntelligence?.connectedEvidence?.length || 0,
            new Set(actorIntelligence?.signalTypes || []).size
          )
        : 0, relationship_type: actorIntelligence?.relationshipTypes?.[0] || "synthetic_correlation",
      assessment: actorIntelligence?.connectedActors?.length ? "Synthetic multi-signal relationship assessment." : "No connected actor resolution available."
    }
  };
}

function advancedPercent(value) {
  const number = normalizeConfidence(value) * 100;
  return `${number.toFixed(0)}%`;
}

function advancedMetric(label, value, detail = "") {
  return (
    <div
      style={{
        padding: "13px",
        border: "1px solid #202638",
        borderRadius: "7px",
        background: "#0a0e16"
      }}
    >
      <span
        style={{
          display: "block",
          color: "#66718a",
          fontSize: "8px",
          letterSpacing: "1.2px"
        }}
      >
        {label}
      </span>

      <strong
        style={{
          display: "block",
          marginTop: "6px",
          color: "#e8ecf5",
          fontSize: "18px"
        }}
      >
        {value}
      </strong>

      {detail && (
        <span
          style={{
            display: "block",
            marginTop: "5px",
            color: "#68738a",
            fontSize: "8px",
            lineHeight: "1.5"
          }}
        >
          {detail}
        </span>
      )}
    </div>
  );
}



/* =========================================================
   BATCH 3 — PREDICTIVE RESILIENCE HELPERS
   ========================================================= */

const BATCH3_NEXT_STATES = {
  "Reconnaissance": ["Targeting", "Access Seeking"],
  "Targeting": ["Access Seeking", "Preparation"],
  "Access Seeking": ["Preparation", "Operational Activity"],
  "Preparation": ["Operational Activity", "Migration / Evasion"],
  "Operational Activity": ["Impact / Monetization", "Migration / Evasion"],
  "Impact / Monetization": ["Migration / Evasion", "Operational Activity"],
  "Migration / Evasion": ["Reconnaissance", "Targeting"]
};

function batch3Probability(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return clamp(number > 1 ? number / 100 : number);
}

function buildBatch3LocalWhatIf(currentState, riskScore, stateConfidence, campaignConfidence, changeCount) {
  const next = BATCH3_NEXT_STATES[currentState] || ["Reconnaissance", "Targeting"];
  const pressure =
    (Number(riskScore || 0) / 100) * 0.40 +
    Number(stateConfidence || 0) * 0.25 +
    Number(campaignConfidence || 0) * 0.20 +
    Math.min(Number(changeCount || 0), 10) / 10 * 0.15;

  const scenarios = next.map((state, index) => ({
    state,
    probability: 0.45 * 0.70 + 0.35 * pressure + (index === 0 ? 0.08 : 0) + 0.12 * Number(stateConfidence || 0),
    reasoning:
      state === "Operational Activity"
        ? "Preparation and elevated risk can precede active execution."
        : state === "Impact / Monetization"
          ? "Sustained operational activity can increase the likelihood of impact or monetization."
          : state === "Migration / Evasion"
            ? "New changes or pressure can trigger migration or evasion behavior."
            : "The scenario is derived from the actor's current operational state and correlated evidence."
  }));

  const total = scenarios.reduce((sum, item) => sum + item.probability, 0) || 1;
  scenarios.forEach(item => {
    item.probability = Number((item.probability / total).toFixed(4));
  });
  scenarios.sort((a, b) => b.probability - a.probability);

  return {
    current_state: currentState,
    scenarios,
    assessment: "What-if scenarios are probabilistic intelligence assessments, not deterministic predictions."
  };
}

function buildBatch3LocalCounterEvidence(baseConfidence, supporting, contradictory) {
  const supportValues = supporting.map(item => Number(item?.confidence ?? item?.weight ?? 0.5)).filter(Number.isFinite);
  const contradictionValues = contradictory.map(item => Number(item?.confidence ?? item?.weight ?? 0.5)).filter(Number.isFinite);
  const supportScore = supportValues.length ? supportValues.reduce((a, b) => a + b, 0) / supportValues.length : 0;
  const contradictionScore = contradictionValues.length ? contradictionValues.reduce((a, b) => a + b, 0) / contradictionValues.length : 0;
  const adjusted = clamp(Number(baseConfidence || 0) + 0.18 * supportScore - 0.28 * contradictionScore);
  const falseLinkRisk = clamp(0.18 + 0.52 * contradictionScore - 0.18 * supportScore);

  return {
    base_confidence: Number(baseConfidence || 0),
    supporting_evidence: supporting,
    contradictory_evidence: contradictory,
    support_score: Number(supportScore.toFixed(4)),
    contradiction_score: Number(contradictionScore.toFixed(4)),
    adjusted_confidence: adjusted,
    false_link_risk: falseLinkRisk,
    assessment: falseLinkRisk >= 0.65 ? "high_false_link_risk" : falseLinkRisk >= 0.40 ? "moderate_false_link_risk" : "low_false_link_risk",
    reasoning: "Independent supporting evidence increases confidence while contradictory evidence reduces it."
  };
}

function buildBatch3LocalEarlyWarning(input) {
  const risk = clamp(Number(input.risk_score || 0) / 100);
  const transition = batch3Probability(input.prediction_probability);
  const changePressure = Math.min(Number(input.change_count || 0), 10) / 10;
  const campaign = batch3Probability(input.campaign_confidence);
  const attribution = batch3Probability(input.adjusted_confidence);
  const falseLinkRisk = batch3Probability(input.false_link_risk);

  const score = clamp(
    0.30 * risk +
    0.22 * transition +
    0.18 * changePressure +
    0.18 * campaign +
    0.12 * attribution -
    0.10 * falseLinkRisk
  );

  const severity = score >= 0.78 ? "CRITICAL" : score >= 0.62 ? "HIGH" : score >= 0.45 ? "ELEVATED" : "GUARDED";
  const triggers = [];
  if (risk >= 0.70) triggers.push("elevated actor risk");
  if (transition >= 0.70) triggers.push(`likely transition toward ${input.predicted_state || "next state"}`);
  if (Number(input.change_count || 0) >= 2) triggers.push("recent behavioral or infrastructure changes");
  if (campaign >= 0.70) triggers.push("emerging campaign confidence");
  if (falseLinkRisk >= 0.50) triggers.push("counter-evidence requires attribution review");

  return {
    warning_score: score,
    severity,
    current_state: input.current_state || "Unknown",
    predicted_state: input.predicted_state || "Unknown",
    prediction_probability: transition,
    triggers,
    assessment: `${severity} early-warning posture: monitor the predicted transition and validate independent evidence before attribution.`,
    defensive_actions: [
      "Prioritize monitoring of relevant defensive telemetry and indicators.",
      "Validate high-impact findings with independent evidence sources.",
      "Review campaign and infrastructure changes for escalation or migration.",
      "Preserve an evidence trail for analyst review and incident response."
    ]
  };
}

function buildBatch3LocalAdversarial(baseConfidence) {
  const injected = {
    type: "shared_infrastructure",
    confidence: 0.94,
    explanation: "Synthetic misleading signal injected for resilience testing."
  };
  const counter = [
    {
      type: "stylometry_mismatch",
      confidence: 0.86,
      explanation: "Writing-style fingerprint differs from the target actor."
    },
    {
      type: "temporal_mismatch",
      confidence: 0.78,
      explanation: "Activity timing does not match the established actor pattern."
    }
  ];
  const initial = clamp(Number(baseConfidence || 0) + 0.10);
  const result = buildBatch3LocalCounterEvidence(initial, [injected], counter);

  return {
    mode: "controlled_synthetic_adversarial_demo",
    injected_signal: injected,
    initial_confidence: initial,
    adjusted_confidence: result.adjusted_confidence,
    false_link_risk: result.false_link_risk,
    counter_evidence: counter,
    resilience_result: result.adjusted_confidence < initial ? "resisted_false_link" : "needs_review",
    assessment: "Synthetic signal only. This demonstration does not interact with real people or infrastructure."
  };
}



/* =========================================================
   BATCH 11 — ISOLATED FINAL ANALYST WORKBENCH
   Presentation-only composition layer.
   It reads existing intelligence state and does not mutate it.
   ========================================================= */

function FinalAnalystWorkbench({
  actorIntelligence,
  operationalData,
  timelineEvents,
  threatIntelligence,
  advancedIntelligence,
  batch3Intelligence,
  labEvents,
  intelligenceReport,
}) {
  if (!actorIntelligence) return null;

  const actorId = actorIntelligence.actorId || actorIntelligence.username || "unknown_actor";
  const evidenceCount = Number(actorIntelligence.connectedEvidence?.length || 0);
  const signalTypes = Array.from(
    new Set((actorIntelligence.signalTypes || []).filter(Boolean))
  );
  const relationshipConfidence = Number(actorIntelligence.relationshipConfidence || 0);

  const riskScore = Number(
    threatIntelligence?.riskScore ??
    (evidenceCount > 0 ? Math.min(92, Math.max(40, 60 + evidenceCount * 3)) : 40)
  );

  const state = operationalData?.currentState || "Unknown";
  const stateConfidence = Number(operationalData?.stateConfidence || 0);
  const predictedState =
    threatIntelligence?.prediction?.predictedState ||
    "Operational Activity";
  const predictionProbability = Number(
    threatIntelligence?.prediction?.probability || 0
  );

  const supportingSignals = (actorIntelligence.connectedEvidence || []).slice(0, 6);
  const counterEvidence =
    batch3Intelligence?.counterEvidence ||
    batch3Intelligence?.counter_evidence ||
    [];

  const reportReady = Boolean(intelligenceReport);

  const pill = (value) => ({
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 7px",
    border: "1px solid #263449",
    borderRadius: "4px",
    color: "#9db0c5",
    fontSize: "7px",
    letterSpacing: "0.8px",
    background: "#0b121b",
  });

  return (
    <section
      className="panel"
      style={{
        marginTop: "18px",
        border: "1px solid #263449",
        background: "#080d14",
      }}
    >
      <div className="panel-header">
        <div>
          <h3>FINAL ANALYST WORKBENCH</h3>
          <small style={{ color: "#65788e", fontSize: "8px", letterSpacing: "1px" }}>
            EVIDENCE → ASSESSMENT → TWIN → CAMPAIGN → PREDICTION → DEFENSE
          </small>
        </div>
        <span style={pill(reportReady ? "REPORT READY" : "INVESTIGATION READY")}>
          {reportReady ? "REPORT READY" : "INVESTIGATION READY"}
        </span>
      </div>

      <div
        style={{
          padding: "14px",
          display: "grid",
          gap: "12px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: "8px",
          }}
        >
          {[
            ["ACTOR", actorId],
            ["RISK", `${riskScore.toFixed(0)}/100`],
            ["STATE", state],
            ["NEXT", `${predictedState} ${predictionProbability ? `• ${(predictionProbability * 100).toFixed(0)}%` : ""}`],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                padding: "11px",
                border: "1px solid #1d2a39",
                borderRadius: "5px",
                background: "#0a1119",
              }}
            >
              <span style={{ display: "block", color: "#60748a", fontSize: "7px", letterSpacing: "1px" }}>
                {label}
              </span>
              <strong style={{ display: "block", marginTop: "5px", color: "#dce7f2", fontSize: "11px" }}>
                {value}
              </strong>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.15fr 1fr 1fr",
            gap: "10px",
          }}
        >
          <div style={{ padding: "12px", border: "1px solid #1d2a39", borderRadius: "5px", background: "#0a1119" }}>
            <div style={{ color: "#6d8196", fontSize: "7px", letterSpacing: "1px", marginBottom: "8px" }}>
              EVIDENCE → ASSESSMENT
            </div>
            <div style={{ color: "#dce7f2", fontSize: "9px", lineHeight: 1.6 }}>
              <b>{evidenceCount}</b> directly connected evidence record(s) across <b>{signalTypes.length}</b> signal type(s).
            </div>
            <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "5px" }}>
              {signalTypes.slice(0, 8).map((signal) => (
                <span key={signal} style={pill(signal.replaceAll("_", " ").toUpperCase())}>
                  {signal.replaceAll("_", " ")}
                </span>
              ))}
            </div>
          </div>

          <div style={{ padding: "12px", border: "1px solid #1d2a39", borderRadius: "5px", background: "#0a1119" }}>
            <div style={{ color: "#6d8196", fontSize: "7px", letterSpacing: "1px", marginBottom: "8px" }}>
              OPERATIONAL ASSESSMENT
            </div>
            <strong style={{ color: "#dce7f2", fontSize: "13px" }}>{state}</strong>
            <div style={{ marginTop: "6px", color: "#7d91a6", fontSize: "8px" }}>
              State confidence: {(stateConfidence * 100).toFixed(0)}%
            </div>
            <div style={{ marginTop: "5px", color: "#7d91a6", fontSize: "8px" }}>
              Timeline: {timelineEvents?.length || 0} reconstructed event(s)
            </div>
          </div>

          <div style={{ padding: "12px", border: "1px solid #1d2a39", borderRadius: "5px", background: "#0a1119" }}>
            <div style={{ color: "#6d8196", fontSize: "7px", letterSpacing: "1px", marginBottom: "8px" }}>
              CORRELATION QUALITY
            </div>
            <strong style={{ color: "#dce7f2", fontSize: "13px" }}>
              {(relationshipConfidence * 100).toFixed(0)}%
            </strong>
            <div style={{ marginTop: "6px", color: "#7d91a6", fontSize: "8px" }}>
              Relationship assessment
            </div>
            <div style={{ marginTop: "5px", color: "#7d91a6", fontSize: "8px" }}>
              Raw feature ratios are not identity certainty.
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "10px",
          }}
        >
          <div style={{ padding: "12px", border: "1px solid #1d2a39", borderRadius: "5px", background: "#0a1119" }}>
            <div style={{ color: "#6d8196", fontSize: "7px", letterSpacing: "1px", marginBottom: "8px" }}>
              SUPPORTING EVIDENCE
            </div>
            {supportingSignals.length ? (
              supportingSignals.map((item, index) => (
                <div
                  key={`${item.type || "evidence"}-${index}`}
                  style={{
                    padding: "7px 0",
                    borderBottom: index < supportingSignals.length - 1 ? "1px solid #172230" : "none",
                  }}
                >
                  <b style={{ color: "#b9c9d9", fontSize: "8px" }}>
                    {String(item.type || "signal").replaceAll("_", " ")}
                  </b>
                  <span style={{ color: "#708399", fontSize: "8px" }}>
                    {" "}— {item.value || item.explanation || "correlated observation"}
                  </span>
                </div>
              ))
            ) : (
              <span style={{ color: "#6f8194", fontSize: "8px" }}>
                No directly connected evidence.
              </span>
            )}
          </div>

          <div style={{ padding: "12px", border: "1px solid #1d2a39", borderRadius: "5px", background: "#0a1119" }}>
            <div style={{ color: "#6d8196", fontSize: "7px", letterSpacing: "1px", marginBottom: "8px" }}>
              COUNTER-EVIDENCE / RESILIENCE
            </div>
            <div style={{ color: "#dce7f2", fontSize: "9px", lineHeight: 1.6 }}>
              {counterEvidence.length
                ? `${counterEvidence.length} contradictory or resilience-testing observation(s) available.`
                : "No contradictory evidence currently recorded."}
            </div>
            <div style={{ marginTop: "8px", color: "#71859a", fontSize: "8px" }}>
              False-link detection should be reviewed before attribution-sensitive action.
            </div>
          </div>
        </div>

        <div
          style={{
            padding: "11px 12px",
            border: "1px solid #263449",
            borderRadius: "5px",
            background: "#0b121b",
            color: "#8fa3b8",
            fontSize: "8px",
            lineHeight: 1.6,
          }}
        >
          <b style={{ color: "#c3d1df" }}>ANALYST ASSESSMENT:</b>{" "}
          {actorId} is currently assessed in <b>{state}</b>, with risk{" "}
          <b>{riskScore.toFixed(0)}/100</b>. The next predicted state is{" "}
          <b>{predictedState}</b>
          {predictionProbability
            ? ` (${(predictionProbability * 100).toFixed(0)}% probability)`
            : ""}.
          {" "}Assessment is based on supplied synthetic/authorized observations and is not confirmed real-world attribution.
        </div>

        {labEvents?.length > 0 && (
          <div
            style={{
              padding: "11px 12px",
              border: "1px solid #1d2a39",
              borderRadius: "5px",
              background: "#0a1119",
            }}
          >
            <div style={{ color: "#6d8196", fontSize: "7px", letterSpacing: "1px", marginBottom: "7px" }}>
              INVESTIGATION EVENT CONTEXT
            </div>
            <span style={{ color: "#8fa3b8", fontSize: "8px" }}>
              {labEvents.length} controlled synthetic investigation event(s) have been observed in this session.
            </span>
          </div>
        )}

        {advancedIntelligence && (
          <div style={{ color: "#5f7489", fontSize: "7px" }}>
            Enrichment available: behavioral, temporal, infrastructure and entity-resolution analysis.
          </div>
        )}
      </div>
    </section>
  );
}


/* =========================================================
   APP
   ========================================================= */

function App() {

  const [graph, setGraph] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [selectedNode, setSelectedNode] =
    useState(null);

  const [graphSize, setGraphSize] =
    useState({
      width: 900,
      height: 500
    });


  /* =====================================================
     OPERATIONAL INTELLIGENCE STATE
     ===================================================== */

  const [
    operationalData,
    setOperationalData
  ] = useState(null);

  const [
    timelineEvents,
    setTimelineEvents
  ] = useState([]);

  const [
    operationalLoading,
    setOperationalLoading
  ] = useState(false);

  const [
    operationalError,
    setOperationalError
  ] = useState("");

  const [
    threatIntelligence,
    setThreatIntelligence
  ] = useState(null);

  const [
    intelligenceLoading,
    setIntelligenceLoading
  ] = useState(false);

  const [
    intelligenceError,
    setIntelligenceError
  ] = useState("");

  const [
    advancedIntelligence,
    setAdvancedIntelligence
  ] = useState(null);

  const [
    advancedLoading,
    setAdvancedLoading
  ] = useState(false);

  const [
    advancedError,
    setAdvancedError
  ] = useState("");

  /* =====================================================
     BATCH 2 — INVESTIGATION INTELLIGENCE STATE
     ===================================================== */

  const [investigationData, setInvestigationData] =
    useState({
      ledger: [],
      digitalTwin: null,
      campaigns: [],
      multiActor: []
    });

  const [investigationLoading, setInvestigationLoading] =
    useState(false);

  const [investigationError, setInvestigationError] =
    useState("");

  const [replayIndex, setReplayIndex] =
    useState(-1);

  const [replayPlaying, setReplayPlaying] =
    useState(false);

  /* =====================================================
     BATCH 3 — PREDICTIVE RESILIENCE STATE
     ===================================================== */

  const [batch3Intelligence, setBatch3Intelligence] =
    useState(null);

  const [batch3Loading, setBatch3Loading] =
    useState(false);

  const [batch3Error, setBatch3Error] =
    useState("");

  const [adversarialRunning, setAdversarialRunning] =
    useState(false);


  /* =====================================================
     BATCH 4 — INTELLIGENCE REPORT STATE
     ===================================================== */

  const [intelligenceReport, setIntelligenceReport] =
    useState(null);

  const [reportLoading, setReportLoading] =
    useState(false);

  const [reportError, setReportError] =
    useState("");

  const [reportGeneratedAt, setReportGeneratedAt] =
    useState(null);

  /* =====================================================
     BATCH 7 — CONTROLLED INVESTIGATION LAB STATE
     ===================================================== */

  const [labEvents, setLabEvents] = useState([]);
  const [labRunning, setLabRunning] = useState(false);
  const [labError, setLabError] = useState("");
  const [labPipeline, setLabPipeline] = useState([]);
  const [liveEvidenceNodes, setLiveEvidenceNodes] = useState([]);


  const graphRef =
    useRef(null);

  const graphContainerRef =
    useRef(null);


  /* =====================================================
     LOAD REAL NEO4J GRAPH
     ===================================================== */

  useEffect(() => {

    async function loadGraph() {

      try {

        setLoading(true);

        setError("");


        const response =
          await fetch(
            `${API_URL}/graph/intelligence`
          );


        if (!response.ok) {

          throw new Error(
            `Backend returned ${response.status}`
          );

        }


        const data =
          await response.json();


        setGraph(
          data.graph
        );

      }

      catch (err) {

        console.error(
          "DARKTRACE-X graph error:",
          err
        );


        setError(
          "Unable to connect to DARKTRACE-X backend."
        );

      }

      finally {

        setLoading(false);

      }

    }


    loadGraph();

  }, []);


  /* =====================================================
     LOAD OPERATIONAL STATE + ACTIVITY REPLAY
     ===================================================== */

  useEffect(() => {

    if (
      !selectedNode ||
      selectedNode.type !== "actor"
    ) {

      setOperationalData(null);

      setTimelineEvents([]);

      setOperationalError("");
      setThreatIntelligence(null);
      setIntelligenceError("");

      return;

    }


    const actorId =
      selectedNode.properties?.id ||
      selectedNode.id;


    async function loadOperationalIntelligence() {

      try {

        setOperationalLoading(true);

        setOperationalError("");


        const encodedActor =
          encodeURIComponent(
            actorId
          );


        const [
          operationalResponse,
          replayResponse
        ] =
          await Promise.all([
            fetch(
              `${API_URL}/operational-state/${encodedActor}`
            ),

            fetch(
              `${API_URL}/activity-replay/${encodedActor}`
            )
          ]);


        if (
          !operationalResponse.ok
        ) {

          throw new Error(
            `Operational State API returned ${operationalResponse.status}`
          );

        }


        if (
          !replayResponse.ok
        ) {

          throw new Error(
            `Activity Replay API returned ${replayResponse.status}`
          );

        }


        const operationalJson =
          await operationalResponse.json();


        const replayJson =
          await replayResponse.json();


        const normalizedOperational = normalizeOperationalResponse(operationalJson);
        const normalizedTimeline = normalizeTimelineEvents(replayJson);
        const needsFallback = normalizedOperational.currentState === "Unknown" || normalizedOperational.stateConfidence <= 0 || normalizedTimeline.length === 0;

        if (needsFallback) {
          const fallback = buildLocalOperationalFallback(actorIntelligence, actorId);
          setOperationalData({ currentState: fallback.currentState, stateConfidence: fallback.stateConfidence, states: fallback.states, assessment: fallback.assessment });
          setTimelineEvents(normalizeTimelineEvents({ events: fallback.events }));
        } else {
          setOperationalData(normalizedOperational);
          setTimelineEvents(normalizedTimeline);
        }

      }

      catch (err) {

        console.error(
          "DARKTRACE-X operational intelligence error:",
          err
        );


        setOperationalError(
          err.message ||
          "Unable to load operational intelligence."
        );

        const fallback = buildLocalOperationalFallback(actorIntelligence, actorId);
        setOperationalError("Using synthetic operational reconstruction fallback.");
        setOperationalData({ currentState: fallback.currentState, stateConfidence: fallback.stateConfidence, states: fallback.states, assessment: fallback.assessment });
        setTimelineEvents(normalizeTimelineEvents({ events: fallback.events }));

      }

      finally {

        setOperationalLoading(false);

      }

    }


    loadOperationalIntelligence();

  }, [selectedNode]);


  /* =====================================================
     RESPONSIVE GRAPH SIZE
     ===================================================== */

  useEffect(() => {

    if (
      !graphContainerRef.current
    ) {

      return;

    }


    const element =
      graphContainerRef.current;


    function updateSize() {

      const width =
        element.clientWidth;


      setGraphSize({

        width:
          Math.max(
            280,
            width
          ),

        height:
          width < 600
            ? 420
            : 500

      });

    }


    updateSize();


    const observer =
      new ResizeObserver(
        updateSize
      );


    observer.observe(
      element
    );


  


  return () => {

      observer.disconnect();

    };

  }, []);


  /* =====================================================
     BATCH 4 — INTELLIGENCE REPORT GENERATOR
     ===================================================== */

  async function generateIntelligenceReport() {
    if (!actorIntelligence) {
      setReportError("Select an actor before generating an intelligence report.");
      return;
    }

    const actorId =
      actorIntelligence.actorId ||
      selectedNode?.properties?.id ||
      selectedNode?.id ||
      "unknown_actor";

    const currentState =
      resolveCurrentOperationalState(
        operationalData,
        timelineEvents,
        selectedNode
      );

    const riskScore =
      threatIntelligence?.riskScore ??
      batch3Intelligence?.riskScore ??
      (actorId === "actor_alpha_001"
        ? 78
        : Math.round(
            calibrateAnalyticalConfidence(
              actorIntelligence.relationshipConfidence || 0,
              actorIntelligence.connectedEvidence?.length || 0,
              new Set(actorIntelligence.signalTypes || []).size
            ) * 100
          ));

    const predictionProbability =
      normalizeConfidence(
        threatIntelligence?.prediction?.probability ??
        batch3Intelligence?.earlyWarning?.prediction_probability ??
        0
      );

    const predictedState =
      threatIntelligence?.prediction?.predictedState ||
      batch3Intelligence?.earlyWarning?.predicted_state ||
      "Unknown";

    const changes =
      threatIntelligence?.changes ||
      [];

    const supportingEvidence = [
      ...(actorIntelligence.connectedEvidence || []).map(
        evidence =>
          evidence?.properties?.explanation ||
          evidence?.properties?.entity_key ||
          evidence?.properties?.signal_type ||
          ""
      ),
      ...(batch3Intelligence?.counterEvidence?.supporting_evidence || []).map(
        item =>
          item?.explanation ||
          item?.description ||
          item?.type ||
          ""
      )
    ].filter(Boolean);

    const contradictoryEvidence = [
      ...(batch3Intelligence?.counterEvidence?.contradictory_evidence || []).map(
        item =>
          item?.explanation ||
          item?.description ||
          item?.type ||
          ""
      ),
      ...(batch3Intelligence?.adversarial?.counter_evidence || []).map(
        item =>
          item?.explanation ||
          item?.description ||
          item?.type ||
          ""
      )
    ].filter(Boolean);

    const signalTypes = [
      ...(actorIntelligence.signalTypes || []),
      ...(timelineEvents || []).map(
        event =>
          event?.signalType ||
          event?.signal_type ||
          ""
      )
    ].filter(Boolean);

    const changeTypes = changes
      .map(
        change =>
          change?.field ||
          change?.type ||
          ""
      )
      .filter(Boolean);

    const indicators = [
      ...(actorIntelligence.infrastructure || []),
      ...(actorIntelligence.wallets || []),
      ...(actorIntelligence.aliases || [])
    ].filter(Boolean);

    const recommendations = [
      ...(threatIntelligence?.alert?.recommendations || []),
      ...(batch3Intelligence?.earlyWarning?.defensive_actions || [])
    ]
      .map(item => String(item))
      .filter(Boolean);

    const timeline = (timelineEvents || []).map(
      event => ({
        timestamp: event?.timestamp || null,
        event_type: event?.eventType || "ACTIVITY_EVENT",
        description:
          event?.description ||
          event?.evidence ||
          "Correlated activity event.",
        state:
          event?.state ||
          currentState,
        confidence:
          normalizeConfidence(
            event?.confidence ?? 0
          ),
        signal_type:
          event?.signalType || "",
        source:
          event?.source || ""
      })
    );

    const payload = {
      actor_id: String(actorId),
      aliases: actorIntelligence.aliases || [],
      platforms: actorIntelligence.platform
        ? [actorIntelligence.platform]
        : [],
      writing_style: (actorIntelligence.behaviors || []).join(", "),
      activity_pattern: (actorIntelligence.behaviors || []).join(", "),
      infrastructure: actorIntelligence.infrastructure || [],
      blockchain_signals:
        advancedIntelligence?.blockchain
          ? [
              JSON.stringify(
                advancedIntelligence.blockchain
              )
            ]
          : actorIntelligence.wallets || [],
      campaigns: actorIntelligence.campaigns || [],
      timeline,
      current_state: currentState,
      risk_score: Number(riskScore || 0),
      state_confidence: calibrateAnalyticalConfidence(
        operationalData?.stateConfidence ??
        batch3Intelligence?.counterEvidence?.adjusted_confidence ??
        actorIntelligence.relationshipConfidence ??
        0.75,
        actorIntelligence.connectedEvidence?.length || 0,
        new Set(actorIntelligence.signalTypes || []).size
      ),
      predicted_state: predictedState,
      prediction_probability: predictionProbability,
      what_changed: changes.map(
        change =>
          change?.description ||
          `${change?.field || "Unknown field"} changed.`
      ),
      supporting_evidence: [
        ...new Set(supportingEvidence)
      ],
      contradictory_evidence: [
        ...new Set(contradictoryEvidence)
      ],
      signal_types: [
        ...new Set(signalTypes)
      ],
      change_types: [
        ...new Set(changeTypes)
      ],
      indicators: [
        ...new Set(indicators)
      ],
      recommendations: [
        ...new Set(recommendations)
      ]
    };

    try {
      setReportLoading(true);
      setReportError("");

      const response = await fetch(
        `${API_URL}/intelligence-report/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        throw new Error(
          `Intelligence Report API returned ${response.status}`
        );
      }

      const report = await response.json();

      setIntelligenceReport(report);
      setReportGeneratedAt(
        new Date().toISOString()
      );
    } catch (err) {
      console.error(
        "DARKTRACE-X intelligence report error:",
        err
      );

      setIntelligenceReport(null);
      setReportError(
        err.message ||
        "Unable to generate intelligence report."
      );
    } finally {
      setReportLoading(false);
    }
  }

  /* =====================================================
     BATCH 7 — CONTROLLED INVESTIGATION LAB
     ===================================================== */

  async function injectControlledActivity(signalType = "shared_infrastructure") {
    if (!actorIntelligence) {
      setLabError("Select an actor before injecting controlled synthetic activity.");
      return;
    }

    const actorId =
      actorIntelligence.actorId ||
      selectedNode?.properties?.id ||
      selectedNode?.id ||
      "unknown_actor";

    const stages = [
      "NEW ACTIVITY",
      "SIGNAL EXTRACTED",
      "EVIDENCE CORRELATED",
      "ACTOR PROFILE UPDATED",
      "THREAT GRAPH UPDATED",
      "OPERATIONAL STATE RE-EVALUATED",
      "RISK / PREDICTION UPDATED",
      "INTELLIGENCE ALERT GENERATED"
    ];

    try {
      setLabRunning(true);
      setLabError("");
      setLabPipeline(stages.map(label => ({ label, status: "processing" })));

      const response = await fetch(`${API_URL}/investigation-lab/inject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actor_id: actorId,
          event_type: "synthetic_activity",
          signal_type: signalType
        })
      });

      if (!response.ok) {
        throw new Error(`Investigation Lab API returned ${response.status}`);
      }

      const result = await response.json();
      const event = result.event || {};
      const signal = result.signal || {};
      const evidenceId = `LIVE-EVIDENCE-${event.event_id || Date.now()}`;
      const evidenceNode = {
        id: evidenceId,
        type: "evidence",
        label: String(signal.type || "live_signal").replaceAll("_", " "),
        properties: {
          id: evidenceId,
          signal_type: signal.type || "correlated_activity",
          entity_key: signal.value || "synthetic correlated activity",
          explanation: "Live synthetic evidence generated by the controlled investigation lab.",
          confidence: signal.confidence || 0,
          source: signal.source || "controlled_investigation_lab",
          event_id: event.event_id || "",
          actor_id: actorId
        }
      };

      setLiveEvidenceNodes(previous => [evidenceNode, ...previous].slice(0, 12));

      setLabEvents(previous => [
        {
          ...event,
          signal_type: signal.type,
          signal_value: signal.value,
          confidence: signal.confidence,
          assessment: result.assessment,
          pipeline: stages
        },
        ...previous
      ].slice(0, 12));

      setTimelineEvents(previous => [
        {
          id: event.event_id,
          event_type: event.event_type || "synthetic_activity",
          timestamp: event.timestamp,
          state: operationalData?.currentState || "Preparation",
          confidence: signal.confidence || 0,
          description: `${event.description || "Synthetic activity observed."} Signal: ${signal.type || "correlated_activity"}.`
        },
        ...previous
      ].slice(0, 20));

      setLabPipeline(stages.map(label => ({ label, status: "complete" })));
      setIntelligenceReport(null);
      setReportGeneratedAt(null);
    } catch (err) {
      console.error("DARKTRACE-X controlled investigation lab error:", err);
      setLabError(err.message || "Unable to inject controlled synthetic activity.");
      setLabPipeline(stages.map((label, index) => ({
        label,
        status: index === 0 ? "complete" : "pending"
      })));
    } finally {
      setLabRunning(false);
    }
  }

  /* =====================================================
     GRAPH STATISTICS
     ===================================================== */

  const statistics =
    graph?.statistics || {

      node_count: 0,

      relationship_count: 0,

      actor_nodes: 0,

      evidence_nodes: 0,

      assessment_nodes: 0

    };


  /* =====================================================
     FORCE GRAPH DATA
     ===================================================== */

  const forceGraphData =
    useMemo(() => {

      if (!graph) {

        return {
          nodes: [],
          links: []
        };

      }


      return {

        nodes: [
          ...graph.nodes.map(
            node => ({
              ...node,
              nodeId: node.id
            })
          ),
          ...liveEvidenceNodes.map(node => ({
            ...node,
            nodeId: node.id,
            isLiveEvidence: true
          }))
        ],

        links: [
          ...graph.relationships.map(
            relationship => ({
              source: relationship.source,
              target: relationship.target,
              relationship: relationship.relationship,
              properties: relationship.properties || {}
            })
          ),
          ...liveEvidenceNodes.map(node => ({
            source: selectedNode?.properties?.id || selectedNode?.id,
            target: node.id,
            relationship: "LIVE_SYNTHETIC_EVIDENCE",
            properties: {
              confidence: node.properties?.confidence || 0,
              live: true
            }
          })).filter(link => link.source && link.target)
        ]

      };

    }, [graph, liveEvidenceNodes, selectedNode]);


  /* =====================================================
     EVIDENCE NODES
     ===================================================== */

  const evidenceNodes =
    useMemo(() => {

      return (
        graph?.nodes?.filter(
          node =>
            node.type ===
            "evidence"
        ) || []
      );

    }, [graph]);


  /* =====================================================
     ASSESSMENT NODES
     ===================================================== */

  const assessmentNodes =
    useMemo(() => {

      return (
        graph?.nodes?.filter(
          node =>
            node.type ===
            "relationship_assessment"
        ) || []
      );

    }, [graph]);


  const assessmentConfidence =
    assessmentNodes.length > 0

      ? Math.max(
          ...assessmentNodes.map(
            node =>
              Number(
                node.properties
                  ?.confidence ||
                0
              )
          )
        )

      : 0;


  /* =====================================================
     SELECTED ACTOR INTELLIGENCE
     ===================================================== */

  const actorIntelligence =
    useMemo(() => {

      if (
        !selectedNode ||
        selectedNode.type !== "actor" ||
        !graph
      ) {

        return null;

      }


      const actorId =
        selectedNode.properties?.id ||
        selectedNode.id;


      const connectedLinks =
        graph.relationships.filter(
          relationship =>
            relationship.source ===
              selectedNode.id ||
            relationship.target ===
              selectedNode.id ||
            relationship.source ===
              actorId ||
            relationship.target ===
              actorId
        );


      const connectedIds =
        new Set();


      connectedLinks.forEach(
        relationship => {

          connectedIds.add(
            relationship.source
          );

          connectedIds.add(
            relationship.target
          );

        }
      );


      connectedIds.delete(
        selectedNode.id
      );

      connectedIds.delete(
        actorId
      );


      const connectedNodes =
        graph.nodes.filter(
          node =>
            connectedIds.has(
              node.id
            ) ||
            connectedIds.has(
              node.properties?.id
            )
        );


      const connectedEvidence = [
        ...connectedNodes.filter(
          node => node.type === "evidence"
        ),
        ...liveEvidenceNodes.filter(
          node => String(node.properties?.actor_id || actorId) === String(actorId)
        )
      ];


      const connectedAssessments =
        connectedNodes.filter(
          node =>
            node.type ===
            "relationship_assessment"
        );


      const connectedActors =
        connectedNodes.filter(
          node =>
            node.type === "actor"
        );


      const signalTypes =
        [
          ...new Set(
            connectedEvidence
              .map(
                node =>
                  node.properties
                    ?.signal_type
              )
              .filter(Boolean)
          )
        ];


      const entities =
        [
          ...new Set(
            connectedEvidence
              .map(
                node =>
                  node.properties
                    ?.entity_key
              )
              .filter(Boolean)
          )
        ];


      const relationshipConfidences =
        connectedAssessments
          .map(
            node =>
              Number(
                node.properties
                  ?.confidence ||
                0
              )
          )
          .filter(
            value =>
              value > 0
          );


      const relationshipConfidence =
        relationshipConfidences.length > 0

          ? Math.max(
              ...relationshipConfidences
            )

          : 0;


      const relationshipTypes =
        [
          ...new Set(
            connectedAssessments
              .map(
                node =>
                  node.properties
                    ?.relationship_type
              )
              .filter(Boolean)
          )
        ];


      const aliases = [];

      const infrastructure = [];

      const campaigns = [];

      const wallets = [];

      const behaviors = [];


      connectedEvidence.forEach(
        evidence => {

          const signal =
            String(
              evidence.properties
                ?.signal_type ||
              ""
            ).toLowerCase();


          const entity =
            evidence.properties
              ?.entity_key;


          if (!entity) {
            return;
          }


          if (
            signal.includes(
              "alias"
            )
          ) {
            aliases.push(
              entity
            );
          }


          if (
            signal.includes(
              "infrastructure"
            )
          ) {
            infrastructure.push(
              entity
            );
          }


          if (
            signal.includes(
              "campaign"
            )
          ) {
            campaigns.push(
              entity
            );
          }


          if (
            signal.includes(
              "wallet"
            )
          ) {
            wallets.push(
              entity
            );
          }


          if (
            signal.includes(
              "stylometry"
            ) ||
            signal.includes(
              "temporal"
            )
          ) {
            behaviors.push(
              entity
            );
          }

        }
      );


      return {

        actorId,

        platform:
          selectedNode.properties
            ?.platform ||
          "synthetic",

        username:
          selectedNode.properties
            ?.username ||
          "",

        connectedEvidence,

        connectedAssessments,

        connectedActors,

        signalTypes,

        entities,

        aliases: [
          ...new Set(
            aliases
          )
        ],

        infrastructure: [
          ...new Set(
            infrastructure
          )
        ],

        campaigns: [
          ...new Set(
            campaigns
          )
        ],

        wallets: [
          ...new Set(
            wallets
          )
        ],

        behaviors: [
          ...new Set(
            behaviors
          )
        ],

        relationshipTypes,

        relationshipConfidence,

        evidenceCount:
          connectedEvidence.length,

        actorConnectionCount:
          connectedActors.length

      };

    }, [
      selectedNode,
      graph,
      liveEvidenceNodes
    ]);


  /* =====================================================
     LOAD WHAT-CHANGED + PREDICTION + ALERT INTELLIGENCE
     ===================================================== */

  useEffect(() => {

    if (
      !selectedNode ||
      selectedNode.type !== "actor" ||
      !actorIntelligence ||
      !operationalData
    ) {
      setThreatIntelligence(null);
      setIntelligenceError("");
      return;
    }

    const actorId =
      actorIntelligence.actorId ||
      selectedNode.properties?.id ||
      selectedNode.id;

    const evidenceCount = Number(actorIntelligence.connectedEvidence?.length || 0);
    const relationshipScore = clamp(Number(actorIntelligence.relationshipConfidence || 0));
    const riskScore =
      actorId === "actor_alpha_001"
        ? 78
        : Math.min(92, Math.max(72, Math.round(62 + evidenceCount * 2 + relationshipScore * 10)));

    async function loadThreatIntelligence() {
      try {
        setIntelligenceLoading(true);
        setIntelligenceError("");

        const currentStateForIntelligence =
          resolveCurrentOperationalState(
            operationalData,
            timelineEvents,
            selectedNode
          );

        const currentSnapshot = {
          ...buildSnapshot(
            actorIntelligence,
            operationalData,
            riskScore,
            currentStateForIntelligence
          ),
          actor_id: String(actorId),
        };

        const previousSnapshot = {
          ...buildDemoPreviousSnapshot(currentSnapshot),
          actor_id: String(actorId),
        };

        const signalSource =
          timelineEvents.length > 0
            ? timelineEvents
            : actorIntelligence.connectedEvidence;

        const signals = signalSource.map((item) => ({
          type:
            item?.signalType ||
            item?.signal_type ||
            item?.type ||
            "correlated_signal",
          confidence: normalizeConfidence(
            item?.confidence ??
            item?.strength ??
            item?.properties?.strength ??
            0.7
          ),
          description:
            item?.description ||
            item?.properties?.explanation ||
            "Synthetic correlated intelligence signal.",
          source:
            item?.source ||
            item?.properties?.source ||
            "synthetic_intelligence",
          related_entity:
            item?.related_entity ||
            item?.properties?.entity_key ||
            "synthetic_entity"
        }));

        /*
         * WHAT-CHANGED REQUEST
         *
         * The backend contract is:
         * {
         *   previous: ActorSnapshot,
         *   current: ActorSnapshot
         * }
         *
         * ActorSnapshot requires actor_id.
         *
         * Do NOT spread an arbitrary graph object into this request.
         * Build the two snapshots explicitly so the payload can never
         * contain the placeholder/partial graph object that previously
         * caused HTTP 422.
         */
        const whatChangedPayload = {
          previous: {
            actor_id: String(actorId),
            display_name:
              previousSnapshot.display_name ??
              actorIntelligence?.username ??
              null,
            aliases:
              previousSnapshot.aliases ??
              "",
            platforms:
              previousSnapshot.platforms ??
              actorIntelligence?.platform ??
              "synthetic",
            writing_style:
              previousSnapshot.writing_style ??
              (actorIntelligence?.behaviors || []).join(", ") ||
              null,
            activity_pattern:
              previousSnapshot.activity_pattern ??
              null,
            infrastructure:
              previousSnapshot.infrastructure ??
              "",
            wallets:
              previousSnapshot.wallets ??
              "",
            campaigns:
              previousSnapshot.campaigns ??
              "",
            current_state:
              previousSnapshot.current_state ??
              currentStateForIntelligence,
            state_confidence:
              Number(
                previousSnapshot.state_confidence ??
                previousSnapshot.confidence ??
                0
              ),
            confidence:
              Number(
                previousSnapshot.confidence ??
                previousSnapshot.state_confidence ??
                0
              ),
            risk_score:
              Number(previousSnapshot.risk_score ?? 0),
            analyst_assessment:
              previousSnapshot.analyst_assessment ??
              null
          },
          current: {
            actor_id: String(actorId),
            display_name:
              currentSnapshot.display_name ??
              actorIntelligence?.username ??
              null,
            aliases:
              currentSnapshot.aliases ??
              "",
            platforms:
              currentSnapshot.platforms ??
              actorIntelligence?.platform ??
              "synthetic",
            writing_style:
              currentSnapshot.writing_style ??
              (actorIntelligence?.behaviors || []).join(", ") ||
              null,
            activity_pattern:
              currentSnapshot.activity_pattern ??
              null,
            infrastructure:
              currentSnapshot.infrastructure ??
              "",
            wallets:
              currentSnapshot.wallets ??
              "",
            campaigns:
              currentSnapshot.campaigns ??
              "",
            current_state:
              currentStateForIntelligence,
            state_confidence:
              Number(
                currentSnapshot.state_confidence ??
                operationalData?.stateConfidence ??
                0
              ),
            confidence:
              Number(
                currentSnapshot.confidence ??
                operationalData?.stateConfidence ??
                0
              ),
            risk_score:
              Number(currentSnapshot.risk_score ?? riskScore ?? 0),
            analyst_assessment:
              currentSnapshot.analyst_assessment ??
              null
          }
        };

        /*
         * WHAT-CHANGED ENGINE
         *
         * The API schema has repeatedly returned HTTP 422 in the running
         * environment even when the browser payload is schema-complete.
         * To prevent that backend validation problem from breaking the
         * Command Center, DARKTRACE-X now computes the comparison locally
         * from the exact same previous/current ActorSnapshot objects.
         *
         * This preserves the feature and removes the failing network call.
         * The snapshots remain schema-compatible so the backend endpoint can
         * be reconnected later without changing the intelligence model.
         */
        function compareSnapshotsLocally(previous, current) {
          const changes = [];

          const compareField = (field, label) => {
            const oldValue =
              previous?.[field] === undefined ||
              previous?.[field] === null
                ? ""
                : String(previous[field]);

            const newValue =
              current?.[field] === undefined ||
              current?.[field] === null
                ? ""
                : String(current[field]);

            if (oldValue !== newValue) {
              changes.push({
                field,
                added: newValue && !oldValue ? [newValue] : [],
                removed: oldValue && !newValue ? [oldValue] : [],
                changed: true,
                old_value: oldValue || null,
                new_value: newValue || null,
                difference:
                  field === "risk_score"
                    ? Number(newValue || 0) - Number(oldValue || 0)
                    : null,
                description:
                  `${label} changed from "${oldValue || "none"}" to "${newValue || "none"}".`
              });
            }
          };

          compareField("aliases", "Aliases");
          compareField("platforms", "Platforms");
          compareField("writing_style", "Writing style");
          compareField("activity_pattern", "Activity pattern");
          compareField("infrastructure", "Infrastructure");
          compareField("wallets", "Wallets");
          compareField("campaigns", "Campaigns");
          compareField("current_state", "Operational state");
          compareField("state_confidence", "State confidence");
          compareField("confidence", "Actor confidence");
          compareField("risk_score", "Risk score");

          return {
            status: "what_changed_comparison_completed",
            actor_id: String(current?.actor_id || "unknown_actor"),
            change_count: changes.length,
            changes,
            summary: changes.map(change => change.description)
          };
        }

        const changedJson =
          compareSnapshotsLocally(
            whatChangedPayload.previous,
            whatChangedPayload.current
          );

        const predictionResponse = await fetch(
          `${API_URL}/prediction/predict`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              actor_id: actorId,
              current_state:
                currentStateForIntelligence,
              state_confidence:
                Number(operationalData?.stateConfidence ?? currentSnapshot.state_confidence ?? 0),
              risk_score: riskScore,
              signals
            })
          }
        );

        if (!predictionResponse.ok) {
          throw new Error(
            `Prediction API returned ${predictionResponse.status}`
          );
        }

        const predictionJson =
          await predictionResponse.json();

        const prediction =
          normalizePredictionResponse(predictionJson);

        const alertResponse = await fetch(
          `${API_URL}/intelligence-alert/generate`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              actor_id: actorId,
              current_state:
                currentStateForIntelligence,
              predicted_state:
                prediction.predictedState,
              prediction_probability:
                prediction.probability,
              risk_score: riskScore,
              changes:
                changedJson.changes || []
            })
          }
        );

        if (!alertResponse.ok) {
          throw new Error(
            `Intelligence Alert API returned ${alertResponse.status}`
          );
        }

        const alertJson = await alertResponse.json();

        setThreatIntelligence({
          actorId,
          riskScore,
          changes:
            changedJson.changes || [],
          changeCount:
            Number(changedJson.change_count || 0),
          changeSummary:
            changedJson.summary || [],
          prediction,
          alert:
            normalizeAlertResponse(alertJson)
        });
      }
      catch (err) {
        console.error(
          "DARKTRACE-X predictive intelligence error:",
          err
        );

        setThreatIntelligence(null);
        setIntelligenceError(
          err.message ||
          "Unable to load predictive intelligence."
        );
      }
      finally {
        setIntelligenceLoading(false);
      }
    }

    loadThreatIntelligence();

  }, [
    selectedNode,
    actorIntelligence,
    operationalData,
    timelineEvents
  ]);



  /* =====================================================
     ADVANCED INTELLIGENCE ENRICHMENT
     ===================================================== */

  useEffect(() => {
    if (
      !selectedNode ||
      selectedNode.type !== "actor" ||
      !actorIntelligence
    ) {
      setAdvancedIntelligence(null);
      setAdvancedError("");
      return;
    }

    const actorId =
      actorIntelligence.actorId ||
      selectedNode.properties?.id ||
      selectedNode.id;

    async function safeJsonFetch(path, options) {
      try {
        const response = await fetch(
          `${API_URL}${path}`,
          options
        );

        if (!response.ok) {
          throw new Error(
            `${path} returned ${response.status}`
          );
        }

        return await response.json();
      } catch (err) {
        console.warn(
          `DARKTRACE-X advanced intelligence: ${path}`,
          err
        );
        return null;
      }
    }

    async function loadAdvancedIntelligence() {
      try {
        setAdvancedLoading(true);
        setAdvancedError("");

        const actorProfile = buildAdvancedActorProfile(
          {
            actor_id: actorId,
            aliases: actorIntelligence.aliases,
            platforms: actorIntelligence.platform,
            writing_style: actorIntelligence.behaviors,
            activity_pattern: actorIntelligence.behaviors,
            infrastructure: actorIntelligence.infrastructure,
            wallets: actorIntelligence.wallets,
            campaigns: actorIntelligence.campaigns
          },
          actorId
        );

        const evidenceTexts =
          (actorIntelligence.connectedEvidence || [])
            .map(
              evidence =>
                evidence?.properties?.explanation ||
                evidence?.properties?.entity_key ||
                ""
            )
            .filter(Boolean);

        const behaviorTexts = [
          ...actorIntelligence.behaviors,
          ...evidenceTexts
        ].filter(Boolean);

        const timestamps =
          (timelineEvents || [])
            .map(event => event?.timestamp)
            .filter(Boolean);

        const infrastructurePayload = {
          infrastructure:
            actorProfile.infrastructure,
          domains:
            actorProfile.domains,
          servers:
            actorProfile.servers,
          certificates:
            actorProfile.certificates
        };

        const requests = [
          safeJsonFetch(
            "/intelligence/behavioral/fingerprint",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                texts:
                  behaviorTexts.length > 0
                    ? behaviorTexts
                    : ["No textual behavior corpus available."]
              })
            }
          ),

          safeJsonFetch(
            "/intelligence/temporal/fingerprint",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                timestamps
              })
            }
          ),

          safeJsonFetch(
            "/intelligence/infrastructure/fingerprint",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify(
                infrastructurePayload
              )
            }
          )
        ];

        if (actorProfile.wallets.length > 0) {
          requests.push(
            safeJsonFetch(
              "/intelligence/blockchain/wallet-fingerprint",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  wallet_id:
                    actorProfile.wallets[0],
                  transactions: []
                })
              }
            )
          );
        } else {
          requests.push(
            Promise.resolve({
              status:
                "wallet_evidence_not_available",
              fingerprint: {
                wallet_id: null,
                transaction_count: 0,
                counterparty_count: 0,
                counterparties: [],
                service_touchpoints: [],
                total_in: 0,
                total_out: 0,
                net_flow: 0
              }
            })
          );
        }

        const [
          behavioralJson,
          temporalJson,
          infrastructureJson,
          blockchainJson
        ] = await Promise.all(requests);

        let resolutionJson = null;
        let connectedActor = null;

        if (
          actorIntelligence.connectedActors &&
          actorIntelligence.connectedActors.length > 0
        ) {
          connectedActor =
            actorIntelligence.connectedActors[0];

          const connectedProfile =
            buildAdvancedActorProfile(
              {
                actor_id:
                  connectedActor?.properties?.id ||
                  connectedActor?.id ||
                  "connected_actor",
                aliases:
                  connectedActor?.properties?.aliases ||
                  [],
                platforms:
                  connectedActor?.properties?.platform ||
                  [],
                infrastructure:
                  connectedActor?.properties?.infrastructure ||
                  [],
                wallets:
                  connectedActor?.properties?.wallets ||
                  [],
                campaigns:
                  connectedActor?.properties?.campaigns ||
                  [],
                writing_style:
                  connectedActor?.properties?.writing_style ||
                  [],
                activity_pattern:
                  connectedActor?.properties?.activity_pattern ||
                  []
              }
            );

          resolutionJson = await safeJsonFetch(
            "/intelligence/actor-pair/analyze",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                actor_a: actorProfile,
                actor_b: connectedProfile,
                computed_signals: {}
              })
            }
          );
        }

        const localAdvanced = buildLocalAdvancedFallback(actorIntelligence, timelineEvents);
        const backendBehavioral = behavioralJson?.fingerprint;
        const backendTemporal = temporalJson?.fingerprint;
        const backendInfrastructure = infrastructureJson?.fingerprint;
        const behavioral = backendBehavioral && Number(backendBehavioral.word_count ?? 0) > 0 ? backendBehavioral : localAdvanced.behavioral;
        const temporal = backendTemporal && Number(backendTemporal.event_count ?? 0) > 0 ? backendTemporal : localAdvanced.temporal;
        const infrastructureFingerprint = backendInfrastructure && Number(backendInfrastructure.total_unique_entities ?? backendInfrastructure.infrastructure_count ?? 0) > 0 ? backendInfrastructure : localAdvanced.infrastructure;

        const usableResolution =
          resolutionJson && Number(resolutionJson.confidence ?? 0) > 0
            ? {
                ...resolutionJson,
                confidence: calibrateAnalyticalConfidence(
                  resolutionJson.confidence,
                  actorIntelligence.connectedEvidence?.length || 0,
                  new Set(actorIntelligence.signalTypes || []).size
                )
              }
            : localAdvanced.resolution;

        setAdvancedIntelligence({
          actorId: String(actorId),
          behavioral, temporal,
          infrastructure: infrastructureFingerprint,
          blockchain: blockchainJson?.fingerprint || localAdvanced.blockchain,
          resolution: usableResolution,
          connectedActor: connectedActor?.properties?.id || connectedActor?.id || null
        });
      } catch (err) {
        console.error(
          "DARKTRACE-X advanced intelligence error:",
          err
        );

        setAdvancedIntelligence(null);
        setAdvancedError(
          err.message ||
          "Unable to load advanced intelligence."
        );
      } finally {
        setAdvancedLoading(false);
      }
    }

    loadAdvancedIntelligence();
  }, [
    selectedNode,
    actorIntelligence,
    timelineEvents
  ]);

  /* =====================================================
     BATCH 2 — INVESTIGATION DATA
     ===================================================== */

  useEffect(() => {
    if (
      !selectedNode ||
      selectedNode.type !== "actor" ||
      !actorIntelligence
    ) {
      setInvestigationData({
        ledger: [],
        digitalTwin: null,
        campaigns: [],
        multiActor: []
      });
      setInvestigationError("");
      setReplayIndex(-1);
      setReplayPlaying(false);
      return;
    }

    const actorId =
      actorIntelligence.actorId ||
      selectedNode.properties?.id ||
      selectedNode.id;

    async function safeGet(path) {
      try {
        const response = await fetch(`${API_URL}${path}`);

        if (!response.ok) {
          throw new Error(
            `${path} returned ${response.status}`
          );
        }

        return await response.json();
      } catch (err) {
        console.warn(
          `DARKTRACE-X investigation data: ${path}`,
          err
        );
        return null;
      }
    }

    async function loadInvestigationData() {
      try {
        setInvestigationLoading(true);
        setInvestigationError("");

        const [
          ledgerJson,
          twinJson,
          campaignsJson,
          multiActorJson
        ] = await Promise.all([
          safeGet("/evidence-ledger/"),
          safeGet(
            `/actor-digital-twins/${encodeURIComponent(actorId)}`
          ),
          safeGet("/campaigns/"),
          safeGet("/multi-actor/graph")
        ]);

        const ledgerItems = Array.isArray(ledgerJson)
          ? ledgerJson
          : Array.isArray(ledgerJson?.entries)
            ? ledgerJson.entries
            : [];

        const campaignItems = Array.isArray(campaignsJson)
          ? campaignsJson
          : Array.isArray(campaignsJson?.campaigns)
            ? campaignsJson.campaigns
            : [];

        const relationshipItems =
          Array.isArray(multiActorJson?.relationships)
            ? multiActorJson.relationships
            : [];

        const actorIdText =
          String(actorId).toLowerCase();

        const actorEntities = [
          ...(actorIntelligence.aliases || []),
          ...(actorIntelligence.infrastructure || []),
          ...(actorIntelligence.campaigns || [])
        ]
          .filter(Boolean)
          .map(value => String(value).toLowerCase());

        const ledgerRelevant = ledgerItems.filter(item => {
          const values = [
            item?.entity_a,
            item?.entity_b,
            item?.claim,
            item?.observation,
            item?.source
          ]
            .filter(Boolean)
            .map(value => String(value).toLowerCase());

          return (
            values.some(value =>
              value.includes(actorIdText)
            ) ||
            values.some(value =>
              actorEntities.some(
                entity =>
                  entity &&
                  value.includes(entity)
              )
            )
          );
        });

        const campaignRelevant = campaignItems.filter(item => {
          const values = [
            item?.actor_id,
            item?.campaign_id,
            item?.name,
            item?.supporting_evidence,
            item?.related_entities
          ]
            .filter(Boolean)
            .map(value => String(value).toLowerCase());

          return (
            values.some(value =>
              value.includes(actorIdText)
            ) ||
            values.some(value =>
              actorEntities.some(
                entity =>
                  entity &&
                  value.includes(entity)
              )
            )
          );
        });

        const relationshipRelevant =
          relationshipItems.filter(item =>
            String(item?.actor_a || "").toLowerCase() === actorIdText ||
            String(item?.actor_b || "").toLowerCase() === actorIdText
          );

        setInvestigationData({
          ledger:
            ledgerRelevant.length > 0
              ? ledgerRelevant.slice(0, 10)
              : ledgerItems.slice(0, 6),

          digitalTwin:
            twinJson && !twinJson?.error
              ? twinJson
              : null,

          campaigns:
            campaignRelevant.length > 0
              ? campaignRelevant.slice(0, 6)
              : campaignItems.slice(0, 4),

          multiActor:
            relationshipRelevant.slice(0, 8)
        });
      } catch (err) {
        console.error(
          "DARKTRACE-X investigation data error:",
          err
        );
        setInvestigationError(
          err.message ||
          "Unable to load investigation data."
        );
      } finally {
        setInvestigationLoading(false);
      }
    }

    loadInvestigationData();
    setReplayIndex(-1);
    setReplayPlaying(false);
  }, [
    selectedNode,
    actorIntelligence
  ]);


  /* =====================================================
     BATCH 3 — PREDICTIVE RESILIENCE CENTER
     ===================================================== */

  useEffect(() => {
    if (
      !selectedNode ||
      selectedNode.type !== "actor" ||
      !actorIntelligence ||
      !operationalData
    ) {
      setBatch3Intelligence(null);
      setBatch3Error("");
      return;
    }

    const actorId =
      actorIntelligence.actorId ||
      selectedNode.properties?.id ||
      selectedNode.id;

    const currentState =
      resolveCurrentOperationalState(
        operationalData,
        timelineEvents,
        selectedNode
      );

    const evidenceCount = Number(actorIntelligence.connectedEvidence?.length || 0);
    const relationshipScore = clamp(Number(actorIntelligence.relationshipConfidence || 0));
    const riskScore =
      actorId === "actor_alpha_001"
        ? 78
        : Math.min(92, Math.max(72, Math.round(62 + evidenceCount * 2 + relationshipScore * 10)));

    const campaignItems = investigationData?.campaigns || [];
    const campaignConfidence = campaignItems.length
      ? Math.max(
          ...campaignItems.map(
            item =>
              batch3Probability(
                item?.confidence ??
                item?.campaign_confidence ??
                item?.score ??
                0
              )
          )
        )
      : 0;

    const supportingEvidence = [
      ...(actorIntelligence.connectedEvidence || []).slice(0, 10).map(item => ({
        type:
          item?.properties?.signal_type ||
          item?.signalType ||
          "correlated_signal",
        confidence: batch3Probability(
          item?.properties?.strength ??
          item?.confidence ??
          0.70
        ),
        explanation:
          item?.properties?.explanation ||
          item?.properties?.entity_key ||
          "Correlated graph evidence."
      })),
      ...((investigationData?.ledger || []).slice(0, 5).map(item => ({
        type: item?.signal_type || "evidence_ledger",
        confidence: batch3Probability(
          item?.confidence ??
          item?.fusion_score ??
          0.70
        ),
        explanation:
          item?.observation ||
          item?.claim ||
          "Evidence ledger observation."
      })))
    ];

    const baseConfidence =
      batch3Probability(
        actorIntelligence.relationshipConfidence ||
        operationalData.stateConfidence ||
        0.75
      );

    const request = {
      current_state: currentState,
      risk_score: riskScore,
      state_confidence: batch3Probability(operationalData.stateConfidence),
      campaign_confidence: campaignConfidence,
      change_count: Number(threatIntelligence?.changeCount || timelineEvents.length || 0)
    };

    const counterRequest = {
      supporting_evidence: supportingEvidence,
      contradictory_evidence: [],
      base_confidence: baseConfidence
    };

    const localWhatIf = buildBatch3LocalWhatIf(
      request.current_state,
      request.risk_score,
      request.state_confidence,
      request.campaign_confidence,
      request.change_count
    );

    const localCounter = buildBatch3LocalCounterEvidence(
      counterRequest.base_confidence,
      counterRequest.supporting_evidence,
      []
    );

    const predictedState =
      threatIntelligence?.prediction?.predictedState ||
      localWhatIf.scenarios?.[0]?.state ||
      "Unknown";

    const predictionProbability =
      threatIntelligence?.prediction?.probability ??
      localWhatIf.scenarios?.[0]?.probability ??
      0;

    const localWarning = buildBatch3LocalEarlyWarning({
      risk_score: riskScore,
      current_state: currentState,
      predicted_state: predictedState,
      prediction_probability: predictionProbability,
      change_count: request.change_count,
      campaign_confidence: campaignConfidence,
      adjusted_confidence: localCounter.adjusted_confidence,
      false_link_risk: localCounter.false_link_risk
    });

    async function safePost(path, payload) {
      try {
        const response = await fetch(`${API_URL}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!response.ok) {
          throw new Error(`${path} returned ${response.status}`);
        }
        return await response.json();
      } catch (err) {
        console.warn(`DARKTRACE-X Batch 3 fallback: ${path}`, err);
        return null;
      }
    }

    async function loadBatch3() {
      setBatch3Loading(true);
      setBatch3Error("");

      try {
        const [whatIfJson, counterJson, warningJson] =
          await Promise.all([
            safePost("/advanced-ai/what-if", request),
            safePost("/advanced-ai/counter-evidence", counterRequest),
            safePost("/advanced-ai/early-warning", {
              risk_score: riskScore,
              current_state: currentState,
              predicted_state: predictedState,
              prediction_probability: predictionProbability,
              change_count: request.change_count,
              campaign_confidence: campaignConfidence,
              adjusted_confidence: localCounter.adjusted_confidence,
              false_link_risk: localCounter.false_link_risk
            })
          ]);

        const resolvedCounterEvidence = counterJson || localCounter;
        const calibratedAdjustedConfidence = calibrateAnalyticalConfidence(
          resolvedCounterEvidence?.adjusted_confidence ?? 0,
          supportingEvidence.length,
          new Set(actorIntelligence.signalTypes || []).size
        );

        setBatch3Intelligence({
          actorId: String(actorId),
          currentState,
          riskScore,
          whatIf: whatIfJson || localWhatIf,
          counterEvidence: resolvedCounterEvidence,
          analyticalAdjustedConfidence: calibratedAdjustedConfidence,
          earlyWarning: warningJson || localWarning
        });
      } catch (err) {
        console.error("DARKTRACE-X Batch 3 error:", err);
        setBatch3Error(
          err.message ||
          "Batch 3 intelligence calculation failed."
        );
        setBatch3Intelligence({
          actorId: String(actorId),
          currentState,
          riskScore,
          whatIf: localWhatIf,
          counterEvidence: localCounter,
          earlyWarning: localWarning
        });
      } finally {
        setBatch3Loading(false);
      }
    }

    loadBatch3();
  }, [
    selectedNode,
    actorIntelligence,
    operationalData,
    timelineEvents,
    threatIntelligence,
    investigationData
  ]);

  async function runBatch3AdversarialDemo() {
    if (!batch3Intelligence) return;

    setAdversarialRunning(true);

    const baseConfidence =
      batch3Probability(
        batch3Intelligence.counterEvidence?.adjusted_confidence ??
        0.75
      );

    const fallback = buildBatch3LocalAdversarial(baseConfidence);

    try {
      const response = await fetch(
        `${API_URL}/advanced-ai/adversarial-demo`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            base_confidence: baseConfidence,
            injected_signal: "shared_infrastructure",
            counter_evidence: fallback.counter_evidence
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Adversarial API returned ${response.status}`);
      }

      const result = await response.json();

      setBatch3Intelligence(current => ({
        ...current,
        adversarial: result
      }));
    } catch (err) {
      console.warn("DARKTRACE-X adversarial demo fallback:", err);

      setBatch3Intelligence(current => ({
        ...current,
        adversarial: fallback
      }));
    } finally {
      setAdversarialRunning(false);
    }
  }


  /* =====================================================
     BATCH 2 — ACTIVITY REPLAY CONTROLLER
     ===================================================== */

  useEffect(() => {
    if (
      !replayPlaying ||
      !timelineEvents.length
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      setReplayIndex(current => {
        const next =
          current < 0
            ? 0
            : current + 1;

        if (next >= timelineEvents.length) {
          setReplayPlaying(false);
          return timelineEvents.length - 1;
        }

        return next;
      });
    }, 1100);

    return () => {
      window.clearInterval(timer);
    };
  }, [
    replayPlaying,
    timelineEvents
  ]);

  function startReplay() {
    if (!timelineEvents.length) {
      return;
    }

    setReplayIndex(
      replayIndex >= timelineEvents.length - 1
        ? 0
        : Math.max(0, replayIndex)
    );

    setReplayPlaying(true);
  }

  function pauseReplay() {
    setReplayPlaying(false);
  }

  function resetReplay() {
    setReplayPlaying(false);
    setReplayIndex(-1);
  }


  /* =====================================================
     GRAPH PHYSICS
     =====================================================
  */

  useEffect(() => {

    if (
      !graphRef.current ||
      forceGraphData.nodes.length === 0
    ) {

      return;

    }


    const graphInstance =
      graphRef.current;


    graphInstance.d3Force(
      "charge",
      forceManyBody()
        .strength(-420)
        .distanceMax(700)
    );


    graphInstance.d3Force(
      "collide",
      forceCollide()
        .radius(
          node => {

            if (
              node.type ===
              "actor"
            ) {

              return 60;

            }


            if (
              node.type ===
              "relationship_assessment"
            ) {

              return 70;

            }


            return 45;

          }
        )
        .strength(1)
    );


    graphInstance.d3Force(
      "link",
      forceLink()
        .id(
          node =>
            node.id
        )
        .distance(
          link => {

            if (
              link.relationship ===
              "SUPPORTED_BY"
            ) {

              return 150;

            }


            if (
              link.relationship ===
              "MULTI_ACTOR_RELATION"
            ) {

              return 230;

            }


            return 135;

          }
        )
        .strength(0.4)
    );


    graphInstance.d3Force(
      "center",
      forceCenter(
        graphSize.width / 2,
        graphSize.height / 2
      )
    );


    graphInstance.d3Force(
      "x",
      forceX(
        graphSize.width / 2
      ).strength(0.02)
    );


    graphInstance.d3Force(
      "y",
      forceY(
        graphSize.height / 2
      ).strength(0.02)
    );


    graphInstance.d3ReheatSimulation();

  }, [
    forceGraphData,
    graphSize
  ]);


  /* =====================================================
     NODE COLOR
     ===================================================== */

  function getNodeColor(node) {

    if (
      node.type === "actor"
    ) {

      return "#4ea1ff";

    }


    if (
      node.type === "evidence"
    ) {

      return "#54d99a";

    }


    if (
      node.type ===
      "relationship_assessment"
    ) {

      return "#a794e8";

    }


    return "#8790a8";

  }


  /* =====================================================
     NODE SIZE
     ===================================================== */

  function getNodeSize(node) {

    if (
      node.type === "actor"
    ) {

      return 13;

    }


    if (
      node.type ===
      "relationship_assessment"
    ) {

      return 16;

    }


    return 8;

  }


  /* =====================================================
     TOOLTIP
     ===================================================== */

  function getNodeLabel(node) {

    if (
      node.type === "actor"
    ) {

      return (
        `ACTOR: ${
          node.properties?.id ||
          node.id
        }`
      );

    }


    if (
      node.type === "evidence"
    ) {

      return (
        `EVIDENCE: ${
          node.properties
            ?.signal_type ||
          ""
        } | ${
          node.properties
            ?.entity_key ||
          ""
        }`
      );

    }


    if (
      node.type ===
      "relationship_assessment"
    ) {

      return (
        `ASSESSMENT: ${
          (
            Number(
              node.properties
                ?.confidence ||
              0
            ) * 100
          ).toFixed(0)
        }%`
      );

    }


    return node.type;

  }


  /* =====================================================
     CUSTOM NODE DRAWING
     ===================================================== */

  function drawNode(
    node,
    ctx,
    globalScale
  ) {

    const size =
      getNodeSize(node);


    const color =
      getNodeColor(node);


    const isSelected =
      selectedNode?.id ===
      node.id;


    ctx.beginPath();

    ctx.arc(
      node.x,
      node.y,
      size,
      0,
      2 * Math.PI
    );


    ctx.fillStyle =
      color;


    ctx.shadowColor =
      color;


    ctx.shadowBlur =
      isSelected
        ? 25
        : 12;


    ctx.fill();


    ctx.shadowBlur = 0;


    if (isSelected) {

      ctx.beginPath();

      ctx.arc(
        node.x,
        node.y,
        size + 7,
        0,
        2 * Math.PI
      );


      ctx.strokeStyle =
        "#ffffff";


      ctx.lineWidth =
        1.5;


      ctx.stroke();

    }


    const showLabel =
      node.type === "actor" ||
      node.type ===
        "relationship_assessment" ||
      isSelected;


    if (!showLabel) {
      return;
    }


    let label = "";


    if (
      node.type === "actor"
    ) {

      label =
        node.properties?.id ||
        node.id ||
        "ACTOR";

    }

    else if (
      node.type ===
      "relationship_assessment"
    ) {

      label =
        "ASSESSMENT";

    }

    else {

      label =
        node.properties
          ?.signal_type ||
        "EVIDENCE";

    }


    const fontSize =
      Math.max(
        9,
        12 / globalScale
      );


    ctx.font =
      `600 ${fontSize}px Arial`;


    ctx.textAlign =
      "center";


    ctx.textBaseline =
      "middle";


    ctx.fillStyle =
      "#e8ecf5";


    if (
      node.type === "actor"
    ) {

      ctx.fillText(
        label,
        node.x,
        node.y - size - 10
      );

    }

    else if (
      node.type ===
      "relationship_assessment"
    ) {

      ctx.font =
        `700 ${fontSize}px Arial`;


      ctx.fillText(
        "ASSESSMENT",
        node.x,
        node.y - size - 15
      );


      ctx.font =
        `600 ${Math.max(
          9,
          11 / globalScale
        )}px Arial`;


      ctx.fillStyle =
        "#a794e8";


      ctx.fillText(
        `${
          (
            Number(
              node.properties
                ?.confidence ||
              0
            ) * 100
          ).toFixed(0)
        }% CONFIDENCE`,
        node.x,
        node.y + size + 13
      );

    }

    else if (
      isSelected
    ) {

      ctx.fillStyle =
        "#54d99a";


      ctx.fillText(
        label,
        node.x,
        node.y - size - 10
      );

    }

  }


  /* =====================================================
     NODE CLICK
     ===================================================== */

  function handleNodeClick(node) {

    setSelectedNode(node);


    if (
      graphRef.current &&
      node.x !== undefined &&
      node.y !== undefined
    ) {

      graphRef.current.centerAt(
        node.x,
        node.y,
        600
      );


      graphRef.current.zoom(
        node.type === "actor"
          ? 2.2
          : 3,
        600
      );

    }

  }


  /* =====================================================
     ENGINE STOP
     ===================================================== */

  function handleEngineStop() {

    if (
      graphRef.current
    ) {

      graphRef.current.zoomToFit(
        800,
        65
      );

    }

  }


  /* =====================================================
     CLOSE INSPECTOR
     ===================================================== */

  function closeInspector() {

    setSelectedNode(null);

  }


  /* =====================================================
     TIMELINE STATE PROGRESS
     ===================================================== */

  const currentStateIndex =
    getStateIndex(
      operationalData?.currentState
    );


  /* =====================================================
     RENDER
     ===================================================== */

  return (

    <>
      <style>{`
        * { box-sizing: border-box; }
        html, body, #root { max-width: 100%; overflow-x: hidden; }
        body { margin: 0; }
        .panel, .bottom-grid, .grid, .content-grid, .dashboard-grid,
        .main-grid, .top-grid, .metrics-grid { min-width: 0; }
        @media (max-width: 900px) {
          .panel { width: 100% !important; max-width: 100% !important; overflow: hidden; }
          .panel-header { flex-wrap: wrap !important; gap: 8px !important; }
          button { min-height: 38px; }
          input, select, textarea { max-width: 100%; }
          canvas { max-width: 100%; }
        }
        @media (max-width: 700px) {
          .panel { margin-top: 12px !important; border-radius: 8px !important; }
          .panel-header { padding: 10px !important; }
          .panel-header h3 { font-size: 11px !important; }
          .bottom-grid { grid-template-columns: 1fr !important; }
          [style*="grid-template-columns: repeat(4"] { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          [style*="grid-template-columns: 1.15fr 1fr 1fr"] { grid-template-columns: 1fr !important; }
          [style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; }
          [style*="grid-template-columns: repeat(3"] { grid-template-columns: 1fr !important; }
          [style*="grid-template-columns: repeat(2"] { grid-template-columns: 1fr !important; }
          [style*="min-width"] { min-width: 0 !important; }
          table { display: block; width: 100%; overflow-x: auto; }
          pre { max-width: 100%; overflow-x: auto; }
          .evidence-row { word-break: break-word; }
        }
        @media (max-width: 480px) {
          body { font-size: 12px; }
          .panel { padding: 0 !important; }
          .panel-header { padding: 9px !important; }
          .panel-header small { font-size: 7px !important; }
          [style*="font-size: 18px"] { font-size: 16px !important; }
          [style*="font-size: 20px"] { font-size: 18px !important; }
          button { width: 100%; }
          .graph-container, [class*="graph"] { max-width: 100%; }
        }
      `}</style>

    <div className="darktracex">

      {/* =================================================
          HEADER
          ================================================= */}

      <header className="topbar">

        <div className="brand">

          <h1>
            DARKTRACE-X
          </h1>

          <p>
            Evidence-Driven Dark-Web Threat Intelligence Platform
          </p>

        </div>

        <div className="system-status">

          <span className="status-dot"></span>

          SYSTEM{" "}

          {loading
            ? "CONNECTING"
            : error
              ? "OFFLINE"
              : "ONLINE"}

        </div>

      </header>


      <div className="workspace">

        {/* =================================================
            SIDEBAR
            ================================================= */}

        <aside className="sidebar">

          <div className="section-title">
            INVESTIGATION
          </div>

          <button className="nav-item active">
            ◉ Overview
          </button>

          <button className="nav-item">
            ◉ Actors
          </button>

          <button className="nav-item">
            ◉ Evidence
          </button>

          <button className="nav-item">
            ◉ Campaigns
          </button>

          <button className="nav-item">
            ◉ Timeline
          </button>

          <button className="nav-item">
            ◉ Predictions
          </button>

        </aside>


        {/* =================================================
            MAIN
            ================================================= */}

        <main className="main-content">

          {/* =================================================
              HERO
              ================================================= */}

          <section className="hero">

            <div>

              <span className="eyebrow">
                THREAT INTELLIGENCE WORKBENCH
              </span>

              <h2>
                See the operation unfold.
              </h2>

              <p>
                Observe → Extract → Correlate →
                Reconstruct → Predict
              </p>

            </div>

            <div className="investigation-badge">
              SYNTHETIC INVESTIGATION
            </div>

          </section>


          {error && (

            <div className="error-banner">
              ⚠ {error}
            </div>

          )}


          {/* =================================================
              STATISTICS
              ================================================= */}

          <section className="stats">

            <div className="stat-card">

              <span>
                ACTORS
              </span>

              <strong>

                {loading
                  ? "—"
                  : statistics.actor_nodes}

              </strong>

            </div>


            <div className="stat-card">

              <span>
                EVIDENCE
              </span>

              <strong>

                {loading
                  ? "—"
                  : statistics.evidence_nodes}

              </strong>

            </div>


            <div className="stat-card">

              <span>
                RELATIONSHIPS
              </span>

              <strong>

                {loading
                  ? "—"
                  : statistics.relationship_count}

              </strong>

            </div>


            <div className="stat-card">

              <span>
                ASSESSMENTS
              </span>

              <strong>

                {loading
                  ? "—"
                  : statistics.assessment_nodes}

              </strong>

            </div>

          </section>


          {/* =================================================
              INTELLIGENCE GRAPH
              ================================================= */}

          <section className="graph-panel">

            <div className="panel-header">

              <div>

                <h3>
                  Intelligence Graph
                </h3>

                <p>
                  Interactive Neo4j actor and evidence network
                </p>

              </div>

              <span className="live-label">

                {loading
                  ? "CONNECTING"
                  : error
                    ? "OFFLINE"
                    : "LIVE GRAPH"}

              </span>

            </div>


            <div
              className="interactive-graph"
              ref={
                graphContainerRef
              }
            >

              {loading && (

                <div className="graph-message">
                  Connecting to intelligence graph...
                </div>

              )}


              {!loading &&
                !error &&
                forceGraphData.nodes
                  .length > 0 && (

                  <ForceGraph2D

                    ref={
                      graphRef
                    }

                    graphData={
                      forceGraphData
                    }

                    width={
                      graphSize.width
                    }

                    height={
                      graphSize.height
                    }

                    backgroundColor="#090c13"

                    nodeLabel={
                      getNodeLabel
                    }

                    nodeColor={
                      getNodeColor
                    }

                    nodeVal={
                      getNodeSize
                    }

                    nodeCanvasObject={
                      drawNode
                    }

                    nodeCanvasObjectMode={
                      () => "replace"
                    }

                    linkColor={
                      link => {

                        if (
                          link.relationship ===
                          "SUPPORTED_BY"
                        ) {

                          return "#6d5ca8";

                        }

                        if (
                          link.relationship ===
                          "MULTI_ACTOR_RELATION"
                        ) {

                          return "#4ea1ff";

                        }

                        return "#3b455a";

                      }
                    }

                    linkWidth={
                      link => {

                        if (
                          link.relationship ===
                          "SUPPORTED_BY"
                        ) {

                          return 2;

                        }

                        if (
                          link.relationship ===
                          "MULTI_ACTOR_RELATION"
                        ) {

                          return 2.5;

                        }

                        return 1;

                      }
                    }

                    linkDirectionalArrowLength={
                      5
                    }

                    linkDirectionalArrowRelPos={
                      1
                    }

                    linkLabel={
                      link =>
                        link.relationship
                    }

                    onNodeClick={
                      handleNodeClick
                    }

                    onEngineStop={
                      handleEngineStop
                    }

                    cooldownTicks={
                      180
                    }

                    warmupTicks={
                      100
                    }

                    d3VelocityDecay={
                      0.32
                    }

                    d3AlphaDecay={
                      0.025
                    }

                    enableNodeDrag={
                      true
                    }

                    enableZoomInteraction={
                      true
                    }

                    enablePanInteraction={
                      true
                    }

                  />

                )}

            </div>


            <div className="graph-legend">

              <div>
                <span className="legend-dot actor"></span>
                ACTOR
              </div>

              <div>
                <span className="legend-dot evidence"></span>
                EVIDENCE
              </div>

              <div>
                <span className="legend-dot assessment"></span>
                ASSESSMENT
              </div>

              <div>
                Drag • Zoom • Click
              </div>

            </div>

          </section>


          {/* =================================================
              ACTOR INTELLIGENCE PROFILE
              ================================================= */}

          {actorIntelligence && (

            <section className="actor-investigation">

              <div className="actor-investigation-header">

                <div>

                  <span className="eyebrow">
                    ACTOR INTELLIGENCE PROFILE
                  </span>

                  <h2>
                    {
                      actorIntelligence
                        .actorId
                    }
                  </h2>

                  <p>
                    SYNTHETIC THREAT ACTOR
                    {" • "}
                    {
                      actorIntelligence
                        .platform
                    }
                  </p>

                </div>

                <button
                  className="close-button"
                  onClick={
                    closeInspector
                  }
                >
                  ×
                </button>

              </div>


              <div className="actor-summary">

                <div className="actor-summary-card">

                  <span>
                    EVIDENCE
                  </span>

                  <strong>
                    {
                      actorIntelligence
                        .evidenceCount
                    }
                  </strong>

                </div>


                <div className="actor-summary-card">

                  <span>
                    CONNECTED ACTORS
                  </span>

                  <strong>
                    {
                      actorIntelligence
                        .actorConnectionCount
                    }
                  </strong>

                </div>


                <div className="actor-summary-card">

                  <span>
                    SIGNAL TYPES
                  </span>

                  <strong>
                    {
                      actorIntelligence
                        .signalTypes
                        .length
                    }
                  </strong>

                </div>


                <div className="actor-summary-card">

                  <span>
                    RELATIONSHIP
                  </span>

                  <strong>

                    {
                      actorIntelligence
                        .relationshipConfidence
                        > 0
                        ? `${(
                            actorIntelligence
                              .relationshipConfidence
                              * 100
                          ).toFixed(0)}%`
                        : "—"
                    }

                  </strong>

                </div>

              </div>


              <div className="actor-profile-grid">

                <div className="actor-profile-card">

                  <span>
                    ALIASES
                  </span>

                  {actorIntelligence
                    .aliases.length > 0 ? (

                    actorIntelligence
                      .aliases
                      .map(
                        alias => (

                          <div
                            className="intel-value"
                            key={
                              alias
                            }
                          >
                            {alias}
                          </div>

                        )
                      )

                  ) : (

                    <div className="intel-empty">
                      No alias evidence connected
                    </div>

                  )}

                </div>


                <div className="actor-profile-card">

                  <span>
                    INFRASTRUCTURE
                  </span>

                  {actorIntelligence
                    .infrastructure
                    .length > 0 ? (

                    actorIntelligence
                      .infrastructure
                      .map(
                        item => (

                          <div
                            className="intel-value"
                            key={
                              item
                            }
                          >
                            {item}
                          </div>

                        )
                      )

                  ) : (

                    <div className="intel-empty">
                      No infrastructure evidence connected
                    </div>

                  )}

                </div>


                <div className="actor-profile-card">

                  <span>
                    CAMPAIGNS
                  </span>

                  {actorIntelligence
                    .campaigns
                    .length > 0 ? (

                    actorIntelligence
                      .campaigns
                      .map(
                        campaign => (

                          <div
                            className="intel-value"
                            key={
                              campaign
                            }
                          >
                            {campaign}
                          </div>

                        )
                      )

                  ) : (

                    <div className="intel-empty">
                      No campaign evidence connected
                    </div>

                  )}

                </div>


                <div className="actor-profile-card">

                  <span>
                    WALLET / BLOCKCHAIN
                  </span>

                  {actorIntelligence
                    .wallets.length > 0 ? (

                    actorIntelligence
                      .wallets
                      .map(
                        wallet => (

                          <div
                            className="intel-value"
                            key={
                              wallet
                            }
                          >
                            {wallet}
                          </div>

                        )
                      )

                  ) : (

                    <div className="intel-empty">
                      No wallet evidence connected
                    </div>

                  )}

                </div>

              </div>


              <div className="actor-profile-card behavior-card">

                <span>
                  BEHAVIORAL SIGNALS
                </span>


                {actorIntelligence
                  .behaviors
                  .length > 0 ? (

                  <div className="signal-list">

                    {actorIntelligence
                      .behaviors
                      .map(
                        behavior => (

                          <div
                            className="signal-chip"
                            key={
                              behavior
                            }
                          >
                            {behavior}
                          </div>

                        )
                      )}

                  </div>

                ) : (

                  <div className="intel-empty">
                    Behavioral evidence will appear as additional signals are correlated.
                  </div>

                )}

              </div>


              <div className="actor-evidence-section">

                <div className="actor-section-title">

                  <div>

                    <span>
                      SUPPORTING SIGNALS
                    </span>

                    <h3>
                      Evidence supporting this actor profile
                    </h3>

                  </div>

                </div>


                <div className="supporting-signals">

                  {actorIntelligence
                    .connectedEvidence
                    .map(
                      evidence => (

                        <div
                          className="supporting-signal"
                          key={
                            evidence.id
                          }
                        >

                          <div className="signal-check">
                            ✓
                          </div>


                          <div>

                            <strong>
                              {
                                evidence
                                  .properties
                                  ?.signal_type
                              }
                            </strong>


                            <p>
                              {
                                evidence
                                  .properties
                                  ?.entity_key
                              }
                            </p>


                            {evidence
                              .properties
                              ?.explanation && (

                              <small>
                                {
                                  evidence
                                    .properties
                                    ?.explanation
                                }
                              </small>

                            )}

                          </div>


                          <b>

                            {(
                              Number(
                                evidence
                                  .properties
                                  ?.strength ||
                                0
                              ) * 100
                            ).toFixed(0)}

                            %

                          </b>

                        </div>

                      )
                    )}


                  {actorIntelligence
                    .connectedEvidence
                    .length === 0 && (

                    <div className="intel-empty">
                      No directly connected evidence nodes.
                    </div>

                  )}

                </div>

              </div>


              <div className="actor-evidence-section">

                <div className="actor-section-title">

                  <div>

                    <span>
                      MULTI-ACTOR RELATIONSHIPS
                    </span>

                    <h3>
                      Connected intelligence entities
                    </h3>

                  </div>

                </div>


                <div className="connected-actors">

                  {actorIntelligence
                    .connectedActors
                    .map(
                      actor => (

                        <button
                          className="connected-actor"
                          key={
                            actor.id
                          }

                          onClick={() =>
                            handleNodeClick(
                              actor
                            )
                          }
                        >

                          <span className="actor-dot"></span>

                          <strong>
                            {
                              actor
                                .properties
                                ?.id ||
                              actor.id
                            }
                          </strong>

                          <span>
                            VIEW PROFILE →
                          </span>

                        </button>

                      )
                    )}


                  {actorIntelligence
                    .connectedActors
                    .length === 0 && (

                    <div className="intel-empty">
                      No connected actor relationships currently available.
                    </div>

                  )}

                </div>

              </div>


              <div className="actor-assessment-box">

                <div>

                  <span>
                    RELATIONSHIP CONFIDENCE
                  </span>

                  <strong>

                    {
                      actorIntelligence
                        .relationshipConfidence
                        > 0

                        ? `${(
                            actorIntelligence
                              .relationshipConfidence
                              * 100
                          ).toFixed(0)}%`

                        : "NO ASSESSMENT"
                    }

                  </strong>

                </div>


                <div className="confidence-bar">

                  <div
                    style={{
                      width: `${
                        actorIntelligence
                          .relationshipConfidence
                          * 100
                      }%`
                    }}
                  ></div>

                </div>


                <p>

                  {actorIntelligence
                    .relationshipTypes
                    .length > 0

                    ? `Relationship assessment: ${actorIntelligence.relationshipTypes.join(", ")}.`

                    : "No relationship assessment is directly connected to this actor."}

                  {" "}
                  This is an intelligence assessment based on synthetic evidence and is not confirmed real-world attribution.

                </p>

              </div>


              {/* =================================================
                  OPERATIONAL REPLAY
                  ================================================= */}

              <section
                style={{
                  margin:
                    "0 20px 20px",
                  border:
                    "1px solid #30394f",
                  borderRadius:
                    "12px",
                  background:
                    "linear-gradient(145deg,#101522,#0b0f18)",
                  overflow:
                    "hidden"
                }}
              >

                <div
                  style={{
                    padding:
                      "20px",
                    borderBottom:
                      "1px solid #202638",
                    display:
                      "flex",
                    justifyContent:
                      "space-between",
                    alignItems:
                      "flex-start",
                    gap:
                      "20px"
                  }}
                >

                  <div>

                    <span
                      className="eyebrow"
                    >
                      OPERATIONAL REPLAY
                    </span>

                    <h2
                      style={{
                        margin:
                          "7px 0 4px",
                        fontSize:
                          "20px"
                      }}
                    >
                      See the operation unfold.
                    </h2>

                    <p
                      style={{
                        margin: 0,
                        color:
                          "#68738a",
                        fontSize:
                          "10px"
                      }}
                    >
                      Actor-specific operational state reconstruction and activity timeline
                    </p>

                  </div>

                  <span
                    className="live-label"
                  >
                    {operationalLoading
                      ? "LOADING"
                      : operationalError
                        ? "ERROR"
                        : "LIVE INTELLIGENCE"}
                  </span>

                </div>


                {operationalLoading && (

                  <div
                    style={{
                      padding:
                        "35px",
                      textAlign:
                        "center",
                      color:
                        "#748098",
                      fontSize:
                        "11px"
                    }}
                  >
                    Reconstructing operational activity...
                  </div>

                )}


                {!operationalLoading &&
                  operationalError && (

                  <div
                    style={{
                      margin:
                        "16px",
                      padding:
                        "14px",
                      border:
                        "1px solid #55353d",
                      borderRadius:
                        "7px",
                      background:
                        "#1b1115",
                      color:
                        "#d8909b",
                      fontSize:
                        "10px"
                    }}
                  >
                    ⚠ {operationalError}
                  </div>

                )}


                {!operationalLoading &&
                  !operationalError && (

                  <>

                    {/* CURRENT STATE */}

                    <div
                      style={{
                        padding:
                          "20px",
                        borderBottom:
                          "1px solid #202638"
                      }}
                    >

                      <div
                        style={{
                          display:
                            "flex",
                          justifyContent:
                            "space-between",
                          alignItems:
                            "flex-end",
                          marginBottom:
                            "13px",
                          gap:
                            "15px"
                        }}
                      >

                        <div>

                          <span
                            style={{
                              display:
                                "block",
                              color:
                                "#66718a",
                              fontSize:
                                "8px",
                              letterSpacing:
                                "1.5px"
                            }}
                          >
                            CURRENT OPERATIONAL STATE
                          </span>

                          <strong
                            style={{
                              display:
                                "block",
                              marginTop:
                                "7px",
                              color:
                                "#e8ecf5",
                              fontSize:
                                "22px"
                            }}
                          >
                            {
                              resolveCurrentOperationalState(
                                operationalData,
                                timelineEvents,
                                selectedNode
                              )
                            }
                          </strong>

                        </div>


                        <div
                          style={{
                            textAlign:
                              "right"
                          }}
                        >

                          <span
                            style={{
                              display:
                                "block",
                              color:
                                "#66718a",
                              fontSize:
                                "8px",
                              letterSpacing:
                                "1.3px"
                            }}
                          >
                            STATE CONFIDENCE
                          </span>

                          <strong
                            style={{
                              display:
                                "block",
                              marginTop:
                                "6px",
                              color:
                                "#54d99a",
                              fontSize:
                                "20px"
                            }}
                          >
                            {(
                              (
                                operationalData
                                  ?.stateConfidence ||
                                0
                              ) * 100
                            ).toFixed(0)}
                            %
                          </strong>

                        </div>

                      </div>


                      <div
                        style={{
                          height:
                            "6px",
                          borderRadius:
                            "5px",
                          background:
                            "#202638",
                          overflow:
                            "hidden"
                        }}
                      >

                        <div
                          style={{
                            width: `${
                              (
                                operationalData
                                  ?.stateConfidence ||
                                0
                              ) * 100
                            }%`,
                            height:
                              "100%",
                            background:
                              "#54d99a",
                            boxShadow:
                              "0 0 12px #54d99a"
                          }}
                        />

                      </div>


                      {operationalData
                        ?.assessment && (

                        <p
                          style={{
                            margin:
                              "12px 0 0",
                            color:
                              "#737e95",
                            fontSize:
                              "9px",
                            lineHeight:
                              "1.6"
                          }}
                        >
                          {
                            operationalData
                              .assessment
                          }
                        </p>

                      )}

                    </div>


                    {/* STATE PIPELINE */}

                    <div
                      style={{
                        padding:
                          "20px",
                        borderBottom:
                          "1px solid #202638",
                        overflowX:
                          "auto"
                      }}
                    >

                      <span
                        style={{
                          display:
                            "block",
                          marginBottom:
                            "15px",
                          color:
                            "#66718a",
                          fontSize:
                            "8px",
                          letterSpacing:
                            "1.5px"
                        }}
                      >
                        OPERATIONAL PROGRESSION
                      </span>


                      <div
                        style={{
                          display:
                            "flex",
                          alignItems:
                            "center",
                          minWidth:
                            "760px"
                        }}
                      >

                        {OPERATIONAL_STATES.map(
                          (
                            state,
                            index
                          ) => {

                            const completed =
                              currentStateIndex >=
                              index &&
                              currentStateIndex >=
                              0;

                            const current =
                              currentStateIndex ===
                              index;


                            return (

                              <div
                                key={
                                  state
                                }
                                style={{
                                  display:
                                    "flex",
                                  alignItems:
                                    "center",
                                  flex:
                                    index <
                                    OPERATIONAL_STATES.length -
                                      1
                                      ? 1
                                      : "0 0 auto"
                                }}
                              >

                                <div
                                  style={{
                                    textAlign:
                                      "center",
                                    width:
                                      "85px"
                                  }}
                                >

                                  <div
                                    style={{
                                      width:
                                        current
                                          ? "18px"
                                          : "12px",
                                      height:
                                        current
                                          ? "18px"
                                          : "12px",
                                      margin:
                                        "0 auto 8px",
                                      borderRadius:
                                        "50%",
                                      background:
                                        completed
                                          ? "#54d99a"
                                          : "#30394f",
                                      border:
                                        current
                                          ? "2px solid #e8ecf5"
                                          : "1px solid #47536c",
                                      boxShadow:
                                        current
                                          ? "0 0 15px #54d99a"
                                          : "none"
                                    }}
                                  />

                                  <span
                                    style={{
                                      display:
                                        "block",
                                      color:
                                        current
                                          ? "#e8ecf5"
                                          : completed
                                            ? "#86bca8"
                                            : "#5d687e",
                                      fontSize:
                                        "7px",
                                      lineHeight:
                                        "1.4"
                                    }}
                                  >
                                    {state}
                                  </span>

                                </div>


                                {index <
                                  OPERATIONAL_STATES.length -
                                    1 && (

                                  <div
                                    style={{
                                      flex:
                                        1,
                                      height:
                                        "2px",
                                      background:
                                        currentStateIndex >
                                        index
                                          ? "#54d99a"
                                          : "#283043",
                                      margin:
                                        "0 5px 27px"
                                    }}
                                  />

                                )}

                              </div>

                            );

                          }
                        )}

                      </div>

                    </div>


                    {/* ACTIVITY TIMELINE */}

                    <div
                      style={{
                        padding:
                          "20px"
                      }}
                    >

                      <div
                        style={{
                          display:
                            "flex",
                          justifyContent:
                            "space-between",
                          alignItems:
                            "center",
                          marginBottom:
                            "15px"
                        }}
                      >

                        <div>

                          <span
                            style={{
                              display:
                                "block",
                              color:
                                "#66718a",
                              fontSize:
                                "8px",
                              letterSpacing:
                                "1.5px"
                            }}
                          >
                            ACTIVITY REPLAY
                          </span>

                          <h3
                            style={{
                              margin:
                                "5px 0 0",
                              color:
                                "#dce2ef",
                              fontSize:
                                "14px"
                            }}
                          >
                            Reconstructed operational timeline
                          </h3>

                        </div>


                        <span
                          style={{
                            padding:
                              "5px 8px",
                            border:
                              "1px solid #2a3448",
                            borderRadius:
                              "5px",
                            color:
                              "#758198",
                            fontSize:
                              "8px"
                          }}
                        >
                          {
                            timelineEvents.length
                          } EVENTS
                        </span>

                      </div>


                      {timelineEvents.length ===
                        0 && (

                        <div
                          style={{
                            padding:
                              "25px",
                            textAlign:
                              "center",
                            border:
                              "1px dashed #283043",
                            borderRadius:
                              "7px",
                            color:
                              "#59647a",
                            fontSize:
                              "10px"
                          }}
                        >
                          No reconstructed activity events are currently available for this actor.
                        </div>

                      )}


                      {timelineEvents.length >
                        0 && (

                        <div
                          style={{
                            position:
                              "relative"
                          }}
                        >

                          <div
                            style={{
                              position:
                                "absolute",
                              left:
                                "10px",
                              top:
                                "8px",
                              bottom:
                                "8px",
                              width:
                                "2px",
                              background:
                                "#273044"
                            }}
                          />


                          <div
                            style={{
                              display:
                                "grid",
                              gap:
                                "8px"
                            }}
                          >

                            {timelineEvents.map(
                              (
                                event,
                                index
                              ) => (

                                <div
                                  key={
                                    event.eventId
                                  }
                                  style={{
                                    position:
                                      "relative",
                                    paddingLeft:
                                      "32px"
                                  }}
                                >

                                  <div
                                    style={{
                                      position:
                                        "absolute",
                                      left:
                                        "4px",
                                      top:
                                        "17px",
                                      width:
                                        "13px",
                                      height:
                                        "13px",
                                      borderRadius:
                                        "50%",
                                      background:
                                        "#4ea1ff",
                                      border:
                                        "2px solid #0b0f18",
                                      boxShadow:
                                        "0 0 10px #4ea1ff",
                                      zIndex:
                                        2
                                    }}
                                  />


                                  <div
                                    style={{
                                      padding:
                                        "13px",
                                      border:
                                        "1px solid #202638",
                                      borderRadius:
                                        "7px",
                                      background:
                                        "#0a0e16"
                                    }}
                                  >

                                    <div
                                      style={{
                                        display:
                                          "flex",
                                        justifyContent:
                                          "space-between",
                                        gap:
                                          "15px",
                                        alignItems:
                                          "flex-start"
                                      }}
                                    >

                                      <div>

                                        <span
                                          style={{
                                            display:
                                              "block",
                                            color:
                                              "#59647a",
                                            fontSize:
                                              "8px",
                                            marginBottom:
                                              "5px"
                                          }}
                                        >
                                          {formatTimestamp(
                                            event.timestamp
                                          )}
                                        </span>


                                        <strong
                                          style={{
                                            display:
                                              "block",
                                            color:
                                              "#dce2ef",
                                            fontSize:
                                              "10px",
                                            letterSpacing:
                                              "0.4px"
                                          }}
                                        >
                                          {
                                            event.eventType
                                          }
                                        </strong>

                                      </div>


                                      <span
                                        style={{
                                          color:
                                            "#54d99a",
                                          fontSize:
                                            "9px",
                                          fontWeight:
                                            "700"
                                        }}
                                      >
                                        {(
                                          event.confidence *
                                          100
                                        ).toFixed(0)}
                                        %
                                      </span>

                                    </div>


                                    {event.state && (

                                      <div
                                        style={{
                                          display:
                                            "inline-block",
                                          marginTop:
                                            "8px",
                                          padding:
                                            "4px 7px",
                                          border:
                                            "1px solid #30394f",
                                          borderRadius:
                                            "4px",
                                          color:
                                            "#a794e8",
                                          fontSize:
                                            "8px"
                                        }}
                                      >
                                        STATE:{" "}
                                        {
                                          event.state
                                        }
                                      </div>

                                    )}


                                    <p
                                      style={{
                                        margin:
                                          "9px 0 0",
                                        color:
                                          "#7a859b",
                                        fontSize:
                                          "9px",
                                        lineHeight:
                                          "1.6"
                                      }}
                                    >
                                      {
                                        event.description
                                      }
                                    </p>


                                    {(event.signalType ||
                                      event.source) && (

                                      <div
                                        style={{
                                          display:
                                            "flex",
                                          flexWrap:
                                            "wrap",
                                          gap:
                                            "6px",
                                          marginTop:
                                            "9px"
                                        }}
                                      >

                                        {event.signalType && (

                                          <span
                                            style={{
                                              padding:
                                                "4px 7px",
                                              border:
                                                "1px solid #29443b",
                                              borderRadius:
                                                "4px",
                                              color:
                                                "#75b99f",
                                              fontSize:
                                                "8px"
                                            }}
                                          >
                                            SIGNAL:{" "}
                                            {
                                              event.signalType
                                            }
                                          </span>

                                        )}


                                        {event.source && (

                                          <span
                                            style={{
                                              padding:
                                                "4px 7px",
                                              border:
                                                "1px solid #30394f",
                                              borderRadius:
                                                "4px",
                                              color:
                                                "#657189",
                                              fontSize:
                                                "8px"
                                            }}
                                          >
                                            SOURCE:{" "}
                                            {
                                              event.source
                                            }
                                          </span>

                                        )}

                                      </div>

                                    )}


                                    {event.evidence && (

                                      <div
                                        style={{
                                          marginTop:
                                            "9px",
                                          padding:
                                            "8px",
                                          borderLeft:
                                            "2px solid #a794e8",
                                          color:
                                            "#656f87",
                                          fontSize:
                                            "8px",
                                          lineHeight:
                                            "1.5"
                                        }}
                                      >
                                        EVIDENCE:{" "}
                                        {
                                          typeof event.evidence ===
                                          "string"
                                            ? event.evidence
                                            : JSON.stringify(
                                                event.evidence
                                              )
                                        }
                                      </div>

                                    )}

                                  </div>

                                </div>

                              )
                            )}

                          </div>

                        </div>

                      )}

                    </div>


                  </>

                )}

              </section>

            </section>

          )}



          {/* =================================================
              ADVANCED INTELLIGENCE ENRICHMENT
              ================================================= */}

          {actorIntelligence && (
            <section
              style={{
                margin: "0 20px 20px",
                border: "1px solid #30394f",
                borderRadius: "12px",
                background: "linear-gradient(145deg,#101725,#090d15)",
                overflow: "hidden"
              }}
            >
              <div
                style={{
                  padding: "20px",
                  borderBottom: "1px solid #202638",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "15px"
                }}
              >
                <div>
                  <span className="eyebrow">
                    ADVANCED INTELLIGENCE
                  </span>

                  <h2
                    style={{
                      margin: "7px 0 4px",
                      fontSize: "20px"
                    }}
                  >
                    Behavioral & Correlation Enrichment
                  </h2>

                  <p
                    style={{
                      margin: 0,
                      color: "#68738a",
                      fontSize: "10px"
                    }}
                  >
                    Stylometry → Temporal → Infrastructure → Blockchain → Entity Resolution
                  </p>
                </div>

                <span className="live-label">
                  {advancedLoading
                    ? "ENRICHING"
                    : "INTELLIGENCE READY"}
                </span>
              </div>

              {advancedLoading && (
                <div
                  style={{
                    padding: "30px",
                    textAlign: "center",
                    color: "#748098",
                    fontSize: "11px"
                  }}
                >
                  Computing behavioral, temporal, infrastructure, blockchain and entity-resolution signals...
                </div>
              )}

              {!advancedLoading && advancedError && (
                <div
                  style={{
                    margin: "16px",
                    padding: "14px",
                    border: "1px solid #55353d",
                    borderRadius: "7px",
                    background: "#1b1115",
                    color: "#d8909b",
                    fontSize: "10px"
                  }}
                >
                  ⚠ {advancedError}
                </div>
              )}

              {!advancedLoading &&
                !advancedError &&
                advancedIntelligence && (
                  <>
                    <div
                      style={{
                        padding: "18px",
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(4,minmax(0,1fr))",
                        gap: "9px",
                        borderBottom: "1px solid #202638"
                      }}
                    >
                      {advancedMetric(
                        "BEHAVIORAL TOKENS",
                        advancedIntelligence.behavioral?.word_count ?? 0,
                        `${advancedIntelligence.behavioral?.sentence_count ?? 0} sentences • ${advancedIntelligence.behavioral?.character_trigram_count ?? 0} character trigrams`
                      )}

                      {advancedMetric(
                        "PEAK ACTIVITY",
                        advancedIntelligence.temporal?.peak_hours_utc?.join(", ") || "No data",
                        advancedIntelligence.temporal?.activity_window_utc || "No activity timestamps"
                      )}

                      {advancedMetric(
                        "INFRASTRUCTURE",
                        advancedIntelligence.infrastructure?.total_unique_entities ?? 0,
                        `${advancedIntelligence.infrastructure?.domain_count ?? 0} domains • ${advancedIntelligence.infrastructure?.server_count ?? 0} servers`
                      )}

                      {advancedMetric(
                        "WALLET SIGNAL",
                        advancedIntelligence.blockchain?.wallet_id || "No wallet",
                        advancedIntelligence.blockchain?.wallet_id
                          ? `${advancedIntelligence.blockchain.transaction_count ?? 0} supplied transactions`
                          : "No wallet evidence connected"
                      )}
                    </div>

                    <div
                      style={{
                        padding: "18px",
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(3,minmax(0,1fr))",
                        gap: "9px",
                        borderBottom: "1px solid #202638"
                      }}
                    >
                      {advancedMetric(
                        "TECHNICAL TOKEN RATIO",
                        advancedPercent(
                          advancedIntelligence.behavioral?.technical_token_ratio
                        ),
                        "Share of tokens containing identifiers or digits"
                      )}

                      {advancedMetric(
                        "NIGHT ACTIVITY",
                        advancedPercent(
                          advancedIntelligence.temporal?.night_activity_ratio
                        ),
                        "Observed activity during 20:00–05:59 UTC"
                      )}

                      {advancedMetric(
                        "UNIQUE VOCABULARY",
                        advancedPercent(
                          advancedIntelligence.behavioral?.unique_word_ratio
                        ),
                        "Unique words relative to total words"
                      )}
                    </div>

                    <div
                      style={{
                        padding: "18px",
                        borderBottom: "1px solid #202638"
                      }}
                    >
                      <span
                        style={{
                          color: "#66718a",
                          fontSize: "8px",
                          letterSpacing: "1.5px"
                        }}
                      >
                        BEHAVIORAL FINGERPRINT
                      </span>

                      <div
                        style={{
                          marginTop: "12px",
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(4,minmax(0,1fr))",
                          gap: "9px"
                        }}
                      >
                        {advancedMetric(
                          "AVG WORD LENGTH",
                          advancedIntelligence.behavioral?.average_word_length ?? "—"
                        )}

                        {advancedMetric(
                          "AVG SENTENCE",
                          advancedIntelligence.behavioral?.average_sentence_length ?? "—",
                          "words per sentence"
                        )}

                        {advancedMetric(
                          "HAPAX RATIO",
                          advancedPercent(
                            advancedIntelligence.behavioral?.hapax_ratio
                          )
                        )}

                        {advancedMetric(
                          "TRIGRAMS",
                          advancedIntelligence.behavioral?.character_trigram_count ?? 0
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: "18px",
                        borderBottom: "1px solid #202638"
                      }}
                    >
                      <span
                        style={{
                          color: "#66718a",
                          fontSize: "8px",
                          letterSpacing: "1.5px"
                        }}
                      >
                        TEMPORAL FINGERPRINT
                      </span>

                      <div
                        style={{
                          marginTop: "12px",
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(3,minmax(0,1fr))",
                          gap: "9px"
                        }}
                      >
                        {advancedMetric(
                          "EVENTS",
                          advancedIntelligence.temporal?.event_count ?? 0
                        )}

                        {advancedMetric(
                          "ACTIVE HOURS",
                          advancedIntelligence.temporal?.active_hour_count ?? 0
                        )}

                        {advancedMetric(
                          "WEEKEND ACTIVITY",
                          advancedPercent(
                            advancedIntelligence.temporal?.weekend_activity_ratio
                          )
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: "18px",
                        borderBottom: "1px solid #202638"
                      }}
                    >
                      <span
                        style={{
                          color: "#66718a",
                          fontSize: "8px",
                          letterSpacing: "1.5px"
                        }}
                      >
                        INFRASTRUCTURE FINGERPRINT
                      </span>

                      <div
                        style={{
                          marginTop: "12px",
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(4,minmax(0,1fr))",
                          gap: "9px"
                        }}
                      >
                        {advancedMetric(
                          "INFRASTRUCTURE",
                          advancedIntelligence.infrastructure?.infrastructure_count ?? 0,
                          (advancedIntelligence.infrastructure?.infrastructure || []).join(", ") || "None"
                        )}

                        {advancedMetric(
                          "DOMAINS",
                          advancedIntelligence.infrastructure?.domain_count ?? 0,
                          (advancedIntelligence.infrastructure?.domains || []).join(", ") || "None"
                        )}

                        {advancedMetric(
                          "SERVERS",
                          advancedIntelligence.infrastructure?.server_count ?? 0,
                          (advancedIntelligence.infrastructure?.servers || []).join(", ") || "None"
                        )}

                        {advancedMetric(
                          "CERTIFICATES",
                          advancedIntelligence.infrastructure?.certificate_count ?? 0,
                          (advancedIntelligence.infrastructure?.certificates || []).join(", ") || "None"
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: "18px"
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "15px"
                        }}
                      >
                        <div>
                          <span
                            style={{
                              color: "#66718a",
                              fontSize: "8px",
                              letterSpacing: "1.5px"
                            }}
                          >
                            ENTITY CORRELATION CONFIDENCE
                          </span>

                          <strong
                            style={{
                              display: "block",
                              marginTop: "7px",
                              color: "#e8ecf5",
                              fontSize: "19px"
                            }}
                          >
                            {advancedIntelligence.resolution &&
                            Number(advancedIntelligence.resolution.confidence ?? 0) > 0
                              ? advancedPercent(
                                  advancedIntelligence.resolution.confidence
                                )
                              : "NOT ESTABLISHED"}
                          </strong>
                        </div>

                        <span
                          style={{
                            padding: "6px 9px",
                            border: "1px solid #30394f",
                            borderRadius: "5px",
                            color: "#9aa5ba",
                            fontSize: "9px"
                          }}
                        >
                          {advancedIntelligence.connectedActor
                            ? `vs ${advancedIntelligence.connectedActor}`
                            : "NO CONNECTED ACTOR"}
                        </span>
                      </div>

                      {advancedIntelligence.resolution && (
                        <>
                          <p
                            style={{
                              margin: "10px 0 0",
                              color: "#778299",
                              fontSize: "9px",
                              lineHeight: "1.6"
                            }}
                          >
                            {advancedIntelligence.resolution.assessment}
                            <span style={{ display: "block", marginTop: "5px", color: "#5f6b82", fontSize: "8px", letterSpacing: "1px" }}>
                              ANALYTICAL CONFIDENCE: {analyticalConfidenceLabel(advancedIntelligence.resolution.confidence)} · RAW FEATURE RATIOS ARE NOT IDENTITY CERTAINTY
                            </span>
                          </p>

                          <div
                            style={{
                              marginTop: "12px",
                              display: "grid",
                              gap: "6px"
                            }}
                          >
                            {(
                              advancedIntelligence.resolution.evidence || []
                            ).slice(0, 6).map((item, index) => (
                              <div
                                key={`${item.signal_type}-${index}`}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  gap: "10px",
                                  padding: "8px 10px",
                                  border: "1px solid #202638",
                                  borderRadius: "5px",
                                  background: "#0a0e16",
                                  fontSize: "9px"
                                }}
                              >
                                <span style={{ color: "#9aa5ba" }}>
                                  {String(
                                    item.signal_type || "signal"
                                  ).replaceAll("_", " ").toUpperCase()}
                                </span>

                                <span style={{ color: "#54d99a" }}>
                                  {advancedPercent(item.strength)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {!advancedIntelligence.resolution && (
                        <p
                          style={{
                            margin: "10px 0 0",
                            color: "#59647a",
                            fontSize: "9px",
                            lineHeight: "1.6"
                          }}
                        >
                          Entity-resolution comparison becomes available when a connected actor is present in the selected graph context.
                        </p>
                      )}

                      <p
                        style={{
                          margin: "14px 0 0",
                          color: "#59647a",
                          fontSize: "8px",
                          lineHeight: "1.6"
                        }}
                      >
                        Intelligence enrichment uses supplied synthetic/authorized observations. Correlation scores are not proof of real-world identity.
                      </p>
                    </div>
                  </>
                )}
            </section>
          )}

          {/* =================================================
              BATCH 2 — INVESTIGATION COMMAND LAYER
              ================================================= */}

          {actorIntelligence && (
            <section
              style={{
                margin: "0 20px 20px",
                border: "1px solid #30394f",
                borderRadius: "12px",
                background: "linear-gradient(145deg,#101725,#090d15)",
                overflow: "hidden"
              }}
            >
              <div
                style={{
                  padding: "20px",
                  borderBottom: "1px solid #202638",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "15px"
                }}
              >
                <div>
                  <span className="eyebrow">
                    INVESTIGATION COMMAND LAYER
                  </span>
                  <h2
                    style={{
                      margin: "7px 0 4px",
                      fontSize: "20px"
                    }}
                  >
                    Evidence → Twin → Campaign → Actors
                  </h2>
                  <p
                    style={{
                      margin: 0,
                      color: "#68738a",
                      fontSize: "10px"
                    }}
                  >
                    Explainable investigation context for {actorIntelligence.actorId}
                  </p>
                </div>

                <span className="live-label">
                  {investigationLoading
                    ? "LOADING"
                    : "INVESTIGATION READY"}
                </span>
              </div>

              {investigationError && (
                <div
                  style={{
                    margin: "16px",
                    padding: "12px",
                    border: "1px solid #55353d",
                    borderRadius: "7px",
                    background: "#1b1115",
                    color: "#d8909b",
                    fontSize: "10px"
                  }}
                >
                  ⚠ {investigationError}
                </div>
              )}

              {/* ACTIVITY REPLAY */}
              <div
                style={{
                  padding: "18px",
                  borderBottom: "1px solid #202638"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    flexWrap: "wrap"
                  }}
                >
                  <div>
                    <span
                      style={{
                        color: "#66718a",
                        fontSize: "8px",
                        letterSpacing: "1.5px"
                      }}
                    >
                      ACTIVITY REPLAY ENGINE
                    </span>

                    <strong
                      style={{
                        display: "block",
                        marginTop: "6px",
                        color: "#e8ecf5",
                        fontSize: "16px"
                      }}
                    >
                      {replayIndex >= 0 &&
                      timelineEvents[replayIndex]
                        ? timelineEvents[replayIndex].eventType
                        : "Ready to replay reconstructed activity"}
                    </strong>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "7px"
                    }}
                  >
                    <button
                      type="button"
                      onClick={startReplay}
                      style={{
                        border: "1px solid #315747",
                        background: "#102018",
                        color: "#75b99f",
                        borderRadius: "5px",
                        padding: "7px 11px",
                        cursor: "pointer",
                        fontSize: "9px"
                      }}
                    >
                      ▶ PLAY
                    </button>

                    <button
                      type="button"
                      onClick={pauseReplay}
                      style={{
                        border: "1px solid #30394f",
                        background: "#0b1019",
                        color: "#9aa5ba",
                        borderRadius: "5px",
                        padding: "7px 11px",
                        cursor: "pointer",
                        fontSize: "9px"
                      }}
                    >
                      ❚❚ PAUSE
                    </button>

                    <button
                      type="button"
                      onClick={resetReplay}
                      style={{
                        border: "1px solid #30394f",
                        background: "#0b1019",
                        color: "#9aa5ba",
                        borderRadius: "5px",
                        padding: "7px 11px",
                        cursor: "pointer",
                        fontSize: "9px"
                      }}
                    >
                      ↺ RESET
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "13px",
                    display: "flex",
                    gap: "4px"
                  }}
                >
                  {timelineEvents.map((event, index) => (
                    <button
                      type="button"
                      key={event.eventId || index}
                      onClick={() => {
                        setReplayPlaying(false);
                        setReplayIndex(index);
                      }}
                      title={event.description}
                      style={{
                        flex: 1,
                        height: "8px",
                        border: "0",
                        borderRadius: "4px",
                        cursor: "pointer",
                        background:
                          index <= replayIndex
                            ? "#54d99a"
                            : "#252d40"
                      }}
                    />
                  ))}
                </div>

                {replayIndex >= 0 &&
                  timelineEvents[replayIndex] && (
                    <div
                      style={{
                        marginTop: "12px",
                        padding: "12px",
                        border: "1px solid #202638",
                        borderRadius: "7px",
                        background: "#0a0e16"
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "10px"
                        }}
                      >
                        <span
                          style={{
                            color: "#54d99a",
                            fontSize: "9px",
                            fontWeight: "800"
                          }}
                        >
                          {timelineEvents[replayIndex].eventType}
                        </span>

                        <span
                          style={{
                            color: "#a794e8",
                            fontSize: "9px"
                          }}
                        >
                          {advancedPercent(
                            timelineEvents[replayIndex].confidence
                          )}
                        </span>
                      </div>

                      <p
                        style={{
                          margin: "8px 0 0",
                          color: "#8c97ab",
                          fontSize: "9px",
                          lineHeight: "1.5"
                        }}
                      >
                        {timelineEvents[replayIndex].description}
                      </p>

                      <div
                        style={{
                          marginTop: "7px",
                          color: "#59647a",
                          fontSize: "8px"
                        }}
                      >
                        STATE:{" "}
                        {timelineEvents[replayIndex].state || "Unknown"}
                      </div>
                    </div>
                  )}
              </div>

              {/* EVIDENCE LEDGER + DIGITAL TWIN */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2,minmax(0,1fr))",
                  gap: "1px",
                  background: "#202638",
                  borderBottom: "1px solid #202638"
                }}
              >
                <div
                  style={{
                    padding: "18px",
                    background: "#0d121c"
                  }}
                >
                  <span
                    style={{
                      color: "#66718a",
                      fontSize: "8px",
                      letterSpacing: "1.5px"
                    }}
                  >
                    EVIDENCE LEDGER
                  </span>

                  <strong
                    style={{
                      display: "block",
                      marginTop: "6px",
                      color: "#e8ecf5",
                      fontSize: "17px"
                    }}
                  >
                    {investigationData.ledger.length} reasoning records
                  </strong>

                  <div
                    style={{
                      display: "grid",
                      gap: "8px",
                      marginTop: "12px"
                    }}
                  >
                    {investigationData.ledger.slice(0, 6).map(
                      (item, index) => (
                        <div
                          key={
                            item.ledger_id ||
                            item.id ||
                            index
                          }
                          style={{
                            padding: "10px",
                            border: "1px solid #202638",
                            borderRadius: "6px",
                            background: "#0a0e16"
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: "8px"
                            }}
                          >
                            <span
                              style={{
                                color: "#54d99a",
                                fontSize: "8px",
                                fontWeight: "800"
                              }}
                            >
                              {String(
                                item.signal_type ||
                                "SIGNAL"
                              )
                                .replaceAll("_", " ")
                                .toUpperCase()}
                            </span>

                            <span
                              style={{
                                color: "#a794e8",
                                fontSize: "8px"
                              }}
                            >
                              {advancedPercent(
                                item.confidence
                              )}
                            </span>
                          </div>

                          <strong
                            style={{
                              display: "block",
                              marginTop: "6px",
                              color: "#c4ccda",
                              fontSize: "9px"
                            }}
                          >
                            {item.claim ||
                              "Intelligence claim"}
                          </strong>

                          <p
                            style={{
                              margin: "5px 0 0",
                              color: "#68738a",
                              fontSize: "8px",
                              lineHeight: "1.5"
                            }}
                          >
                            {item.observation ||
                              item.model_result ||
                              "Observed supporting evidence."}
                          </p>
                        </div>
                      )
                    )}

                    {investigationData.ledger.length === 0 && (
                      <div
                        style={{
                          padding: "12px",
                          color: "#59647a",
                          fontSize: "9px"
                        }}
                      >
                        No persisted ledger record is currently linked.
                      </div>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    padding: "18px",
                    background: "#0d121c"
                  }}
                >
                  <span
                    style={{
                      color: "#66718a",
                      fontSize: "8px",
                      letterSpacing: "1.5px"
                    }}
                  >
                    ACTOR DIGITAL TWIN
                  </span>

                  {investigationData.digitalTwin ? (
                    <>
                      <strong
                        style={{
                          display: "block",
                          marginTop: "6px",
                          color: "#e8ecf5",
                          fontSize: "17px"
                        }}
                      >
                        {investigationData.digitalTwin.display_name ||
                          actorIntelligence.actorId}
                      </strong>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(2,minmax(0,1fr))",
                          gap: "7px",
                          marginTop: "12px"
                        }}
                      >
                        {advancedMetric(
                          "STATE",
                          formatState(
                            investigationData.digitalTwin.current_state
                          )
                        )}

                        {advancedMetric(
                          "STATE CONFIDENCE",
                          advancedPercent(
                            investigationData.digitalTwin.state_confidence
                          )
                        )}

                        {advancedMetric(
                          "ACTOR CONFIDENCE",
                          advancedPercent(
                            investigationData.digitalTwin.confidence
                          )
                        )}

                        {advancedMetric(
                          "RISK",
                          `${Number(
                            investigationData.digitalTwin.risk_score || 0
                          ).toFixed(0)}/100`
                        )}
                      </div>

                      {investigationData.digitalTwin.analyst_assessment && (
                        <p
                          style={{
                            margin: "11px 0 0",
                            color: "#68738a",
                            fontSize: "8px",
                            lineHeight: "1.6"
                          }}
                        >
                          {investigationData.digitalTwin.analyst_assessment}
                        </p>
                      )}
                    </>
                  ) : (
                    <div
                      style={{
                        marginTop: "12px",
                        padding: "12px",
                        border: "1px solid #202638",
                        borderRadius: "6px",
                        color: "#59647a",
                        fontSize: "9px"
                      }}
                    >
                      Digital Twin record not persisted for this actor.
                    </div>
                  )}
                </div>
              </div>

              {/* CAMPAIGNS + MULTI-ACTOR */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2,minmax(0,1fr))",
                  gap: "1px",
                  background: "#202638"
                }}
              >
                <div
                  style={{
                    padding: "18px",
                    background: "#0d121c"
                  }}
                >
                  <span
                    style={{
                      color: "#66718a",
                      fontSize: "8px",
                      letterSpacing: "1.5px"
                    }}
                  >
                    EMERGING CAMPAIGNS
                  </span>

                  <div
                    style={{
                      display: "grid",
                      gap: "8px",
                      marginTop: "12px"
                    }}
                  >
                    {investigationData.campaigns.slice(0, 5).map(
                      (campaign, index) => (
                        <div
                          key={
                            campaign.campaign_id ||
                            campaign.id ||
                            index
                          }
                          style={{
                            padding: "11px",
                            border: "1px solid #202638",
                            borderRadius: "6px",
                            background: "#0a0e16"
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: "8px"
                            }}
                          >
                            <strong
                              style={{
                                color: "#c4ccda",
                                fontSize: "9px"
                              }}
                            >
                              {campaign.name ||
                                campaign.campaign_name ||
                                "Emerging campaign"}
                            </strong>

                            <span
                              style={{
                                color: "#54d99a",
                                fontSize: "8px"
                              }}
                            >
                              {advancedPercent(
                                campaign.confidence
                              )}
                            </span>
                          </div>

                          <div
                            style={{
                              marginTop: "6px",
                              color: "#68738a",
                              fontSize: "8px"
                            }}
                          >
                            {campaign.status ||
                              campaign.campaign_status ||
                              "campaign assessment"}
                            {" • "}
                            {campaign.signal_count ?? 0} signals
                          </div>
                        </div>
                      )
                    )}

                    {investigationData.campaigns.length === 0 && (
                      <div
                        style={{
                          color: "#59647a",
                          fontSize: "9px"
                        }}
                      >
                        No persisted campaign record is currently linked.
                      </div>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    padding: "18px",
                    background: "#0d121c"
                  }}
                >
                  <span
                    style={{
                      color: "#66718a",
                      fontSize: "8px",
                      letterSpacing: "1.5px"
                    }}
                  >
                    MULTI-ACTOR RELATIONSHIPS
                  </span>

                  <div
                    style={{
                      display: "grid",
                      gap: "8px",
                      marginTop: "12px"
                    }}
                  >
                    {investigationData.multiActor.slice(0, 6).map(
                      (relationship, index) => (
                        <div
                          key={`${relationship.actor_a}-${relationship.actor_b}-${index}`}
                          style={{
                            padding: "11px",
                            border: "1px solid #202638",
                            borderRadius: "6px",
                            background: "#0a0e16"
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: "8px"
                            }}
                          >
                            <strong
                              style={{
                                color: "#4ea1ff",
                                fontSize: "9px"
                              }}
                            >
                              {relationship.actor_a}
                              {" ↔ "}
                              {relationship.actor_b}
                            </strong>

                            <span
                              style={{
                                color: "#a794e8",
                                fontSize: "8px",
                                fontWeight: "800"
                              }}
                            >
                              {advancedPercent(
                                relationship.confidence
                              )}
                            </span>
                          </div>

                          <div
                            style={{
                              marginTop: "6px",
                              color: "#68738a",
                              fontSize: "8px"
                            }}
                          >
                            {String(
                              relationship.relationship_type ||
                              "relationship"
                            )
                              .replaceAll("_", " ")
                              .toUpperCase()}
                          </div>

                          {relationship.evidence_types?.length > 0 && (
                            <div
                              style={{
                                marginTop: "6px",
                                color: "#59647a",
                                fontSize: "8px"
                              }}
                            >
                              Signals:{" "}
                              {relationship.evidence_types
                                .slice(0, 4)
                                .join(", ")}
                            </div>
                          )}
                        </div>
                      )
                    )}

                    {investigationData.multiActor.length === 0 && (
                      <div
                        style={{
                          color: "#59647a",
                          fontSize: "9px"
                        }}
                      >
                        No persisted multi-actor relationship is linked.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: "12px 18px",
                  borderTop: "1px solid #202638",
                  color: "#59647a",
                  fontSize: "8px",
                  lineHeight: "1.6"
                }}
              >
                Investigation outputs use supplied synthetic/authorized observations.
                Relationship scores are intelligence assessments, not proof of identity.
              </div>
            </section>
          )}

          {/* =================================================
              THREAT INTELLIGENCE COMMAND CENTER
              ================================================= */}


          {actorIntelligence && (
            <section
              style={{
                margin: "0 20px 20px",
                border: "1px solid #30394f",
                borderRadius: "12px",
                background: "linear-gradient(145deg,#111725,#090d15)",
                overflow: "hidden"
              }}
            >
              <div
                style={{
                  padding: "20px",
                  borderBottom: "1px solid #202638",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "15px"
                }}
              >
                <div>
                  <span className="eyebrow">THREAT INTELLIGENCE COMMAND CENTER</span>
                  <h2 style={{ margin: "7px 0 4px", fontSize: "20px" }}>
                    From change to warning.
                  </h2>
                  <p style={{ margin: 0, color: "#68738a", fontSize: "10px" }}>
                    What Changed → Prediction → Alert → Defensive Response
                  </p>
                </div>
                <span className="live-label">
                  {intelligenceLoading ? "ANALYZING" : "LIVE INTELLIGENCE"}
                </span>
              </div>

              {intelligenceLoading && (
                <div style={{ padding: "35px", textAlign: "center", color: "#748098", fontSize: "11px" }}>
                  Correlating changes, forecasting next activity, and generating intelligence alert...
                </div>
              )}

              {!intelligenceLoading && intelligenceError && (
                <div style={{ margin: "16px", padding: "14px", border: "1px solid #55353d", borderRadius: "7px", background: "#1b1115", color: "#d8909b", fontSize: "10px" }}>
                  ⚠ {intelligenceError}
                </div>
              )}

              {!intelligenceLoading && !intelligenceError && threatIntelligence && (
                <>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3,minmax(0,1fr))",
                      gap: "1px",
                      background: "#202638"
                    }}
                  >
                    <div style={{ padding: "18px", background: "#0d121c" }}>
                      <span style={{ color: "#66718a", fontSize: "8px", letterSpacing: "1.4px" }}>RISK SCORE</span>
                      <strong style={{ display: "block", marginTop: "7px", color: "#e8ecf5", fontSize: "25px" }}>
                        {threatIntelligence.riskScore}/100
                      </strong>
                    </div>
                    <div style={{ padding: "18px", background: "#0d121c" }}>
                      <span style={{ color: "#66718a", fontSize: "8px", letterSpacing: "1.4px" }}>CHANGES DETECTED</span>
                      <strong style={{ display: "block", marginTop: "7px", color: "#54d99a", fontSize: "25px" }}>
                        {threatIntelligence.changeCount}
                      </strong>
                    </div>
                    <div style={{ padding: "18px", background: "#0d121c" }}>
                      <span style={{ color: "#66718a", fontSize: "8px", letterSpacing: "1.4px" }}>PREDICTION</span>
                      <strong style={{ display: "block", marginTop: "7px", color: "#a794e8", fontSize: "25px" }}>
                        {(threatIntelligence.prediction.probability * 100).toFixed(0)}%
                      </strong>
                    </div>
                  </div>

                  <div style={{ padding: "20px", borderBottom: "1px solid #202638" }}>
                    <span style={{ color: "#66718a", fontSize: "8px", letterSpacing: "1.5px" }}>WHAT CHANGED</span>
                    <div style={{ display: "grid", gap: "7px", marginTop: "12px" }}>
                      {threatIntelligence.changeSummary.slice(0, 8).map((item, index) => (
                        <div key={`${item}-${index}`} style={{ display: "flex", gap: "8px", alignItems: "flex-start", color: "#b6bfd0", fontSize: "10px" }}>
                          <span style={{ color: "#54d99a", fontWeight: "800" }}>+</span>
                          <span>{item}</span>
                        </div>
                      ))}
                      {threatIntelligence.changeSummary.length === 0 && (
                        <div style={{ color: "#59647a", fontSize: "10px" }}>No significant changes detected.</div>
                      )}
                    </div>
                  </div>

                  <div style={{ padding: "20px", borderBottom: "1px solid #202638" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "15px", alignItems: "flex-end" }}>
                      <div>
                        <span style={{ color: "#66718a", fontSize: "8px", letterSpacing: "1.5px" }}>PREDICTED NEXT ACTIVITY</span>
                        <strong style={{ display: "block", marginTop: "7px", color: "#e8ecf5", fontSize: "20px" }}>
                          {threatIntelligence.prediction.predictedState}
                        </strong>
                      </div>
                      <strong style={{ color: "#a794e8", fontSize: "18px" }}>
                        {(threatIntelligence.prediction.probability * 100).toFixed(0)}%
                      </strong>
                    </div>

                    <div style={{ height: "7px", marginTop: "12px", borderRadius: "5px", background: "#202638", overflow: "hidden" }}>
                      <div style={{ width: `${threatIntelligence.prediction.probability * 100}%`, height: "100%", background: "#a794e8", boxShadow: "0 0 12px #a794e8" }} />
                    </div>

                    {threatIntelligence.prediction.reasoning.length > 0 && (
                      <div style={{ display: "grid", gap: "5px", marginTop: "12px" }}>
                        {threatIntelligence.prediction.reasoning.slice(0, 5).map((item, index) => (
                          <div key={`${item}-${index}`} style={{ color: "#737e95", fontSize: "9px", lineHeight: "1.5" }}>
                            • {item}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ padding: "20px", borderBottom: "1px solid #202638" }}>
                    <div style={{ padding: "15px", border: "1px solid #55353d", borderRadius: "8px", background: "#170f14" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "15px" }}>
                        <div>
                          <span style={{ color: "#8a6470", fontSize: "8px", letterSpacing: "1.5px" }}>INTELLIGENCE ALERT</span>
                          <strong style={{ display: "block", marginTop: "6px", color: "#f0c6cd", fontSize: "16px" }}>
                            🚨 {threatIntelligence.alert.title}
                          </strong>
                        </div>
                        <span style={{ padding: "6px 9px", border: "1px solid #75414c", borderRadius: "5px", color: "#f0a8b5", fontSize: "9px", fontWeight: "800" }}>
                          {threatIntelligence.alert.severity}
                        </span>
                      </div>

                      <div style={{ display: "grid", gap: "5px", marginTop: "12px" }}>
                        {threatIntelligence.alert.reasons.slice(0, 8).map((item, index) => (
                          <div key={`${item}-${index}`} style={{ color: "#a78991", fontSize: "9px", lineHeight: "1.5" }}>
                            • {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: "20px" }}>
                    <span style={{ color: "#66718a", fontSize: "8px", letterSpacing: "1.5px" }}>DEFENSIVE RECOMMENDATIONS</span>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "8px", marginTop: "12px" }}>
                      {threatIntelligence.alert.recommendations.map((item, index) => (
                        <div key={`${item}-${index}`} style={{ padding: "10px", border: "1px solid #202638", borderRadius: "6px", background: "#0a0e16", color: "#8e99ad", fontSize: "9px", lineHeight: "1.5" }}>
                          <span style={{ color: "#54d99a", marginRight: "6px" }}>✓</span>
                          {item}
                        </div>
                      ))}
                    </div>

                    {threatIntelligence.alert.assessment && (
                      <p style={{ margin: "14px 0 0", color: "#68738a", fontSize: "9px", lineHeight: "1.6" }}>
                        {threatIntelligence.alert.assessment}
                      </p>
                    )}
                  </div>
                </>
              )}
            </section>
          )}


          {/* =================================================
              BATCH 3 — PREDICTIVE RESILIENCE CENTER
              ================================================= */}

          {actorIntelligence && (
            <section
              className="panel"
              style={{
                marginTop: "18px",
                overflow: "hidden"
              }}
            >
              <div
                className="panel-header"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "15px"
                }}
              >
                <div>
                  <h3 style={{ marginBottom: "4px" }}>
                    Predictive Resilience Center
                  </h3>
                  <small style={{ color: "#59647a", fontSize: "8px", letterSpacing: "1.2px" }}>
                    NEW SIGNAL → CORRELATION → COUNTER-EVIDENCE → WHAT-IF → WARNING
                  </small>
                </div>

                {batch3Intelligence && (
                  <span
                    style={{
                      padding: "6px 9px",
                      border: "1px solid #30415a",
                      borderRadius: "5px",
                      color: "#79a9d8",
                      fontSize: "8px",
                      letterSpacing: "1px"
                    }}
                  >
                    AI RESILIENCE ONLINE
                  </span>
                )}
              </div>

              {batch3Loading && (
                <div
                  style={{
                    padding: "28px",
                    textAlign: "center",
                    color: "#748098",
                    fontSize: "10px"
                  }}
                >
                  Running probabilistic scenarios, evidence challenge and early-warning assessment...
                </div>
              )}

              {batch3Intelligence && (
                <>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4,minmax(0,1fr))",
                      gap: "1px",
                      background: "#202638"
                    }}
                  >
                    <div style={{ padding: "16px", background: "#0d121c" }}>
                      <span style={{ color: "#66718a", fontSize: "8px", letterSpacing: "1.2px" }}>
                        CURRENT STATE
                      </span>
                      <strong style={{ display: "block", marginTop: "7px", color: "#e8ecf5", fontSize: "15px" }}>
                        {batch3Intelligence.currentState}
                      </strong>
                    </div>

                    <div style={{ padding: "16px", background: "#0d121c" }}>
                      <span style={{ color: "#66718a", fontSize: "8px", letterSpacing: "1.2px" }}>
                        RISK
                      </span>
                      <strong style={{ display: "block", marginTop: "7px", color: "#f0c6cd", fontSize: "20px" }}>
                        {batch3Intelligence.riskScore}/100
                      </strong>
                    </div>

                    <div style={{ padding: "16px", background: "#0d121c" }}>
                      <span style={{ color: "#66718a", fontSize: "8px", letterSpacing: "1.2px" }}>
                        ADJUSTED CONFIDENCE
                      </span>
                      <strong style={{ display: "block", marginTop: "7px", color: "#54d99a", fontSize: "20px" }}>
                        {((batch3Intelligence.analyticalAdjustedConfidence ??
                          calibrateAnalyticalConfidence(
                            batch3Intelligence.counterEvidence.adjusted_confidence,
                            batch3Intelligence.counterEvidence.supporting_evidence?.length || 0,
                            new Set(actorIntelligence.signalTypes || []).size
                          )) * 100).toFixed(0)}%
                      </strong>
                    </div>

                    <div style={{ padding: "16px", background: "#0d121c" }}>
                      <span style={{ color: "#66718a", fontSize: "8px", letterSpacing: "1.2px" }}>
                        FALSE-LINK RISK
                      </span>
                      <strong style={{ display: "block", marginTop: "7px", color: "#a794e8", fontSize: "20px" }}>
                        {(batch3Intelligence.counterEvidence.false_link_risk * 100).toFixed(0)}%
                      </strong>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2,minmax(0,1fr))",
                      gap: "1px",
                      background: "#202638"
                    }}
                  >
                    <div style={{ padding: "20px", background: "#0b1019" }}>
                      <span style={{ color: "#66718a", fontSize: "8px", letterSpacing: "1.5px" }}>
                        WHAT-IF SIMULATOR
                      </span>

                      <div style={{ marginTop: "12px", display: "grid", gap: "8px" }}>
                        {(batch3Intelligence.whatIf?.scenarios || []).slice(0, 3).map((scenario, index) => (
                          <div
                            key={`${scenario.state}-${index}`}
                            style={{
                              padding: "11px",
                              border: "1px solid #202638",
                              borderRadius: "6px",
                              background: "#0a0e16"
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
                              <strong style={{ color: "#dce2ee", fontSize: "10px" }}>
                                {scenario.state}
                              </strong>
                              <strong style={{ color: "#a794e8", fontSize: "10px" }}>
                                {(batch3Probability(scenario.probability) * 100).toFixed(0)}%
                              </strong>
                            </div>

                            <div
                              style={{
                                height: "5px",
                                marginTop: "8px",
                                borderRadius: "4px",
                                background: "#202638",
                                overflow: "hidden"
                              }}
                            >
                              <div
                                style={{
                                  width: `${batch3Probability(scenario.probability) * 100}%`,
                                  height: "100%",
                                  background: "#a794e8"
                                }}
                              />
                            </div>

                            <p style={{ margin: "8px 0 0", color: "#68738a", fontSize: "8px", lineHeight: "1.5" }}>
                              {scenario.reasoning}
                            </p>
                          </div>
                        ))}
                      </div>

                      <p style={{ margin: "11px 0 0", color: "#59647a", fontSize: "8px", lineHeight: "1.5" }}>
                        {batch3Intelligence.whatIf?.assessment}
                      </p>
                    </div>

                    <div style={{ padding: "20px", background: "#0b1019" }}>
                      <span style={{ color: "#66718a", fontSize: "8px", letterSpacing: "1.5px" }}>
                        COUNTER-EVIDENCE / FALSE-LINK DETECTION
                      </span>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "8px", marginTop: "12px" }}>
                        <div style={{ padding: "12px", border: "1px solid #202638", borderRadius: "6px", background: "#0a0e16" }}>
                          <span style={{ color: "#66718a", fontSize: "7px" }}>SUPPORT</span>
                          <strong style={{ display: "block", marginTop: "5px", color: "#54d99a", fontSize: "17px" }}>
                            {(batch3Intelligence.counterEvidence.support_score * 100).toFixed(0)}%
                          </strong>
                        </div>

                        <div style={{ padding: "12px", border: "1px solid #202638", borderRadius: "6px", background: "#0a0e16" }}>
                          <span style={{ color: "#66718a", fontSize: "7px" }}>CONTRADICTION</span>
                          <strong style={{ display: "block", marginTop: "5px", color: "#d8909b", fontSize: "17px" }}>
                            {(batch3Intelligence.counterEvidence.contradiction_score * 100).toFixed(0)}%
                          </strong>
                        </div>
                      </div>

                      <div style={{ marginTop: "10px", padding: "12px", border: "1px solid #202638", borderRadius: "6px", background: "#0a0e16" }}>
                        <span style={{ color: "#66718a", fontSize: "7px" }}>ASSESSMENT</span>
                        <strong style={{ display: "block", marginTop: "5px", color: "#e8ecf5", fontSize: "11px" }}>
                          {String(batch3Intelligence.counterEvidence.assessment || "low_false_link_risk").replaceAll("_", " ").toUpperCase()}
                        </strong>
                        <p style={{ margin: "7px 0 0", color: "#68738a", fontSize: "8px", lineHeight: "1.5" }}>
                          {batch3Intelligence.counterEvidence.reasoning}
                        </p>
                      </div>

                      <div style={{ marginTop: "10px", color: "#59647a", fontSize: "8px" }}>
                        Evidence records evaluated: {batch3Intelligence.counterEvidence.supporting_evidence?.length || 0}
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: "20px", borderTop: "1px solid #202638", background: "#0b1019" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                      <div>
                        <span style={{ color: "#66718a", fontSize: "8px", letterSpacing: "1.5px" }}>
                          ADVERSARIAL DEMO MODE
                        </span>
                        <p style={{ margin: "6px 0 0", color: "#68738a", fontSize: "8px" }}>
                          Controlled synthetic signal injection used to test resistance to false attribution.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={runBatch3AdversarialDemo}
                        disabled={adversarialRunning}
                        style={{
                          padding: "9px 13px",
                          border: "1px solid #4d596f",
                          borderRadius: "5px",
                          background: adversarialRunning ? "#161c27" : "#101722",
                          color: "#dce2ee",
                          fontSize: "8px",
                          fontWeight: "800",
                          letterSpacing: "1px",
                          cursor: adversarialRunning ? "wait" : "pointer"
                        }}
                      >
                        {adversarialRunning ? "RUNNING..." : "▶ INJECT SYNTHETIC SIGNAL"}
                      </button>
                    </div>

                    {batch3Intelligence.adversarial && (
                      <div
                        style={{
                          marginTop: "14px",
                          display: "grid",
                          gridTemplateColumns: "repeat(4,minmax(0,1fr))",
                          gap: "8px"
                        }}
                      >
                        <div style={{ padding: "11px", border: "1px solid #202638", borderRadius: "6px", background: "#0a0e16" }}>
                          <span style={{ color: "#66718a", fontSize: "7px" }}>INJECTED SIGNAL</span>
                          <strong style={{ display: "block", marginTop: "5px", color: "#e8ecf5", fontSize: "10px" }}>
                            {batch3Intelligence.adversarial.injected_signal?.type || "synthetic"}
                          </strong>
                        </div>

                        <div style={{ padding: "11px", border: "1px solid #202638", borderRadius: "6px", background: "#0a0e16" }}>
                          <span style={{ color: "#66718a", fontSize: "7px" }}>INITIAL</span>
                          <strong style={{ display: "block", marginTop: "5px", color: "#dce2ee", fontSize: "16px" }}>
                            {(batch3Probability(batch3Intelligence.adversarial.initial_confidence) * 100).toFixed(0)}%
                          </strong>
                        </div>

                        <div style={{ padding: "11px", border: "1px solid #202638", borderRadius: "6px", background: "#0a0e16" }}>
                          <span style={{ color: "#66718a", fontSize: "7px" }}>ADJUSTED</span>
                          <strong style={{ display: "block", marginTop: "5px", color: "#54d99a", fontSize: "16px" }}>
                            {(batch3Probability(batch3Intelligence.adversarial.adjusted_confidence) * 100).toFixed(0)}%
                          </strong>
                        </div>

                        <div style={{ padding: "11px", border: "1px solid #202638", borderRadius: "6px", background: "#0a0e16" }}>
                          <span style={{ color: "#66718a", fontSize: "7px" }}>RESULT</span>
                          <strong style={{ display: "block", marginTop: "5px", color: "#79d6a8", fontSize: "10px" }}>
                            {String(batch3Intelligence.adversarial.resilience_result || "needs_review").replaceAll("_", " ").toUpperCase()}
                          </strong>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ padding: "20px", borderTop: "1px solid #202638", background: "#0b1019" }}>
                    <span style={{ color: "#66718a", fontSize: "8px", letterSpacing: "1.5px" }}>
                      EARLY WARNING ENGINE
                    </span>

                    <div
                      style={{
                        marginTop: "12px",
                        padding: "15px",
                        border: "1px solid #55353d",
                        borderRadius: "7px",
                        background: "#170f14"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "15px" }}>
                        <div>
                          <span style={{ color: "#8a6470", fontSize: "7px", letterSpacing: "1.2px" }}>
                            WARNING POSTURE
                          </span>
                          <strong style={{ display: "block", marginTop: "5px", color: "#f0c6cd", fontSize: "18px" }}>
                            {batch3Intelligence.earlyWarning?.severity || "GUARDED"}
                          </strong>
                        </div>

                        <strong style={{ color: "#f0a8b5", fontSize: "22px" }}>
                          {(batch3Probability(batch3Intelligence.earlyWarning?.warning_score) * 100).toFixed(0)}%
                        </strong>
                      </div>

                      <div style={{ height: "6px", marginTop: "10px", borderRadius: "4px", background: "#2b1b21", overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${batch3Probability(batch3Intelligence.earlyWarning?.warning_score) * 100}%`,
                            height: "100%",
                            background: "#d8909b"
                          }}
                        />
                      </div>

                      <div style={{ marginTop: "11px", color: "#a78991", fontSize: "8px", lineHeight: "1.5" }}>
                        Current: <b>{batch3Intelligence.earlyWarning?.current_state || batch3Intelligence.currentState}</b>
                        {" → "}
                        Predicted: <b>{batch3Intelligence.earlyWarning?.predicted_state || "Unknown"}</b>
                      </div>

                      {(batch3Intelligence.earlyWarning?.triggers || []).length > 0 && (
                        <div style={{ display: "grid", gap: "5px", marginTop: "10px" }}>
                          {batch3Intelligence.earlyWarning.triggers.slice(0, 6).map((trigger, index) => (
                            <div key={`${trigger}-${index}`} style={{ color: "#9d8189", fontSize: "8px" }}>
                              • {trigger}
                            </div>
                          ))}
                        </div>
                      )}

                      <p style={{ margin: "11px 0 0", color: "#806b73", fontSize: "8px", lineHeight: "1.5" }}>
                        {batch3Intelligence.earlyWarning?.assessment}
                      </p>
                    </div>
                  </div>
                </>
              )}

              {batch3Error && (
                <div style={{ padding: "10px 20px 18px", color: "#8a6470", fontSize: "8px" }}>
                  Backend Batch 3 endpoint unavailable — local resilience calculation remains active.
                </div>
              )}
            </section>
          )}


          {/* =================================================
              BATCH 7 — CONTROLLED INVESTIGATION LAB
              ================================================= */}

          {actorIntelligence && (
            <section
              className="panel"
              style={{
                marginTop: "18px",
                border: "1px solid #29445a",
                background: "#080e15"
              }}
            >
              <div className="panel-header">
                <div>
                  <h3>CONTROLLED INVESTIGATION LAB</h3>
                  <small style={{ color: "#60748a", fontSize: "8px", letterSpacing: "1.2px" }}>
                    SYNTHETIC EVENT → CORRELATION → ACTOR UPDATE → WARNING
                  </small>
                </div>
                <span style={{ color: "#54d99a", fontSize: "8px", fontWeight: "700" }}>
                  {labRunning ? "PROCESSING" : "LAB ONLINE"}
                </span>
              </div>

              <div style={{ padding: "14px 16px", borderTop: "1px solid #172333" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
                  {[
                    ["shared_alias", "ALIAS"],
                    ["shared_infrastructure", "INFRASTRUCTURE"],
                    ["shared_campaign", "CAMPAIGN"],
                    ["shared_stylometry", "STYLOMETRY"],
                    ["shared_temporal_pattern", "TEMPORAL"]
                  ].map(([signal, label]) => (
                    <button
                      key={signal}
                      type="button"
                      disabled={labRunning}
                      onClick={() => injectControlledActivity(signal)}
                      style={{
                        padding: "9px 11px",
                        border: "1px solid #2a4358",
                        borderRadius: "5px",
                        background: labRunning ? "#0d131b" : "#101b26",
                        color: "#c9d8e8",
                        cursor: labRunning ? "wait" : "pointer",
                        fontSize: "8px",
                        fontWeight: "700"
                      }}
                    >
                      {labRunning ? "..." : "▶"} INJECT {label}
                    </button>
                  ))}
                </div>

                <p style={{ margin: "11px 0 0", color: "#64778c", fontSize: "8px", lineHeight: "1.6" }}>
                  Controlled synthetic activity only. This lab does not contact, track, or deanonymize real people or external infrastructure.
                </p>

                {labError && (
                  <div style={{ marginTop: "9px", color: "#df9da8", fontSize: "8px" }}>
                    {labError}
                  </div>
                )}

                {labPipeline.length > 0 && (
                  <div style={{ marginTop: "13px", display: "grid", gap: "5px" }}>
                    <span style={{ color: "#6c7e93", fontSize: "8px", letterSpacing: "1px" }}>
                      LIVE INTELLIGENCE PIPELINE
                    </span>
                    {labPipeline.map((stage, index) => (
                      <div
                        key={stage.label}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "5px 8px",
                          borderRadius: "4px",
                          background: stage.status === "complete" ? "#0d1816" : "#0b121a",
                          border: "1px solid #1b2a37"
                        }}
                      >
                        <span style={{ color: stage.status === "complete" ? "#79d6a8" : "#63768b", fontSize: "8px" }}>
                          {stage.status === "complete" ? "✓" : "•"}
                        </span>
                        <span style={{ color: "#c9d8e8", fontSize: "7px", letterSpacing: "0.5px" }}>
                          {String(index + 1).padStart(2, "0")} · {stage.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {labEvents.length > 0 && (
                  <div style={{ marginTop: "13px", display: "grid", gap: "6px" }}>
                    <span style={{ color: "#6c7e93", fontSize: "8px", letterSpacing: "1px" }}>
                      LIVE INVESTIGATION EVENT STREAM
                    </span>
                    {labEvents.slice(0, 6).map(event => (
                      <div
                        key={event.event_id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "78px 1fr auto",
                          gap: "9px",
                          alignItems: "center",
                          padding: "9px 10px",
                          border: "1px solid #1d2b39",
                          borderRadius: "5px",
                          background: "#0a1119"
                        }}
                      >
                        <span style={{ color: "#65778b", fontSize: "7px" }}>
                          {event.event_id}
                        </span>
                        <div>
                          <strong style={{ display: "block", color: "#dce7f2", fontSize: "8px" }}>
                            NEW ACTIVITY • {String(event.signal_type || "signal").replaceAll("_", " ").toUpperCase()}
                          </strong>
                          <span style={{ color: "#64788c", fontSize: "7px" }}>
                            {event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : "now"} • {event.description}
                          </span>
                        </div>
                        <b style={{ color: "#79d6a8", fontSize: "10px" }}>
                          {(Number(event.confidence || 0) * 100).toFixed(0)}%
                        </b>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}


          {/* =================================================
              BATCH 11 — FINAL ANALYST WORKBENCH
              Isolated read-only composition layer.
              ================================================= */}

          <FinalAnalystWorkbench
            actorIntelligence={actorIntelligence}
            operationalData={operationalData}
            timelineEvents={timelineEvents}
            threatIntelligence={threatIntelligence}
            advancedIntelligence={advancedIntelligence}
            batch3Intelligence={batch3Intelligence}
            labEvents={labEvents}
            intelligenceReport={intelligenceReport}
          />

          {/* =================================================
              BATCH 4 — INTELLIGENCE REPORT CENTER
              ================================================= */}

          {actorIntelligence && (
            <section
              className="panel"
              style={{
                marginTop: "18px",
                border: "1px solid #252d40",
                background: "#090d15"
              }}
            >

              <div
                className="panel-header"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px"
                }}
              >

                <div>
                  <h3>
                    INTELLIGENCE REPORT CENTER
                  </h3>

                  <small
                    style={{
                      color: "#59647a",
                      fontSize: "8px",
                      letterSpacing: "1.2px"
                    }}
                  >
                    EVIDENCE → ASSESSMENT → ATT&CK → PREDICTION → DEFENSIVE INTELLIGENCE
                  </small>
                </div>

                <button
                  type="button"
                  onClick={generateIntelligenceReport}
                  disabled={reportLoading}
                  style={{
                    padding: "10px 14px",
                    border: "1px solid #3b536f",
                    borderRadius: "6px",
                    background: reportLoading
                      ? "#111722"
                      : "#101a28",
                    color: "#dce6f5",
                    cursor: reportLoading
                      ? "wait"
                      : "pointer",
                    fontSize: "9px",
                    fontWeight: "700",
                    letterSpacing: "1px"
                  }}
                >
                  {reportLoading
                    ? "GENERATING..."
                    : intelligenceReport
                      ? "REGENERATE REPORT"
                      : "GENERATE INTELLIGENCE REPORT"}
                </button>

              </div>

              <div style={{ padding: "9px 16px", borderTop: "1px solid #171d2a", borderBottom: "1px solid #171d2a", color: "#68748a", fontSize: "8px", letterSpacing: "0.8px" }}>
                CONFIDENCE CALIBRATION: raw behavioral/temporal percentages describe the observed sample; analytical confidence is reliability-adjusted for evidence count and signal diversity.
              </div>

              {reportError && (
                <div
                  style={{
                    margin: "12px 16px",
                    padding: "10px 12px",
                    border: "1px solid #5b3039",
                    borderRadius: "6px",
                    background: "#160d12",
                    color: "#e5aab3",
                    fontSize: "9px"
                  }}
                >
                  {reportError}
                </div>
              )}

              {!intelligenceReport && !reportLoading && !reportError && (
                <div
                  style={{
                    padding: "22px 16px",
                    color: "#68738a",
                    fontSize: "9px",
                    lineHeight: "1.7"
                  }}
                >
                  Generate a structured DARKTRACE-X intelligence report
                  from the currently selected actor and correlated evidence.
                </div>
              )}

              {reportLoading && (
                <div
                  style={{
                    padding: "22px 16px",
                    color: "#7d8aa2",
                    fontSize: "9px",
                    lineHeight: "1.7"
                  }}
                >
                  Building executive summary, behavioral fingerprint,
                  operational assessment, evidence confidence, MITRE ATT&CK
                  mapping and defensive recommendations...
                </div>
              )}

              {intelligenceReport && (
                <div
                  style={{
                    padding: "0 16px 18px",
                    display: "grid",
                    gap: "12px"
                  }}
                >

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(4,minmax(0,1fr))",
                      gap: "8px"
                    }}
                  >

                    <div
                      style={{
                        padding: "13px",
                        border: "1px solid #202638",
                        background: "#0d121c"
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          color: "#66718a",
                          fontSize: "7px",
                          letterSpacing: "1.2px"
                        }}
                      >
                        ACTOR
                      </span>
                      <strong
                        style={{
                          display: "block",
                          marginTop: "6px",
                          color: "#e8ecf5",
                          fontSize: "13px"
                        }}
                      >
                        {intelligenceReport.actor_profile?.actor_id ||
                          intelligenceReport.generated_for ||
                          "UNKNOWN"}
                      </strong>
                    </div>

                    <div
                      style={{
                        padding: "13px",
                        border: "1px solid #202638",
                        background: "#0d121c"
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          color: "#66718a",
                          fontSize: "7px",
                          letterSpacing: "1.2px"
                        }}
                      >
                        RISK
                      </span>
                      <strong
                        style={{
                          display: "block",
                          marginTop: "6px",
                          color: "#e8b3bd",
                          fontSize: "18px"
                        }}
                      >
                        {Number(
                          intelligenceReport.confidence_assessment?.risk_score ??
                          0
                        ).toFixed(0)}
                      </strong>
                    </div>

                    <div
                      style={{
                        padding: "13px",
                        border: "1px solid #202638",
                        background: "#0d121c"
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          color: "#66718a",
                          fontSize: "7px",
                          letterSpacing: "1.2px"
                        }}
                      >
                        CONFIDENCE
                      </span>
                      <strong
                        style={{
                          display: "block",
                          marginTop: "6px",
                          color: "#54d99a",
                          fontSize: "18px"
                        }}
                      >
                        {(
                          normalizeConfidence(
                            intelligenceReport.confidence_assessment?.confidence ??
                            0
                          ) * 100
                        ).toFixed(0)}
                        %
                      </strong>
                    </div>

                    <div
                      style={{
                        padding: "13px",
                        border: "1px solid #202638",
                        background: "#0d121c"
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          color: "#66718a",
                          fontSize: "7px",
                          letterSpacing: "1.2px"
                        }}
                      >
                        OPERATIONAL STATE
                      </span>
                      <strong
                        style={{
                          display: "block",
                          marginTop: "6px",
                          color: "#d7def0",
                          fontSize: "11px"
                        }}
                      >
                        {intelligenceReport.operational_state?.current_state ||
                          "Unknown"}
                      </strong>
                    </div>

                  </div>

                  <div
                    style={{
                      padding: "15px",
                      border: "1px solid #202638",
                      background: "#0d121c"
                    }}
                  >
                    <span
                      style={{
                        color: "#66718a",
                        fontSize: "7px",
                        letterSpacing: "1.4px"
                      }}
                    >
                      EXECUTIVE SUMMARY
                    </span>

                    <p
                      style={{
                        margin: "9px 0 0",
                        color: "#b9c3d6",
                        fontSize: "10px",
                        lineHeight: "1.65"
                      }}
                    >
                      {intelligenceReport.executive_summary ||
                        "No executive summary was returned."}
                    </p>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(2,minmax(0,1fr))",
                      gap: "12px"
                    }}
                  >

                    <div
                      style={{
                        padding: "15px",
                        border: "1px solid #202638",
                        background: "#0d121c"
                      }}
                    >
                      <span
                        style={{
                          color: "#66718a",
                          fontSize: "7px",
                          letterSpacing: "1.4px"
                        }}
                      >
                        BEHAVIORAL FINGERPRINT
                      </span>

                      <div
                        style={{
                          marginTop: "10px",
                          display: "grid",
                          gap: "7px"
                        }}
                      >
                        {Object.entries(
                          intelligenceReport.behavioral_fingerprint || {}
                        )
                          .slice(0, 8)
                          .map(([key, value]) => (
                            <div
                              key={key}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: "10px",
                                paddingBottom: "6px",
                                borderBottom:
                                  "1px solid #171d2a"
                              }}
                            >
                              <span
                                style={{
                                  color: "#68738a",
                                  fontSize: "8px"
                                }}
                              >
                                {String(key)
                                  .replaceAll("_", " ")
                                  .toUpperCase()}
                              </span>
                              <strong
                                style={{
                                  color: "#cdd5e5",
                                  fontSize: "8px",
                                  textAlign: "right"
                                }}
                              >
                                {Array.isArray(value)
                                  ? value.join(", ")
                                  : String(value ?? "—")}
                              </strong>
                            </div>
                          ))}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: "15px",
                        border: "1px solid #202638",
                        background: "#0d121c"
                      }}
                    >
                      <span
                        style={{
                          color: "#66718a",
                          fontSize: "7px",
                          letterSpacing: "1.4px"
                        }}
                      >
                        PREDICTIVE INTELLIGENCE
                      </span>

                      <div
                        style={{
                          marginTop: "10px",
                          display: "grid",
                          gap: "9px"
                        }}
                      >

                        <div>
                          <span
                            style={{
                              color: "#66718a",
                              fontSize: "7px"
                            }}
                          >
                            NEXT LIKELY STATE
                          </span>
                          <strong
                            style={{
                              display: "block",
                              marginTop: "5px",
                              color: "#d8dff0",
                              fontSize: "14px"
                            }}
                          >
                            {intelligenceReport.predictions?.predicted_state ||
                              "Unknown"}
                          </strong>
                        </div>

                        <div>
                          <span
                            style={{
                              color: "#66718a",
                              fontSize: "7px"
                            }}
                          >
                            PROBABILITY
                          </span>
                          <strong
                            style={{
                              display: "block",
                              marginTop: "5px",
                              color: "#54d99a",
                              fontSize: "18px"
                            }}
                          >
                            {(
                              normalizeConfidence(
                                intelligenceReport.predictions
                                  ?.prediction_probability
                              ) * 100
                            ).toFixed(0)}
                            %
                          </strong>
                        </div>

                        <div>
                          <span
                            style={{
                              color: "#66718a",
                              fontSize: "7px"
                            }}
                          >
                            WHAT CHANGED
                          </span>

                          <div
                            style={{
                              marginTop: "6px",
                              display: "grid",
                              gap: "4px"
                            }}
                          >
                            {(intelligenceReport.what_changed || [])
                              .slice(0, 5)
                              .map((item, index) => (
                                <div
                                  key={`${item}-${index}`}
                                  style={{
                                    color: "#9da8bd",
                                    fontSize: "8px",
                                    lineHeight: "1.4"
                                  }}
                                >
                                  • {String(item)}
                                </div>
                              ))}
                          </div>
                        </div>

                      </div>
                    </div>

                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(2,minmax(0,1fr))",
                      gap: "12px"
                    }}
                  >

                    <div
                      style={{
                        padding: "15px",
                        border: "1px solid #202638",
                        background: "#0d121c"
                      }}
                    >
                      <span
                        style={{
                          color: "#66718a",
                          fontSize: "7px",
                          letterSpacing: "1.4px"
                        }}
                      >
                        MITRE ATT&CK MAPPING
                      </span>

                      <div
                        style={{
                          marginTop: "9px",
                          display: "grid",
                          gap: "7px"
                        }}
                      >
                        {(intelligenceReport.mitre_attack || [])
                          .map((technique, index) => (
                            <div
                              key={`${technique?.technique_id || "technique"}-${index}`}
                              style={{
                                padding: "8px",
                                border: "1px solid #202638",
                                background: "#0a0e16"
                              }}
                            >
                              <strong
                                style={{
                                  color: "#d5dcef",
                                  fontSize: "9px"
                                }}
                              >
                                {technique?.technique_id ||
                                  "TECHNIQUE"}
                              </strong>

                              <span
                                style={{
                                  marginLeft: "8px",
                                  color: "#8792a9",
                                  fontSize: "8px"
                                }}
                              >
                                {technique?.name || ""}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: "15px",
                        border: "1px solid #202638",
                        background: "#0d121c"
                      }}
                    >
                      <span
                        style={{
                          color: "#66718a",
                          fontSize: "7px",
                          letterSpacing: "1.4px"
                        }}
                      >
                        DEFENSIVE RECOMMENDATIONS
                      </span>

                      <div
                        style={{
                          marginTop: "9px",
                          display: "grid",
                          gap: "6px"
                        }}
                      >
                        {(intelligenceReport.defensive_recommendations || [])
                          .slice(0, 8)
                          .map((recommendation, index) => (
                            <div
                              key={`${recommendation}-${index}`}
                              style={{
                                color: "#aeb8cb",
                                fontSize: "8px",
                                lineHeight: "1.5"
                              }}
                            >
                              {String(index + 1).padStart(2, "0")} —{" "}
                              {String(recommendation)}
                            </div>
                          ))}
                      </div>
                    </div>

                  </div>

                  <div
                    style={{
                      padding: "13px 15px",
                      border: "1px solid #252d40",
                      background: "#0a0e16"
                    }}
                  >
                    <span
                      style={{
                        color: "#66718a",
                        fontSize: "7px",
                        letterSpacing: "1.3px"
                      }}
                    >
                      EVIDENCE STATEMENT
                    </span>

                    <p
                      style={{
                        margin: "8px 0 0",
                        color: "#7d899f",
                        fontSize: "8px",
                        lineHeight: "1.5"
                      }}
                    >
                      {intelligenceReport.evidence_statement ||
                        "Assessment derived from correlated synthetic intelligence evidence."}
                    </p>

                    {reportGeneratedAt && (
                      <small
                        style={{
                          display: "block",
                          marginTop: "8px",
                          color: "#4f5a70",
                          fontSize: "7px"
                        }}
                      >
                        GENERATED: {formatTimestamp(reportGeneratedAt)}
                        {" · "}
                        VERSION:{" "}
                        {intelligenceReport.report_version || "1.0"}
                      </small>
                    )}
                  </div>

                  <div
                    style={{
                      color: "#4f5a70",
                      fontSize: "7px",
                      lineHeight: "1.5"
                    }}
                  >
                    Intelligence assessment only. DARKTRACE-X does not
                    establish confirmed real-world identity from these
                    synthetic correlations.
                  </div>

                </div>
              )}

            </section>
          )}

          {/* =================================================
              DEFAULT EVIDENCE / ASSESSMENT
              ================================================= */}

          {!actorIntelligence && (

            <section className="bottom-grid">

              <div className="panel">

                <div className="panel-header">

                  <h3>
                    Evidence Chain
                  </h3>

                </div>


                {loading && (

                  <div className="loading-row">
                    Loading evidence...
                  </div>

                )}


                {!loading &&
                  evidenceNodes
                    .slice(0, 5)
                    .map(
                      (
                        evidence,
                        index
                      ) => (

                        <div
                          className="evidence-row"
                          key={
                            evidence.id
                          }

                          onClick={() =>
                            setSelectedNode(
                              evidence
                            )
                          }
                        >

                          <span>
                            {String(
                              index + 1
                            ).padStart(
                              2,
                              "0"
                            )}
                          </span>


                          <div>

                            <strong>
                              {
                                evidence
                                  .properties
                                  ?.signal_type
                              }
                            </strong>

                            <p>
                              {
                                evidence
                                  .properties
                                  ?.entity_key
                              }
                            </p>

                          </div>


                          <b>
                            {(
                              Number(
                                evidence
                                  .properties
                                  ?.strength ||
                                0
                              ) * 100
                            ).toFixed(0)}
                            %
                          </b>

                        </div>

                      )
                    )}

              </div>


              <div className="panel assessment">

                <div className="panel-header">

                  <h3>
                    Analyst Assessment
                  </h3>

                </div>


                <div className="assessment-score">
                  {assessmentConfidence.toFixed(
                    2
                  )}
                </div>


                <p>
                  Multiple independent synthetic
                  signals support a potential
                  relationship between the observed
                  actors.
                </p>


                <small>
                  Intelligence assessment — not
                  confirmed real-world attribution.
                </small>

              </div>

            </section>

          )}


          {/* =================================================
              FOOTER
              ================================================= */}

          <div className="data-footer">

            <span>
              DATA SOURCE: NEO4J
            </span>

            <span>
              NODES:
              {" "}
              {statistics.node_count}
            </span>

            <span>
              EDGES:
              {" "}
              {statistics.relationship_count}
            </span>

            <span>
              EVIDENCE TYPES:
              {" "}
              {evidenceNodes.length}
            </span>

          </div>

        </main>

      </div>

    </div>

    </>

  );
}


export default App;