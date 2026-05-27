import React, { useState } from 'react';
import { useAuth } from '@/lib/LeadOpsAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { apiClient } from '@/api/apiClient';

const RENOVATION_OPTIONS = [
  'Solar', 'Roof', 'HVAC / AC', 'Windows and Doors', 'Kitchen', 'Bathroom', 'Painting',
];

const INITIAL = {
  prospect_name: '',
  address: '',
  renovation_items: [],
  q_homeowner: null,
  q_mortgage_current: null,
  q_taxes_paid_3y: null,
  q_bankruptcy_3y: null,
  q_reverse_mortgage: null,
  credit_score_band: null,
  utility_bill_raw: '',
  phone: '',
  appointment_at: '',
  recording_url: '',
  campaign_source: '',
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
  if (err.status === 403 && err.payload?.message?.includes('only callers')) {
    return 'Only callers can submit leads. Sign in with a caller account.';
  }
  if (err.status === 400 && err.payload?.error === 'no_client_assigned') {
    return 'Your account is not assigned to a client. Ask an admin to link your account to a client.';
  }
  if (err.status === 400 && err.payload?.error === 'validation_error') {
    const first = err.payload?.issues?.[0];
    if (first) {
      const path = (first.path || []).join('.');
      return `Validation: ${first.message}${path ? ` (${path})` : ''}`;
    }
    return 'Some fields are invalid. Please check the form.';
  }
  return err.message || 'Failed to submit lead.';
}

export default function Intake() {
  const [form, setForm] = useState(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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

    if (form.renovation_items.length === 0) {
      setError('Please select at least one renovation item.');
      return;
    }

    const body = {
      prospect_name: form.prospect_name,
      address: form.address,
      renovation_items: form.renovation_items,
      q_homeowner: form.q_homeowner,
      q_mortgage_current: form.q_mortgage_current,
      q_taxes_paid_3y: form.q_taxes_paid_3y,
      q_bankruptcy_3y: form.q_bankruptcy_3y,
      q_reverse_mortgage: form.q_reverse_mortgage,
      credit_score_band: form.credit_score_band,
      utility_bill_raw: form.utility_bill_raw || null,
      phone: form.phone || null,
      appointment_at: form.appointment_at ? new Date(form.appointment_at).toISOString() : null,
      recording_url: form.recording_url || null,
      campaign_source: form.campaign_source || null,
    };

    setSubmitting(true);
    try {
      await apiClient.submitLead(body);
      toast.success('Lead submitted');
      setForm(INITIAL);
    } catch (err) {
      if (err.status === 400 && err.payload?.error === 'validation_error') {
        const issues = err.payload.issues;
        const detail = issues
          ? Object.entries(issues).map(([f, m]) => `${f}: ${m}`).join('; ')
          : '';
        setError(`Validation error${detail ? ` — ${detail}` : ''}. ${err.payload.message || ''}`);
      } else {
        setError(err.message || 'Something went wrong.');
      }
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

              {/* Credit score band */}
              <div className="space-y-1.5">
                <Label>Is the credit score over or under 650?</Label>
                <RadioGroup
                  value={form.credit_score_band || ''}
                  onValueChange={v => setField('credit_score_band', v)}
                  className="flex gap-6"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="over" id="credit-over" />
                    <Label htmlFor="credit-over" className="font-normal cursor-pointer">Over</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="under" id="credit-under" />
                    <Label htmlFor="credit-under" className="font-normal cursor-pointer">Under</Label>
                  </div>
                </RadioGroup>
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