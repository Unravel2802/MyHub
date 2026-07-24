import type {
  LeetCodeAttempt,
  LeetCodeDifficulty,
  LeetCodeOutcome,
  LeetCodeProblem,
  LeetCodeStatus,
} from "@/src/modules/leetcode/types";
import { format } from "date-fns";
import { supabase } from "@/src/lib/supabaseClient";

interface LeetCodeProblemRow {
  id: string;
  title: string;
  question_number: number | null;
  difficulty: LeetCodeDifficulty;
  tags: string[];
  notes: string | null;
  status: LeetCodeStatus;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface LeetCodeAttemptRow {
  id: string;
  problem_id: string;
  date: string;
  time_to_solve_min: number | null;
  outcome: LeetCodeOutcome;
  notes: string | null;
  solution_code: string | null;
  solution_language: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

function problemFromRow(row: LeetCodeProblemRow): LeetCodeProblem {
  return {
    id: row.id,
    title: row.title,
    questionNumber: row.question_number,
    difficulty: row.difficulty,
    tags: row.tags,
    notes: row.notes,
    status: row.status,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function attemptFromRow(row: LeetCodeAttemptRow): LeetCodeAttempt {
  return {
    id: row.id,
    problemId: row.problem_id,
    date: row.date,
    timeToSolveMin: row.time_to_solve_min,
    outcome: row.outcome,
    notes: row.notes,
    solutionCode: row.solution_code,
    solutionLanguage: row.solution_language,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Published contract for the LeetCode Tracker (a new module — see migration
// 0033's header for why it's a sibling of Prep Tracker rather than new columns
// on prep_entries). Soft deletes only: `deleted_at`, never a DELETE.

export interface CreateProblemInput {
  title: string;
  questionNumber?: number | null;
  difficulty: LeetCodeDifficulty;
  tags?: string[];
  notes?: string | null;
  status?: LeetCodeStatus;
}

function problemWrite(input: Partial<CreateProblemInput>) {
  return {
    ...(input.title !== undefined && { title: input.title }),
    ...(input.questionNumber !== undefined && {
      question_number: input.questionNumber,
    }),
    ...(input.difficulty !== undefined && { difficulty: input.difficulty }),
    ...(input.tags !== undefined && { tags: input.tags }),
    ...(input.notes !== undefined && { notes: input.notes }),
    ...(input.status !== undefined && { status: input.status }),
  };
}

export async function getProblems(): Promise<LeetCodeProblem[]> {
  const { data, error } = await supabase
    .from("leetcode_problems")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data.map(problemFromRow);
}

export async function createProblem(
  input: CreateProblemInput,
): Promise<LeetCodeProblem> {
  const { data, error } = await supabase
    .from("leetcode_problems")
    .insert(problemWrite(input))
    .select()
    .single();

  if (error) throw error;
  return problemFromRow(data);
}

export async function updateProblem(
  id: string,
  updates: Partial<CreateProblemInput>,
): Promise<LeetCodeProblem> {
  const { data, error } = await supabase
    .from("leetcode_problems")
    .update(problemWrite(updates))
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return problemFromRow(data);
}

export async function deleteProblem(id: string): Promise<void> {
  const { error } = await supabase
    .from("leetcode_problems")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export interface CreateAttemptInput {
  problemId: string;
  // yyyy-MM-dd. Defaults to today when omitted.
  date?: string;
  timeToSolveMin?: number | null;
  outcome: LeetCodeOutcome;
  notes?: string | null;
  // Present together or not at all — the DB rejects one without the other
  // (leetcode_attempts_solution_pair).
  solutionCode?: string | null;
  solutionLanguage?: string | null;
}

function attemptWrite(input: Partial<CreateAttemptInput>) {
  return {
    ...(input.problemId !== undefined && { problem_id: input.problemId }),
    ...(input.date !== undefined && { date: input.date }),
    ...(input.timeToSolveMin !== undefined && {
      time_to_solve_min: input.timeToSolveMin,
    }),
    ...(input.outcome !== undefined && { outcome: input.outcome }),
    ...(input.notes !== undefined && { notes: input.notes }),
    ...(input.solutionCode !== undefined && {
      solution_code: input.solutionCode,
    }),
    ...(input.solutionLanguage !== undefined && {
      solution_language: input.solutionLanguage,
    }),
  };
}

// All attempts, most recent first. The store derives per-problem history from
// this rather than issuing a fetch per problem (see attemptsForProblem in
// leetcodeBoard.ts).
export async function getAttempts(): Promise<LeetCodeAttempt[]> {
  const { data, error } = await supabase
    .from("leetcode_attempts")
    .select("*")
    .is("deleted_at", null)
    .order("date", { ascending: false });

  if (error) throw error;
  return data.map(attemptFromRow);
}

export async function createAttempt(
  input: CreateAttemptInput,
): Promise<LeetCodeAttempt> {
  const { data, error } = await supabase
    .from("leetcode_attempts")
    .insert({
      ...attemptWrite(input),
      date: input.date ?? format(new Date(), "yyyy-MM-dd"),
    })
    .select()
    .single();

  if (error) throw error;
  return attemptFromRow(data);
}

export async function updateAttempt(
  id: string,
  updates: Partial<CreateAttemptInput>,
): Promise<LeetCodeAttempt> {
  const { data, error } = await supabase
    .from("leetcode_attempts")
    .update(attemptWrite(updates))
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return attemptFromRow(data);
}

export async function deleteAttempt(id: string): Promise<void> {
  const { error } = await supabase
    .from("leetcode_attempts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}
