from __future__ import annotations
from typing import Any, Dict, List
from collections import Counter
from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/intelligence", tags=["Intelligence Enrichment"])

class TextRequest(BaseModel):
    texts: List[str] = Field(default_factory=list)
class TemporalRequest(BaseModel):
    timestamps: List[str] = Field(default_factory=list)
class InfrastructureRequest(BaseModel):
    infrastructure: List[str] = Field(default_factory=list)
    domains: List[str] = Field(default_factory=list)
    servers: List[str] = Field(default_factory=list)
    certificates: List[str] = Field(default_factory=list)
class WalletRequest(BaseModel):
    wallet_id: str | None = None
    transactions: List[Dict[str, Any]] = Field(default_factory=list)
class ActorPairRequest(BaseModel):
    actor_a: Dict[str, Any] = Field(default_factory=dict)
    actor_b: Dict[str, Any] = Field(default_factory=dict)
    computed_signals: Dict[str, Any] = Field(default_factory=dict)

def _tokens(texts):
    words=[]
    for text in texts:
        words.extend(str(text).lower().split())
    return words

@router.post("/behavioral/fingerprint")
def behavioral(req: TextRequest):
    words=_tokens(req.texts); counts=Counter(words)
    unique=len(set(words)); total=len(words)
    avg=sum(len(w) for w in words)/total if total else 0
    return {"status":"behavioral_fingerprint_completed","fingerprint":{"sample_count":len(req.texts),"token_count":total,"vocabulary_size":unique,"lexical_diversity":round(unique/max(total,1),4),"average_token_length":round(avg,2),"top_terms":[w for w,_ in counts.most_common(8)],"style_summary":"Compact synthetic behavioral fingerprint derived from supplied text."}}

@router.post("/temporal/fingerprint")
def temporal(req: TemporalRequest):
    hours=[]
    for ts in req.timestamps:
        try: hours.append(int(str(ts)[11:13]))
        except Exception: pass
    distribution=Counter(hours)
    peak=distribution.most_common(1)[0][0] if distribution else None
    return {"status":"temporal_fingerprint_completed","fingerprint":{"sample_count":len(req.timestamps),"observed_hours":sorted(set(hours)),"peak_hour_utc":peak,"activity_span_hours":(max(hours)-min(hours)) if hours else 0,"mismatches":[]}}

@router.post("/infrastructure/fingerprint")
def infrastructure(req: InfrastructureRequest):
    values=req.infrastructure+req.domains+req.servers+req.certificates
    return {"status":"infrastructure_fingerprint_completed","fingerprint":{"entity_count":len(values),"unique_entities":len(set(map(str,values))),"infrastructure":req.infrastructure,"domains":req.domains,"servers":req.servers,"certificates":req.certificates,"fingerprint_id":"synthetic_infra_"+str(abs(hash(tuple(map(str,values)))) % 10000000)}}

@router.post("/blockchain/wallet-fingerprint")
def wallet(req: WalletRequest):
    tx=req.transactions
    return {"status":"wallet_fingerprint_completed","fingerprint":{"wallet_id":req.wallet_id,"transaction_count":len(tx),"counterparty_count":0,"counterparties":[],"service_touchpoints":[],"total_in":0,"total_out":0,"net_flow":0}}

@router.post("/actor-pair/analyze")
def pair(req: ActorPairRequest):
    a=req.actor_a; b=req.actor_b
    fields=[("aliases",.95),("infrastructure",.90),("wallets",.88),("campaigns",.90),("writing_style",.82),("activity_pattern",.72)]
    signals=[]; weighted=0; weights=0
    for field,w in fields:
        av={str(x).lower() for x in (a.get(field) or [])} if isinstance(a.get(field),list) else {str(a.get(field)).lower()} if a.get(field) else set()
        bv={str(x).lower() for x in (b.get(field) or [])} if isinstance(b.get(field),list) else {str(b.get(field)).lower()} if b.get(field) else set()
        overlap=bool(av & bv)
        if overlap:
            signals.append({"type":field,"confidence":w,"explanation":f"Shared {field.replace('_',' ')} evidence."}); weighted+=w; weights+=1
    score=round(weighted/max(weights,1),4) if signals else 0
    return {"status":"actor_pair_analysis_completed","actor_a":a.get("actor_id"),"actor_b":b.get("actor_id"),"confidence":score,"fusion_score":score,"signals":signals,"counter_evidence":[],"assessment":"Synthetic intelligence assessment, not confirmed attribution."}
