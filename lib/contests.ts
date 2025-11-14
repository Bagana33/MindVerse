import { addExperience, getUser } from "./users";
import { addNotification } from "./notifications";

export type ContestSubmission = {
  id: string;
  contestId: string;
  userEmail: string;
  userName: string;
  title: string;
  description: string;
  imageUrl?: string;
  submittedAt: string;
  votes: string[]; // emails of users who voted
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
  participants: string[]; // emails of participants
  submissions: ContestSubmission[];
  status: "upcoming" | "active" | "ended";
  createdAt: string;
};

const contests = new Map<string, Contest>();
// Track contests whose winners have been awarded & notified
const awardedContestWinners = new Set<string>();

// Initialize demo contests
function initializeDemoContests() {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 86400000);
  const tomorrow = new Date(now.getTime() + 86400000);
  const nextWeek = new Date(now.getTime() + 7 * 86400000);

  const demoContests: Contest[] = [
    {
      id: "contest-demo-1",
      title: "React Component Challenge",
      description: "Create the most creative React component! Winner gets 100 XP.",
      authorEmail: "teacher@demo.com",
      authorName: "Demo Teacher",
      startDate: yesterday.toISOString(),
      endDate: nextWeek.toISOString(),
      prize: 100,
      participants: ["enkhjin@demo.com", "bat-erdene@demo.com"],
      submissions: [
        {
          id: "sub-1",
          contestId: "contest-demo-1",
          userEmail: "enkhjin@demo.com",
          userName: "Enkhjin T.",
          title: "Animated Button Component",
          description: "A beautiful animated button with hover effects",
          submittedAt: now.toISOString(),
          votes: ["bat-erdene@demo.com"],
        }
      ],
      status: "active",
      createdAt: yesterday.toISOString(),
    },
    {
      id: "contest-demo-2",
      title: "UI Design Contest",
      description: "Design a modern dashboard interface. Prize: 150 XP",
      authorEmail: "teacher@demo.com",
      authorName: "Demo Teacher",
      startDate: tomorrow.toISOString(),
      endDate: new Date(tomorrow.getTime() + 7 * 86400000).toISOString(),
      prize: 150,
      participants: [],
      submissions: [],
      status: "upcoming",
      createdAt: now.toISOString(),
    }
  ];

  demoContests.forEach(contest => {
    contests.set(contest.id, contest);
  });
}

initializeDemoContests();

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
  allContests.forEach(contest => {
    if (contest.status === "ended" && contest.submissions.length > 0 && !awardedContestWinners.has(contest.id)) {
      const winner = contest.submissions.reduce((prev, current) => current.votes.length > prev.votes.length ? current : prev);
      const user = getUser(winner.userEmail);
      if (user) {
        addExperience(winner.userEmail, contest.prize);
      }
      addNotification(
        winner.userEmail,
        contest.authorEmail,
        "CONTEST_WIN",
        `Та \"${contest.title}\" уралдаанд яллаа! +${contest.prize} XP 🎉`
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
    const user = getUser(winner.userEmail);
    if (user) {
      addExperience(winner.userEmail, contest.prize);
    }
    addNotification(
      winner.userEmail,
      contest.authorEmail,
      "CONTEST_WIN",
      `Та \"${contest.title}\" уралдаанд яллаа! +${contest.prize} XP 🎉`
    );
    awardedContestWinners.add(contest.id);
  }
  return contest;
}

export function submitToContest(contestId: string, submission: Omit<ContestSubmission, "id" | "contestId" | "votes" | "submittedAt">): ContestSubmission | null {
  const contest = contests.get(contestId);
  if (!contest) return null;

  // Check if contest is active
  if (contest.status !== "active") return null;

  // Check if user already submitted
  const existingSubmission = contest.submissions.find(s => s.userEmail === submission.userEmail);
  if (existingSubmission) return null;

  const newSubmission: ContestSubmission = {
    ...submission,
    id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    contestId,
    votes: [],
    submittedAt: new Date().toISOString(),
  };

  contest.submissions.push(newSubmission);
  
  // Add to participants if not already there
  if (!contest.participants.includes(submission.userEmail)) {
    contest.participants.push(submission.userEmail);
  }

  contests.set(contestId, contest);
  return newSubmission;
}

export function voteSubmission(contestId: string, submissionId: string, voterEmail: string): boolean {
  const contest = contests.get(contestId);
  if (!contest) return false;

  const submission = contest.submissions.find(s => s.id === submissionId);
  if (!submission) return false;

  // Can't vote for own submission
  if (submission.userEmail === voterEmail) return false;

  const voteIndex = submission.votes.indexOf(voterEmail);
  if (voteIndex > -1) {
    // Remove vote
    submission.votes.splice(voteIndex, 1);
  } else {
    // Add vote
    submission.votes.push(voterEmail);
  }

  contests.set(contestId, contest);
  return true;
}

export function getWinner(contestId: string): ContestSubmission | null {
  const contest = contests.get(contestId);
  if (!contest || contest.status !== "ended") return null;

  if (contest.submissions.length === 0) return null;

  // Find submission with most votes
  const winner = contest.submissions.reduce((prev, current) => {
    return current.votes.length > prev.votes.length ? current : prev;
  });

  return winner;
}

export function deleteContest(id: string, userEmail: string): boolean {
  const contest = contests.get(id);
  if (!contest || contest.authorEmail !== userEmail) return false;
  
  contests.delete(id);
  return true;
}
