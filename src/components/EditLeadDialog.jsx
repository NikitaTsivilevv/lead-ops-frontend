import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { apiClient } from '@/api/apiClient';

const RENOVATION_OPTIONS = [
  'Solar', 'Roof', 'HVAC / AC', 'Windows and Doors', 'Kitchen', 'Bathroom', 'Painting', 'Other',
];

function toDatetimeLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditLeadDialog({ lead, open, onOpenChange }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(() => ({
    prospect_name: lead.prospect_name || '',
    address: lead.address || '',
    renovation_items: lead.renovation_items || [],
    other_renovation_text: lead.other_renovation_text || '',
    credit_score_text: lead.credit_score_text || '',
    utility_bill_raw: lead.utility_bill_raw || '',
    phone: lead.phone || '',
    appointment_at: toDatetimeLocal(lead.appointment_at),
    caller_name: lead.caller_name || '',
    caller_notes: lead.caller_notes || '',
  }));

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleRenovation = (opt) => {
    setForm((f) => {
      const items = f.renovation_items.includes(opt)
        ? f.renovation_items.filter((i) => i !== opt)
        : [...f.renovation_items, opt];
      return { ...f, renovation_items: items };
    });
  };

  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        prospect_name: form.prospect_name,
        address: form.address,
        renovation_items: form.renovation_items,
        other_renovation_text: form.renovation_items.includes('Other')
          ? form.other_renovation_text
          : null,
        credit_score_text: form.credit_score_text || null,
        utility_bill_raw: form.utility_bill_raw || null,
        phone: form.phone || null,
        appointment_at: form.appointment_at ? new Date(form.appointment_at).toISOString() : undefined,
        caller_name: form.caller_name,
        caller_notes: form.caller_notes || null,
      };
      // Strip undefined so we don't send 'appointment_at: undefined' as a key
      Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);
      return apiClient.updateMyLead(lead.id, body);
    },
    onSuccess: () => {
      toast.success('Lead updated');
      qc.invalidateQueries({ queryKey: ['my-leads'] });
      onOpenChange(false);
    },
    onError: (err) => {
      const code = err?.payload?.error;
      if (code === 'lead_locked') {
        toast.error('This lead is no longer editable — confirmation team already picked it up.');
        qc.invalidateQueries({ queryKey: ['my-leads'] });
        onOpenChange(false);
      } else {
        toast.error(err?.payload?.message || err?.payload?.error || err.message || 'Failed to save');
      }
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.renovation_items.includes('Other') && !form.other_renovation_text.trim()) {
      toast.error('Please describe the "Other" renovation item.');
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="caller_name">Your name (caller) *</Label>
            <Input id="caller_name" value={form.caller_name} onChange={(e) => setField('caller_name', e.target.value)} required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prospect_name">Prospect name *</Label>
            <Input id="prospect_name" value={form.prospect_name} onChange={(e) => setField('prospect_name', e.target.value)} required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="address">Address *</Label>
            <Input id="address" value={form.address} onChange={(e) => setField('address', e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label>Renovation items *</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {RENOVATION_OPTIONS.map((opt) => (
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
              <div className="space-y-1.5 mt-2">
                <Label htmlFor="other_renovation_text">Specify other renovation item *</Label>
                <Input id="other_renovation_text" value={form.other_renovation_text} onChange={(e) => setField('other_renovation_text', e.target.value)} required />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="credit_score_text">What is your credit score?</Label>
            <Input id="credit_score_text" placeholder="e.g. 680, 650-700" value={form.credit_score_text} onChange={(e) => setField('credit_score_text', e.target.value)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="utility_bill_raw">Average monthly utility bill</Label>
              <Input id="utility_bill_raw" value={form.utility_bill_raw} onChange={(e) => setField('utility_bill_raw', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Prospect phone</Label>
              <Input id="phone" type="tel" value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="appointment_at">Appointment date and time (Eastern Time) *</Label>
            <Input id="appointment_at" type="datetime-local" value={form.appointment_at} onChange={(e) => setField('appointment_at', e.target.value)} required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="caller_notes">General notes</Label>
            <textarea
              id="caller_notes"
              className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.caller_notes}
              onChange={(e) => setField('caller_notes', e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
