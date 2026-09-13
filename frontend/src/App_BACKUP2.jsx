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

const API_URL = "http://127.0.0.1:8000";


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
  let number =
    Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  if (number > 1) {
    number =
      number / 100;
  }

  return clamp(number);
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
     BATCH 3 — ADVANCED AI / RESILIENCE STATE
     ===================================================== */

  const [resilienceData, setResilienceData] = useState({
    whatIf: null,
    counterEvidence: null,
    adversarial: null,
    earlyWarning: null
  });

  const [resilienceLoading, setResilienceLoading] = useState(false);
  const [resilienceError, setResilienceError] = useState("");
  const [adversarialRunning, setAdversarialRunning] = useState(false);


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
            `${API_URL}/graph/evidence`
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


        setOperationalData(
          normalizeOperationalResponse(
            operationalJson
          )
        );


        setTimelineEvents(
          normalizeTimelineEvents(
            replayJson
          )
        );

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

        setOperationalData(null);

        setTimelineEvents([]);

      }

      finally {

        setOperationalLoading(false);

      }

    }


    loadOperationalIntelligence();

  }, [selectedNode]);


  /* =====================================================
     BATCH 3 — PREDICTIVE RESILIENCE ENGINE
     ===================================================== */

  useEffect(() => {
    if (!actorIntelligence || !threatIntelligence) {
      setResilienceData({ whatIf: null, counterEvidence: null, adversarial: null, earlyWarning: null });
      setResilienceError("");
      return;
    }

    const currentState = operationalData?.currentState ||
      investigationData.digitalTwin?.current_state || "Preparation";
    const stateConfidence = Number(
      operationalData?.stateConfidence ??
      investigationData.digitalTwin?.state_confidence ?? 0.74
    );
    const riskScore = Number(threatIntelligence.riskScore ?? investigationData.digitalTwin?.risk_score ?? 0);
    const prediction = threatIntelligence.prediction || {};
    const predictedState = prediction.predictedState || "Operational Activity";
    const predictionProbability = Number(prediction.probability ?? 0.8);
    const campaignConfidence = investigationData.campaigns?.length
      ? Math.max(...investigationData.campaigns.map(c => Number(c?.confidence || 0)))
      : 0;
    const changeCount = Number(threatIntelligence.changeCount || 0);
    const baseConfidence = Number(
      resilienceData.counterEvidence?.base_confidence ??
      advancedIntelligence?.resolution?.fusion_score ??
      advancedIntelligence?.resolution?.confidence ??
      investigationData.digitalTwin?.confidence ?? 0.75
    );

    async function postJson(path, body) {
      const response = await fetch(`${API_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error(`${path} returned ${response.status}`);
      return response.json();
    }

    async function loadResilience() {
      try {
        setResilienceLoading(true);
        setResilienceError("");

        const supporting = [
          { type: "alias_overlap", confidence: 0.95, explanation: "Alias overlap across synthetic observations." },
          { type: "infrastructure_overlap", confidence: 0.90, explanation: "Shared synthetic infrastructure fingerprint." },
          { type: "campaign_overlap", confidence: campaignConfidence || 0.88, explanation: "Emerging campaign context links the activity." },
          { type: "behavioral_similarity", confidence: 0.82, explanation: "Behavioral fingerprint is consistent with the actor profile." }
        ];
        const contradictory = [
          ...(advancedIntelligence?.resolution?.counter_evidence || []).map(item => ({
            type: item?.type || "resolution_counter_evidence",
            confidence: Number(item?.confidence ?? 0.55),
            explanation: item?.explanation || "Contradictory resolution signal."
          })),
          ...(advancedIntelligence?.temporal?.mismatches || []).slice(0, 2).map(item => ({
            type: "temporal_mismatch",
            confidence: Number(item?.confidence ?? 0.62),
            explanation: String(item?.explanation || item)
          }))
        ];

        const [whatIf, counterEvidence, earlyWarning] = await Promise.all([
          postJson("/advanced-ai/what-if", {
            current_state: currentState,
            risk_score: riskScore,
            state_confidence: stateConfidence,
            campaign_confidence: campaignConfidence,
            change_count: changeCount
          }),
          postJson("/advanced-ai/counter-evidence", {
            supporting_evidence: supporting,
            contradictory_evidence: contradictory,
            base_confidence: baseConfidence
          }),
          postJson("/advanced-ai/early-warning", {
            risk_score: riskScore,
            current_state: currentState,
            predicted_state: predictedState,
            prediction_probability: predictionProbability,
            change_count: changeCount,
            campaign_confidence: campaignConfidence,
            adjusted_confidence: baseConfidence,
            false_link_risk: 0
          })
        ]);

        setResilienceData(prev => ({
          ...prev,
          whatIf,
          counterEvidence,
          earlyWarning
        }));
      } catch (err) {
        console.error("DARKTRACE-X Batch 3 error:", err);
        setResilienceError(err.message || "Unable to load predictive resilience intelligence.");
      } finally {
        setResilienceLoading(false);
      }
    }

    loadResilience();
  }, [
    actorIntelligence,
    threatIntelligence,
    operationalData,
    investigationData,
    advancedIntelligence
  ]);

  async function runAdversarialDemo() {
    try {
      setAdversarialRunning(true);
      setResilienceError("");
      const baseConfidence = Number(
        resilienceData.counterEvidence?.adjusted_confidence ??
        advancedIntelligence?.resolution?.fusion_score ??
        investigationData.digitalTwin?.confidence ?? 0.75
      );
      const result = await fetch(`${API_URL}/advanced-ai/adversarial-demo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base_confidence: baseConfidence,
          injected_signal: "shared_infrastructure",
          counter_evidence: [
            { type: "stylometry_mismatch", confidence: 0.86, explanation: "Writing-style fingerprint conflicts with the target actor." },
            { type: "temporal_mismatch", confidence: 0.78, explanation: "Activity timing conflicts with the established actor pattern." }
          ]
        })
      });
      if (!result.ok) throw new Error(`Adversarial Demo API returned ${result.status}`);
      const json = await result.json();
      setResilienceData(prev => ({ ...prev, adversarial: json }));
    } catch (err) {
      console.error("DARKTRACE-X adversarial demo error:", err);
      setResilienceError(err.message || "Adversarial demo failed.");
    } finally {
      setAdversarialRunning(false);
    }
  }

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

        nodes:
          graph.nodes.map(
            node => ({
              ...node,
              nodeId: node.id
            })
          ),


        links:
          graph.relationships.map(
            relationship => ({
              source:
                relationship.source,

              target:
                relationship.target,

              relationship:
                relationship.relationship,

              properties:
                relationship.properties ||
                {}
            })
          )

      };

    }, [graph]);


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


      const connectedEvidence =
        connectedNodes.filter(
          node =>
            node.type ===
            "evidence"
        );


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
      graph
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

    const riskScore =
      actorId === "actor_alpha_001"
        ? 78
        : Math.round(
            clamp(
              actorIntelligence.relationshipConfidence || 0
            ) * 100
          );

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

        setAdvancedIntelligence({
          actorId: String(actorId),
          behavioral:
            behavioralJson?.fingerprint || null,
          temporal:
            temporalJson?.fingerprint || null,
          infrastructure:
            infrastructureJson?.fingerprint || null,
          blockchain:
            blockchainJson?.fingerprint || null,
          resolution:
            resolutionJson || null,
          connectedActor:
            connectedActor?.properties?.id ||
            connectedActor?.id ||
            null
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
                            ENTITY RESOLUTION
                          </span>

                          <strong
                            style={{
                              display: "block",
                              marginTop: "7px",
                              color: "#e8ecf5",
                              fontSize: "19px"
                            }}
                          >
                            {advancedIntelligence.resolution
                              ? advancedPercent(
                                  advancedIntelligence.resolution.confidence
                                )
                              : "NO COMPARISON"}
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
              BATCH 3 — PREDICTIVE RESILIENCE CENTER
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
              <div style={{ padding: "20px", borderBottom: "1px solid #202638", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "15px" }}>
                <div>
                  <span className="eyebrow">PREDICTIVE RESILIENCE CENTER</span>
                  <h2 style={{ margin: "7px 0 4px", fontSize: "20px" }}>What if the evidence is misleading?</h2>
                  <p style={{ margin: 0, color: "#68738a", fontSize: "10px" }}>
                    New Signal → Correlation → Supporting Evidence → Counter-Evidence → Confidence → What-If → Warning
                  </p>
                </div>
                <span className="live-label">{resilienceLoading ? "CALCULATING" : "RESILIENCE ONLINE"}</span>
              </div>

              {resilienceError && (
                <div style={{ margin: "16px", padding: "12px", border: "1px solid #55353d", borderRadius: "7px", background: "#1b1115", color: "#d8909b", fontSize: "10px" }}>
                  ⚠ {resilienceError}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "1px", background: "#202638" }}>
                <div style={{ padding: "18px", background: "#0d121c" }}>
                  <span style={{ color: "#66718a", fontSize: "8px", letterSpacing: "1.5px" }}>WHAT-IF SIMULATOR</span>
                  <div style={{ marginTop: "12px", display: "grid", gap: "8px" }}>
                    {(resilienceData.whatIf?.scenarios || []).map((scenario, index) => (
                      <div key={`${scenario.state}-${index}`} style={{ padding: "11px", border: "1px solid #202638", borderRadius: "6px", background: "#0a0e16" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                          <strong style={{ color: "#c4ccda", fontSize: "10px" }}>{scenario.state}</strong>
                          <span style={{ color: "#54d99a", fontSize: "9px", fontWeight: "800" }}>{advancedPercent(scenario.probability)}</span>
                        </div>
                        <p style={{ margin: "7px 0 0", color: "#68738a", fontSize: "8px", lineHeight: "1.5" }}>{scenario.reasoning}</p>
                      </div>
                    ))}
                    {!resilienceData.whatIf && !resilienceLoading && <div style={{ color: "#59647a", fontSize: "9px" }}>Waiting for threat prediction context.</div>}
                  </div>
                </div>

                <div style={{ padding: "18px", background: "#0d121c" }}>
                  <span style={{ color: "#66718a", fontSize: "8px", letterSpacing: "1.5px" }}>COUNTER-EVIDENCE / FALSE-LINK DETECTION</span>
                  {resilienceData.counterEvidence ? (
                    <>
                      <div style={{ marginTop: "12px", display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "7px" }}>
                        {advancedMetric("BASE", advancedPercent(resilienceData.counterEvidence.base_confidence))}
                        {advancedMetric("ADJUSTED", advancedPercent(resilienceData.counterEvidence.adjusted_confidence))}
                        {advancedMetric("FALSE-LINK", advancedPercent(resilienceData.counterEvidence.false_link_risk))}
                      </div>
                      <div style={{ marginTop: "12px", color: "#a794e8", fontSize: "9px", fontWeight: "800" }}>
                        {String(resilienceData.counterEvidence.assessment || "review_required").replaceAll("_", " ").toUpperCase()}
                      </div>
                      <p style={{ margin: "8px 0 0", color: "#68738a", fontSize: "8px", lineHeight: "1.5" }}>{resilienceData.counterEvidence.reasoning}</p>
                      <div style={{ marginTop: "10px", color: "#59647a", fontSize: "8px" }}>
                        SUPPORT: {resilienceData.counterEvidence.supporting_evidence?.length || 0} · CONTRADICTION: {resilienceData.counterEvidence.contradictory_evidence?.length || 0}
                      </div>
                    </>
                  ) : <div style={{ marginTop: "12px", color: "#59647a", fontSize: "9px" }}>Waiting for independent evidence assessment.</div>}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "1px", background: "#202638", borderTop: "1px solid #202638" }}>
                <div style={{ padding: "18px", background: "#0d121c" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
                    <div>
                      <span style={{ color: "#66718a", fontSize: "8px", letterSpacing: "1.5px" }}>ADVERSARIAL DEMO MODE</span>
                      <div style={{ marginTop: "6px", color: "#c4ccda", fontSize: "11px", fontWeight: "800" }}>Can DARKTRACE-X resist a misleading signal?</div>
                    </div>
                    <button type="button" onClick={runAdversarialDemo} disabled={adversarialRunning} style={{ border: "1px solid #4ea1ff", background: "#0b1523", color: "#8dc4ff", borderRadius: "5px", padding: "8px 11px", cursor: adversarialRunning ? "wait" : "pointer", fontSize: "8px", fontWeight: "800" }}>
                      {adversarialRunning ? "RUNNING..." : "▶ INJECT SYNTHETIC SIGNAL"}
                    </button>
                  </div>
                  {resilienceData.adversarial && (
                    <div style={{ marginTop: "12px", padding: "12px", border: "1px solid #202638", borderRadius: "6px", background: "#0a0e16" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                        <span style={{ color: "#68738a", fontSize: "8px" }}>INJECTED: {resilienceData.adversarial.injected_signal?.type}</span>
                        <strong style={{ color: "#54d99a", fontSize: "9px" }}>{String(resilienceData.adversarial.resilience_result || "").replaceAll("_", " ").toUpperCase()}</strong>
                      </div>
                      <div style={{ marginTop: "9px", color: "#c4ccda", fontSize: "10px" }}>
                        Confidence {advancedPercent(resilienceData.adversarial.initial_confidence)} → {advancedPercent(resilienceData.adversarial.adjusted_confidence)}
                      </div>
                      <div style={{ marginTop: "5px", color: "#68738a", fontSize: "8px" }}>False-link risk: {advancedPercent(resilienceData.adversarial.false_link_risk)}</div>
                    </div>
                  )}
                  <p style={{ margin: "10px 0 0", color: "#59647a", fontSize: "8px", lineHeight: "1.5" }}>Controlled synthetic resilience test. It does not contact or track real people or infrastructure.</p>
                </div>

                <div style={{ padding: "18px", background: "#0d121c" }}>
                  <span style={{ color: "#66718a", fontSize: "8px", letterSpacing: "1.5px" }}>EARLY WARNING ENGINE</span>
                  {resilienceData.earlyWarning ? (
                    <>
                      <div style={{ marginTop: "10px", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "10px" }}>
                        <strong style={{ color: "#e8ecf5", fontSize: "22px" }}>{resilienceData.earlyWarning.severity}</strong>
                        <span style={{ color: "#54d99a", fontSize: "11px", fontWeight: "800" }}>{advancedPercent(resilienceData.earlyWarning.warning_score)}</span>
                      </div>
                      <div style={{ marginTop: "6px", color: "#68738a", fontSize: "8px" }}>
                        {resilienceData.earlyWarning.current_state} → {resilienceData.earlyWarning.predicted_state}
                      </div>
                      <div style={{ marginTop: "10px", display: "flex", flexWrap: "wrap", gap: "5px" }}>
                        {(resilienceData.earlyWarning.triggers || []).map((trigger, index) => (
                          <span key={index} style={{ padding: "5px 7px", border: "1px solid #202638", borderRadius: "4px", color: "#8d98ad", fontSize: "7px" }}>{trigger}</span>
                        ))}
                      </div>
                      <p style={{ margin: "10px 0 0", color: "#68738a", fontSize: "8px", lineHeight: "1.5" }}>{resilienceData.earlyWarning.assessment}</p>
                    </>
                  ) : <div style={{ marginTop: "12px", color: "#59647a", fontSize: "9px" }}>Waiting for predictive context.</div>}
                </div>
              </div>

              <div style={{ padding: "11px 18px", borderTop: "1px solid #202638", color: "#59647a", fontSize: "8px", lineHeight: "1.6" }}>
                Intelligence assessment only. Counter-evidence reduces false attribution risk; predictions are probabilistic and intended for defensive decision support.
              </div>
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

  );
}


export default App;