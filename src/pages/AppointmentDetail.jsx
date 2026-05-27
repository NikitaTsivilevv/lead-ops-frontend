import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/LeadOpsAuthContext';
import { apiClient } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

// ── Helpers ────────────────────────────────────────────────────────────────

function formatET(isoString, opts) {
  if (!isoString) return '—';
  const defaults = {
    timeZone: 'America/New_York',
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  };
  return new Intl.DateTimeFormat('en-US', { ...defaults, ...opts }).format(new Date(isoString));
}

function formatFullET(isoString) {
  if (!isoString) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long', month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short',
  }).format(new Date(isoString));
}

const QUAL_COLORS = {
  qualified: 'bg-green-100 text-green-800',
  disqualified: 'bg-red-100 text-red-800',
  pending: 'bg-muted text-muted-foreground',
};

const OUTCOME_COLORS = {
  sold: 'bg-green-100 text-green-800',
  'not sold': 'bg-red-100 text-red-800',
  showed: 'bg-blue-100 text-blue-800',
  'no-show': 'bg-gray-100 text-gray-700',
  'reschedule needed': 'bg-orange-100 text-orange-800',
  pending: 'bg-muted text-muted-foreground',
};

function clientDecisionColor(val) {
  if (val === true || val === 'accepted') return 'bg-green-100 text-green-800';
  if (val === false || val === 'rejected') return 'bg-red-100 text-red-800';
  if (val === 'auto-accepted') return 'bg-blue-100 text-blue-800';
  return 'bg-muted text-muted-foreground';
}

function clientDecisionLabel(val) {
  if (val === null || val === undefined) return 'Pending';
  if (val === true || val === 'accepted') return 'Accepted';
  if (val === false || val === 'rejected') return 'Rejected';
  if (val === 'auto-accepted') return 'Auto-accepted';
  return String(val);
}

