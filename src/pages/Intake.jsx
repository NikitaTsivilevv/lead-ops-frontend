import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { useAuth } from '@/lib/LeadOpsAuthContext';
import { apiClient } from '@/api/apiClient';

const RENOVATION_OPTIONS = [
  'Solar', 'Roof', 'HVAC / AC', 'Windows and Doors', 'Kitchen', 'Bathroom', 'Painting', 'Other',
];

const INITIAL = {
  client_id: '',
  caller_name: '',
  prospect_name: '',
  address: '',
  renovation_items: [],
  other_renovation_text: '',
  q_homeowner: null,
  q_mortgage_current: null,
  q_taxes_paid_3y: null,
  q_bankruptcy_3y: null,
  q_reverse_mortgage: null,
  credit_score_text: '',
  utility_bill_raw: '',
  phone: '',
  appointment_at: '',
  recording_url: '',
  campaign_source: '',
  caller_notes: '',
};

function YesNo({ name, label, value, onChange }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <RadioGroup
        value={value === true ? 'yes' : value === false ? 'no' : ''}
        onValueChange={(v) => onChange(name, v === 'yes' ? true : false)}
        className="flex gap-6"
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem value="yes" id={`${name}-yes`} />
          <Label htmlFor={`${name}-yes`} className="font-normal cursor-pointer">Yes</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="no" id={`${name}-no`} />
          <Label htmlFor={`${name}-no`} className="font-normal cursor-pointer">No</Label>
        </div>
      </RadioGroup>
    </div>
  );
}

function explainLeadError(err) {
  const status = err?.status;
  const payload = err?.payload || {};
  const errorCode = payload.error;
  const message = payload.message || '';
  const requiredRoles = payload.required_roles || [];

  // 403 from the requireRole middleware (response shape: { error: 'forbidden', required_roles: [...] })
  if (status === 403 && errorCode === 'forbidden') {
    if (requiredRoles.includes('caller')) {
      return 'Only users with the Caller role can submit leads. Sign in with a caller account.';
    }
    return 'You do not have permission to submit leads.';
  }

  // 403 thrown from inside the service (response shape: { error: 'forbidden', message: '...' })
  if (status === 403 && message.toLowerCase().includes('only callers')) {
    return 'Only users with the Caller role can submit leads. Sign in with a caller account.';
  }

  // 400 no_client_assigned — a caller account exists but has no client_id link
  if (status === 400 && errorCode === 'no_client_assigned') {
    return 'Your account is not assigned to a client. Ask an admin to link your account to a client.';
  }

  // 400 invalid_client — selected client is inactive or does not exist
  if (status === 400 && errorCode === 'invalid_client') {
    return 'Selected client is not available. Pick another client.';
  }

  // 400 validation_error — Zod schema failure on the request body
  if (status === 400 && errorCode === 'validation_error') {
    const first = (payload.issues || [])[0];
    if (first) {
      const path = (first.path || []).join('.');
      return `Validation: ${first.message}${path ? ` (${path})` : ''}`;
    }
    return 'Some fields are invalid. Please check the form.';
  }

  return err?.message || 'Failed to submit lead.';
}

