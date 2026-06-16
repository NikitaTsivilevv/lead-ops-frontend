import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { useAuth } from '@/lib/LeadOpsAuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, Trash2, ArrowLeft } from 'lucide-react';

const TEMPLATE_VARS = [
  { value: '{{first_name}}',       label: 'First name' },
  { value: '{{last_name}}',        label: 'Last name' },
  { value: '{{full_name}}',        label: 'Full name' },
  { value: '{{phone}}',            label: 'Phone' },
  { value: '{{address}}',          label: 'Street address' },
  { value: '{{city}}',             label: 'City' },
  { value: '{{state}}',            label: 'State' },
  { value: '{{zip}}',              label: 'ZIP' },
  { value: '{{appointment_date}}', label: 'Appointment date' },
  { value: '{{appointment_time}}', label: 'Appointment time' },
];

// Roles allowed to create/edit/delete the shared templates. Everyone with comms
// access can still read them (to insert into the SMS composer).
const MANAGER_ROLES = ['admin', 'operations'];

const MAX_BODY = 1600;

export default function SmsTemplates() {
  const { user } = useAuth();
  const canManage = MANAGER_ROLES.includes(user?.role);
  const qc = useQueryClient();

  const [editing, setEditing] = useState(null); // null = closed, {} = new, {…} = edit
  const [toDelete, setToDelete] = useState(null);

  const { data: templates = [], isLoading, isError, error } = useQuery({
    queryKey: ['sms-templates'],
    queryFn: () => apiClient.listSmsTemplates(),
  });

  const save = useMutation({
    mutationFn: ({ id, title, body }) =>
      id ? apiClient.updateSmsTemplate(id, { title, body })
         : apiClient.createSmsTemplate({ title, body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sms-templates'] });
      setEditing(null);
      toast.success('Template saved');
    },
    onError: (e) => toast.error(e.message || 'Failed to save template'),
  });

  const remove = useMutation({
    mutationFn: (id) => apiClient.deleteSmsTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sms-templates'] });
      setToDelete(null);
      toast.success('Template deleted');
    },
    onError: (e) => toast.error(e.message || 'Failed to delete template'),
  });

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="space-y-4 max-w-3xl ">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/conversations" className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Conversations
          </Link>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">SMS Templates</h1>
            <p className="text-sm text-muted-foreground">
              Shared templates available to everyone when sending a text.
            </p>
          </div>
          {canManage && (
            <Button size="sm" onClick={() => setEditing({})}>
              <Plus className="w-4 h-4 mr-1" /> New template
            </Button>
          )}
        </div>

        {isLoading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {isError && (
          <p className="text-destructive text-sm">
            Failed to load templates: {String(error?.message || error)}
          </p>
        )}

        {!isLoading && !isError && (
          <Card>
            <CardContent className="p-0 divide-y">
              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground p-6">No templates yet.</p>
              ) : (
                templates.map((t) => (
                  <div key={t.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{t.title}</div>
                      <div className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                        {t.body}
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="icon" variant="ghost" onClick={() => setEditing(t)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setToDelete(t)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <TemplateDialog
        template={editing}
        onClose={() => setEditing(null)}
        onSave={(payload) => save.mutate(payload)}
        saving={save.isPending}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              “{toDelete?.title}” will be removed for everyone. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => remove.mutate(toDelete.id)}
              disabled={remove.isPending}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TemplateDialog({ template, onClose, onSave, saving }) {
  const open = template !== null;
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [varSelectKey, setVarSelectKey] = useState(0);
  const textareaRef = useRef(null);

  // Sync local state whenever a different template is opened.
  const [syncedId, setSyncedId] = useState(undefined);
  if (open && syncedId !== (template.id ?? 'new')) {
    setSyncedId(template.id ?? 'new');
    setTitle(template.title || '');
    setBody(template.body || '');
  }

  const handleSave = () => {
    if (!title.trim() || !body.trim()) return;
    onSave({ id: template.id, title: title.trim(), body: body.trim() });
  };

  function insertVariable(variable) {
    const el = textareaRef.current;
    if (!el) {
      setBody((prev) => prev + variable);
    } else {
      const start = el.selectionStart ?? body.length;
      const end = el.selectionEnd ?? body.length;
      const next = body.slice(0, start) + variable + body.slice(end);
      setBody(next);
      // Restore cursor after the inserted text
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + variable.length, start + variable.length);
      });
    }
    setVarSelectKey((k) => k + 1);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setSyncedId(undefined); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{template?.id ? 'Edit template' : 'New template'}</DialogTitle>
          <DialogDescription>
            Select a variable to insert it at the cursor position — it will be replaced with the lead's real data when the template is used.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="tmpl-title">Title</Label>
            <Input
              id="tmpl-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Appointment reminder"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tmpl-body">Message</Label>
            <Textarea
              ref={textareaRef}
              id="tmpl-body"
              rows={5}
              maxLength={MAX_BODY}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Hi {{first_name}}, just confirming your appointment…"
            />
            <div className="flex items-center justify-between gap-2">
              <Select key={varSelectKey} onValueChange={insertVariable}>
                <SelectTrigger className="h-7 text-xs w-48">
                  <SelectValue placeholder="Insert variable…" />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_VARS.map((v) => (
                    <SelectItem key={v.value} value={v.value} className="text-xs">
                      <span className="font-mono mr-2 text-muted-foreground">{v.value}</span>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">{body.length}/{MAX_BODY}</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!title.trim() || !body.trim() || saving}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
