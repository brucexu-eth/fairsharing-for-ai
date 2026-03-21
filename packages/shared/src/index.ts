// ABI and contract address exports — populated after deployment

export const PROPOSAL_STATUS = ["Pending", "Passed", "Rejected", "Executed"] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUS)[number];

export interface ProposalData {
  id: bigint;
  proposer: string;
  title: string;
  summary: string;
  proofURI: string;
  proofHash: string;
  requestedReward: bigint;
  yesVotes: bigint;
  noVotes: bigint;
  status: ProposalStatus;
  createdAt: bigint;
}

export interface AgentProfile {
  address: string;
  name: string;
  strategy: "conservative" | "neutral" | "aggressive";
}
