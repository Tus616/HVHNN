import { useState } from 'react';
import apiService from '../services/api';
import { Brain, Play, Copy, Check, ChevronDown, Zap, Shield, Users, BarChart3, Heart, MessageSquare } from 'lucide-react';

const MODES = [
  { id: 'parse_request', label: 'Parse Request', icon: <Zap size={18} />, color: '#10b981' },
  { id: 'fake_detection', label: 'Fake Detection', icon: <Shield size={18} />, color: '#f59e0b' },
  { id: 'match_volunteers', label: 'Match Volunteers', icon: <Users size={18} />, color: '#6366f1' },
  { id: 'predict_demand', label: 'Predict Demand', icon: <BarChart3 size={18} />, color: '#ec4899' },
  { id: 'community_health', label: 'Community Health', icon: <Heart size={18} />, color: '#ef4444' },
  { id: 'response_suggestion', label: 'Response Suggestion', icon: <MessageSquare size={18} />, color: '#06b6d4' },
];

const EXAMPLES = {
  parse_request: {
    mode: "parse_request",
    data: {
      raw_text: "Mujhe B+ blood chahiye urgently, AIIMS Delhi mein patient ICU mein hai. Contact: 9876543210",
      user_id: "user_123",
      community_id: "comm_aiims",
      timestamp: new Date().toISOString()
    }
  },
  fake_detection: {
    mode: "fake_detection",
    data: {
      user_id: "user_456",
      request_text: "PLEASE HELP!! Send money to my Paytm 9999999999. My child is dying and I need urgent funds transferred NOW!!!",
      user_history: { total_requests: 12, flagged_count: 3, avg_response_rate: 0.2, account_age_days: 2 },
      similar_recent_requests: 4,
      verified_status: false,
      device_fingerprint_match: false
    }
  },
  match_volunteers: {
    mode: "match_volunteers",
    data: {
      request: { category: "blood_donation", urgency: "critical", location: { lat: 28.5672, lng: 77.2100 }, blood_group: "B+" },
      volunteers: [
        { volunteer_id: "v1", name: "Priya Patel", skills: ["blood_donation", "medical"], distance_km: 2.5, past_responses: 12, success_rate: 0.92, last_active_mins_ago: 5, blood_group: "B+", is_available: true },
        { volunteer_id: "v2", name: "Amit Kumar", skills: ["food_support", "transport"], distance_km: 4.1, past_responses: 8, success_rate: 0.85, last_active_mins_ago: 15, blood_group: "O+", is_available: true },
        { volunteer_id: "v3", name: "Sneha Gupta", skills: ["blood_donation"], distance_km: 7.2, past_responses: 5, success_rate: 0.78, last_active_mins_ago: 45, blood_group: "B+", is_available: true },
        { volunteer_id: "v4", name: "Rahul Singh", skills: ["medical", "blood_donation"], distance_km: 1.8, past_responses: 20, success_rate: 0.95, last_active_mins_ago: 3, blood_group: "O-", is_available: false }
      ]
    }
  },
  predict_demand: {
    mode: "predict_demand",
    data: {
      community_id: "comm_iitd",
      historical_data: [
        { date: "2026-04-20", category: "blood_donation", count: 3 },
        { date: "2026-04-20", category: "medical_emergency", count: 2 },
        { date: "2026-04-21", category: "food_support", count: 5 },
        { date: "2026-04-21", category: "blood_donation", count: 4 },
        { date: "2026-04-22", category: "transport", count: 2 },
        { date: "2026-04-22", category: "medical_emergency", count: 3 },
        { date: "2026-04-23", category: "food_support", count: 6 }
      ],
      upcoming_events: [{ name: "Blood Donation Camp", date: "2026-04-30", type: "health" }],
      current_month: "April",
      current_active_volunteers: 8
    }
  },
  community_health: {
    mode: "community_health",
    data: {
      community_id: "comm_iitd",
      stats: {
        total_requests_30d: 45,
        resolved_requests: 38,
        avg_resolution_time_hrs: 4.2,
        active_volunteers: 15,
        total_volunteers: 22,
        repeat_helpers: 8,
        fake_requests_flagged: 2,
        top_category: "blood_donation",
        member_count: 150
      }
    }
  },
  response_suggestion: {
    mode: "response_suggestion",
    data: {
      request: { category: "blood_donation", urgency: "critical", summary_en: "B+ blood needed urgently at AIIMS Delhi ICU", location: "AIIMS Delhi", extracted_info: { blood_group: "B+" } },
      volunteer: { name: "Priya Patel", skills: ["blood_donation", "medical"], distance_km: 2.5 }
    }
  }
};

