import { format } from "date-fns";
import { supabase } from "@/src/lib/supabaseClient";
import type {
  OutreachChannel,
  OutreachEntry,
} from "@/src/modules/outreach/types";

interface OutreachEntryRow {
  id: string;
  contact_name: string | null;
  company_id: string | null;
  channel: OutreachChannel;
  date: string;
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

function fromRow(row: OutreachEntryRow): OutreachEntry {
  return {
    id: row.id,
    contactName: row.contact_name,
    companyId: row.company_id,
    channel: row.channel,
    date: row.date,
    notes: row.notes,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(input: Partial<CreateOutreachEntryInput>) {
  return {
    ...(input.contactName !== undefined && { contact_name: input.contactName }),
    ...(input.companyId !== undefined && { company_id: input.companyId }),
    ...(input.channel !== undefined && { channel: input.channel }),
    ...(input.date !== undefined && { date: input.date }),
    ...(input.notes !== undefined && { notes: input.notes }),
  };
}

// Published contract for the Outreach Log (myhub_plan.md Part A §A.2, §A.3). Soft
// deletes only. See docs/handoff/outreach-log.md for the wiring brief.
//
// No Event Bus type for this module: nothing downstream reacts to a logged
// conversation the way the Dashboard reacts to interview.completed. The
// Dashboard's weekly-cadence panel reads this table directly through
// getEntries, the same "no new repository, read the others' repositories"
// rule Daily Dashboard already follows for its own aggregation.

export interface CreateOutreachEntryInput {
  contactName?: string | null;
  companyId?: string | null;
  channel: OutreachChannel;
  date?: string;
  notes?: string | null;
}

export async function getEntries(): Promise<OutreachEntry[]> {
  const { data, error } = await supabase
    .from("outreach_log")
    .select("*")
    .is("deleted_at", null)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(fromRow);
}

export async function createEntry(
  input: CreateOutreachEntryInput,
): Promise<OutreachEntry> {
  const { data, error } = await supabase
    .from("outreach_log")
    .insert({
      ...toRow(input),
      date: input.date ?? format(new Date(), "yyyy-MM-dd"),
    })
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateEntry(
  id: string,
  updates: Partial<CreateOutreachEntryInput>,
): Promise<OutreachEntry> {
  const { data, error } = await supabase
    .from("outreach_log")
    .update(toRow(updates))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from("outreach_log")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
