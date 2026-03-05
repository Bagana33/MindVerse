import { supabase } from "./supabase";
import { addNotification } from "./notifications";
import { addExperience } from "./users";

export type ContestSubmission = {
  id: string;
  contestId: string;
  userEmail: string;
  userName: string;
  fileUrl: string;
  description?: string;
  votes: string[];
  submittedAt: string;
};

export type Contest = {
  id: string;
  title: string;
  description: string;
  authorEmail: string;
  authorName: string;
  startDate: string;
  endDate: string;
  prize: number;
  targetGrades: string[];
  participants: string[];
  submissions: ContestSubmission[];
  status: "upcoming" | "active" | "ended";
  createdAt: string;
  winnerAwardedAt?: string;
};

type ContestRow = {
  id: string;
  title: string;
  description: string;
  author_email: string;
  author_name: string;
  start_date: string;
  end_date: string;
  prize: number;
  target_grades: string[] | null;
  created_at: string;
  winner_awarded_at?: string | null;
};

type ContestSubmissionRow = {
  id: string;
  contest_id: string;
  student_email: string;
  student_name: string;
  file_url: string;
  description?: string | null;
  submitted_at: string;
};

type ContestVoteRow = {
  submission_id: string;
  voter_email: string;
  contest_id?: string;
};

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function computeContestStatus(startDateIso: string, endDateIso: string): "upcoming" | "active" | "ended" {
  const now = new Date();
  const startDate = new Date(startDateIso);
  const endDate = new Date(endDateIso);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return "upcoming";
  }
  if (now >= startDate && now <= endDate) return "active";
  if (now > endDate) return "ended";
  return "upcoming";
}

function dbToContestBase(row: ContestRow): Contest {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    authorEmail: row.author_email,
    authorName: row.author_name,
    startDate: row.start_date,
    endDate: row.end_date,
    prize: row.prize ?? 0,
    targetGrades: Array.isArray(row.target_grades) ? row.target_grades : [],
    participants: [],
    submissions: [],
    status: computeContestStatus(row.start_date, row.end_date),
    createdAt: row.created_at,
    winnerAwardedAt: row.winner_awarded_at || undefined,
  };
}

function dbToSubmission(row: ContestSubmissionRow, votes: string[]): ContestSubmission {
  return {
    id: row.id,
    contestId: row.contest_id,
    userEmail: row.student_email,
    userName: row.student_name,
    fileUrl: row.file_url,
    description: row.description || undefined,
    votes,
    submittedAt: row.submitted_at,
  };
}

function toFriendlyContestError(error: any): Error {
  const message = String(error?.message || error || "");
  if (
    /Could not find the table 'public\.contests'/i.test(message) ||
    /Could not find the table 'public\.contest_submissions'/i.test(message) ||
    /Could not find the table 'public\.contest_votes'/i.test(message)
  ) {
    return new Error("Contests table үүсээгүй байна. Supabase migration ажиллуулна уу.");
  }
  return error instanceof Error ? error : new Error(message || "Contest query failed");
}

async function loadSubmissionsWithVotes(contestIds: string[]): Promise<{
  submissionsByContest: Map<string, ContestSubmission[]>;
  participantsByContest: Map<string, string[]>;
}> {
  const submissionsByContest = new Map<string, ContestSubmission[]>();
  const participantsByContest = new Map<string, string[]>();

  if (contestIds.length === 0) {
    return { submissionsByContest, participantsByContest };
  }

  const { data: submissionRows, error: submissionError } = await supabase
    .from("contest_submissions")
    .select("*")
    .in("contest_id", contestIds)
    .order("submitted_at", { ascending: false });

  if (submissionError) {
    throw toFriendlyContestError(submissionError);
  }

  const submissions = (submissionRows || []) as ContestSubmissionRow[];
  const submissionIds = submissions.map((s) => s.id);

  let voteRows: ContestVoteRow[] = [];
  if (submissionIds.length > 0) {
    const { data: votes, error: voteError } = await supabase
      .from("contest_votes")
      .select("submission_id,voter_email,contest_id")
      .in("submission_id", submissionIds);
    if (voteError) {
      throw toFriendlyContestError(voteError);
    }
    voteRows = (votes || []) as ContestVoteRow[];
  }

  const votesBySubmission = new Map<string, string[]>();
  for (const vote of voteRows) {
    if (!votesBySubmission.has(vote.submission_id)) {
      votesBySubmission.set(vote.submission_id, []);
    }
    votesBySubmission.get(vote.submission_id)!.push(vote.voter_email);
  }

  const participantSets = new Map<string, Set<string>>();
  for (const row of submissions) {
    const submission = dbToSubmission(row, votesBySubmission.get(row.id) || []);
    if (!submissionsByContest.has(row.contest_id)) {
      submissionsByContest.set(row.contest_id, []);
    }
    submissionsByContest.get(row.contest_id)!.push(submission);

    if (!participantSets.has(row.contest_id)) {
      participantSets.set(row.contest_id, new Set<string>());
    }
    participantSets.get(row.contest_id)!.add(row.student_email);
  }

  for (const [contestId, set] of participantSets.entries()) {
    participantsByContest.set(contestId, Array.from(set));
  }

  return { submissionsByContest, participantsByContest };
}

