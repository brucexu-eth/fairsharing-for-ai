import { expect } from "chai";
import { ethers } from "hardhat";
import { FSProjectFactory, FSProject, RewardToken } from "../typechain-types";

describe("FSProject", () => {
  let factory: FSProjectFactory;
  let project: FSProject;
  let rewardToken: RewardToken;
  let owner: any, agent1: any, agent2: any, agent3: any, stranger: any;

  beforeEach(async () => {
    [owner, agent1, agent2, agent3, stranger] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("FSProjectFactory");
    factory = await Factory.deploy(ethers.ZeroAddress); // skip ERC-8004 checks in tests

    const tx = await factory.connect(owner).createProject("Test Project");
    const receipt = await tx.wait();
    const event = receipt!.logs
      .map((log) => factory.interface.parseLog(log as any))
      .find((e) => e?.name === "ProjectCreated");
    const projectAddress = event!.args.projectAddress;

    project = await ethers.getContractAt("FSProject", projectAddress);
    rewardToken = await ethers.getContractAt(
      "RewardToken",
      await project.rewardToken()
    );

    // Add 3 agents
    await project.connect(owner).addAgent(agent1.address);
    await project.connect(owner).addAgent(agent2.address);
    await project.connect(owner).addAgent(agent3.address);
  });

  describe("submitProposal", () => {
    it("allows an agent to submit a proposal", async () => {
      await expect(
        project.connect(agent1).submitProposal(
          "Built the API",
          "Implemented REST API for the project",
          "https://github.com/example/pr/1",
          ethers.keccak256(ethers.toUtf8Bytes("proof")),
          ethers.parseEther("1000")
        )
      ).to.emit(project, "ProposalSubmitted");
    });

    it("rejects submission from non-agent", async () => {
      await expect(
        project.connect(stranger).submitProposal(
          "title",
          "summary",
          "uri",
          ethers.ZeroHash,
          100n
        )
      ).to.be.revertedWith("FSProject: not an agent");
    });
  });

  describe("vote + execute (majority pass)", () => {
    let proposalId: bigint;

    beforeEach(async () => {
      const tx = await project.connect(agent1).submitProposal(
        "Built the API",
        "Implemented REST API",
        "https://github.com/example/pr/1",
        ethers.ZeroHash,
        ethers.parseEther("1000")
      );
      const receipt = await tx.wait();
      const event = receipt!.logs
        .map((log) => project.interface.parseLog(log as any))
        .find((e) => e?.name === "ProposalSubmitted");
      proposalId = event!.args.id;
    });

    it("passes proposal with majority yes votes", async () => {
      await project.connect(agent2).vote(proposalId, true);
      await expect(project.connect(agent3).vote(proposalId, true))
        .to.emit(project, "ProposalPassed")
        .withArgs(proposalId);
    });

    it("rejects proposal with majority no votes", async () => {
      await project.connect(agent2).vote(proposalId, false);
      await expect(project.connect(agent3).vote(proposalId, false))
        .to.emit(project, "ProposalRejected")
        .withArgs(proposalId);
    });

    it("mints reward tokens on execute", async () => {
      await project.connect(agent2).vote(proposalId, true);
      await project.connect(agent3).vote(proposalId, true);

      const rewardAmount = ethers.parseEther("1000");
      await expect(project.connect(stranger).executeProposal(proposalId))
        .to.emit(project, "ProposalExecuted")
        .withArgs(proposalId, agent1.address, rewardAmount);

      expect(await rewardToken.balanceOf(agent1.address)).to.equal(rewardAmount);
    });

    it("prevents double voting", async () => {
      await project.connect(agent2).vote(proposalId, true);
      await expect(
        project.connect(agent2).vote(proposalId, true)
      ).to.be.revertedWith("FSProject: already voted");
    });

    it("cannot execute a rejected proposal", async () => {
      await project.connect(agent2).vote(proposalId, false);
      await project.connect(agent3).vote(proposalId, false);
      await expect(
        project.connect(stranger).executeProposal(proposalId)
      ).to.be.revertedWith("FSProject: not passed");
    });
  });
});