function Badge({ children, className }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

function YesNo({ value }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
  return <span className={value ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>{value ? 'Yes' : 'No'}</span>;
}

function InfoRow({ label, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-0">
      <span className="text-sm text-muted-foreground sm:w-52 shrink-0">{label}</span>
      <span className="text-sm text-foreground">{children}</span>
    </div>
  );
}

// ── Confirmation stages ────────────────────────────────────────────────────

const STAGES = [
  { key: 'day_before', label: 'Day-before confirmation' },
  { key: 'morning_of', label: 'Morning-of confirmation' },
  { key: '2h_before',  label: '2-hour confirmation' },
];

const CONF_STATUSES = ['pending', 'confirmed', 'failed', 'reschedule'];

function buildConfRows(confirmations = []) {
  const map = {};
  confirmations.forEach(c => { map[c.stage] = c; });
  return STAGES.map(s => ({
    stage: s.key,
    label: s.label,
    status: map[s.key]?.status || 'pending',
    note: map[s.key]?.note || '',
    confirmed_at: map[s.key]?.confirmed_at || null,
  }));
}

// ── Main component ─────────────────────────────────────────────────────────

export default function AppointmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [appt, setAppt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  // Qualification panel state
  const [qualValue, setQualValue] = useState('');
  const [qualNote, setQualNote] = useState('');
  const [qualSaving, setQualSaving] = useState(false);

  // Confirmations state — rows driven by confirmations array
  const [confRows, setConfRows] = useState(buildConfRows([]));
  const [confSaving, setConfSaving] = useState({}); // { [stage]: bool }

  // Client decision panel state
  const [cdCloser, setCdCloser] = useState('');
  const [cdSaving, setCdSaving] = useState(false);
  const [cdError, setCdError] = useState('');
  const [cdForbidden, setCdForbidden] = useState(false);

  // Outcome panel state
  const [ocOutcome, setOcOutcome] = useState('');
  const [ocNoShowReason, setOcNoShowReason] = useState('');
  const [ocSaleAmount, setOcSaleAmount] = useState('');
  const [ocItemsSold, setOcItemsSold] = useState('');
  const [ocMeetingNotes, setOcMeetingNotes] = useState('');
  const [ocSalesNotes, setOcSalesNotes] = useState('');
  const [ocNeedReschedule, setOcNeedReschedule] = useState(false);
  const [ocSaving, setOcSaving] = useState(false);
  const [ocError, setOcError] = useState('');

  // Redistribute panel state
  const [rdTargetClient, setRdTargetClient] = useState('');
  const [rdReason, setRdReason] = useState('');
  const [rdSaving, setRdSaving] = useState(false);
  const [rdError, setRdError] = useState('');

  // Admin payout panel state
  const [paTeamApproved, setPaTeamApproved] = useState(false);
  const [paTeamPaid, setPaTeamPaid] = useState(false);
  const [paApproveNote, setPaApproveNote] = useState('');
  const [paSaving, setPaSaving] = useState(false);
  const [paError, setPaError] = useState('');

  // TODO: replace with GET /api/clients once the endpoint is exposed.
  const CLIENT_OPTIONS = [
    { id: 1, name: 'Guy Green Constructions' },
  ];

  const canEdit = user?.role !== 'client';
  const showPanels = ['admin', 'operations', 'confirmation'].includes(user?.role);
  const showClientDecision = ['admin', 'operations', 'client'].includes(user?.role);

  const loadAppt = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const data = await apiClient.getAppointment(id);
      const a = data?.appointment || data;
      setAppt(a);
      setQualValue(a.qualification && a.qualification !== 'pending' ? a.qualification : '');
      setQualNote(a.qualification_note || '');
      setCdCloser(a.assigned_closer || '');
      // Outcome pre-population
      if (a.outcome && a.outcome !== 'pending') {
        setOcOutcome(a.outcome);
        setOcNoShowReason(a.no_show_reason || '');
        setOcSaleAmount(a.sale_amount != null ? String(a.sale_amount) : '');
        setOcItemsSold(a.items_sold || '');
        setOcMeetingNotes(a.meeting_notes || '');
        setOcSalesNotes(a.sales_notes || '');
        setOcNeedReschedule(!!a.need_reschedule);
      }
      // Admin payout pre-population
      setPaTeamApproved(!!a.team_approved);
      setPaTeamPaid(!!a.team_paid);
      setPaApproveNote(a.team_approve_note || '');
      // confirmations may or may not be side-loaded
      setConfRows(buildConfRows(a.confirmations || []));
    } catch (err) {
      if (err.status === 404) setNotFound(true);
      else if (err.status === 403) setCdForbidden(true);
      else setError(err.message || 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadAppt(); }, [loadAppt]);

  // ── Qualification save ───────────────────────────────────────────────────
  const saveQualification = async () => {
    if (!qualValue) return;
    setQualSaving(true);
    try {
      await apiClient.setQualification(id, { qualification: qualValue, qualification_note: qualNote });
      await loadAppt();
      toast.success('Qualification saved');
    } finally {
      setQualSaving(false);
    }
  };

  // ── Confirmation save ────────────────────────────────────────────────────
  const saveConfirmation = async (stage, status, note) => {
    setConfSaving(s => ({ ...s, [stage]: true }));
    try {
      const result = await apiClient.addConfirmation(id, { stage, status, note });
      // backend returns full confirmations list
      const list = Array.isArray(result) ? result : (result?.confirmations || []);
      if (list.length > 0) setConfRows(buildConfRows(list));
      else await loadAppt();
      toast.success('Confirmation saved');
    } finally {
      setConfSaving(s => ({ ...s, [stage]: false }));
    }
  };

  const updateConfRow = (stage, field, value) => {
    setConfRows(rows => rows.map(r => r.stage === stage ? { ...r, [field]: value } : r));
  };

  // ── Client decision actions ──────────────────────────────────────────────
  const acceptAppointment = async () => {
    setCdError('');
    setCdSaving(true);
    try {
      await apiClient.setClientDecision(id, { decision: 'accepted', assigned_closer: cdCloser || null });
      await loadAppt();
      toast.success('Appointment accepted');
    } catch (err) {
      if (err.status === 403) setCdForbidden(true);
      else setCdError(err.message || 'Failed to save.');
    } finally {
      setCdSaving(false);
    }
  };

  const rejectAppointment = async () => {
    if (!window.confirm('Reject this appointment? It can be redistributed to another client.')) return;
    setCdError('');
    setCdSaving(true);
    try {
      await apiClient.setClientDecision(id, { decision: 'rejected' });
      await loadAppt();
      toast.success('Appointment rejected');
    } catch (err) {
      if (err.status === 403) setCdForbidden(true);
      else setCdError(err.message || 'Failed to save.');
    } finally {
      setCdSaving(false);
    }
  };

  const saveCloser = async () => {
    setCdError('');
    setCdSaving(true);
    try {
      await apiClient.setClientDecision(id, { decision: 'accepted', assigned_closer: cdCloser || null });
      await loadAppt();
      toast.success('Closer updated');
    } catch (err) {
      if (err.status === 403) setCdForbidden(true);
      else setCdError(err.message || 'Failed to save.');
    } finally {
      setCdSaving(false);
    }
  };

  // ── Outcome save ────────────────────────────────────────────────────────
  const saveOutcome = async () => {
    setOcError('');
    setOcSaving(true);
    try {
      await apiClient.setOutcome(id, {
        outcome: ocOutcome,
        no_show_reason: ocOutcome === 'no_show' ? (ocNoShowReason || null) : null,
        sale_amount: ocOutcome === 'sold' && ocSaleAmount !== '' ? Number(ocSaleAmount) : null,
        items_sold: ocOutcome === 'sold' && ocItemsSold ? ocItemsSold : null,
        meeting_notes: ocMeetingNotes || null,
        sales_notes: ocSalesNotes || null,
        need_reschedule: ocNeedReschedule,
      });
      await loadAppt();
      toast.success('Outcome saved');
    } catch (err) {
      setOcError(err.message || 'Failed to save.');
    } finally {
      setOcSaving(false);
    }
  };

  // ── Redistribute ─────────────────────────────────────────────────────────
  const redistribute = async () => {
    if (!window.confirm('Move this appointment to the selected client? The new client will need to accept it again.')) return;
    setRdError('');
    setRdSaving(true);
    try {
      await apiClient.redistribute(id, {
        to_client_id: Number(rdTargetClient),
        reason: rdReason || null,
      });
      await loadAppt();
      toast.success('Appointment redistributed');
    } catch (err) {
      setRdError(err.message || 'Failed to redistribute.');
    } finally {
      setRdSaving(false);
    }
  };

  // ── Admin payout save ────────────────────────────────────────────────────
  const saveAdminPayout = async () => {
    setPaError('');
    setPaSaving(true);
    try {
      await apiClient.setAdminPayout(id, {
        team_approved: paTeamApproved,
        team_paid: paTeamPaid,
        team_approve_note: paApproveNote || null,
      });
      await loadAppt();
      toast.success('Payout updated');
    } catch (err) {
      setPaError(err.message || 'Failed to save.');
    } finally {
      setPaSaving(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">This appointment does not exist or you don't have access.</p>
          <Button variant="outline" onClick={() => navigate('/leads')}>Back to Leads</Button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="space-y-3 text-center">
          <div className="rounded-lg bg-destructive/10 text-destructive text-sm px-4 py-3">{error}</div>
          <Button variant="outline" onClick={loadAppt}>Retry</Button>
        </div>
      </div>
    );
  }

  const qualColor = QUAL_COLORS[appt.qualification?.toLowerCase()] || QUAL_COLORS.pending;
  const outcomeColor = OUTCOME_COLORS[appt.outcome?.toLowerCase()] || OUTCOME_COLORS.pending;
  const showOutcome = ['admin', 'operations', 'client'].includes(user?.role);
  const apptPast = appt.appointment_at ? new Date(appt.appointment_at) < new Date() : false;
  const isRejected = appt.client_decision === 'rejected' || appt.client_decision === false;

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-[960px] mx-auto space-y-6">

        {/* Top bar */}
        <div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex flex-wrap items-start gap-3">
            <h1 className="text-2xl font-semibold text-foreground">{appt.prospect_name || 'Untitled'}</h1>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge className={qualColor}>
                <span className="text-[10px] uppercase tracking-wide opacity-70 mr-1.5">Qualification</span>
                {appt.qualification || 'pending'}
              </Badge>
              <Badge className={clientDecisionColor(appt.client_decision)}>
                <span className="text-[10px] uppercase tracking-wide opacity-70 mr-1.5">Decision</span>
                {clientDecisionLabel(appt.client_decision)}
              </Badge>
              <Badge className={outcomeColor}>
                <span className="text-[10px] uppercase tracking-wide opacity-70 mr-1.5">Outcome</span>
                {(appt.outcome || 'pending').replace(/_/g, ' ')}
              </Badge>
            </div>
          </div>
        </div>

        {/* Lead info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Lead info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="Appointment">{formatFullET(appt.appointment_at)}</InfoRow>
            <InfoRow label="Address">{appt.address || '—'}</InfoRow>
            <InfoRow label="Renovations">
              {Array.isArray(appt.renovation_items) && appt.renovation_items.length > 0
                ? <span className="flex flex-wrap gap-1">
                    {appt.renovation_items.map(r => (
                      <span key={r} className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs">{r}</span>
                    ))}
                  </span>
                : '—'}
            </InfoRow>

            <div className="pt-1 border-t border-border" />

            <InfoRow label="Homeowner?"><YesNo value={appt.q_homeowner} /></InfoRow>
            <InfoRow label="Mortgage current?"><YesNo value={appt.q_mortgage_current} /></InfoRow>
            <InfoRow label="Taxes paid (3y)?"><YesNo value={appt.q_taxes_paid_3y} /></InfoRow>
            <InfoRow label="Bankruptcy (3y)?"><YesNo value={appt.q_bankruptcy_3y} /></InfoRow>
            <InfoRow label="Reverse mortgage?"><YesNo value={appt.q_reverse_mortgage} /></InfoRow>
            <InfoRow label="Credit score">
              {appt.credit_score_band
                ? appt.credit_score_band.charAt(0).toUpperCase() + appt.credit_score_band.slice(1) + ' 650'
                : '—'}
            </InfoRow>
            <InfoRow label="Avg. utility bill">{appt.utility_bill_raw || '—'}</InfoRow>

            <div className="pt-1 border-t border-border" />

            <InfoRow label="Phone">{appt.phone || '—'}</InfoRow>
            <InfoRow label="Agent">{appt.agent_id ? `#${appt.agent_id}` : '—'}</InfoRow>
            <InfoRow label="Campaign source">{appt.campaign_source || '—'}</InfoRow>
            {appt.recording_url && (
              <InfoRow label="Recording">
                <a href={appt.recording_url} target="_blank" rel="noopener noreferrer"
                   className="text-primary underline-offset-4 hover:underline text-sm">
                  Listen to recording
                </a>
              </InfoRow>
            )}
          </CardContent>
        </Card>

        {/* Qualification panel */}
        {showPanels && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <CardTitle className="text-base">Qualification</CardTitle>
                <Badge className={qualColor}>{appt.qualification || 'pending'}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup value={qualValue} onValueChange={setQualValue} className="flex gap-6">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="qualified" id="q-qualified" />
                  <Label htmlFor="q-qualified" className="font-normal cursor-pointer">Qualified</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="disqualified" id="q-disqualified" />
                  <Label htmlFor="q-disqualified" className="font-normal cursor-pointer">Disqualified</Label>
                </div>
              </RadioGroup>
              <Textarea
                placeholder="Why qualified or disqualified — optional"
                value={qualNote}
                onChange={e => setQualNote(e.target.value)}
                className="h-20 resize-none"
              />
              <Button
                onClick={saveQualification}
                disabled={!qualValue || qualSaving || !canEdit}
                size="sm"
              >
                {qualSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Client decision panel */}
        {showClientDecision && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <CardTitle className="text-base">Client decision</CardTitle>
                <Badge className={clientDecisionColor(appt.client_decision)}>
                  {clientDecisionLabel(appt.client_decision)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {cdForbidden ? (
                <p className="text-sm text-muted-foreground">You don't have access to this appointment.</p>
              ) : (
                <>
                  {cdError && (
                    <div className="rounded-lg bg-destructive/10 text-destructive text-sm px-4 py-3">{cdError}</div>
                  )}

                  {/* Pending state */}
                  {(!appt.client_decision || appt.client_decision === 'pending') && (
                    <div className="space-y-3">
                      <Input
                        placeholder="Assigned closer (optional)"
                        value={cdCloser}
                        onChange={e => setCdCloser(e.target.value)}
                        className="max-w-xs"
                      />
                      <div className="flex gap-3">
                        <Button disabled={cdSaving} onClick={acceptAppointment}>
                          {cdSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Accept appointment'}
                        </Button>
                        <Button
                          variant="outline"
                          className="text-destructive border-destructive/40 hover:bg-destructive/10"
                          disabled={cdSaving}
                          onClick={rejectAppointment}
                        >
                          Reject appointment
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Accepted / auto-accepted state */}
                  {(appt.client_decision === 'accepted' || appt.client_decision === 'auto-accepted' || appt.client_decision === true) && (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Closer: <span className="text-foreground font-medium">{appt.assigned_closer || 'Not assigned'}</span>
                      </p>
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Assigned closer"
                          value={cdCloser}
                          onChange={e => setCdCloser(e.target.value)}
                          className="h-8 max-w-xs"
                        />
                        <Button size="sm" className="h-8" disabled={cdSaving} onClick={saveCloser}>
                          {cdSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive h-7 px-0"
                        disabled={cdSaving}
                        onClick={rejectAppointment}
                      >
                        Reject instead
                      </Button>
                    </div>
                  )}

                  {/* Rejected state */}
                  {(appt.client_decision === 'rejected' || appt.client_decision === false) && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        An operations user can redistribute this appointment to another client.
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Outcome panel */}
        {showOutcome && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <CardTitle className="text-base">Outcome</CardTitle>
                <Badge className={outcomeColor}>{appt.outcome || 'pending'}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!apptPast ? (
                <p className="text-sm text-muted-foreground">Outcome can be set after the appointment time.</p>
              ) : isRejected ? (
                <p className="text-sm text-muted-foreground">Cannot set outcome on a rejected appointment.</p>
              ) : (
                <>
                  {ocError && (
                    <div className="rounded-lg bg-destructive/10 text-destructive text-sm px-4 py-3">{ocError}</div>
                  )}
                  <RadioGroup value={ocOutcome} onValueChange={setOcOutcome} className="flex flex-wrap gap-x-6 gap-y-2">
                    {[
                      { value: 'showed', label: 'Showed' },
                      { value: 'no_show', label: 'No-show' },
                      { value: 'sold', label: 'Sold' },
                      { value: 'not_sold', label: 'Not sold' },
                      { value: 'reschedule_needed', label: 'Reschedule needed' },
                    ].map(opt => (
                      <div key={opt.value} className="flex items-center gap-2">
                        <RadioGroupItem value={opt.value} id={`oc-${opt.value}`} />
                        <Label htmlFor={`oc-${opt.value}`} className="font-normal cursor-pointer">{opt.label}</Label>
                      </div>
                    ))}
                  </RadioGroup>

                  {ocOutcome === 'no_show' && (
                    <div className="space-y-1">
                      <Label className="text-sm">Reason <span className="text-destructive">*</span></Label>
                      <Select value={ocNoShowReason} onValueChange={setOcNoShowReason}>
                        <SelectTrigger className="w-56 h-9">
                          <SelectValue placeholder="Select reason" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="homeowner">Homeowner</SelectItem>
                          <SelectItem value="client">Client</SelectItem>
                          <SelectItem value="operational">Operational mistake</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {ocOutcome === 'sold' && (
                    <div className="flex flex-wrap gap-3">
                      <div className="space-y-1">
                        <Label className="text-sm">Sale amount (USD) <span className="text-destructive">*</span></Label>
                        <Input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={ocSaleAmount}
                          onChange={e => setOcSaleAmount(e.target.value)}
                          className="w-40 h-9"
                        />
                      </div>
                      <div className="space-y-1 flex-1 min-w-[180px]">
                        <Label className="text-sm">Items sold <span className="text-destructive">*</span></Label>
                        <Input
                          placeholder="e.g. Solar, Kitchen"
                          value={ocItemsSold}
                          onChange={e => setOcItemsSold(e.target.value)}
                          className="h-9"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label className="text-sm">Meeting notes</Label>
                    <Textarea
                      placeholder="Optional"
                      value={ocMeetingNotes}
                      onChange={e => setOcMeetingNotes(e.target.value)}
                      className="h-20 resize-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">Sales notes</Label>
                    <Textarea
                      placeholder="Optional"
                      value={ocSalesNotes}
                      onChange={e => setOcSalesNotes(e.target.value)}
                      className="h-20 resize-none"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="oc-reschedule"
                      checked={ocNeedReschedule}
                      onCheckedChange={v => setOcNeedReschedule(!!v)}
                    />
                    <Label htmlFor="oc-reschedule" className="font-normal cursor-pointer text-sm">Reschedule needed</Label>
                  </div>

                  <Button
                    size="sm"
                    disabled={!ocOutcome || ocSaving}
                    onClick={saveOutcome}
                  >
                    {ocSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Redistribute panel */}
        {['admin', 'operations'].includes(user?.role) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Redistribute to another client</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Move this appointment to a different client. The new client's decision will reset to Pending and they will need to accept it. Full history is preserved.
              </p>
              {rdError && (
                <div className="rounded-lg bg-destructive/10 text-destructive text-sm px-4 py-3">{rdError}</div>
              )}
              <div className="space-y-1">
                <Label className="text-sm">Target client</Label>
                {/* TODO: replace with GET /api/clients once the endpoint is exposed. */}
                <Select value={rdTargetClient} onValueChange={setRdTargetClient}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {CLIENT_OPTIONS.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Reason (optional)</Label>
                <Textarea
                  placeholder="Optional"
                  value={rdReason}
                  onChange={e => setRdReason(e.target.value)}
                  className="h-20 resize-none"
                />
              </div>
              <Button
                variant="destructive"
                size="sm"
                disabled={!rdTargetClient || rdSaving || (appt.client_id && Number(rdTargetClient) === appt.client_id)}
                onClick={redistribute}
              >
                {rdSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Redistribute'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Confirmations panel */}
        {showPanels && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Confirmations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {confRows.map(row => (
                <div key={row.stage} className="space-y-2 pb-4 border-b border-border last:border-0 last:pb-0">
                  <p className="text-sm font-medium">{row.label}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={row.status}
                      onValueChange={v => updateConfRow(row.stage, 'status', v)}
                    >
                      <SelectTrigger className="w-36 h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONF_STATUSES.map(s => (
                          <SelectItem key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Note"
                      value={row.note}
                      onChange={e => updateConfRow(row.stage, 'note', e.target.value)}
                      className="h-8 text-sm w-48 flex-1"
                    />
                    <Button
                      size="sm"
                      className="h-8"
                      disabled={confSaving[row.stage] || !canEdit}
                      onClick={() => saveConfirmation(row.stage, row.status, row.note)}
                    >
                      {confSaving[row.stage] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
                    </Button>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {row.confirmed_at ? formatET(row.confirmed_at) : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Admin payout panel */}
        {user?.role === 'admin' && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Admin payout</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {paError && (
                <div className="rounded-lg bg-destructive/10 text-destructive text-sm px-4 py-3">{paError}</div>
              )}
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="pa-team-approved"
                    checked={paTeamApproved}
                    onCheckedChange={v => setPaTeamApproved(!!v)}
                  />
                  <Label htmlFor="pa-team-approved" className="font-normal cursor-pointer text-sm">Approved for team payout</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="pa-team-paid"
                    checked={paTeamPaid}
                    onCheckedChange={v => setPaTeamPaid(!!v)}
                  />
                  <Label htmlFor="pa-team-paid" className="font-normal cursor-pointer text-sm">Paid to team</Label>
                </div>
              </div>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>Approved: <span className={paTeamApproved ? 'text-green-700 font-medium' : 'text-foreground'}>{paTeamApproved ? 'Yes' : 'No'}</span></span>
                <span>Paid: <span className={paTeamPaid ? 'text-green-700 font-medium' : 'text-foreground'}>{paTeamPaid ? 'Yes' : 'No'}</span></span>
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Approval note</Label>
                <Textarea
                  placeholder="Optional"
                  value={paApproveNote}
                  onChange={e => setPaApproveNote(e.target.value)}
                  className="h-20 resize-none"
                />
              </div>
              <Button size="sm" disabled={paSaving} onClick={saveAdminPayout}>
                {paSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
              </Button>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}