async function maybeAwardContestWinner(contest: Contest): Promise<void> {
  if (contest.status !== "ended") return;
  if (contest.submissions.length === 0) return;
  if (contest.winnerAwardedAt) return;

  const winner = contest.submissions.reduce((prev, current) =>
    current.votes.length > prev.votes.length ? current : prev
  );

  const awardedAt = new Date().toISOString();
  const { data: lockRows, error: lockError } = await supabase
    .from("contests")
    .update({ winner_awarded_at: awardedAt })
    .eq("id", contest.id)
    .is("winner_awarded_at", null)
    .select("id");

  if (lockError) {
    // Backward compatibility: if older DB doesn't have winner_awarded_at yet, skip auto-award.
    if (!/column .*winner_awarded_at.* does not exist/i.test(String(lockError.message))) {
      console.error("Contest winner lock error:", lockError);
    }
    return;
  }
  if (!lockRows || lockRows.length === 0) return;

  contest.winnerAwardedAt = awardedAt;
  try {
    await addExperience(winner.userEmail, contest.prize);
    await addNotification(
      winner.userEmail,
      contest.authorEmail,
      "CONTEST_WIN",
      `Та "${contest.title}" уралдаанд яллаа! +${contest.prize} XP 🎉`
    );
  } catch (err) {
    console.error("Contest winner award error:", err);
  }
}

async function hydrateContests(rows: ContestRow[]): Promise<Contest[]> {
  const contests = rows.map(dbToContestBase);
  const contestIds = contests.map((c) => c.id);
  const { submissionsByContest, participantsByContest } = await loadSubmissionsWithVotes(contestIds);

  for (const contest of contests) {
    contest.submissions = submissionsByContest.get(contest.id) || [];
    contest.participants = participantsByContest.get(contest.id) || [];
  }

  await Promise.allSettled(contests.map((c) => maybeAwardContestWinner(c)));
  return contests;
}

export async function createContest(
  data: Omit<Contest, "id" | "participants" | "submissions" | "status" | "createdAt" | "winnerAwardedAt">
): Promise<Contest> {
  const contestId = createId("contest");
  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new Error("Огноо буруу байна");
  }
  if (endDate < startDate) {
    throw new Error("Дуусах огноо эхлэх огнооноос өмнө байж болохгүй");
  }

  const { data: contestRow, error } = await supabase
    .from("contests")
    .insert([
      {
        id: contestId,
        title: data.title,
        description: data.description,
        author_email: data.authorEmail,
        author_name: data.authorName,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        prize: data.prize ?? 0,
        target_grades: data.targetGrades || [],
      },
    ])
    .select("*")
    .single();

  if (error || !contestRow) {
    throw toFriendlyContestError(error || new Error("Failed to create contest"));
  }

  return dbToContestBase(contestRow as ContestRow);
}

export async function getAllContests(): Promise<Contest[]> {
  const { data, error } = await supabase
    .from("contests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw toFriendlyContestError(error);
  }
  if (!data) return [];

  return hydrateContests(data as ContestRow[]);
}

export async function getContest(id: string): Promise<Contest | null> {
  const { data, error } = await supabase.from("contests").select("*").eq("id", id).single();
  if (error || !data) return null;

  const hydrated = await hydrateContests([data as ContestRow]);
  return hydrated[0] || null;
}

