import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { apiClient } from '@/api/apiClient';

export default function BillingSection({ appointment, onSaved }) {
  const qc = useQueryClient();
  const [state, setState] = useState({
    team_approved: !!appointment.team_approved,
    team_paid: !!appointment.team_paid,
    team_approve_note: appointment.team_approve_note || '',
    approved_for_billing: !!appointment.approved_for_billing,
    client_charge_amount:
      appointment.client_charge_amount != null ? String(appointment.client_charge_amount) : '',
    client_billed: !!appointment.client_billed,
    client_paid: !!appointment.client_paid,
    client_bill_note: appointment.client_bill_note || '',
    client_approval_note: appointment.client_approval_note || '',
  });

  const update = (patch) => setState((s) => ({ ...s, ...patch }));

  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        team_approved: state.team_approved,
        team_paid: state.team_paid,
        team_approve_note: state.team_approve_note || null,
        approved_for_billing: state.approved_for_billing,
        client_charge_amount:
          state.client_charge_amount === '' ? null : Number(state.client_charge_amount),
        client_billed: state.client_billed,
        client_paid: state.client_paid,
        client_bill_note: state.client_bill_note || null,
        client_approval_note: state.client_approval_note || null,
      };
      return apiClient.setAdminPayout(appointment.id, body);
    },
    onSuccess: (data) => {
      toast.success('Billing updated');
      qc.invalidateQueries({ queryKey: ['appointment', appointment.id] });
      qc.invalidateQueries({ queryKey: ['appointment-history', appointment.id] });
      onSaved?.(data.appointment);
    },
    onError: (err) => {
      const code = err?.payload?.error;
      const message = err?.payload?.message;
      if (code === 'billing_amount_required') {
        toast.error('Set a billing amount before approving for billing.');
      } else if (code === 'must_be_approved_first') {
        toast.error('Lead must be approved for billing before it can be charged.');
      } else if (code === 'must_be_charged_first') {
        toast.error('Lead must be charged before it can be collected.');
      } else {
        toast.error(message || code || err.message || 'Failed to save billing');
      }
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Billing &amp; payout</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Team payout
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="ta"
              checked={state.team_approved}
              onCheckedChange={(v) => update({ team_approved: !!v })}
            />
            <Label htmlFor="ta">Team payout approved</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="tp"
              checked={state.team_paid}
              onCheckedChange={(v) => update({ team_paid: !!v })}
            />
            <Label htmlFor="tp">Paid to team</Label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tan">Team note</Label>
            <Input
              id="tan"
              value={state.team_approve_note}
              onChange={(e) => update({ team_approve_note: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2 pt-3 border-t">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Client billing
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="ab"
              checked={state.approved_for_billing}
              onCheckedChange={(v) => update({ approved_for_billing: !!v })}
            />
            <Label htmlFor="ab">Approved for billing</Label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="amt">Billing amount</Label>
            <Input
              id="amt"
              type="number"
              min="0"
              step="0.01"
              value={state.client_charge_amount}
              onChange={(e) => update({ client_charge_amount: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="cb"
              checked={state.client_billed}
              onCheckedChange={(v) => update({ client_billed: !!v })}
              disabled={!state.approved_for_billing}
            />
            <Label htmlFor="cb" className={!state.approved_for_billing ? 'text-muted-foreground' : ''}>
              Charged to client
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="cp"
              checked={state.client_paid}
              onCheckedChange={(v) => update({ client_paid: !!v })}
              disabled={!state.client_billed}
            />
            <Label htmlFor="cp" className={!state.client_billed ? 'text-muted-foreground' : ''}>
              Collected from client
            </Label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cbn">Bill note (internal)</Label>
            <Input
              id="cbn"
              value={state.client_bill_note}
              onChange={(e) => update({ client_bill_note: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="can">Client approval note</Label>
            <Input
              id="can"
              value={state.client_approval_note}
              onChange={(e) => update({ client_approval_note: e.target.value })}
            />
          </div>
        </div>

        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Save billing'}
        </Button>
      </CardContent>
    </Card>
  );
}