export default function Intake() {
  const { user } = useAuth();
  const [form, setForm] = useState(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [clients, setClients] = useState([]);
  useEffect(() => {
    apiClient.listClients()
      .then((data) => setClients(Array.isArray(data) ? data : (data.clients || [])))
      .catch(() => setClients([]));
  }, []);

  // Default the client picker to the caller's own client (once, when clients load).
  const ownClientId = user?.client_id ?? user?.clientId ?? null;
  useEffect(() => {
    if (!ownClientId) return;
    if (clients.some((c) => String(c.id) === String(ownClientId))) {
      setForm((f) => (f.client_id ? f : { ...f, client_id: String(ownClientId) }));
    }
  }, [clients, ownClientId]);

  // Default the caller name to the logged-in user's full name (editable).
  useEffect(() => {
    if (user?.full_name) {
      setForm((f) => (f.caller_name ? f : { ...f, caller_name: user.full_name }));
    }
  }, [user]);

  const setField = (name, value) => setForm(f => ({ ...f, [name]: value }));

  const toggleRenovation = (option) => {
    setForm(f => {
      const items = f.renovation_items.includes(option)
        ? f.renovation_items.filter(i => i !== option)
        : [...f.renovation_items, option];
      return { ...f, renovation_items: items };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.client_id) {
      setError('Please select a client.');
      return;
    }

    if (form.renovation_items.length === 0) {
      setError('Please select at least one renovation item.');
      return;
    }

    if (form.renovation_items.includes('Other') && !form.other_renovation_text.trim()) {
      setError('Please describe the "Other" renovation item.');
      return;
    }

    const body = {
      caller_name: form.caller_name,
      client_id: form.client_id ? Number(form.client_id) : undefined,
      prospect_name: form.prospect_name,
      address: form.address,
      renovation_items: form.renovation_items,
      other_renovation_text: form.renovation_items.includes('Other')
        ? form.other_renovation_text
        : null,
      q_homeowner: form.q_homeowner,
      q_mortgage_current: form.q_mortgage_current,
      q_taxes_paid_3y: form.q_taxes_paid_3y,
      q_bankruptcy_3y: form.q_bankruptcy_3y,
      q_reverse_mortgage: form.q_reverse_mortgage,
      credit_score_text: form.credit_score_text || null,
      utility_bill_raw: form.utility_bill_raw || null,
      phone: form.phone || null,
      appointment_at: form.appointment_at ? new Date(form.appointment_at).toISOString() : null,
      recording_url: form.recording_url || null,
      campaign_source: form.campaign_source || null,
      caller_notes: form.caller_notes || null,
    };

    setSubmitting(true);
    try {
      await apiClient.submitLead(body);
      toast.success('Lead submitted');
      // Keep the chosen client + caller name for the next lead; clear everything else.
      setForm((f) => ({ ...INITIAL, client_id: f.client_id, caller_name: f.caller_name }));
    } catch (err) {
      setError(explainLeadError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-[720px] mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">New Lead</h1>
          <p className="text-sm text-muted-foreground mt-1">Fill in all required fields and submit.</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Basic info */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="client_id">Client *</Label>
                  <select
                    id="client_id"
                    className="h-9 rounded-md border bg-background px-2 text-sm w-full"
                    value={form.client_id}
                    onChange={e => setField('client_id', e.target.value)}
                    required
                  >
                    <option value="">Select client…</option>
                    {clients.map(c => (
                      <option key={c.id} value={String(c.id)}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="caller_name">Caller *</Label>
                  <Input
                    id="caller_name"
                    value={form.caller_name}
                    onChange={e => setField('caller_name', e.target.value)}
                    placeholder="Setter name"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="prospect_name">Prospect name *</Label>
                  <Input
                    id="prospect_name"
                    value={form.prospect_name}
                    onChange={e => setField('prospect_name', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="address">Address *</Label>
                  <Input
                    id="address"
                    value={form.address}
                    onChange={e => setField('address', e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Renovation items */}
              <div className="space-y-2">
                <Label>Renovation items *</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {RENOVATION_OPTIONS.map(opt => (
                    <div key={opt} className="flex items-center gap-2">
                      <Checkbox
                        id={`reno-${opt}`}
                        checked={form.renovation_items.includes(opt)}
                        onCheckedChange={() => toggleRenovation(opt)}
                      />
                      <Label htmlFor={`reno-${opt}`} className="font-normal cursor-pointer">{opt}</Label>
                    </div>
                  ))}
                </div>
                {form.renovation_items.includes('Other') && (
                  <div className="space-y-1.5 mt-3">
                    <Label htmlFor="other_renovation_text">Specify other renovation item *</Label>
                    <Input
                      id="other_renovation_text"
                      value={form.other_renovation_text}
                      onChange={e => setField('other_renovation_text', e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>

              {/* Qualification questions */}
              <div className="space-y-4">
                <p className="text-sm font-semibold text-foreground uppercase tracking-wide">Qualification</p>
                <YesNo name="q_homeowner" label="Are you the homeowner?" value={form.q_homeowner} onChange={setField} />
                <YesNo name="q_mortgage_current" label="Are you current on your mortgage payments?" value={form.q_mortgage_current} onChange={setField} />
                <YesNo name="q_taxes_paid_3y" label="Have your property taxes been paid on time over the last 3 years?" value={form.q_taxes_paid_3y} onChange={setField} />
                <YesNo name="q_bankruptcy_3y" label="Have you had bankruptcy in the last 3 years?" value={form.q_bankruptcy_3y} onChange={setField} />
                <YesNo name="q_reverse_mortgage" label="Do you have a reverse mortgage on the home?" value={form.q_reverse_mortgage} onChange={setField} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="credit_score_text">What is your credit score?</Label>
                <Input
                  id="credit_score_text"
                  placeholder="e.g. 680, 650-700, Not sure"
                  value={form.credit_score_text}
                  onChange={e => setField('credit_score_text', e.target.value)}
                />
              </div>

              {/* Remaining fields */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="utility_bill_raw">Average monthly utility bill</Label>
                  <Input
                    id="utility_bill_raw"
                    placeholder="e.g. $100, Didn't ask"
                    value={form.utility_bill_raw}
                    onChange={e => setField('utility_bill_raw', e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phone">Prospect phone number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={form.phone}
                    onChange={e => setField('phone', e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="appointment_at">Appointment date and time (Eastern Time) *</Label>
                  <Input
                    id="appointment_at"
                    type="datetime-local"
                    value={form.appointment_at}
                    onChange={e => setField('appointment_at', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="recording_url">Call recording URL</Label>
                  <Input
                    id="recording_url"
                    type="url"
                    placeholder="https://..."
                    value={form.recording_url}
                    onChange={e => setField('recording_url', e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="campaign_source">Campaign / source</Label>
                  <Input
                    id="campaign_source"
                    value={form.campaign_source}
                    onChange={e => setField('campaign_source', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="caller_notes">General notes</Label>
                <textarea
                  id="caller_notes"
                  className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Anything else the team should know"
                  value={form.caller_notes}
                  onChange={e => setField('caller_notes', e.target.value)}
                />
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-lg bg-destructive/10 text-destructive text-sm px-4 py-3">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}