export async function submitToContest(
  contestId: string,
  submission: Omit<ContestSubmission, "id" | "contestId" | "votes" | "submittedAt">
): Promise<ContestSubmission | null> {
  const contest = await getContest(contestId);
  if (!contest) return null;
  if (contest.status !== "active") return null;

  const { data: existing, error: existingError } = await supabase
    .from("contest_submissions")
    .select("id")
    .eq("contest_id", contestId)
    .eq("student_email", submission.userEmail)
    .maybeSingle();

  if (existingError) {
    throw toFriendlyContestError(existingError);
  }
  if (existing?.id) return null;

  const submissionId = createId("sub");
  const { data, error } = await supabase
    .from("contest_submissions")
    .insert([
      {
        id: submissionId,
        contest_id: contestId,
        student_email: submission.userEmail,
        student_name: submission.userName,
        file_url: submission.fileUrl,
        description: submission.description || null,
      },
    ])
    .select("*")
    .single();

  if (error || !data) {
    throw toFriendlyContestError(error || new Error("Failed to submit contest work"));
  }

  return dbToSubmission(data as ContestSubmissionRow, []);
}

export async function voteSubmission(
  contestId: string,
  submissionId: string,
  userEmail: string
): Promise<ContestSubmission | null> {
  const contest = await getContest(contestId);
  if (!contest || contest.status !== "active") return null;

  const submission = contest.submissions.find((s) => s.id === submissionId);
  if (!submission) return null;
  if (submission.userEmail === userEmail) return null;

  const { data: existingVote, error: voteCheckError } = await supabase
    .from("contest_votes")
    .select("id")
    .eq("contest_id", contestId)
    .eq("submission_id", submissionId)
    .eq("voter_email", userEmail)
    .maybeSingle();

  if (voteCheckError) {
    throw toFriendlyContestError(voteCheckError);
  }

  if (existingVote?.id) {
    const { error: removeError } = await supabase
      .from("contest_votes")
      .delete()
      .eq("id", existingVote.id);
    if (removeError) throw toFriendlyContestError(removeError);
  } else {
    const { error: addError } = await supabase.from("contest_votes").insert([
      {
        contest_id: contestId,
        submission_id: submissionId,
        voter_email: userEmail,
      },
    ]);
    if (addError) throw toFriendlyContestError(addError);
  }

  const refreshed = await getContest(contestId);
  return refreshed?.submissions.find((s) => s.id === submissionId) || null;
}

export async function getWinner(contestId: string): Promise<ContestSubmission | null> {
  const contest = await getContest(contestId);
  if (!contest || contest.status !== "ended" || contest.submissions.length === 0) return null;

  return contest.submissions.reduce((prev, current) =>
    current.votes.length > prev.votes.length ? current : prev
  );
}

export async function updateContest(
  id: string,
  userEmail: string,
  updates: Partial<Pick<Contest, "title" | "description" | "startDate" | "endDate" | "prize" | "targetGrades">>
): Promise<Contest | null> {
  const existing = await getContest(id);
  if (!existing || existing.authorEmail !== userEmail) return null;

  const dbUpdate: any = {};
  if (updates.title !== undefined) dbUpdate.title = updates.title.trim();
  if (updates.description !== undefined) dbUpdate.description = updates.description.trim();
  if (updates.startDate !== undefined) {
    const start = new Date(updates.startDate);
    if (Number.isNaN(start.getTime())) throw new Error("Эхлэх огноо буруу байна");
    dbUpdate.start_date = start.toISOString();
  }
  if (updates.endDate !== undefined) {
    const end = new Date(updates.endDate);
    if (Number.isNaN(end.getTime())) throw new Error("Дуусах огноо буруу байна");
    dbUpdate.end_date = end.toISOString();
  }
  if (updates.prize !== undefined) dbUpdate.prize = Number(updates.prize) || 0;
  if (updates.targetGrades !== undefined) dbUpdate.target_grades = updates.targetGrades;

  if (Object.keys(dbUpdate).length > 0) {
    const { error } = await supabase
      .from("contests")
      .update(dbUpdate)
      .eq("id", id)
      .eq("author_email", userEmail);
    if (error) throw toFriendlyContestError(error);
  }

  return getContest(id);
}

export async function deleteContest(id: string, userEmail: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("contests")
    .delete()
    .eq("id", id)
    .eq("author_email", userEmail)
    .select("id");

  if (error) throw toFriendlyContestError(error);
  return Boolean(data && data.length > 0);
}
