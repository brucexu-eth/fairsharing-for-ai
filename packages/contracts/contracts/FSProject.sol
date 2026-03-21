// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./RewardToken.sol";
import "./interfaces/IERC8004Registry.sol";

/// @title FSProject
/// @notice On-chain contribution tracking and incentive distribution for AI Agent collaboration.
///         Agents submit proposals, peer agents vote, passed proposals auto-mint reward tokens.
contract FSProject {
    string public name;
    address public owner;
    RewardToken public rewardToken;

    /// @notice ERC-8004 identity registry. If address(0), agent identity check is skipped (local dev).
    IERC8004Registry public immutable erc8004Registry;

    mapping(address => bool) public isAgent;
    address[] private _agents;

    enum ProposalStatus {
        Pending,
        Passed,
        Rejected,
        Executed
    }

    struct Proposal {
        uint256 id;
        address proposer;
        string title;
        string summary;
        string proofURI;
        bytes32 proofHash;
        uint256 requestedReward;
        uint256 yesVotes;
        uint256 noVotes;
        ProposalStatus status;
        uint256 createdAt;
    }

    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    // proposalId => voter => hasVoted
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event AgentAdded(address indexed agent);
    event AgentRemoved(address indexed agent);
    event ProposalSubmitted(
        uint256 indexed id,
        address indexed proposer,
        string title,
        uint256 requestedReward
    );
    event ProposalVoted(uint256 indexed id, address indexed voter, bool support);
    event ProposalPassed(uint256 indexed id);
    event ProposalRejected(uint256 indexed id);
    event ProposalExecuted(
        uint256 indexed id,
        address indexed proposer,
        uint256 reward
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "FSProject: not owner");
        _;
    }

    modifier onlyAgent() {
        require(isAgent[msg.sender], "FSProject: not an agent");
        _;
    }

    constructor(
        string memory _name,
        address _owner,
        address _erc8004Registry
    ) {
        name = _name;
        owner = _owner;
        erc8004Registry = IERC8004Registry(_erc8004Registry);
        rewardToken = new RewardToken(
            string.concat(_name, " Reward"),
            "FSR",
            address(this)
        );
    }

    // ─── Agent Management ────────────────────────────────────────────────────

    /// @notice Add an agent to the whitelist.
    ///         If an ERC-8004 registry is configured, the address must have a registered identity.
    function addAgent(address agent) external onlyOwner {
        require(!isAgent[agent], "FSProject: already an agent");
        if (address(erc8004Registry) != address(0)) {
            require(
                erc8004Registry.isRegistered(agent),
                "FSProject: agent not registered in ERC-8004 registry"
            );
        }
        isAgent[agent] = true;
        _agents.push(agent);
        emit AgentAdded(agent);
    }

    function removeAgent(address agent) external onlyOwner {
        require(isAgent[agent], "FSProject: not an agent");
        isAgent[agent] = false;
        for (uint256 i = 0; i < _agents.length; i++) {
            if (_agents[i] == agent) {
                _agents[i] = _agents[_agents.length - 1];
                _agents.pop();
                break;
            }
        }
        emit AgentRemoved(agent);
    }

    function getAgents() external view returns (address[] memory) {
        return _agents;
    }

    function agentCount() external view returns (uint256) {
        return _agents.length;
    }

    // ─── Proposals ───────────────────────────────────────────────────────────

    function submitProposal(
        string calldata title,
        string calldata summary,
        string calldata proofURI,
        bytes32 proofHash,
        uint256 requestedReward
    ) external onlyAgent returns (uint256 id) {
        id = proposalCount++;
        Proposal storage p = proposals[id];
        p.id = id;
        p.proposer = msg.sender;
        p.title = title;
        p.summary = summary;
        p.proofURI = proofURI;
        p.proofHash = proofHash;
        p.requestedReward = requestedReward;
        p.status = ProposalStatus.Pending;
        p.createdAt = block.timestamp;

        emit ProposalSubmitted(id, msg.sender, title, requestedReward);
    }

    // ─── Voting ──────────────────────────────────────────────────────────────

    /// @notice Vote on a pending proposal. Majority (>N/2) triggers immediate state change.
    function vote(uint256 proposalId, bool support) external onlyAgent {
        Proposal storage p = proposals[proposalId];
        require(p.status == ProposalStatus.Pending, "FSProject: not pending");
        require(!hasVoted[proposalId][msg.sender], "FSProject: already voted");

        hasVoted[proposalId][msg.sender] = true;

        if (support) {
            p.yesVotes++;
        } else {
            p.noVotes++;
        }

        emit ProposalVoted(proposalId, msg.sender, support);

        uint256 majority = _agents.length / 2;
        if (p.yesVotes > majority) {
            p.status = ProposalStatus.Passed;
            emit ProposalPassed(proposalId);
        } else if (p.noVotes > majority) {
            p.status = ProposalStatus.Rejected;
            emit ProposalRejected(proposalId);
        }
    }

    // ─── Execution ───────────────────────────────────────────────────────────

    /// @notice Anyone can execute a passed proposal. Mints requestedReward tokens to proposer.
    function executeProposal(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        require(p.status == ProposalStatus.Passed, "FSProject: not passed");

        p.status = ProposalStatus.Executed;
        rewardToken.mint(p.proposer, p.requestedReward);

        emit ProposalExecuted(proposalId, p.proposer, p.requestedReward);
    }

    // ─── Views ───────────────────────────────────────────────────────────────

    function getProposal(
        uint256 proposalId
    )
        external
        view
        returns (
            uint256 id,
            address proposer,
            string memory title,
            string memory summary,
            string memory proofURI,
            bytes32 proofHash,
            uint256 requestedReward,
            uint256 yesVotes,
            uint256 noVotes,
            ProposalStatus status,
            uint256 createdAt
        )
    {
        Proposal storage p = proposals[proposalId];
        return (
            p.id,
            p.proposer,
            p.title,
            p.summary,
            p.proofURI,
            p.proofHash,
            p.requestedReward,
            p.yesVotes,
            p.noVotes,
            p.status,
            p.createdAt
        );
    }
}
