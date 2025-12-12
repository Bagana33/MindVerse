// In-memory contest storage
import { getUser, addExperience } from './users';
import { addNotification } from './notifications';

export type ContestSubmission = {
  id: string;
  contestId: string;
  userEmail: string;
  userName: string;
  fileUrl: string;
  description?: string;
  votes: string[]; // emails of users who voted
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
  prize: number; // XP prize for winner
  targetGrades: string[]; // ["10", "11", "12"] or [] for all grades
  participants: string[]; // emails of participants
  submissions: ContestSubmission[];
  status: "upcoming" | "active" | "ended";
  createdAt: string;
};

const contests = new Map<string, Contest>();
// Track contests whose winners have been awarded & notified
const awardedContestWinners = new Set<string>();

export function createContest(data: Omit<Contest, "id" | "participants" | "submissions" | "status" | "createdAt">): Contest {
  const now = new Date();
  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  
  let status: "upcoming" | "active" | "ended" = "upcoming";
  if (now >= startDate && now <= endDate) {
    status = "active";
  } else if (now > endDate) {
    status = "ended";
  }

  const contest: Contest = {
    ...data,
    id: `contest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    participants: [],
    submissions: [],
    status,
    createdAt: now.toISOString(),
  };
  
  contests.set(contest.id, contest);
  return contest;
}

export function getAllContests(): Contest[] {
  const now = new Date();
  const allContests = Array.from(contests.values());
  
  // Update status based on dates
  allContests.forEach(contest => {
    const startDate = new Date(contest.startDate);
    const endDate = new Date(contest.endDate);
    
    if (now >= startDate && now <= endDate) {
      contest.status = "active";
    } else if (now > endDate) {
      contest.status = "ended";
    } else {
      contest.status = "upcoming";
    }
  });
  
  // One-time winner award & notification for ended contests
  allContests.forEach(async contest => {
    if (contest.status === "ended" && contest.submissions.length > 0 && !awardedContestWinners.has(contest.id)) {
      const winner = contest.submissions.reduce((prev, current) => current.votes.length > prev.votes.length ? current : prev);
      const user = await getUser(winner.userEmail);
      if (user) {
        await addExperience(winner.userEmail, contest.prize);
      }
      await addNotification(
        winner.userEmail,
        contest.authorEmail,
        "CONTEST_WIN",
        `Та "${contest.title}" уралдаанд яллаа! +${contest.prize} XP 🎉`
      );
      awardedContestWinners.add(contest.id);
    }
  });

  return allContests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getContest(id: string): Contest | undefined {
  const contest = contests.get(id);
  if (!contest) return undefined;
  // Refresh status
  const now = new Date();
  const startDate = new Date(contest.startDate);
  const endDate = new Date(contest.endDate);
  if (now >= startDate && now <= endDate) {
    contest.status = "active";
  } else if (now > endDate) {
    contest.status = "ended";
  } else {
    contest.status = "upcoming";
  }
  if (contest.status === "ended" && contest.submissions.length > 0 && !awardedContestWinners.has(contest.id)) {
    const winner = contest.submissions.reduce((prev, current) => current.votes.length > prev.votes.length ? current : prev);
    // Award winner asynchronously (don't await to avoid blocking)
    (async () => {
      const user = await getUser(winner.userEmail);
    if (user) {
        await addExperience(winner.userEmail, contest.prize);
    }
      await addNotification(
      winner.userEmail,
      contest.authorEmail,
      "CONTEST_WIN",
        `Та "${contest.title}" уралдаанд яллаа! +${contest.prize} XP 🎉`
    );
    awardedContestWinners.add(contest.id);
    })();
  }
  return contest;
}

export function submitToContest(contestId: string, submission: Omit<ContestSubmission, "id" | "contestId" | "votes" | "submittedAt">): ContestSubmission | null {
  const contest = contests.get(contestId);
  if (!contest) return null;

  // Check if contest is active
  const now = new Date();
  const startDate = new Date(contest.startDate);
  const endDate = new Date(contest.endDate);
  if (now < startDate || now > endDate) return null;

  // Check if user already submitted
  if (contest.submissions.some(s => s.userEmail === submission.userEmail)) return null;

  const newSubmission: ContestSubmission = {
    ...submission,
    id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    contestId,
    votes: [],
    submittedAt: new Date().toISOString(),
  };

  contest.submissions.push(newSubmission);
  if (!contest.participants.includes(submission.userEmail)) {
    contest.participants.push(submission.userEmail);
  }

  return newSubmission;
}

export function voteSubmission(contestId: string, submissionId: string, userEmail: string): ContestSubmission | null {
  const contest = contests.get(contestId);
  if (!contest) return null;

  const submission = contest.submissions.find(s => s.id === submissionId);
  if (!submission) return null;

  // Can't vote on own submission
  if (submission.userEmail === userEmail) return null;

  // Check if already voted
  if (submission.votes.includes(userEmail)) {
    // Remove vote
    submission.votes = submission.votes.filter(e => e !== userEmail);
  } else {
    // Add vote
    submission.votes.push(userEmail);
  }

  return submission;
}

export function getWinner(contestId: string): ContestSubmission | null {
  const contest = contests.get(contestId);
  if (!contest || contest.status !== "ended" || contest.submissions.length === 0) return null;

  const winner = contest.submissions.reduce((prev, current) => 
    current.votes.length > prev.votes.length ? current : prev
  );

  return winner;
}

export function updateContest(
  id: string,
  userEmail: string,
  updates: Partial<Pick<Contest, "title" | "description" | "startDate" | "endDate" | "prize" | "targetGrades">>
): Contest | null {
  const contest = contests.get(id);
  if (!contest || contest.authorEmail !== userEmail) return null;

  const nextContest = { ...contest };

  if (updates.title !== undefined) nextContest.title = updates.title.trim();
  if (updates.description !== undefined) nextContest.description = updates.description.trim();
  if (updates.startDate !== undefined) nextContest.startDate = updates.startDate;
  if (updates.endDate !== undefined) nextContest.endDate = updates.endDate;
  if (updates.prize !== undefined) nextContest.prize = updates.prize;
  if (updates.targetGrades !== undefined) nextContest.targetGrades = updates.targetGrades;

  // Recompute status after updates
  const now = new Date();
  const startDate = new Date(nextContest.startDate);
  const endDate = new Date(nextContest.endDate);
  if (now >= startDate && now <= endDate) {
    nextContest.status = "active";
  } else if (now > endDate) {
    nextContest.status = "ended";
  } else {
    nextContest.status = "upcoming";
  }

  contests.set(id, nextContest);
  return nextContest;
}

export function deleteContest(id: string, userEmail: string): boolean {
  const contest = contests.get(id);
  if (!contest || contest.authorEmail !== userEmail) return false;
  contests.delete(id);
  return true;
}