export default function AiPlayground() {
  const [selectedMode, setSelectedMode] = useState('parse_request');
  const [inputJson, setInputJson] = useState(JSON.stringify(EXAMPLES.parse_request, null, 2));
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [elapsed, setElapsed] = useState(null);

  const handleModeChange = (modeId) => {
    setSelectedMode(modeId);
    setInputJson(JSON.stringify(EXAMPLES[modeId], null, 2));
    setResponse(null);
    setError('');
    setElapsed(null);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    setResponse(null);
    setElapsed(null);
    const start = performance.now();

    try {
      const payload = JSON.parse(inputJson);
      const res = await apiService.processAiRequest(payload);
      setResponse(res.data);
      setElapsed(Math.round(performance.now() - start));
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON input. Please check your syntax.');
      } else {
        setError(err.message || 'Request failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentMode = MODES.find(m => m.id === selectedMode);

  return (
    <div className="ai-playground animate-in">
      {/* Header */}
      <div className="ai-pg-header">
        <div className="ai-pg-title-row">
          <div className="ai-pg-icon-wrap" style={{ background: `${currentMode?.color}18`, color: currentMode?.color }}>
            <Brain size={28} />
          </div>
          <div>
            <h1 className="ai-pg-title">Sahay AI Engine</h1>
            <p className="ai-pg-subtitle">Unified JSON processing engine — 6 intelligent modes</p>
          </div>
        </div>
      </div>

      {/* Mode Selector */}
      <div className="ai-pg-modes">
        {MODES.map(mode => (
          <button
            key={mode.id}
            className={`ai-pg-mode-btn ${selectedMode === mode.id ? 'active' : ''}`}
            onClick={() => handleModeChange(mode.id)}
            style={selectedMode === mode.id ? { borderColor: mode.color, background: `${mode.color}12` } : {}}
          >
            <span className="ai-pg-mode-icon" style={{ color: mode.color }}>{mode.icon}</span>
            <span className="ai-pg-mode-label">{mode.label}</span>
          </button>
        ))}
      </div>

      {/* Editor + Response */}
      <div className="ai-pg-workspace">
        {/* Input Panel */}
        <div className="ai-pg-panel">
          <div className="ai-pg-panel-header">
            <span className="ai-pg-panel-tag">INPUT</span>
            <span className="ai-pg-panel-mode" style={{ color: currentMode?.color }}>
              {currentMode?.icon} {currentMode?.label}
            </span>
          </div>
          <textarea
            className="ai-pg-editor"
            value={inputJson}
            onChange={e => setInputJson(e.target.value)}
            spellCheck={false}
          />
          <div className="ai-pg-actions">
            <button
              className="btn btn-primary ai-pg-run-btn"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Processing...</> : <><Play size={16} /> Run Engine</>}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleModeChange(selectedMode)}
            >
              Reset Example
            </button>
          </div>
        </div>

        {/* Response Panel */}
        <div className="ai-pg-panel">
          <div className="ai-pg-panel-header">
            <span className="ai-pg-panel-tag response">RESPONSE</span>
            {elapsed != null && (
              <span className="ai-pg-elapsed">{elapsed}ms</span>
            )}
            {response && (
              <button className="btn btn-secondary btn-sm ai-pg-copy" onClick={() => handleCopy(JSON.stringify(response, null, 2))}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            )}
          </div>

          {error && (
            <div className="ai-pg-error">
              <span>⚠️</span> {error}
            </div>
          )}

          {!response && !error && !loading && (
            <div className="ai-pg-empty">
              <Brain size={48} style={{ opacity: 0.15 }} />
              <p>Run the engine to see the response</p>
            </div>
          )}

          {loading && (
            <div className="ai-pg-empty">
              <div className="spinner" style={{ width: 32, height: 32 }} />
              <p>Sahay AI is processing...</p>
            </div>
          )}

          {response && (
            <pre className="ai-pg-response">{JSON.stringify(response, null, 2)}</pre>
          )}
        </div>
      </div>
    </div>
  );
}
